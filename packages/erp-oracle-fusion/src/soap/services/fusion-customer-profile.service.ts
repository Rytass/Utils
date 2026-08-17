import type { CustomerProfile, CustomerProfileInput } from '../../typings/customer-profile';
import type { FusionCallContext } from '../../typings/call-log';
import type { FusionSoapClient, FusionSoapService } from '../fusion-soap-client';
import type { SoapObject } from '../envelope';

/**
 * `ReceivablesCustomerProfileService` 的服務座標。
 *
 * 與 CRM 端不同，這裡的 types namespace 就是 `{service}types/`，沒有 `applicationModule/`
 * 那一段。
 */
export const FUSION_CUSTOMER_PROFILE_SERVICE: FusionSoapService = {
  path: '/fscmService/ReceivablesCustomerProfileService',
  serviceNamespace: 'http://xmlns.oracle.com/apps/financials/receivables/customers/customerProfileService/',
  typesNamespace: 'http://xmlns.oracle.com/apps/financials/receivables/customers/customerProfileService/types/',
  soapActionNamespace: 'http://xmlns.oracle.com/apps/financials/receivables/customers/customerProfileService/',
};

const REF_KEYS: readonly string[] = ['CustomerAccountProfileId', 'CustomerAccountId', 'AccountNumber'];
const SUMMARY_KEYS: readonly string[] = [
  'CustomerAccountProfileId',
  'AccountNumber',
  'SiteNumber',
  'ProfileClassName',
  'CreditHold',
];

interface SoapResponse {
  readonly result?: unknown;
}

function resultValues<T>(response: SoapResponse): T[] {
  const result = response.result as Record<string, unknown> | undefined;

  if (!result) return [];

  const value = result['Value'];

  if (value === undefined || value === null) return [];

  return (Array.isArray(value) ? value : [value]) as T[];
}

export interface FusionCustomerProfileCallOptions {
  readonly context?: FusionCallContext;
}

/**
 * Oracle Fusion AR 信用檔（Customer Profile）的 SOAP 服務。
 *
 * 涵蓋信用額度、信用檢核與凍結、收款條件、對帳單與催收政策。與客戶帳戶一樣沒有對應的
 * REST 資源，只能走 SOAP。
 *
 * **帳戶層與站點層**：不帶 `SiteNumber` 時操作的是帳戶層信用檔（一個帳戶一份）；帶了
 * `SiteNumber` 則是該站點的信用檔。兩者是不同記錄，更新時務必確認要改哪一份。
 *
 * **旗標是字串**：`CreditChecking`／`CreditHold` 等在 XSD 上是 `string`，請傳 `'Y'`／`'N'`
 * 而非 JS boolean。
 *
 * **回應不是完整快照**：`create`／`update` 的回應只包含這次送出的欄位，未送出的欄位一律
 * 是 `null`——這**不代表**它們被清空了。已驗證：更新 `CreditLimit` 後回應的
 * `CreditCurrencyCode` 為 null，但回讀仍是原本的 `TWD`。需要完整資料請改用
 * `getActiveCustomerProfile` 回讀，不要拿寫入回應當現值。
 */
export class FusionCustomerProfileService {
  constructor(
    private readonly client: FusionSoapClient,
    private readonly service: FusionSoapService = FUSION_CUSTOMER_PROFILE_SERVICE,
  ) {}

  /**
   * 建立信用檔。
   *
   * **`CustomerAccountId` 與 `PartyId` 都必填**——只給 `CustomerAccountId` 會得到
   * `JBO-27014: Attribute PartyId in CustomerProfileDEO is required.`。`PartyId` 是該帳戶
   * 所屬的 TCA Party，可從 `createCustomerAccount` 的回應或帳戶查詢取得。
   *
   * `ProfileClassName` 決定未指定欄位的預設值來源（如 `DEFAULT`）。
   *
   * 一個帳戶在同一時間區間內只能有一份有效的帳戶層信用檔。透過 SOAP 建立的帳戶**不會**
   * 自動附帶信用檔（已驗證：新建帳戶查 `getActiveCustomerProfile` 會得到
   * `FND_CMN_RCRD_MSNG`），但 UI 建立的帳戶通常已有一份——因此同步流程應先嘗試
   * `getActiveCustomerProfile`，有則 update、無則 create。
   */
  async createCustomerProfile(
    customerProfile: CustomerProfileInput,
    options?: FusionCustomerProfileCallOptions,
  ): Promise<CustomerProfile | null> {
    const response = await this.client.call<SoapResponse>(
      this.service,
      'createCustomerProfile',
      [{ name: 'customerProfile', value: customerProfile as SoapObject }],
      {
        ...(options?.context ? { context: options.context } : {}),
        refKeys: REF_KEYS,
        summaryKeys: SUMMARY_KEYS,
      },
    );

    return resultValues<CustomerProfile>(response)[0] ?? null;
  }

  /**
   * 更新信用檔。
   *
   * 以 `CustomerAccountProfileId` 定位最精確；也可用 `AccountNumber`（帳戶層）或
   * `AccountNumber` + `SiteNumber`（站點層）。只需帶要變更的欄位。
   *
   * 例：調整信用額度並解除信用凍結
   * ```ts
   * await profileService.updateCustomerProfile({
   *   CustomerAccountProfileId: '300000003278056',
   *   CreditLimit: 500000,
   *   CreditCurrencyCode: 'TWD',
   *   CreditHold: 'N',
   * });
   * ```
   */
  async updateCustomerProfile(
    customerProfile: CustomerProfileInput,
    options?: FusionCustomerProfileCallOptions,
  ): Promise<CustomerProfile | null> {
    const response = await this.client.call<SoapResponse>(
      this.service,
      'updateCustomerProfile',
      [{ name: 'customerProfile', value: customerProfile as SoapObject }],
      {
        ...(options?.context ? { context: options.context } : {}),
        refKeys: REF_KEYS,
        summaryKeys: SUMMARY_KEYS,
      },
    );

    return resultValues<CustomerProfile>(response)[0] ?? null;
  }

  /**
   * 取回目前有效的信用檔。
   *
   * 以 key 欄位定位：`AccountNumber`（帳戶層）、或 `AccountNumber` + `SiteNumber`
   * （站點層）、或 `CustomerAccountId`。查無資料時 Fusion 回 fault
   * （`FND_CMN_RCRD_MSNG`），因此會拋出 `FusionSoapFaultError` 而非回傳 null。
   */
  async getActiveCustomerProfile(
    key: CustomerProfileInput,
    options?: FusionCustomerProfileCallOptions,
  ): Promise<CustomerProfile | null> {
    const response = await this.client.call<SoapResponse>(
      this.service,
      'getActiveCustomerProfile',
      [{ name: 'customerProfile', value: key as SoapObject }],
      {
        ...(options?.context ? { context: options.context } : {}),
        // 唯讀且冪等。
        maxRetries: 2,
        refKeys: REF_KEYS,
        summaryKeys: SUMMARY_KEYS,
      },
    );

    return resultValues<CustomerProfile>(response)[0] ?? null;
  }
}
