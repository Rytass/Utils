import type { FusionSoapInput, FusionSoapOutput, FusionSoapRecord } from './soap';

/**
 * `CustomerAccount` SDO 的純量欄位載體（欄位名取自 pod 的 `CustomerAccount.xsd`）。
 *
 * 型別值只作為欄位載體，實際讀寫形狀由 `FusionSoapInput`／`FusionSoapOutput` 衍生。
 */
export interface CustomerAccountFields {
  /** 帳戶主鍵，由 Fusion 產生；更新時必填。 */
  CustomerAccountId: string;
  /**
   * 所屬 TCA Party。
   *
   * **建立帳戶時必填**——`CustomerAccountService` 不會順帶建立 Party，必須先有
   * Organization／Person。請用 `crmRestApi` 的 **`accounts`** 資源建立：
   * `hubOrganizations` 會因未指派 party usage 而被 `HZ-120421` 拒絕。
   */
  PartyId: string;
  /** 帳號。未指定時由 Fusion 依帳號自動編碼規則產生。 */
  AccountNumber: string;
  /** 帳戶名稱。 */
  AccountName: string;
  /** 帳戶狀態，`A`（Active）／`I`（Inactive）。 */
  Status: string;
  /** 客戶類別，如 `R`（Internal）／`I`（External）。 */
  CustomerType: string;
  CustomerClassCode: string;
  TaxCode: string;
  TaxHeaderLevelFlag: string;
  TaxRoundingRule: string;
  CoterminateDayMonth: string;
  /** 帳戶成立日，格式 `YYYY-MM-DD`。 */
  AccountEstablishedDate: string;
  /** 帳戶終止日；Fusion 慣用 `4712-12-31` 表示無期限。 */
  AccountTerminationDate: string;
  HeldBillExpirationDate: string;
  HoldBillFlag: string;
  DepositRefundMethod: string;
  NpaNumber: string;
  SourceCode: string;
  Comments: string;
  DateTypePreference: string;
  ArrivalsetsIncludeLinesFlag: string;
  StatusUpdateDate: string;
  AutopayFlag: string;
  SellingPartyId: string;
  /** 外部系統代碼，供 `getCustomerAccountByOriginalSystemReference` 反查。 */
  OrigSystem: string;
  /** 外部系統的單號／識別碼。 */
  OrigSystemReference: string;
  /**
   * 建立來源模組，用於資料來源稽核。
   *
   * **建立帳戶時必填**（已對真實 pod 驗證）：省略會得到籠統的 `JBO-27024` 而非明確的
   * 欄位錯誤。整合慣例填 `'HZ_WS'`；UI 建立的資料會是 `TCA_FORM_WRAPPER`。
   */
  CreatedByModule: string;
  LastBatchId: string;
  RequestId: string;
  /** 唯讀稽核欄位，寫入時不需帶。 */
  CreationDate: string;
  CreatedBy: string;
  LastUpdateDate: string;
  LastUpdatedBy: string;
  LastUpdateLogin: string;
}

/** `CustomerAccountSite` 的純量欄位載體。建立帳戶時可一併帶入（`maxOccurs="unbounded"`）。 */
export interface CustomerAccountSiteFields {
  CustomerAccountSiteId: string;
  CustomerAccountId: string;
  /** 對應的 TCA Party Site；建立站點時必填。 */
  PartySiteId: string;
  Status: string;
  /** `Y`／`N`，是否為帳單地址。 */
  BillToIndicator: string;
  /** `Y`／`N`，是否為送貨地址。 */
  ShipToIndicator: string;
  MarketIndicator: string;
  CustomerCategoryCode: string;
  Language: string;
  KeyAccountFlag: string;
  TpHeaderId: string;
  EceTpLocationCode: string;
  TranslatedCustomerName: string;
  CreatedByModule: string;
  SetId: string;
  SetCode: string;
  StartDate: string;
  EndDate: string;
  OrigSystemReference: string;
  CreationDate: string;
  CreatedBy: string;
  LastUpdateDate: string;
  LastUpdatedBy: string;
  LastUpdateLogin: string;
  RequestId: string;
}

/** 建立／更新客戶帳戶站點的輸入。 */
export interface CustomerAccountSiteInput extends FusionSoapInput<CustomerAccountSiteFields> {
  readonly CustomerAccountSiteUse?: readonly FusionSoapRecord[];
  readonly CustomerAccountContact?: readonly FusionSoapRecord[];
  readonly OriginalSystemReference?: readonly FusionSoapRecord[];
  readonly CustAcctSiteInformation?: FusionSoapRecord;
  readonly CustAccountSiteGdf?: FusionSoapRecord;
}

/**
 * 建立／更新客戶帳戶的輸入。
 *
 * 未帶的欄位不會送出，因此 `updateCustomerAccount` 可以只帶 `CustomerAccountId` 加要改的
 * 欄位；要清空某欄位請顯式傳 `null`。
 */
export interface CustomerAccountInput extends FusionSoapInput<CustomerAccountFields> {
  readonly CustomerAccountSite?: readonly CustomerAccountSiteInput[];
  readonly CustomerAccountContact?: readonly FusionSoapRecord[];
  readonly CustomerAccountRelationship?: readonly FusionSoapRecord[];
  readonly OriginalSystemReference?: readonly FusionSoapRecord[];
  readonly CustAcctInformation?: FusionSoapRecord;
  readonly CustAccountGdf?: FusionSoapRecord;
}

/** Fusion 回傳的客戶帳戶站點。 */
export type CustomerAccountSite = FusionSoapOutput<CustomerAccountSiteFields> & {
  readonly CustomerAccountSiteUse?: unknown;
  readonly CustomerAccountContact?: unknown;
};

/** Fusion 回傳的客戶帳戶。純量欄位一律為字串或 null。 */
export type CustomerAccount = FusionSoapOutput<CustomerAccountFields> & {
  readonly CustomerAccountSite?: CustomerAccountSite | readonly CustomerAccountSite[];
  readonly CustomerAccountContact?: unknown;
  readonly CustomerAccountRelationship?: unknown;
};
