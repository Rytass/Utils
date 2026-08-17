import type { FusionSoapInput, FusionSoapOutput, FusionSoapRecord } from './soap';

/**
 * `CustomerProfile` SDO 的純量欄位載體（欄位名取自 pod 的 `CustomerProfile.xsd`）。
 *
 * 這是 AR 的「客戶信用檔」：信用額度、信用檢核、收款條件與對帳單政策都在這裡。
 *
 * **多數 `Y`／`N` 旗標在 XSD 上是 `string` 而非 `boolean`**，傳 JS `true` 會序列化成
 * `true` 而被 Fusion 拒絕，請傳 `'Y'`／`'N'`。
 */
export interface CustomerProfileFields {
  /** 信用檔主鍵，由 Fusion 產生。 */
  CustomerAccountProfileId: string;
  /**
   * 帳號。`getActiveCustomerProfile`／`updateCustomerProfile` 以此定位帳戶層信用檔，
   * 與 `CustomerAccountId` 擇一即可。
   */
  AccountNumber: string;
  CustomerAccountId: string;
  /** 站點編號。帶入時操作的是**站點層**信用檔，留空則為帳戶層。 */
  SiteNumber: string;
  PartyId: string;
  /** 信用檔類別名稱，如 `DEFAULT`。決定未指定欄位的預設值來源。 */
  ProfileClassName: string;
  /** 生效起日 `YYYY-MM-DD`。 */
  EffectiveStartDate: string;
  /** 生效迄日；`4712-12-31` 表示無期限。 */
  EffectiveEndDate: string;

  /** 信用額度。 */
  CreditLimit: string;
  /** 信用額度幣別，如 `TWD`。設定 `CreditLimit` 時應一併指定。 */
  CreditCurrencyCode: string;
  /** 單筆訂單金額上限。 */
  OrderAmountLimit: string;
  /** `Y`／`N`，是否啟用信用檢核。 */
  CreditChecking: string;
  /** `Y`／`N`，是否信用凍結（凍結後新訂單會被擋）。 */
  CreditHold: string;
  /** 信用分級，值來自 pod 的 `CREDIT_CLASSIFICATION` lookup。 */
  CreditClassificationValue: string;
  CreditRatingValue: string;
  RiskCodeValue: string;
  AccountStatusValue: string;
  CreditAnalystName: string;
  CreditReviewCycleName: string;
  LastCreditReviewDate: string;
  NextCreditReviewDate: string;

  /** 收款條件名稱，如 `Immediate`／`Net 30`。 */
  PaymentTerms: string;
  /** `Y`／`N`，是否允許交易覆寫收款條件。 */
  OverrideTerms: string;
  /** `Y`／`N`，是否適用折扣條件。 */
  DiscountTerms: string;
  DiscountGraceDays: string;
  ClearingDays: string;
  CollectorName: string;
  ConversionRateType: string;
  /** 容差金額／百分比。 */
  Tolerance: string;
  PercentCollectable: string;

  /** `Y`／`N`，是否寄送對帳單。 */
  SendStatements: string;
  StatementCycle: string;
  StatementDeliveryMethod: string;
  CreditBalanceStatements: string;
  /** `Y`／`N`，是否寄送催收信。 */
  DunningLetters: string;

  BillLevel: string;
  BillType: string;
  GenerateBill: string;
  GroupingRule: string;
  ConsolidatedInvoice: string;
  EnableConsolidatedBilling: string;
  ConsBillingTermsName: string;
  DraftBillReviewRequired: string;

  MatchReceiptsBy: string;
  MatchByAutoupdate: string;
  AutoCashRuleSet: string;
  AutoMatchRuleSet: string;
  ApplicationExceptionRuleSet: string;
  ReminderRuleSet: string;
  AutoReceiptsIncludeDisputedItems: string;
  ExceptionAdjustmentReason: string;

  PreferredContactMethod: string;
  PreferredDeliveryMethod: string;
}

/**
 * 建立／更新信用檔的輸入。
 *
 * `updateCustomerProfile` 只需帶定位鍵（`CustomerAccountProfileId`，或 `AccountNumber`
 * 加上帳戶／站點層的區分）與要變更的欄位；未帶的欄位維持原值，傳 `null` 則清空。
 */
export interface CustomerProfileInput extends FusionSoapInput<CustomerProfileFields> {
  /** 彈性欄位（DFF）。 */
  readonly CustomerProfileFLEX?: FusionSoapRecord;
  /** 全球化彈性欄位（GDF），依國別而異。 */
  readonly CustomerProfileGdf?: readonly FusionSoapRecord[];
}

/** Fusion 回傳的信用檔。純量欄位一律為字串或 null。 */
export type CustomerProfile = FusionSoapOutput<CustomerProfileFields> & {
  readonly CustomerProfileFLEX?: unknown;
  readonly CustomerProfileGdf?: unknown;
};
