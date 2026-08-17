import type { SoapObject, SoapValue } from './envelope';

/**
 * ADF `FindCriteria` 的建構。
 *
 * Fusion 的 `findXxx` operation 一律吃這組 ADF 共用結構（定義於 `BC4JService.xsd`）。
 * **element 順序有意義**——XSD 用的是 `xsd:sequence`，順序錯了 Fusion 會拒收；本模組
 * 依 schema 順序組裝，呼叫端不需要知道這件事。
 */

/**
 * ADF 查詢運算子。字面值直接送到 Fusion，`=`／`<>`／`>`／`<`／`>=`／`<=` 之外還有
 * `LIKE`（配合 `%`）、`BETWEEN`、`IN`（配合多個 `value`）、`ISNULL`／`ISNOTNULL`（不帶值）。
 */
export type FusionFindOperator =
  | '='
  | '<>'
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'BETWEEN'
  | 'IN'
  | 'ISNULL'
  | 'ISNOTNULL';

export interface FusionFindFilterItem {
  /** 要比對的 SDO 屬性名，如 `AccountNumber`。 */
  readonly attribute: string;
  /** 預設 `=`。 */
  readonly operator?: FusionFindOperator;
  /** 比對值；`BETWEEN`／`IN` 可給多個，`ISNULL`／`ISNOTNULL` 則省略。 */
  readonly value?: string | number | boolean | readonly (string | number | boolean)[];
  /** 與**前一個** item 的連接方式，預設 `And`；第一個 item 不需指定。 */
  readonly conjunction?: 'And' | 'Or';
  /** 是否忽略大小寫比對，預設 false。 */
  readonly upperCaseCompare?: boolean;
}

export interface FusionFindCriteriaOptions {
  /** 起始筆數，預設 0。 */
  readonly fetchStart?: number;
  /** 取回筆數，預設 10。設 `-1` 表示不限（大集合請小心）。 */
  readonly fetchSize?: number;
  /** 過濾條件；全部放在同一個 group 內。 */
  readonly filters?: readonly FusionFindFilterItem[];
  /**
   * 只取回指定屬性。留空則回傳整個 SDO——客戶帳戶的完整 SDO 含所有站點與聯絡人，
   * 資料量可觀，只需要少數欄位時務必指定。
   */
  readonly findAttributes?: readonly string[];
  /** 為 true 時 `findAttribute` 的語意反轉為「排除這些屬性」，預設 false。 */
  readonly excludeAttribute?: boolean;
}

function buildFilterItem(item: FusionFindFilterItem): SoapObject {
  const values =
    item.value === undefined ? undefined : Array.isArray(item.value) ? item.value : [item.value as SoapValue];

  // 順序依 ViewCriteriaItem 的 xsd:sequence：conjunction → upperCaseCompare → attribute → operator → value
  return {
    ...(item.conjunction ? { conjunction: item.conjunction } : {}),
    upperCaseCompare: item.upperCaseCompare ?? false,
    attribute: item.attribute,
    operator: item.operator ?? '=',
    ...(values ? { value: values as readonly SoapValue[] } : {}),
  };
}

/**
 * 組出 `findCriteria` 參數的內容。
 *
 * 回傳值須以 `contentPrefix: 'adf'` 傳給 `buildSoapEnvelope`——`FindCriteria` 的欄位屬於
 * ADF 共用 namespace，不是服務自己的 namespace。
 */
export function buildFindCriteria(options: FusionFindCriteriaOptions = {}): SoapObject {
  const { filters = [], findAttributes = [] } = options;

  return {
    fetchStart: options.fetchStart ?? 0,
    fetchSize: options.fetchSize ?? 10,
    ...(filters.length > 0
      ? {
          filter: {
            group: {
              upperCaseCompare: false,
              item: filters.map(buildFilterItem),
            },
          },
        }
      : {}),
    ...(findAttributes.length > 0 ? { findAttribute: findAttributes as readonly SoapValue[] } : {}),
    excludeAttribute: options.excludeAttribute ?? false,
  };
}

/** `findControl` 參數的內容（同樣使用 `adf` prefix）。 */
export function buildFindControl(retrieveAllTranslations = false): SoapObject {
  return { retrieveAllTranslations };
}
