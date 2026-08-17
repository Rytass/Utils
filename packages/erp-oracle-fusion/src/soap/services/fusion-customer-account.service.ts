import type { CustomerAccount, CustomerAccountInput } from '../../typings/customer-account';
import type { FusionCallContext } from '../../typings/call-log';
import { buildFindCriteria, buildFindControl } from '../find-criteria';
import type { FusionFindCriteriaOptions } from '../find-criteria';
import type { FusionSoapClient, FusionSoapService } from '../fusion-soap-client';
import type { SoapObject } from '../envelope';

/**
 * `CustomerAccountService` 的服務座標。
 *
 * 注意 `typesNamespace` 多了一段 `applicationModule/`——這是 CRM 端 BC4J 服務的慣例，
 * 與 FSCM 端的 `ReceivablesCustomerProfileService` 不同，不能互相套用。
 */
export const FUSION_CUSTOMER_ACCOUNT_SERVICE: FusionSoapService = {
  path: '/crmService/CustomerAccountService',
  serviceNamespace: 'http://xmlns.oracle.com/apps/cdm/foundation/parties/customerAccountService/',
  typesNamespace: 'http://xmlns.oracle.com/apps/cdm/foundation/parties/customerAccountService/applicationModule/types/',
  soapActionNamespace: 'http://xmlns.oracle.com/apps/cdm/foundation/parties/customerAccountService/applicationModule/',
};

/** 觀測紀錄要擷取的參照 id。 */
const REF_KEYS: readonly string[] = ['CustomerAccountId', 'AccountNumber', 'PartyId'];
const SUMMARY_KEYS: readonly string[] = ['CustomerAccountId', 'AccountNumber', 'PartyId', 'Status'];

interface SoapResponse {
  readonly result?: unknown;
}

function toArray<T>(value: unknown): T[] {
  if (value === undefined || value === null) return [];

  return (Array.isArray(value) ? value : [value]) as T[];
}

/**
 * 由 `XxxResult` 取出 `Value` 清單。
 *
 * XML 沒有「單元素陣列」的概念：回一筆時解析結果是物件，回多筆才是陣列。一律正規化成
 * 陣列，避免呼叫端每次都要判斷。
 */
function resultValues<T>(response: SoapResponse): T[] {
  const result = response.result as Record<string, unknown> | undefined;

  if (!result) return [];

  return toArray<T>(result['Value']);
}

export interface FusionCustomerAccountCallOptions {
  readonly context?: FusionCallContext;
}

/**
 * Oracle Fusion 客戶帳戶（AR Customer Account）的 SOAP 服務。
 *
 * **為何是 SOAP**：客戶帳戶沒有對應的 REST 資源。`crmRestApi` 的 `accounts` 是 Sales
 * Account（TCA Party 加銷售輪廓），欄位是 `PartyId`／`SalesProfile…`，與 AR 的
 * `CustomerAccountId`／`AccountNumber` 是不同的東西，不能替代。
 *
 * **建立順序**：`CustomerAccountService` 不會順帶建立 TCA Party，`createCustomerAccount`
 * 必須帶既有的 `PartyId`。完整流程是先建 Party、再建帳戶、最後建信用檔
 * （`FusionCustomerProfileService`）。
 *
 * 建 Party 請用 `crmRestApi` 的 **`accounts`** 資源——`hubOrganizations` 會因為沒有指派
 * party usage 而被拒（`HZ-120421: This party isn't valid because there is no party usage
 * assigned.`），`accounts` 則會連同 usage 一起建立。
 */
export class FusionCustomerAccountService {
  constructor(
    private readonly client: FusionSoapClient,
    private readonly service: FusionSoapService = FUSION_CUSTOMER_ACCOUNT_SERVICE,
  ) {}

  /**
   * 建立客戶帳戶。
   *
   * **`PartyId` 與 `CreatedByModule` 都必填**。少了 `CreatedByModule` 會得到籠統的
   * `JBO-27024: Failed to validate a row`，且 `attributeErrors` **不會**指出是哪個欄位——
   * 排查時很容易卡住，因此請一律帶上（整合慣例用 `'HZ_WS'`）。
   *
   * `AccountNumber` 留空時由 Fusion 依帳號編碼規則自動產生。
   * 可在同一次呼叫中以 `CustomerAccountSite` 帶入站點。
   *
   * `OrigSystem` 若要帶，其值必須是該 pod **已註冊的 source system**，否則會得到
   * `HZ-120559`。未註冊前請留空，改用 `CustomerAccountId` 對照。
   *
   * 不自動重試——建立帳戶非冪等，重送會產生重複帳戶。
   */
  async createCustomerAccount(
    customerAccount: CustomerAccountInput,
    options?: FusionCustomerAccountCallOptions,
  ): Promise<CustomerAccount | null> {
    const response = await this.client.call<SoapResponse>(
      this.service,
      'createCustomerAccount',
      [{ name: 'customerAccount', value: customerAccount as SoapObject }],
      {
        ...(options?.context ? { context: options.context } : {}),
        refKeys: REF_KEYS,
        summaryKeys: SUMMARY_KEYS,
      },
    );

    return resultValues<CustomerAccount>(response)[0] ?? null;
  }

  /**
   * 更新客戶帳戶。
   *
   * 只需帶 `CustomerAccountId` 與要變更的欄位；未帶的欄位維持原值，傳 `null` 則清空。
   */
  async updateCustomerAccount(
    customerAccount: CustomerAccountInput,
    options?: FusionCustomerAccountCallOptions,
  ): Promise<CustomerAccount | null> {
    const response = await this.client.call<SoapResponse>(
      this.service,
      'updateCustomerAccount',
      [{ name: 'customerAccount', value: customerAccount as SoapObject }],
      {
        ...(options?.context ? { context: options.context } : {}),
        refKeys: REF_KEYS,
        summaryKeys: SUMMARY_KEYS,
      },
    );

    return resultValues<CustomerAccount>(response)[0] ?? null;
  }

  /** 以主鍵取單一帳戶。查無資料時 Fusion 回 fault，因此會拋出 `FusionSoapFaultError`。 */
  async getCustomerAccount(
    customerAccountId: string | number,
    options?: FusionCustomerAccountCallOptions,
  ): Promise<CustomerAccount | null> {
    const response = await this.client.call<SoapResponse>(
      this.service,
      'getCustomerAccount',
      [{ name: 'customerAccountId', value: customerAccountId }],
      {
        ...(options?.context ? { context: options.context } : {}),
        // 唯讀且冪等，暫時性錯誤可安全重試。
        maxRetries: 2,
        refKeys: REF_KEYS,
        summaryKeys: SUMMARY_KEYS,
      },
    );

    return (response.result as CustomerAccount | undefined) ?? null;
  }

  /**
   * 條件查詢帳戶。
   *
   * 完整 SDO 含所有站點與聯絡人，資料量可觀；只需要少數欄位時請用
   * `criteria.findAttributes` 限縮。
   *
   * **回傳型別是 `Partial<CustomerAccount>`**：使用 `findAttributes` 時 Fusion 只回傳
   * 被指定的欄位，未取回的欄位是 `undefined`（不是 `null`）。若宣告成完整的
   * `CustomerAccount`，`account.Status === 'A'` 這種判斷會永遠為 false 而且沒有型別
   * 警告——所以這裡刻意讓編譯器逼呼叫端處理缺欄位的情況。
   */
  async findCustomerAccount(
    criteria: FusionFindCriteriaOptions = {},
    options?: FusionCustomerAccountCallOptions,
  ): Promise<Partial<CustomerAccount>[]> {
    const response = await this.client.call<SoapResponse>(
      this.service,
      'findCustomerAccount',
      [
        { name: 'findCriteria', value: buildFindCriteria(criteria), contentPrefix: 'adf' },
        { name: 'findControl', value: buildFindControl(), contentPrefix: 'adf' },
      ],
      {
        ...(options?.context ? { context: options.context } : {}),
        maxRetries: 2,
        refKeys: REF_KEYS,
        summaryKeys: SUMMARY_KEYS,
      },
    );

    return resultValues<Partial<CustomerAccount>>(response);
  }

  /**
   * 以外部系統參照反查帳戶——外部系統同步的標準做法：用自家單號查回 Fusion 的帳戶，
   * 避免在自家資料庫另存 `CustomerAccountId` 對照表。
   *
   * `origSystem` 必須是 pod 已註冊的 source system。回傳型別同 `findCustomerAccount`，
   * 為 `Partial<CustomerAccount>`。
   */
  async getCustomerAccountByOriginalSystemReference(
    origSystem: string,
    origSystemReference: string,
    criteria: FusionFindCriteriaOptions = {},
    options?: FusionCustomerAccountCallOptions,
  ): Promise<Partial<CustomerAccount>[]> {
    const response = await this.client.call<SoapResponse>(
      this.service,
      'getCustomerAccountByOriginalSystemReference',
      [
        { name: 'findCriteria', value: buildFindCriteria(criteria), contentPrefix: 'adf' },
        { name: 'bindOrigSystem', value: origSystem },
        { name: 'bindOrigSystemReference', value: origSystemReference },
        { name: 'findControl', value: buildFindControl(), contentPrefix: 'adf' },
      ],
      {
        ...(options?.context ? { context: options.context } : {}),
        maxRetries: 2,
        refKeys: REF_KEYS,
        summaryKeys: SUMMARY_KEYS,
      },
    );

    return resultValues<Partial<CustomerAccount>>(response);
  }
}
