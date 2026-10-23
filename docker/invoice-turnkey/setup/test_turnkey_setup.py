"""turnkey_setup 的解析與版本規格測試（畫面取自 Turnkey 3.2.2 實機）。

  python3 -m unittest discover -s docker/invoice-turnkey/setup
"""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import turnkey_setup as ts

SENDER_EDIT = """
位置: 頂點/傳輸設定/基本設定/送方管理/編輯/編輯[12345675]
--.  送方統編: 12345675
 2.  送方憑證: 0001
 3.  送方描述: 12345675
 4.  傳送帳號: TESTACCT
 5.  查詢繞送代碼
--.  傳送繞送代碼: PX000001
--.  傳送繞送描述: PX000001
 8.  存證代理人: [ ]
 9.  儲存
10.  重置
 q.  回到上層
請選擇一個項目, 或按 m 更新選單: """

TASK_FIELD = """10/23 16:00:51.237 WARN  o.h.e.j.spi.SqlExceptionHelper 145 - noise
設定項目: 任務
目前設定: D:接收檔案
 1. *D:接收檔案
 2.  D:下載轉檔
 3.  A:發票下載
變更設定: """

SAVED = """10
\tDatabase JDBC URL [jdbc:postgresql://db:5432/einvturnkey]
儲存成功


位置: 頂點/傳輸設定/基本設定/資料庫連線設定
 1.  資料庫類型: PostgreSQL
 7.  資料庫密碼: ***
--.  檔案目錄:
 9.  建立資料庫
請選擇一個項目, 或按 m 更新選單: """

ENV_CHECK = """
位置: 頂點/傳輸設定/基本設定/環境檢測
 1.  資料庫連線測試
--.  資料庫連線測試結果：: 測試成功
--.  B2B交換目錄測試結果：:
請選擇一個項目, 或按 m 更新選單: """


class ParseScreenTest(unittest.TestCase):
    def test_menu_items_values_and_disabled(self):
        screen = ts.parse_screen(SENDER_EDIT)
        self.assertEqual(screen.kind, 'menu')
        self.assertEqual(screen.path, '頂點/傳輸設定/基本設定/送方管理/編輯/編輯[12345675]')
        self.assertFalse(screen.find('傳送繞送代碼').enabled)
        self.assertEqual(screen.find('傳送繞送代碼').value, 'PX000001')
        self.assertEqual(screen.find('存證代理人').value, '[ ]')
        self.assertEqual(screen.find('儲存').key, '9')
        self.assertEqual(screen.find('查詢繞送代碼').value, '')

    def test_field_with_options_and_noise(self):
        screen = ts.parse_screen(TASK_FIELD)
        self.assertEqual(screen.kind, 'field')
        self.assertEqual(screen.field, '任務')
        self.assertEqual(screen.current, 'D:接收檔案')
        self.assertEqual([i.bare for i in screen.items], ['D:接收檔案', 'D:下載轉檔', 'A:發票下載'])
        self.assertTrue(screen.items[0].marked)
        self.assertNotIn('noise', ' '.join(screen.messages))

    def test_messages_before_menu(self):
        screen = ts.parse_screen(SAVED)
        self.assertIn('儲存成功', screen.messages)
        self.assertEqual(screen.find('資料庫密碼').value, '***')
        self.assertEqual(screen.find('檔案目錄').name, '檔案目錄')

    def test_result_labels_keep_fullwidth_colon(self):
        screen = ts.parse_screen(ENV_CHECK)
        self.assertEqual(screen.find('資料庫連線測試結果：').value, '測試成功')
        self.assertEqual(screen.find('B2B交換目錄測試結果：').value, '')


class SpecTest(unittest.TestCase):
    def test_menu_mismatch_fails_loudly(self):
        spec = ts.Spec({'version': 'x', 'menus': {'頂點/傳輸設定/基本設定/送方管理/編輯/編輯[12345675]': ['送方統編']}})
        with self.assertRaises(ts.SetupError):
            spec.check_menu(ts.parse_screen(SENDER_EDIT))

    def test_options_may_shrink_but_not_change(self):
        options = ['U:上傳轉檔', 'D:接收檔案', 'D:下載轉檔', 'A:發票下載']
        spec = ts.Spec({'version': 'x', 'menus': {}, 'fields': {'任務': {'menu': 'm', 'options': options}}})
        spec.check_field(ts.parse_screen(TASK_FIELD))
        renamed = ts.Spec({'version': 'x', 'menus': {}, 'fields': {'任務': {'menu': 'm', 'options': options[:2]}}})
        with self.assertRaises(ts.SetupError):
            renamed.check_field(ts.parse_screen(TASK_FIELD))

    def test_unverified_version_is_refused_unless_allowed(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('TURNKEY_SETUP_ALLOW_UNVERIFIED', None)
            with self.assertRaises(ts.SetupError):
                ts.resolve_spec('9.9.9')
            os.environ['TURNKEY_SETUP_ALLOW_UNVERIFIED'] = '1'
            self.assertEqual(ts.resolve_spec('9.9.9').version, ts.Spec.supported()[-1])
            os.environ.pop('TURNKEY_SETUP_ALLOW_UNVERIFIED')

    def test_every_supported_spec_loads(self):
        for version in ts.Spec.supported():
            spec = ts.Spec.load(version)
            self.assertIn('頂點', spec.menus)


class SecretsTest(unittest.TestCase):
    def test_masks_literal_values_including_regex_characters(self):
        secrets = ts.Secrets()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'pw'
            path.write_text('a/b.*c$\n', encoding='utf-8')
            value = secrets.read('pw', str(path), None)
        self.assertEqual(value, 'a/b.*c$')
        self.assertEqual(secrets.mask('x a/b.*c$ y'), 'x <redacted> y')

    def test_missing_secret_fails(self):
        with self.assertRaises(ts.SetupError):
            ts.Secrets().read('pw', None, 'TURNKEY_TEST_UNSET_SECRET')


class DesiredStateTest(unittest.TestCase):
    def test_environment_must_be_explicit(self):
        with self.assertRaises(ts.SetupError):
            ts._environment(None)
        self.assertEqual(ts._environment('production'), 'production')

    def test_schedule_row_matches_list_screen(self):
        row = ts.Converger._schedule_row(ts.Schedule('A:發票上傳'))
        self.assertEqual(row, 'A:發票上傳 是 PERIOD 1,2,3,4,5,6,7 00:01')


class ConfigFileTest(unittest.TestCase):
    BASE = {
        'environment': 'test',
        'database': {'host': 'db', 'name': 'einv', 'user': 'tk', 'passwordEnv': 'TK_TEST_PW'},
        'transmitAccounts': [{'account': 'ACCT', 'passwordEnv': 'TK_TEST_PW'}],
        'certificates': [{'code': '0001', 'pfxFile': '/x.pfx', 'passwordEnv': 'TK_TEST_PW'}],
        'senders': [{'taxId': '12345675', 'certificate': '0001', 'transmitAccount': 'ACCT', 'routingCode': 'PX000001'}],
    }

    def load(self, data: dict) -> ts.Desired:
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {'TK_TEST_PW': 'pw'}):
            path = Path(tmp) / 'setup.json'
            path.write_text(json.dumps(data), encoding='utf-8')
            return ts._load_file(str(path), 'ADMIN', 'menu', 'required')

    def test_valid_file_uses_default_schedules(self):
        desired = self.load(self.BASE)
        self.assertEqual([s.task for s in desired.schedules], ts.DEFAULT_SCHEDULES)
        self.assertEqual(desired.senders[0].routing_description, 'PX000001')

    def test_misspelled_or_missing_section_fails(self):
        data = {k: v for k, v in self.BASE.items() if k != 'senders'}
        with self.assertRaises(ts.SetupError):
            self.load({**data, 'sender': self.BASE['senders']})

    def test_ids_must_be_strings(self):
        # YAML 會把未加引號的 0001 讀成整數 1
        data = {**self.BASE, 'certificates': [{'code': 1, 'pfxFile': '/x.pfx', 'passwordEnv': 'TK_TEST_PW'}]}
        with self.assertRaises(ts.SetupError):
            self.load(data)

    def test_sender_references_must_exist(self):
        sender = {**self.BASE['senders'][0], 'certificate': '0002'}
        with self.assertRaises(ts.SetupError):
            self.load({**self.BASE, 'senders': [sender]})

    def test_storage_agent_must_be_boolean(self):
        sender = {**self.BASE['senders'][0], 'storageAgent': 'false'}
        with self.assertRaises(ts.SetupError):
            self.load({**self.BASE, 'senders': [sender]})


class SpecOrderTest(unittest.TestCase):
    def test_versions_sort_numerically(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / 'spec').mkdir()
            for version in ('3.10.0', '3.2.2', '3.9.1'):
                (Path(tmp) / 'spec' / f'{version}.json').write_text('{}', encoding='utf-8')
            with mock.patch.object(ts, 'HERE', Path(tmp)):
                self.assertEqual(ts.Spec.supported(), ['3.2.2', '3.9.1', '3.10.0'])


if __name__ == '__main__':
    unittest.main()
