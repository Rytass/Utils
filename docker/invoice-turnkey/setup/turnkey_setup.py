#!/usr/bin/env python3
"""Turnkey 文字選單自動設定。

依畫面上的選項文字操作，不重播按鍵；畫面與該版本的規格（spec/<版本>.json）對不上就中止。
密碼一律從檔案或環境變數讀入，不寫進 log；畫面輸出前會把已知的密碼值遮罩。

指令：
  configure  依設定檔（或單一公司的環境變數）收斂 Turnkey 設定
  verify     唯讀走過規格中的每個選單，逐一比對畫面
  version    印出已安裝的 Turnkey 版本與支援清單

退出碼：0 無變更、10 有變更（需重啟排程，由 entrypoint 處理）、1 失敗、2 有差異但未允許更新。
"""
from __future__ import annotations

import argparse
import dataclasses
import filecmp
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Iterable, Optional

import pexpect

EXIT_OK = 0
EXIT_FAILED = 1
EXIT_DRIFT = 2
EXIT_CHANGED = 10

# 有變更時寫入此檔，entrypoint 據此重啟排程（即使之後因差異或檢測失敗而以非 0 結束）
RESTART_MARKER = Path(os.environ.get('TURNKEY_SETUP_RESTART_MARKER', '/run/turnkey/restart-needed'))

HERE = Path(__file__).resolve().parent
TURNKEY_HOME = Path(os.environ.get('TURNKEY_HOME', '/opt/EINVTurnkey'))
DATA_DIR = Path(os.environ.get('TURNKEY_DATA', '/data'))
USER_CONFIG = DATA_DIR / 'config' / 'einvUserConfig.xml'
PFX_DIR = DATA_DIR / 'cert' / 'PFX'

PROMPT = re.compile(
    r'(或按 m 更新選單: ?|變更設定: ?|變更密碼: ?|再次確認: ?|\(Y/N\)[^\n]*|請輸入使用者帳號: ?|請輸入使用者密碼: ?)$'
)
ITEM = re.compile(r'^\s*([0-9]+|--|[a-z])\.\s+(.*?)\s*$')
ENVIRONMENT_LABELS = {'test': '測試環境', 'production': '正式環境'}
BASIC = ['傳輸設定', '基本設定']
SCHEDULE = ['傳輸設定', '排程設定', '設定排程']
DIRECTORY_SCREENS = ['B2B交換目錄設定', '存證目錄設定', '下載流程目錄設定', '發票配號訊息目錄設定']
DEFAULT_SCHEDULES = ['A:發票上傳', 'D:下載拆封', 'D:下載轉檔', 'A:發票下載']
WEEKDAYS_ALL = '1,2,3,4,5,6,7'


class SetupError(Exception):
    pass


class DriftError(Exception):
    pass


# ---------------------------------------------------------------------------
# 機密與 log


class Secrets:
    """記住讀過的密碼，輸出前一律遮罩（字面比對，不用正規表示式）"""

    def __init__(self) -> None:
        self._values: list[str] = []

    def read(self, name: str, file_path: Optional[str], env_name: Optional[str]) -> str:
        value: Optional[str] = None
        if file_path:
            value = Path(file_path).read_text(encoding='utf-8').rstrip('\r\n')
        elif env_name and os.environ.get(env_name):
            value = os.environ[env_name]
        if not value:
            raise SetupError(f'缺少 {name}：請提供 passwordFile 或環境變數')
        if '\n' in value or '\r' in value:
            raise SetupError(f'{name} 不可包含換行')
        self._values.append(value)
        return value

    def mask(self, text: str) -> str:
        for value in sorted(self._values, key=len, reverse=True):
            text = text.replace(value, '<redacted>')
        return text


SECRETS = Secrets()


def log(message: str) -> None:
    print(f'[turnkey-setup] {SECRETS.mask(message)}', flush=True)


# ---------------------------------------------------------------------------
# 畫面解析


@dataclasses.dataclass(frozen=True)
class Item:
    key: str
    text: str

    @property
    def enabled(self) -> bool:
        return self.key != '--'

    @property
    def marked(self) -> bool:
        return self.text.startswith('*')

    @property
    def bare(self) -> str:
        return self.text.lstrip('*').strip()

    @property
    def name(self) -> str:
        bare = self.bare
        if ': ' in bare:
            return bare.split(': ', 1)[0].strip()
        return bare[:-1].strip() if bare.endswith(':') else bare

    @property
    def value(self) -> str:
        bare = self.bare
        if ': ' in bare:
            return bare.split(': ', 1)[1].strip()
        return ''


@dataclasses.dataclass(frozen=True)
class Screen:
    raw: str
    kind: str  # menu | field | password | confirm | login
    path: str = ''
    items: tuple[Item, ...] = ()
    field: str = ''
    current: str = ''
    messages: tuple[str, ...] = ()

    def find(self, name: str) -> Optional[Item]:
        return next((item for item in self.items if item.name == name or item.bare == name), None)

    def names(self) -> list[str]:
        return [item.name for item in self.items]


NOISE = re.compile(
    r'^(\d\d/\d\d \d\d:\d\d:\d\d\.\d+ |\s+at |\t|gov\.nat\.|HTTP response|Caused by|\s*位置：\d+$)'
)


def parse_screen(raw: str) -> Screen:
    text = raw.replace('\r', '')
    tail_menu = text.rfind('位置:')
    tail_field = text.rfind('設定項目:')
    start = max(tail_menu, tail_field)
    before = text[:start] if start >= 0 else text
    messages = tuple(
        line.strip() for line in before.split('\n') if line.strip() and not NOISE.match(line)
    )
    if '(Y/N)' in text[-200:]:
        return Screen(raw=raw, kind='confirm', messages=messages)
    if start < 0:
        return Screen(raw=raw, kind='login', messages=messages)
    body = text[start:].split('\n')
    items = tuple(Item(m.group(1), m.group(2)) for m in (ITEM.match(line) for line in body[1:]) if m)
    if start == tail_field:
        field = body[0].split(':', 1)[1].strip()
        current = next((l.split(':', 1)[1].strip() for l in body if l.startswith('目前設定:')), '')
        kind = 'password' if re.search(r'(變更密碼|再次確認): ?$', text.rstrip('\n')) else 'field'
        return Screen(raw=raw, kind=kind, field=field, current=current, items=items, messages=messages)
    path = body[0].split(':', 1)[1].strip()
    return Screen(raw=raw, kind='menu', path=path, items=items, messages=messages)


# ---------------------------------------------------------------------------
# 規格（版本綁定）


class Spec:
    def __init__(self, data: dict) -> None:
        self.version: str = data['version']
        self.menus: dict[str, list[str]] = data['menus']
        # 欄位名稱 → {menu: 所在選單路徑, options: 選項清單}
        self.fields: dict[str, dict] = data.get('fields', {})

    @staticmethod
    def load(version: str) -> 'Spec':
        path = HERE / 'spec' / f'{version}.json'
        if not path.exists():
            raise FileNotFoundError(path)
        return Spec(json.loads(path.read_text(encoding='utf-8')))

    @staticmethod
    def supported() -> list[str]:
        def key(version: str) -> tuple:
            return tuple(int(part) if part.isdigit() else part for part in version.split('.'))

        return sorted((p.stem for p in (HERE / 'spec').glob('*.json')), key=key)

    def check_menu(self, screen: Screen) -> None:
        expected = self.menus.get(screen.path)
        if expected is None:
            return
        actual = screen.names()
        if actual != expected:
            raise SetupError(
                f'畫面與 {self.version} 規格不符：{screen.path}\n  預期 {expected}\n  實際 {actual}'
            )

    def check_field(self, screen: Screen) -> None:
        spec = self.fields.get(screen.field)
        if spec is None or not screen.items:
            return
        # 選項會隨既有設定減少（例如已有 A:發票上傳 就不再列出 U:*），只要求都在規格內
        expected = spec['options']
        actual = [item.bare for item in screen.items]
        if any(option not in expected for option in actual):
            raise SetupError(f'選項與 {self.version} 規格不符：{screen.field}\n  預期 {expected}\n  實際 {actual}')


# ---------------------------------------------------------------------------
# 選單驅動


class Menu:
    def __init__(self, command: list[str], login_user: str, login_password: str, timeout: int) -> None:
        self.command = command
        self.login_user = login_user
        self.login_password = login_password
        self.timeout = timeout
        self.child: Optional[pexpect.spawn] = None
        self.screen: Optional[Screen] = None
        self.version = ''
        self.spec: Optional[Spec] = None

    # -- 連線

    def open(self) -> None:
        self.child = pexpect.spawn(
            self.command[0], self.command[1:], cwd=str(TURNKEY_HOME) if TURNKEY_HOME.exists() else None,
            encoding='utf-8', timeout=self.timeout, dimensions=(500, 200), echo=False,
        )
        self._expect(r'請輸入使用者帳號: ?$')
        match = re.search(r'local Turnkey Version: (\S+)', self.child.before or '')
        self.version = match.group(1) if match else ''
        self.child.sendline(self.login_user)
        self._expect(r'請輸入使用者密碼: ?$')
        self.child.sendline(self.login_password)
        self._read()
        if self.screen.kind == 'confirm':
            # 平台有新版時詢問是否更新；容器內一律不更新（升版改換安裝包重建 image）
            self.child.sendline('N')
            self._read()
        if self.screen.kind != 'menu' or self.screen.path != '頂點':
            self._fail('登入失敗或未進入主選單')

    def close(self) -> None:
        if not self.child:
            return
        try:
            for _ in range(10):
                if self.screen and self.screen.kind == 'menu' and self.screen.path == '頂點':
                    break
                self.child.sendline('q')
                self._read(timeout=30)
            self.child.sendline(self._key_of('結束', fallback='5'))
            self.child.expect(pexpect.EOF, timeout=60)
        except Exception:  # noqa: BLE001 結束時已無法挽救，避免 TurnkeyCmd 在 EOF 後空轉
            pass
        finally:
            if self.child.isalive():
                self.child.terminate(force=True)
            self.child = None
            self.screen = None

    def reopen(self) -> None:
        self.close()
        self.open()

    # -- 低階

    def _expect(self, pattern: str, timeout: Optional[int] = None) -> None:
        try:
            self.child.expect(pattern, timeout=timeout or self.timeout)
        except pexpect.TIMEOUT:
            raise SetupError('等待畫面逾時；最後畫面：\n' + SECRETS.mask(self.child.before or '')) from None
        except pexpect.EOF:
            raise SetupError('選單程式提前結束；最後輸出：\n' + SECRETS.mask(self.child.before or '')) from None

    def _read(self, timeout: Optional[int] = None) -> Screen:
        self._expect(PROMPT.pattern, timeout)
        self.screen = parse_screen((self.child.before or '') + (self.child.after or ''))
        if 'Initial SessionFactory creation failed' in self.screen.raw and self.screen.kind != 'menu':
            self._fail('Turnkey 無法連線資料庫')
        if self.spec and self.screen.kind == 'menu':
            self.spec.check_menu(self.screen)
        if self.spec and self.screen.kind == 'field':
            self.spec.check_field(self.screen)
        return self.screen

    def _send(self, text: str) -> Screen:
        self.child.sendline(text)
        return self._read()

    def _fail(self, reason: str) -> None:
        raw = SECRETS.mask(self.screen.raw if self.screen else '')
        raise SetupError(f'{reason}\n----- 畫面 -----\n{raw}\n---------------')

    def _key_of(self, name: str, fallback: Optional[str] = None) -> str:
        item = self.screen.find(name) if self.screen and self.screen.kind == 'menu' else None
        if item and item.enabled:
            return item.key
        if fallback is not None:
            return fallback
        self._fail(f'找不到可選的項目「{name}」')
        return ''

    # -- 導覽

    def top(self) -> None:
        for _ in range(12):
            if self.screen.kind == 'menu' and self.screen.path == '頂點':
                return
            self._send('q')
        self._fail('無法回到主選單')

    def goto(self, names: Iterable[str]) -> Screen:
        self.top()
        path = '頂點'
        for name in names:
            self.select(name)
            path = f'{path}/{name}'
            if self.screen.kind != 'menu' or self.screen.path != path:
                self._fail(f'預期進入「{path}」')
        return self.screen

    def select(self, name: str) -> Screen:
        if self.screen.kind != 'menu':
            self._fail(f'目前不在選單畫面，無法選擇「{name}」')
        return self._send(self._key_of(name))

    def back(self) -> Screen:
        return self._send('q')

    def require_message(self, pattern: str, action: str) -> None:
        if not any(re.search(pattern, message) for message in self.screen.messages):
            self._fail(f'{action}失敗')

    # -- 欄位

    def set_field(self, name: str, value: str) -> None:
        item = self.screen.find(name)
        if item is None or not item.enabled:
            self._fail(f'欄位「{name}」不存在或不可編輯')
        menu_path = self.screen.path
        self.select(name)
        if self.screen.kind != 'field' or self.screen.field != item.name:
            self._fail(f'預期進入欄位「{name}」')
        if self.screen.items:
            option = next((o for o in self.screen.items if o.bare == value), None)
            if option is None:
                hint = '（排程任務會依既有排程增減，請確認新增順序，或刪除排程後依預設順序重建）' if name == '任務' else ''
                self._fail(f'欄位「{name}」沒有選項「{value}」{hint}')
            self._send(option.key)
        else:
            self._send(value)
        if self.screen.kind != 'menu' or self.screen.path != menu_path:
            self._fail(f'設定「{name}」後未回到「{menu_path}」')
        after = self.screen.find(name)
        if after is None or after.value != value:
            self._fail(f'「{name}」設定後的值不是預期值')

    def set_password(self, name: str, value: str) -> None:
        menu_path = self.screen.path
        item = self.screen.find(name)
        if item is None or not item.enabled:
            self._fail(f'欄位「{name}」不存在或不可編輯')
        self.child.sendline(item.key)
        self._expect(r'變更密碼: ?$')
        self.child.sendline(value)
        self._expect(r'再次確認: ?$')
        self.child.sendline(value)
        self._read()
        if self.screen.kind != 'menu' or self.screen.path != menu_path:
            self._fail(f'設定「{name}」後未回到「{menu_path}」')
        if not self.screen.find(name).value.startswith('*'):
            self._fail(f'「{name}」設定後未顯示為已設定')

    def toggle_to(self, name: str, checked: bool) -> None:
        item = self.screen.find(name)
        if item is None:
            self._fail(f'找不到勾選欄位「{name}」')
        if (item.value == '[X]') != checked:
            self.select(name)

    def save(self, action: str) -> None:
        self.select('儲存')
        self.require_message(r'(新增|儲存|修改|更新|編輯)成功', action)

    def list_entries(self, names: Iterable[str]) -> list[Item]:
        screen = self.goto(names)
        return [item for item in screen.items if item.key not in ('q', 'h')]


# ---------------------------------------------------------------------------
# 期望狀態


@dataclasses.dataclass
class Database:
    host: str
    port: str
    name: str
    user: str
    password: str


@dataclasses.dataclass
class Account:
    account: str
    password: str


@dataclasses.dataclass
class Certificate:
    code: str
    pfx_source: str
    password: str

    @property
    def target(self) -> Path:
        return PFX_DIR / f'turnkey-setup-{self.code}.pfx'


@dataclasses.dataclass
class Sender:
    tax_id: str
    certificate: str
    description: str
    account: str
    routing_code: str
    routing_description: str
    storage_agent: bool = False


@dataclasses.dataclass
class Schedule:
    task: str
    interval: str = '00:01'
    weekdays: str = WEEKDAYS_ALL
    enabled: bool = True


@dataclasses.dataclass
class Desired:
    environment: str
    database: Database
    accounts: list[Account]
    certificates: list[Certificate]
    senders: list[Sender]
    schedules: list[Schedule]
    menu_user: str
    menu_password: str
    env_check: str  # required | warn | off


def _secret(entry: dict, name: str, key: str = 'password') -> str:
    return SECRETS.read(name, entry.get(f'{key}File'), entry.get(f'{key}Env'))


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = os.environ.get(name)
    return value if value not in (None, '') else default


def _env_secret(name: str, label: str) -> str:
    return SECRETS.read(label, _env(f'{name}_FILE'), name)


def load_desired(config_file: Optional[str]) -> Desired:
    menu_user = _env('TURNKEY_MENU_USER', 'ADMIN')
    menu_password = SECRETS.read('選單登入密碼', _env('TURNKEY_MENU_PASSWORD_FILE'), 'TURNKEY_MENU_PASSWORD')
    env_check = _env('TURNKEY_SETUP_ENV_CHECK', 'required')
    if config_file:
        return _load_file(config_file, menu_user, menu_password, env_check)
    return _load_env(menu_user, menu_password, env_check)


FILE_KEYS = {'environment', 'database', 'transmitAccounts', 'certificates', 'senders', 'schedules', 'menuUser', 'envCheck'}
FILE_REQUIRED = ('environment', 'database', 'transmitAccounts', 'certificates', 'senders')


def _text(entry: dict, key: str, where: str, default: Optional[str] = None) -> str:
    """識別碼一律要求字串：YAML 會把未加引號的 0001、03374707 解析成（八進位）整數"""
    if key not in entry:
        if default is not None:
            return default
        raise SetupError(f'{where} 缺少 {key}')
    value = entry[key]
    if not isinstance(value, str) or not value:
        raise SetupError(f'{where} 的 {key} 必須是非空字串（YAML 請加引號，例如 "0001"）')
    return value


def _flag(entry: dict, key: str, where: str, default: bool) -> bool:
    value = entry.get(key, default)
    if not isinstance(value, bool):
        raise SetupError(f'{where} 的 {key} 必須是 true 或 false')
    return value


def _list(data: dict, key: str) -> list[dict]:
    value = data[key]
    if not isinstance(value, list) or not all(isinstance(item, dict) for item in value):
        raise SetupError(f'設定檔的 {key} 必須是清單')
    return value


def _load_file(path: str, menu_user: str, menu_password: str, env_check: str) -> Desired:
    text = Path(path).read_text(encoding='utf-8')
    if path.endswith('.json'):
        data = json.loads(text)
    else:
        import yaml  # 只在用 YAML 時需要

        data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise SetupError('設定檔內容必須是物件')
    # 拼錯或漏掉區段會被當成「清單為空」而刪光既有項目，所以一律報錯
    unknown = sorted(set(data) - FILE_KEYS)
    missing = [key for key in FILE_REQUIRED if key not in data]
    if unknown or missing:
        raise SetupError(f'設定檔區段有誤：未知 {unknown}，缺少 {missing}')
    db = data['database']
    if not isinstance(db, dict):
        raise SetupError('設定檔的 database 必須是物件')
    accounts = [
        Account(_text(a, 'account', 'transmitAccounts'), _secret(a, f'傳送帳號 {a.get("account")} 密碼'))
        for a in _list(data, 'transmitAccounts')
    ]
    certificates = [
        Certificate(_text(c, 'code', 'certificates'), _text(c, 'pfxFile', 'certificates'), _secret(c, f'憑證 {c.get("code")} 密碼'))
        for c in _list(data, 'certificates')
    ]
    senders = []
    for entry in _list(data, 'senders'):
        tax_id = _text(entry, 'taxId', 'senders')
        where = f'送方 {tax_id}'
        routing = _text(entry, 'routingCode', where)
        senders.append(Sender(
            tax_id=tax_id,
            certificate=_text(entry, 'certificate', where),
            description=_text(entry, 'description', where, tax_id),
            account=_text(entry, 'transmitAccount', where, tax_id),
            routing_code=routing,
            routing_description=_text(entry, 'routingDescription', where, routing),
            storage_agent=_flag(entry, 'storageAgent', where, False),
        ))
    schedule_entries = _list(data, 'schedules') if 'schedules' in data else [{'task': t} for t in DEFAULT_SCHEDULES]
    schedules = [
        Schedule(
            _text(e, 'task', 'schedules'), _text(e, 'interval', 'schedules', '00:01'),
            _text(e, 'weekdays', 'schedules', WEEKDAYS_ALL), _flag(e, 'enabled', 'schedules', True),
        )
        for e in schedule_entries
    ]
    return _validated(Desired(
        environment=_environment(data.get('environment')),
        database=Database(
            host=str(db['host']), port=str(db.get('port', 5432)), name=str(db['name']), user=str(db['user']),
            password=_secret(db, '資料庫密碼'),
        ),
        accounts=accounts,
        certificates=certificates,
        senders=senders,
        schedules=schedules,
        menu_user=_text(data, 'menuUser', '設定檔', menu_user),
        menu_password=menu_password,
        env_check=_text(data, 'envCheck', '設定檔', env_check),
    ))


def _validated(desired: Desired) -> Desired:
    """送方參照的帳號、憑證必須在設定中；識別碼不得重複"""
    def unique(values: list[str], label: str) -> set[str]:
        duplicated = sorted({v for v in values if values.count(v) > 1})
        if duplicated:
            raise SetupError(f'{label}重複：{duplicated}')
        return set(values)

    accounts = unique([a.account for a in desired.accounts], '傳送帳號')
    certificates = unique([c.code for c in desired.certificates], '憑證代碼')
    unique([s.tax_id for s in desired.senders], '送方統編')
    unique([s.task for s in desired.schedules], '排程任務')
    for sender in desired.senders:
        if sender.account not in accounts:
            raise SetupError(f'送方 {sender.tax_id} 的傳送帳號 {sender.account} 不在 transmitAccounts 中')
        if sender.certificate not in certificates:
            raise SetupError(f'送方 {sender.tax_id} 的憑證 {sender.certificate} 不在 certificates 中')
    if desired.env_check not in ('required', 'warn', 'off'):
        raise SetupError('envCheck（TURNKEY_SETUP_ENV_CHECK）必須是 required、warn 或 off')
    return desired


def _load_env(menu_user: str, menu_password: str, env_check: str) -> Desired:
    tax_id = _env('TURNKEY_SENDER_TAX_ID')
    if not tax_id:
        raise SetupError('沒有設定檔（TURNKEY_SETUP_FILE），也沒有 TURNKEY_SENDER_TAX_ID')
    account = _env('TURNKEY_TRANSMIT_ACCOUNT', tax_id)
    cert_code = _env('TURNKEY_CERT_CODE', '0001')
    routing = _env('TURNKEY_ROUTING_CODE')
    if not routing:
        raise SetupError('缺少 TURNKEY_ROUTING_CODE')
    pfx = _env('TURNKEY_CERT_PFX_FILE')
    if not pfx:
        raise SetupError('缺少 TURNKEY_CERT_PFX_FILE')
    for name in ('TURNKEY_DB_HOST', 'TURNKEY_DB_NAME', 'TURNKEY_DB_USER'):
        if not _env(name):
            raise SetupError(f'缺少 {name}')
    return _validated(Desired(
        environment=_environment(_env('TURNKEY_ENVIRONMENT')),
        database=Database(
            host=_env('TURNKEY_DB_HOST'), port=_env('TURNKEY_DB_PORT', '5432'), name=_env('TURNKEY_DB_NAME'),
            user=_env('TURNKEY_DB_USER'), password=_env_secret('TURNKEY_DB_PASSWORD', '資料庫密碼'),
        ),
        accounts=[Account(account, _env_secret('TURNKEY_TRANSMIT_PASSWORD', '傳送密碼'))],
        certificates=[Certificate(cert_code, pfx, _env_secret('TURNKEY_CERT_PASSWORD', '憑證密碼'))],
        senders=[
            Sender(
                tax_id=tax_id, certificate=cert_code, description=_env('TURNKEY_SENDER_DESCRIPTION', tax_id),
                account=account, routing_code=routing, routing_description=_env('TURNKEY_ROUTING_DESCRIPTION', routing),
            )
        ],
        schedules=[Schedule(task) for task in DEFAULT_SCHEDULES],
        menu_user=menu_user,
        menu_password=menu_password,
        env_check=env_check,
    ))


def _environment(value: Optional[str]) -> str:
    if value not in ENVIRONMENT_LABELS:
        raise SetupError('environment（TURNKEY_ENVIRONMENT）必須明確設為 test 或 production')
    return value


def check_pfx(cert: 'Certificate') -> None:
    """換上 PFX 之前先確認密碼能開啟，避免 Turnkey 拿到打不開的憑證"""
    if not shutil.which('openssl'):
        return
    import subprocess

    errors = []
    # Turnkey 產生的 PFX 可能用舊式加密，OpenSSL 3 需加 -legacy 才讀得到
    for extra in ([], ['-legacy']):
        result = subprocess.run(
            ['openssl', 'pkcs12', '-in', cert.pfx_source, '-noout', '-passin', 'stdin', *extra],
            input=cert.password + '\n', capture_output=True, text=True,
        )
        if result.returncode == 0:
            return
        errors.append(result.stderr.lower())
    if any('mac verify' in error or 'invalid password' in error for error in errors):
        raise SetupError(f'憑證 {cert.code}：PFX 無法以設定的密碼開啟（{cert.pfx_source}）')
    log(f'憑證 {cert.code}：無法以 openssl 預先檢查 PFX，略過檢查')


class _installed_pfx:
    """把 PFX 放到 Turnkey 使用的路徑；選單操作失敗時還原原本的檔案（或移除新放的檔案）"""

    def __init__(self, cert: 'Certificate') -> None:
        self.cert = cert
        self.backup = cert.target.with_suffix('.pfx.bak')

    def __enter__(self) -> None:
        if self.cert.target.exists():
            shutil.copy2(self.cert.target, self.backup)
        tmp = self.cert.target.with_suffix('.pfx.tmp')
        shutil.copyfile(self.cert.pfx_source, tmp)
        os.chmod(tmp, 0o600)
        os.replace(tmp, self.cert.target)

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc_type is not None:
            if self.backup.exists():
                os.replace(self.backup, self.cert.target)
            else:
                self.cert.target.unlink(missing_ok=True)
        else:
            self.backup.unlink(missing_ok=True)
        return False


# ---------------------------------------------------------------------------
# 收斂


class Converger:
    def __init__(self, menu: Menu, desired: Desired, apply_updates: bool, reset_passwords: bool) -> None:
        self.menu = menu
        self.desired = desired
        self.apply_updates = apply_updates
        self.reset_passwords = reset_passwords
        self.changed = False
        self.fresh = False
        self.drift: list[str] = []

    def note_change(self, message: str) -> None:
        if not self.changed:
            try:
                RESTART_MARKER.parent.mkdir(parents=True, exist_ok=True)
                RESTART_MARKER.touch()
            except OSError:
                pass
        self.changed = True
        log(message)

    def differs(self, message: str, fresh_ok: bool = False) -> bool:
        """有差異時：允許更新就回傳 True，否則記錄差異、回傳 False。

        fresh（einvUserConfig.xml 尚未完成資料庫設定）只豁免存在設定檔裡的項目（資料庫連線、執行環境）；
        資料庫裡的送方、帳號、憑證、排程可能是沿用的外部資料庫，修改或刪除一律要 --apply-updates
        """
        if self.apply_updates or (fresh_ok and self.fresh):
            return True
        self.drift.append(message)
        log(f'差異（未更新）：{message}')
        return False

    def run(self) -> None:
        self.database()
        self.environment()
        self.directories()
        # 送方參照帳號與憑證：先刪多餘送方，再新增／更新帳號、憑證、送方，最後才刪多餘的帳號與憑證，
        # 避免刪掉仍被保留送方參照的項目
        self.delete_extra_senders()
        self.accounts()
        self.certificates()
        self.senders()
        self.delete_extra_accounts()
        self.delete_extra_certificates()
        self.schedules()
        if self.drift:
            raise DriftError('\n'.join(self.drift))

    # -- 資料庫

    def database(self) -> None:
        d = self.desired.database
        screen = self.menu.goto(BASIC + ['資料庫連線設定'])
        current = {item.name: item.value for item in screen.items}
        wanted = {'資料庫類型': 'PostgreSQL', '資料庫位址': d.host, '資料庫埠號': d.port, '資料庫名稱': d.name, '資料庫帳號': d.user}
        configured = 'true' in _config_value('db-config-ok')
        mismatched = [k for k, v in wanted.items() if current.get(k) != v]
        if configured and not mismatched and not self.reset_passwords:
            log('資料庫連線設定一致')
        else:
            if configured and mismatched and not self.apply_updates:
                # 不中止的話，後續新增的項目會寫進即將被替換的資料庫
                raise DriftError(f'資料庫連線設定不同：{", ".join(mismatched)}')
            if not configured:
                self.fresh = True
            for name, value in wanted.items():
                if self.menu.screen.find(name).value != value:
                    self.menu.set_field(name, value)
            self.menu.set_password('資料庫密碼', d.password)
            self.menu.save('儲存資料庫連線設定')
            self.note_change('已儲存資料庫連線設定')
        create = self.menu.screen.find('建立資料庫')
        if create and create.enabled:
            self.menu.select('建立資料庫')
            self.menu.require_message(r'資料庫建立完成', '建立資料庫')
            self.note_change('已建立 Turnkey 資料表')
        # 資料庫設定完成前其他選單都是停用的，重新登入才會開放
        self.menu.reopen()

    # -- 系統設定

    def environment(self) -> None:
        label = ENVIRONMENT_LABELS[self.desired.environment]
        screen = self.menu.goto(BASIC + ['系統環境設定', '系統設定'])
        if screen.find('執行環境').value == label:
            log(f'執行環境為{label}')
            return
        if not self.differs(f'執行環境為「{screen.find("執行環境").value}」，設定為「{label}」', fresh_ok=True):
            return
        self.menu.set_field('執行環境', label)
        self.menu.save('儲存系統設定')
        self.note_change(f'執行環境改為{label}')

    # -- 目錄

    def directories(self) -> None:
        for name in DIRECTORY_SCREENS:
            screen = self.menu.goto(BASIC + [name])
            paths = [Path(item.value) for item in screen.items if item.enabled and item.value.startswith('/')]
            if paths and all(path.is_dir() for path in paths):
                continue
            self.menu.save(f'儲存{name}')
            self.note_change(f'已儲存{name}')

    # -- 傳送帳號

    def accounts(self) -> None:
        existing = {item.bare for item in self.menu.list_entries(BASIC + ['傳送帳號管理', '查詢'])}
        for account in self.desired.accounts:
            if account.account not in existing:
                self.menu.goto(BASIC + ['傳送帳號管理', '新增'])
                self.menu.set_field('傳送帳號', account.account)
                self.menu.set_password('傳送密碼', account.password)
                self.menu.save(f'新增傳送帳號 {account.account}')
                self.note_change(f'已新增傳送帳號 {account.account}')
            elif self.reset_passwords:
                self._edit(['傳送帳號管理'], account.account)
                self.menu.set_password('傳送密碼', account.password)
                self.menu.save(f'更新傳送帳號 {account.account}')
                self.note_change(f'已重設傳送帳號 {account.account} 的密碼')

    def delete_extra_accounts(self) -> None:
        existing = {item.bare for item in self.menu.list_entries(BASIC + ['傳送帳號管理', '查詢'])}
        for extra in sorted(existing - {a.account for a in self.desired.accounts}):
            if self.differs(f'傳送帳號 {extra} 不在設定中（將刪除）'):
                self._delete(['傳送帳號管理'], extra)
                self.note_change(f'已刪除傳送帳號 {extra}')

    # -- 憑證

    def certificates(self) -> None:
        existing = {item.bare for item in self.menu.list_entries(BASIC + ['憑證管理', '查詢'])}
        PFX_DIR.mkdir(parents=True, exist_ok=True)
        for cert in self.desired.certificates:
            same_file = cert.target.exists() and filecmp.cmp(cert.pfx_source, cert.target, shallow=False)
            if cert.code not in existing:
                check_pfx(cert)
                with _installed_pfx(cert):
                    self.menu.goto(BASIC + ['憑證管理', '新增'])
                    self.menu.set_field('憑證代碼', cert.code)
                    self.menu.set_password('憑證密碼', cert.password)
                    if self.menu.screen.find('憑證類型').value != 'PFX':
                        self.menu.set_field('憑證類型', 'PFX')
                    self.menu.set_field('憑證路徑', str(cert.target))
                    self.menu.save(f'新增憑證 {cert.code}')
                self.note_change(f'已新增憑證 {cert.code}')
                continue
            screen = self._edit(['憑證管理'], cert.code)
            path_ok = screen.find('憑證路徑').value == str(cert.target)
            if path_ok and same_file:
                if self.reset_passwords:
                    self.menu.set_password('憑證密碼', cert.password)
                    self.menu.save(f'更新憑證 {cert.code}')
                    self.note_change(f'已重設憑證 {cert.code} 的密碼')
                continue
            reason = '憑證檔內容不同（例如換發）' if not same_file else '憑證路徑不同'
            if not self.differs(f'憑證 {cert.code}：{reason}'):
                continue
            check_pfx(cert)
            with _installed_pfx(cert):
                if not path_ok:
                    self.menu.set_field('憑證路徑', str(cert.target))
                self.menu.set_password('憑證密碼', cert.password)
                self.menu.save(f'更新憑證 {cert.code}')
            self.note_change(f'已更新憑證 {cert.code}（{reason}）')

    def delete_extra_certificates(self) -> None:
        existing = {item.bare for item in self.menu.list_entries(BASIC + ['憑證管理', '查詢'])}
        for extra in sorted(existing - {c.code for c in self.desired.certificates}):
            if self.differs(f'憑證 {extra} 不在設定中（將刪除）'):
                self._delete(['憑證管理'], extra)
                managed = PFX_DIR / f'turnkey-setup-{extra}.pfx'
                if managed.exists():
                    managed.unlink()
                self.note_change(f'已刪除憑證 {extra}')

    # -- 送方

    def _sender_fields(self, sender: Sender) -> dict[str, str]:
        return {
            '送方憑證': sender.certificate,
            '送方描述': sender.description,
            '傳送帳號': sender.account,
            '傳送繞送代碼': sender.routing_code,
            '傳送繞送描述': sender.routing_description,
        }

    def delete_extra_senders(self) -> None:
        existing = {item.bare for item in self.menu.list_entries(BASIC + ['送方管理', '查詢'])}
        for extra in sorted(existing - {s.tax_id for s in self.desired.senders}):
            if self.differs(f'送方 {extra} 不在設定中（將刪除）'):
                self._delete(['送方管理'], extra)
                self.note_change(f'已刪除送方 {extra}')

    def senders(self) -> None:
        existing = {item.bare for item in self.menu.list_entries(BASIC + ['送方管理', '查詢'])}
        for sender in self.desired.senders:
            fields = self._sender_fields(sender)
            if sender.tax_id in existing:
                screen = self._edit(['送方管理'], sender.tax_id)
                locked = [k for k in ('傳送繞送代碼', '傳送繞送描述') if screen.find(k).value != fields[k]]
                # 繞送代碼建立後在編輯畫面不可改，只能刪除送方再新增
                if locked and self.differs(f'送方 {sender.tax_id} 的{"、".join(locked)}不同（需刪除後重建送方）'):
                    self._delete(['送方管理'], sender.tax_id)
                    self.note_change(f'已刪除送方 {sender.tax_id}，以新的繞送代碼重建')
                    existing.discard(sender.tax_id)
                elif locked:
                    continue
            if sender.tax_id not in existing:
                self.menu.goto(BASIC + ['送方管理', '新增'])
                self.menu.set_field('送方統編', sender.tax_id)
                for name, value in fields.items():
                    self.menu.set_field(name, value)
                self.menu.toggle_to('存證代理人', sender.storage_agent)
                self.menu.save(f'新增送方 {sender.tax_id}')
                self.note_change(f'已新增送方 {sender.tax_id}')
                continue
            screen = self._edit(['送方管理'], sender.tax_id)
            diff = [k for k, v in fields.items() if screen.find(k).enabled and screen.find(k).value != v]
            agent = screen.find('存證代理人').value == '[X]'
            if agent != sender.storage_agent:
                diff.append('存證代理人')
            if not diff or not self.differs(f'送方 {sender.tax_id} 欄位不同：{", ".join(diff)}'):
                continue
            for name in diff:
                if name == '存證代理人':
                    self.menu.toggle_to(name, sender.storage_agent)
                else:
                    self.menu.set_field(name, fields[name])
            self.menu.save(f'更新送方 {sender.tax_id}')
            self.note_change(f'已更新送方 {sender.tax_id}：{", ".join(diff)}')

    # -- 排程

    @staticmethod
    def _schedule_row(schedule: Schedule) -> str:
        return f'{schedule.task} {"是" if schedule.enabled else "否"} PERIOD {schedule.weekdays} {schedule.interval}'

    def schedules(self) -> None:
        rows = [item.bare for item in self.menu.list_entries(SCHEDULE + ['列表所有排程'])]
        wanted = {s.task: s for s in self.desired.schedules}
        current_tasks = [row.split(' ', 1)[0] for row in rows]
        problems = []
        for row, task in zip(rows, current_tasks):
            if task not in wanted:
                problems.append(f'排程「{row}」不在設定中（將刪除）')
            elif current_tasks.count(task) > 1:
                problems.append(f'排程「{row}」重複')
            elif row != self._schedule_row(wanted[task]):
                problems.append(f'排程「{row}」與設定「{self._schedule_row(wanted[task])}」不同')
        # 任務選項會依既有排程增減，順序有影響。3.2.2 實測可行的順序：
        # A:發票上傳 → D:下載拆封 → D:下載轉檔 → A:發票下載（先加 D:* 會使 A:發票上傳 不再出現，
        # 先加 A:發票下載 則 D:* 不再出現）。因此有差異時刪除全部排程，再依設定檔順序重建
        if problems and self.differs('；'.join(problems)):
            for row in rows:
                self.menu.goto(SCHEDULE + ['刪除排程'])
                self.menu.select(row)
                self.menu.require_message(r'刪除成功', f'刪除排程 {row}')
                self.note_change(f'已刪除排程 {row}')
            current_tasks = []
        missing = [s for s in self.desired.schedules if s.task not in current_tasks]
        for schedule in missing:
            row = self._schedule_row(schedule)
            self.menu.goto(SCHEDULE + ['新增排程'])
            self.menu.set_field('任務', schedule.task)
            self.menu.toggle_to('啟用', schedule.enabled)
            if self.menu.screen.find('排程類型').value != 'PERIOD':
                self.menu.set_field('排程類型', 'PERIOD')
            self._set_weekdays(schedule.weekdays)
            self.menu.set_field('排程區間(例：00:05)', schedule.interval)
            self.menu.save(f'新增排程 {schedule.task}')
            self.note_change(f'已新增排程 {row}')

    def _set_weekdays(self, weekdays: str) -> None:
        self.menu.select('排程星期')
        if weekdays == WEEKDAYS_ALL:
            self.menu.toggle_to('全部', True)
        else:
            names = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']
            wanted = {names[int(d) - 1] for d in weekdays.split(',')}
            for name in names:
                self.menu.toggle_to(name, name in wanted)
        self.menu.back()
        if self.menu.screen.find('排程星期').value != weekdays:
            self.menu._fail(f'排程星期設定後不是 {weekdays}')

    # -- 共用

    def _edit(self, base: list[str], key: str) -> Screen:
        self.menu.goto(BASIC + base + ['編輯'])
        self.menu.select(key)
        if not self.menu.screen.path.endswith(f'編輯[{key}]'):
            self.menu._fail(f'預期進入編輯[{key}]')
        return self.menu.screen

    def _delete(self, base: list[str], key: str) -> None:
        self.menu.goto(BASIC + base + ['刪除'])
        self.menu.select(key)
        self.menu.require_message(r'刪除成功', f'刪除 {key}')


# ---------------------------------------------------------------------------
# 環境檢測


ENV_CHECKS = [
    ('資料庫連線測試', ['資料庫連線測試結果：']),
    ('傳送帳號連線測試', ['傳送帳號連線測試結果：']),
    ('SFTP 連線測試', ['SFTP連線測試結果：']),
    ('WEB API連線測試', ['WEB API連線測試結果：']),
    ('資料目錄測試', ['B2B交換目錄測試結果：', '存證目錄測試結果：', '發票配號訊息目錄測試結果：', '下載流程目錄測試結果：']),
]


def environment_check(menu: Menu, mode: str, attempts: int, delay: int) -> None:
    if mode == 'off':
        log('略過環境檢測（TURNKEY_SETUP_ENV_CHECK=off）')
        return
    failures: list[str] = []
    for attempt in range(1, attempts + 1):
        failures = []
        menu.goto(BASIC + ['環境檢測'])
        for action, results in ENV_CHECKS:
            menu.select(action)
            for result in results:
                value = menu.screen.find(result).value
                if value != '測試成功':
                    detail = [m for m in menu.screen.messages if m != '檢測訊息:']
                    failures.append(f'{result.rstrip("：")}：{value or "無結果"} {" / ".join(detail[-3:])}'.strip())
        if not failures:
            log('環境檢測全部通過')
            return
        if attempt < attempts:
            log(f'環境檢測未通過（第 {attempt} 次），{delay} 秒後重試：' + '；'.join(failures))
            time.sleep(delay)
    message = '環境檢測未通過：\n  ' + '\n  '.join(failures)
    if mode == 'warn':
        log(message)
        return
    raise SetupError(message)


# ---------------------------------------------------------------------------
# 指令


def _config_value(tag: str) -> str:
    if not USER_CONFIG.exists():
        return ''
    match = re.search(rf'<{tag}>([^<]*)</{tag}>', USER_CONFIG.read_text(encoding='utf-8'))
    return match.group(1).strip() if match else ''


def installed_version() -> str:
    version_md = TURNKEY_HOME / 'VERSION.md'
    if not version_md.exists():
        return ''
    match = re.search(r'Version (\d+\.\d+\.\d+)', version_md.read_text(encoding='utf-8'))
    return match.group(1) if match else ''


def resolve_spec(version: str) -> Spec:
    supported = Spec.supported()
    if version in supported:
        return Spec.load(version)
    if _env('TURNKEY_SETUP_ALLOW_UNVERIFIED') == '1':
        log(f'Turnkey {version or "（版本不明）"} 未經驗證（支援：{", ".join(supported)}），'
            f'TURNKEY_SETUP_ALLOW_UNVERIFIED=1 → 改用 {supported[-1]} 的規格，畫面不符仍會中止')
        return Spec.load(supported[-1])
    raise SetupError(
        f'Turnkey {version or "（版本不明）"} 未經驗證，支援的版本：{", ".join(supported)}。'
        '請先以 verify 驗證新版畫面並加入規格，或設 TURNKEY_SETUP_ALLOW_UNVERIFIED=1'
    )


def spawn_command() -> list[str]:
    override = _env('TURNKEY_SETUP_SPAWN')
    return override.split() if override else ['./run_cmd.sh']


def cmd_configure(args: argparse.Namespace) -> int:
    desired = load_desired(args.config or _env('TURNKEY_SETUP_FILE'))
    version = installed_version()
    spec = resolve_spec(version)
    log(f'Turnkey {version}，規格 {spec.version}，執行環境 {desired.environment}')
    menu = Menu(spawn_command(), desired.menu_user, desired.menu_password, args.timeout)
    changed = False
    try:
        menu.open()
        if menu.version and menu.version != version:
            raise SetupError(f'選單版本 {menu.version} 與 VERSION.md 的 {version} 不一致')
        menu.spec = spec
        converger = Converger(menu, desired, args.apply_updates, args.reset_passwords)
        try:
            converger.run()
        finally:
            changed = converger.changed
        environment_check(menu, desired.env_check, args.env_check_attempts, args.env_check_delay)
    except DriftError as error:
        if changed:
            log('部分設定已變更，需重啟排程才會生效')
        log('設定與 Turnkey 現況不同，未更新。確認後加 --apply-updates（或 TURNKEY_SETUP_APPLY_UPDATES=1）再執行：\n  '
            + str(error).replace('\n', '\n  '))
        return EXIT_DRIFT
    finally:
        menu.close()
    if changed:
        log('設定已變更，需重啟排程才會生效')
        return EXIT_CHANGED
    log('設定一致，沒有變更')
    return EXIT_OK


def cmd_verify(args: argparse.Namespace) -> int:
    """唯讀：走過規格中每個選單與選項清單，逐一比對；不儲存任何設定"""
    version = installed_version()
    spec = Spec.load(args.spec or version)
    user = _env('TURNKEY_MENU_USER', 'ADMIN')
    password = SECRETS.read('選單登入密碼', _env('TURNKEY_MENU_PASSWORD_FILE'), 'TURNKEY_MENU_PASSWORD')
    menu = Menu(spawn_command(), user, password, args.timeout)
    problems: list[str] = []
    try:
        menu.open()
        log(f'選單版本 {menu.version}，VERSION.md {version}，比對規格 {spec.version}')
        for path, expected in spec.menus.items():
            names = path.split('/')[1:]
            try:
                menu.goto(names)
            except SetupError as error:
                problems.append(f'{path}：無法進入（{str(error).splitlines()[0]}）')
                menu.reopen()
                continue
            actual = menu.screen.names()
            if actual != expected:
                problems.append(f'{path}\n    預期 {expected}\n    實際 {actual}')
        menu.spec = None  # 欄位選項自行比對，不在讀畫面時中止
        for field, entry in spec.fields.items():
            menu.goto(entry['menu'].split('/')[1:])
            menu.select(field)
            actual = [item.bare for item in menu.screen.items]
            if any(option not in entry['options'] for option in actual):
                problems.append(f'{entry["menu"]} → {field}\n    預期 {entry["options"]}\n    實際 {actual}')
            # 重選目前的選項：不變更，也不儲存
            current = next((item for item in menu.screen.items if item.marked), menu.screen.items[0])
            menu._send(current.key)
    finally:
        menu.close()
    if problems:
        log('畫面與規格不符：\n  ' + '\n  '.join(problems))
        return EXIT_FAILED
    log(f'全部 {len(spec.menus)} 個選單與 {len(spec.fields)} 個選項清單都符合 {spec.version} 規格')
    return EXIT_OK


def cmd_version(_: argparse.Namespace) -> int:
    print(json.dumps({'installed': installed_version(), 'supported': Spec.supported()}, ensure_ascii=False))
    return EXIT_OK


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog='turnkey-setup')
    sub = parser.add_subparsers(dest='command', required=True)
    configure = sub.add_parser('configure')
    configure.add_argument('--config')
    configure.add_argument('--apply-updates', action='store_true', default=_env('TURNKEY_SETUP_APPLY_UPDATES') == '1')
    configure.add_argument('--reset-passwords', action='store_true', default=_env('TURNKEY_SETUP_RESET_PASSWORDS') == '1')
    configure.add_argument('--env-check-attempts', type=int, default=int(_env('TURNKEY_SETUP_ENV_CHECK_ATTEMPTS', '5')))
    configure.add_argument('--env-check-delay', type=int, default=int(_env('TURNKEY_SETUP_ENV_CHECK_DELAY', '30')))
    configure.add_argument('--timeout', type=int, default=int(_env('TURNKEY_SETUP_TIMEOUT', '180')))
    configure.set_defaults(handler=cmd_configure)
    verify = sub.add_parser('verify')
    verify.add_argument('--spec')
    verify.add_argument('--timeout', type=int, default=int(_env('TURNKEY_SETUP_TIMEOUT', '180')))
    verify.set_defaults(handler=cmd_verify)
    version = sub.add_parser('version')
    version.set_defaults(handler=cmd_version)
    args = parser.parse_args(argv)
    try:
        return args.handler(args)
    except (SetupError, FileNotFoundError, KeyError) as error:
        log(f'失敗：{error}')
        return EXIT_FAILED


if __name__ == '__main__':
    sys.exit(main())
