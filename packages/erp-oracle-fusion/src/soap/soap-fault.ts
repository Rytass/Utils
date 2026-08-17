import { XMLParser } from 'fast-xml-parser';
import {
  FusionAuthError,
  FusionSoapFaultError,
  FusionTransientError,
  FusionValidationError,
} from '../errors/fusion-errors';
import type { FusionRequestError, FusionSoapAttributeError } from '../errors/fusion-errors';

/**
 * 解析 Fusion 回應時一律關閉數值轉換：Fusion 的 id 是 `long`，`CustomerAccountId`
 * 這類值轉成 JS number 會有精度風險；帳號 `0012` 轉成 number 也會掉前導零。
 * 全部保持字串，由消費端自行決定轉型。
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // 回應中的 prefix（ns0／ns2／ns4…）由 Fusion 動態產生，不能寫死；一律剝除後以裸名取用。
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

/**
 * 把 fast-xml-parser 的輸出正規化成單純的 JS 結構：
 * - `xsi:nil="true"` → `null`（Fusion 用它表示「此欄位無值」，數量極多）
 * - 移除 `xsi:type` 等屬性（純 schema 資訊，非業務資料）
 * - 只剩文字內容的節點 → 該字串
 */
export function normalizeParsedXml(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(normalizeParsedXml);

  if (node === null || typeof node !== 'object') return node;

  const obj = node as Record<string, unknown>;

  if (obj['@_nil'] === 'true' || obj['@_nil'] === true) return null;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('@_')) continue;

    result[key] = normalizeParsedXml(value);
  }

  const keys = Object.keys(result);

  if (keys.length === 1 && keys[0] === '#text') return result['#text'];

  return result;
}

/**
 * 解析 SOAP 回應 XML 為正規化後的 JS 物件。
 *
 * 解析器對空字串與非 XML 內容不會拋錯，而是回傳空物件——這類回應會被視為「沒有 fault
 * 也沒有內容」，最終由服務層轉成 `null`。只有解析器真的拋錯時才回傳 `null`。
 */
export function parseSoapXml(xml: string): Record<string, unknown> | null {
  try {
    const parsed = normalizeParsedXml(parser.parse(xml));

    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') return value;

  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  return null;
}

function toArray(value: unknown): readonly unknown[] {
  if (value === undefined || value === null) return [];

  return Array.isArray(value) ? value : [value];
}

/**
 * 遞迴收集 `ServiceMessage.detail` 樹中的欄位級錯誤。
 *
 * Fusion 在一次 create/update 失敗時可能回報多個欄位問題，全部掛在巢狀的 `detail` 下
 * （XSD 的 `detail` 是 `maxOccurs="unbounded"` 且型別為自身）。只取最外層會漏掉真正
 * 說明「哪個欄位錯」的訊息。
 */
function collectAttributeErrors(node: unknown, accumulator: FusionSoapAttributeError[]): void {
  const record = asRecord(node);

  if (!record) return;

  const attributeName = asText(record['attributeName']);
  const objectName = asText(record['objectName']);

  if (attributeName !== null || objectName !== null) {
    accumulator.push({ attributeName, objectName, message: asText(record['message']) });
  }

  for (const detail of toArray(record['detail'])) {
    collectAttributeErrors(detail, accumulator);
  }
}

/** 從已解析的回應中取出 `soap:Fault` 節點；沒有 fault 時回傳 null。 */
export function findSoapFaultNode(parsed: Record<string, unknown> | null): Record<string, unknown> | null {
  const envelope = asRecord(parsed?.['Envelope']);
  const body = asRecord(envelope?.['Body']);

  return asRecord(body?.['Fault']);
}

/**
 * 由 fault 節點建出 `FusionSoapFaultError`。
 *
 * `faultstring` 內含 Oracle 的 `<MESSAGE><TEXT>…</TEXT></MESSAGE>` 包裝（且是 XML 跳脫後
 * 的文字），對人閱讀很吵，因此優先取 `detail/ServiceErrorMessage/message`，並額外抽出
 * `<TEXT>` 內的實際敘述作為訊息主體。
 */
export function buildSoapFaultError(
  faultNode: Record<string, unknown>,
  status: number,
  description: string,
): FusionSoapFaultError {
  const detail = asRecord(faultNode['detail']);
  const serviceError = asRecord(detail?.['ServiceErrorMessage']) ?? asRecord(detail?.['ServiceMessage']);

  const rawMessage = asText(serviceError?.['message']) ?? asText(faultNode['faultstring']) ?? 'Unknown SOAP fault';

  // Oracle 把可讀敘述包在 <TEXT> 裡；抽出來當主訊息，抽不到就用原字串。
  const textMatch = /<TEXT>([\s\S]*?)<\/TEXT>/.exec(rawMessage);
  const readable = textMatch?.[1]?.trim() || rawMessage;

  const attributeErrors: FusionSoapAttributeError[] = [];

  collectAttributeErrors(serviceError, attributeErrors);

  return new FusionSoapFaultError(status, `Fusion SOAP fault (${description}): ${readable}`, faultNode, {
    faultCode: asText(faultNode['faultcode']),
    errorCode: asText(serviceError?.['code']),
    severity: asText(serviceError?.['severity']),
    exceptionClassName: asText(serviceError?.['exceptionClassName']),
    attributeErrors,
  });
}

/**
 * SOAP 回應的錯誤分類。
 *
 * 與 REST 的關鍵差異：**SOAP fault 一律以 HTTP 500 回傳**。若沿用 REST 規則會把業務驗證
 * 失敗判成暫時性錯誤而重試——重試不會成功，且對非冪等寫入有重複送出的風險。因此 500 一定
 * 要先看 body 有沒有 fault，有 fault 就是確定失敗。
 */
export function classifySoapHttpError(status: number, bodyText: string, description: string): FusionRequestError {
  if (status === 401 || status === 403) {
    return new FusionAuthError(
      status,
      `Fusion SOAP authentication/authorization failed (${description}): ${status} ${bodyText}`,
    );
  }

  const faultNode = findSoapFaultNode(parseSoapXml(bodyText));

  if (faultNode) {
    return buildSoapFaultError(faultNode, status, description);
  }

  if (status === 400) {
    return new FusionValidationError(
      status,
      `Fusion SOAP request validation failed (${description}): ${status} ${bodyText}`,
      bodyText,
    );
  }

  // 500 但無 fault（多為 gateway／容器層錯誤）與 429／502-504 才是真正可重試的暫時性失敗。
  return new FusionTransientError(status, `Fusion SOAP transient error (${description}): ${status} ${bodyText}`);
}
