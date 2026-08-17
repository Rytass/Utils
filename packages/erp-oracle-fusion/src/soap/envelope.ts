/**
 * Fusion SOAP envelope 的序列化。
 *
 * Fusion 的 BC4J web service 有一個容易踩到的結構特性：**同一個 envelope 內用到兩個
 * namespace**——operation 與其直屬參數 element 定義在 `{service}/types/`，但參數內容
 * （SDO 欄位）定義在 `{service}/`。把整包都掛在 WSDL 的 `targetNamespace` 下會得到
 * `500 Unknown method`，這是接 Fusion SOAP 最常見的第一個坑。
 */

/** SOAP payload 可序列化的值。`undefined` 與 `null` 語意不同，詳見 `serializeElement`。 */
export type SoapValue = string | number | boolean | null | undefined | SoapObject | readonly SoapValue[];

export interface SoapObject {
  readonly [key: string]: SoapValue;
}

/**
 * envelope 內預先宣告的 namespace prefix：
 * - `typ`：`{service}/types/`，operation 與其直屬參數 element
 * - `svc`：`{service}/`，SDO 欄位（`AccountNumber`、`CreditLimit` 等）
 * - `adf`：`http://xmlns.oracle.com/adf/svc/types/`，ADF 共用型別（`FindCriteria` 等）
 */
export type SoapNamespacePrefix = 'typ' | 'svc' | 'adf';

export const ADF_TYPES_NAMESPACE = 'http://xmlns.oracle.com/adf/svc/types/';
export const SOAP_ENVELOPE_NAMESPACE = 'http://schemas.xmlsoap.org/soap/envelope/';
export const XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';

/** operation 的一個直屬參數。 */
export interface SoapParameter {
  /** 參數 element 名稱，恆位於 `typ`（types）namespace。 */
  readonly name: string;
  readonly value: SoapValue;
  /** 參數內容欄位所用的 namespace prefix，預設 `svc`。ADF 型別（FindCriteria）需傳 `adf`。 */
  readonly contentPrefix?: SoapNamespacePrefix;
}

export interface BuildSoapEnvelopeOptions {
  readonly operation: string;
  /** `{service}/types/`——operation 與參數 element 所在的 namespace。 */
  readonly typesNamespace: string;
  /** `{service}/`——SDO 欄位所在的 namespace。 */
  readonly serviceNamespace: string;
  readonly parameters: readonly SoapParameter[];
}

/**
 * XML 1.0 不允許出現的控制字元（`\t`、`\n`、`\r` 除外）。
 *
 * 這類字元無法用實體跳脫表示，留在 payload 裡會讓**整個 envelope** 變成無效 XML 而被
 * Fusion 整包拒收，錯誤訊息也不會指向真正的來源欄位。外部匯入的客戶名稱、地址偶爾會夾帶
 * 這些字元，因此在序列化時直接移除。
 *
 * 一律以 `\u` 逸出書寫：字面控制字元在原始碼中不可見，難以維護。
 */
// eslint-disable-next-line no-control-regex
const XML_ILLEGAL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

/** XML 文字節點與屬性值的跳脫。五個字元全跳脫，避免客戶名稱含 `&`／`<` 時產生無效 XML。 */
export function escapeXml(value: string): string {
  return value
    .replace(XML_ILLEGAL_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 純量值序列化為 XML 文字。
 *
 * Fusion 的日期欄位是 `YYYY-MM-DD`、時間戳是 ISO 8601，但兩者在 SDO 上都是字串；
 * 這裡不接受 `Date`（型別已擋下），請由呼叫端決定格式後傳字串，避免時區在序列化層被
 * 悄悄決定。
 */
function serializeScalar(value: string | number | boolean): string {
  return escapeXml(typeof value === 'string' ? value : String(value));
}

/**
 * 單一 element 的序列化。
 *
 * **`undefined` 與 `null` 是不同語意**，這是 partial update 能正確運作的關鍵：
 * - `undefined`：整個 element 不輸出 → Fusion 維持該欄位原值
 * - `null`：輸出 `xsi:nil="true"` → Fusion 將該欄位清空
 *
 * 陣列展開為同名 element 重複出現（對應 XSD 的 `maxOccurs="unbounded"`）。
 */
export function serializeElement(name: string, value: SoapValue, prefix: SoapNamespacePrefix): string {
  if (value === undefined) return '';

  const tag = `${prefix}:${name}`;

  if (value === null) return `<${tag} xsi:nil="true"/>`;

  if (Array.isArray(value)) {
    return value.map(item => serializeElement(name, item, prefix)).join('');
  }

  if (typeof value === 'object') {
    const children = Object.entries(value as SoapObject)
      .map(([childName, childValue]) => serializeElement(childName, childValue, prefix))
      .join('');

    // 全部子欄位都是 undefined 時仍輸出空 element，語意等同「這個複合欄位存在但無內容」。
    return `<${tag}>${children}</${tag}>`;
  }

  return `<${tag}>${serializeScalar(value)}</${tag}>`;
}

/**
 * operation 的單一直屬參數序列化。
 *
 * 參數 element 本身恆在 `typ`（types）namespace，其內容欄位則換到 `contentPrefix`——
 * 這個「一個 element 兩個 namespace」的轉換就是 Fusion BC4J 服務的核心結構特性。
 *
 * 陣列展開為同名參數 element 重複出現，對應 XSD 中 `maxOccurs="unbounded"` 的參數
 * （例如 `processCustomerAccount` 的 `customerAccount`）。
 */
function serializeParameter(parameter: SoapParameter): string {
  const contentPrefix = parameter.contentPrefix ?? 'svc';
  const { name, value } = parameter;

  if (value === undefined) return '';

  if (value === null) return `<typ:${name} xsi:nil="true"/>`;

  if (Array.isArray(value)) {
    return value.map(item => serializeParameter({ name, value: item, contentPrefix })).join('');
  }

  const children =
    typeof value === 'object'
      ? Object.entries(value as SoapObject)
          .map(([childName, childValue]) => serializeElement(childName, childValue, contentPrefix))
          .join('')
      : serializeScalar(value as string | number | boolean);

  return `<typ:${name}>${children}</typ:${name}>`;
}

/** 組出完整的 SOAP envelope 字串。 */
export function buildSoapEnvelope(options: BuildSoapEnvelopeOptions): string {
  const { operation, typesNamespace, serviceNamespace, parameters } = options;

  const body = parameters.map(parameter => serializeParameter(parameter)).join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<soap:Envelope xmlns:soap="${SOAP_ENVELOPE_NAMESPACE}"` +
    ` xmlns:typ="${typesNamespace}"` +
    ` xmlns:svc="${serviceNamespace}"` +
    ` xmlns:adf="${ADF_TYPES_NAMESPACE}"` +
    ` xmlns:xsi="${XSI_NAMESPACE}">` +
    `<soap:Body><typ:${operation}>${body}</typ:${operation}></soap:Body>` +
    '</soap:Envelope>'
  );
}
