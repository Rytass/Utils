/**
 * Fusion SOAP envelope 的序列化。
 *
 * Fusion 的 BC4J web service 有一個容易踩到的結構特性：**同一個 envelope 內用到兩個
 * namespace**——operation 與其直屬參數 element 定義在 `{service}/types/`，但參數內容
 * （SDO 欄位）定義在 `{service}/`。把整包都掛在 WSDL 的 `targetNamespace` 下會得到
 * `500 Unknown method`，這是接 Fusion SOAP 最常見的第一個坑。
 */

/** SOAP payload 可序列化的值。`undefined` 與 `null` 語意不同，詳見 `serializeElement`。 */
export type SoapValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SoapObject
  | SoapNamespacedObject
  | readonly SoapValue[];

export interface SoapObject {
  readonly [key: string]: SoapValue;
}

/**
 * 標記 key。以 `$` 開頭的字串：XML 元素名稱不能以 `$` 開頭，因此不可能與真實欄位撞名。
 *
 * 不用 symbol key 或 class + `instanceof`：DFF 值常先經 JSON（佇列、重試 payload）或
 * `structuredClone` 才送出，這兩者都會丟掉 symbol 與原型，標記消失後 `fields` 會被當成
 * 一般欄位輸出成 `<svc:fields>`。字串 key 在往返後仍保留，ESM／CJS 混載時也一致。
 */
const SOAP_NAMESPACE_MARKER = '$namespace';

/** 由 `soapNamespaced()` 產生：子欄位改掛在另一個 namespace 的複合欄位。 */
export interface SoapNamespacedObject {
  readonly $namespace: string;
  readonly fields: SoapObject;
}

/**
 * 讓複合欄位的**子欄位**改用另一個 namespace，元素本身仍留在父層 namespace。
 *
 * 用途是 Fusion 的描述性彈性欄位（DFF）：以 `createCreditMemo` 為例，`CreditMemoFLEXVA`
 * 在服務 namespace，但其下的 DFF 欄位定義在 `.../model/flex/CreditMemoDff/`。掛錯
 * namespace 時 DFF 值不會寫入。
 *
 * ```ts
 * { CreditMemoFLEXVA: soapNamespaced(CREDIT_MEMO_DFF_NS, { voucherNumber: 'X' }) }
 * // → <svc:CreditMemoFLEXVA>
 * //     <ns1:voucherNumber xmlns:ns1="...CreditMemoDff/">X</ns1:voucherNumber>
 * //   </svc:CreditMemoFLEXVA>
 * ```
 *
 * namespace 宣告在每個直屬子欄位上（與 Fusion 實測成功的形狀一致）；更深的巢狀欄位沿用
 * 同一個 prefix。巢狀使用時 prefix 依層級遞增（`ns1`、`ns2`…），不會與 `typ`／`svc`／
 * `adf` 衝突。
 */
export function soapNamespaced(namespaceUri: string, fields: SoapObject): SoapNamespacedObject {
  if (!namespaceUri) {
    throw new TypeError('soapNamespaced() requires a non-empty namespace URI');
  }

  return { $namespace: namespaceUri, fields };
}

/** 是否為 `soapNamespaced()` 產生的標記物件（含經 JSON 往返後的形狀）。 */
export function isSoapNamespaced(value: unknown): value is SoapNamespacedObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>)[SOAP_NAMESPACE_MARKER] === 'string'
  );
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
  return serializeNode(name, value, prefix, ROOT_CONTEXT);
}

/**
 * 序列化時往下傳的狀態：
 * - `attributes`：要加在本元素開頭標籤上的屬性（`soapNamespaced` 子欄位的 `xmlns:` 宣告）
 * - `namespaceDepth`：已進入幾層 `soapNamespaced`，用來產生不重複的 prefix
 */
interface SerializeContext {
  readonly attributes: string;
  readonly namespaceDepth: number;
}

const ROOT_CONTEXT: SerializeContext = { attributes: '', namespaceDepth: 0 };

function serializeNode(name: string, value: SoapValue, prefix: string, context: SerializeContext): string {
  if (value === undefined) return '';

  const tag = `${prefix}:${name}`;
  const openTag = `${tag}${context.attributes}`;

  if (value === null) return `<${openTag} xsi:nil="true"/>`;

  if (Array.isArray(value)) {
    return value.map(item => serializeNode(name, item, prefix, context)).join('');
  }

  if (typeof value === 'object') {
    // 全部子欄位都是 undefined 時仍輸出空 element，語意等同「這個複合欄位存在但無內容」。
    return `<${openTag}>${serializeChildren(value as SoapObject | SoapNamespacedObject, prefix, context.namespaceDepth)}</${tag}>`;
  }

  return `<${openTag}>${serializeScalar(value)}</${tag}>`;
}

/**
 * 複合欄位的子欄位序列化，參數層與巢狀層共用。
 *
 * 一般物件：子欄位沿用 `prefix`。`soapNamespaced` 標記物件：換成新 prefix（`ns{層級}`），
 * 並在**每個直屬子欄位**上宣告 `xmlns`——這是 issue #237 在 Fusion 實測成功的形狀；
 * 宣告在包裝元素上語意相同，但尚未在 Fusion 驗證過，先不簡化。
 */
function serializeChildren(value: SoapObject | SoapNamespacedObject, prefix: string, namespaceDepth: number): string {
  // 必須先判斷標記，否則 `$namespace`／`fields` 會被當成一般欄位輸出。
  if (isSoapNamespaced(value)) {
    const depth = namespaceDepth + 1;
    const childPrefix = `ns${depth}`;
    const context: SerializeContext = {
      attributes: ` xmlns:${childPrefix}="${escapeXml(value.$namespace)}"`,
      namespaceDepth: depth,
    };

    return Object.entries(value.fields)
      .map(([childName, childValue]) => serializeNode(childName, childValue, childPrefix, context))
      .join('');
  }

  const context: SerializeContext = { attributes: '', namespaceDepth };

  return Object.entries(value)
    .map(([childName, childValue]) => serializeNode(childName, childValue, prefix, context))
    .join('');
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
      ? serializeChildren(value as SoapObject | SoapNamespacedObject, contentPrefix, ROOT_CONTEXT.namespaceDepth)
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
