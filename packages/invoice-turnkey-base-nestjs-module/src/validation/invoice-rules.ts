import { TurnkeyCarrierType, TurnkeyDeliveryMode, TurnkeyTaxType } from '../typings/turnkey-enums';
import { TurnkeyInvoiceAmounts, TurnkeyInvoiceIssueInput } from '../typings/turnkey-invoice.types';
import { computeInvoiceAmounts, roundTo, itemAmount } from '../utils/amounts';
import { isTaxIdValid } from '../utils/tax-id';
import { TurnkeyValidationCode, TurnkeyValidationIssue } from './turnkey-validation-error';

const HOUR = 60 * 60 * 1000;

/** 手機條碼：/ 開頭共 8 碼，後 7 碼為數字、大寫英文或 . + - */
export const isMobileBarcodeFormatValid = (code: string): boolean => /^\/[0-9A-Z.+-]{7}$/.test(code);

/** 自然人憑證條碼：2 碼大寫英文＋14 碼數字 */
export const isMoicaFormatValid = (code: string): boolean => /^[A-Z]{2}\d{14}$/.test(code);

/** 捐贈碼 3 到 7 位數字 */
export const isNpoCodeFormatValid = (code: string): boolean => /^\d{3,7}$/.test(code);

export interface InvoiceRuleContext {
  readonly now: Date;
  /** B2C（無買方統編）開立後幾小時內要上傳，預設 48 */
  readonly issueDeadlineHours?: number;
  /** B2B（有買方統編）開立後幾小時內要上傳，預設 168（7 日） */
  readonly b2bIssueDeadlineHours?: number;
  /** 允許的未來天數，預設 3（E1002） */
  readonly futureToleranceDays?: number;
}

const issue = (code: TurnkeyValidationCode, message: string, field?: string): TurnkeyValidationIssue => ({
  code,
  message,
  field,
});

const checkCarrier = (input: TurnkeyInvoiceIssueInput): readonly TurnkeyValidationIssue[] => {
  if (!input.carrier) return [];

  const { type, code, typeCode } = input.carrier;

  switch (type) {
    case TurnkeyCarrierType.MOBILE:
      return isMobileBarcodeFormatValid(code)
        ? []
        : [issue(TurnkeyValidationCode.INVALID_CARRIER, '手機條碼格式錯誤', 'carrier.code')];

    case TurnkeyCarrierType.MOICA:
      return isMoicaFormatValid(code)
        ? []
        : [issue(TurnkeyValidationCode.INVALID_CARRIER, '自然人憑證條碼格式錯誤', 'carrier.code')];

    default:
      return typeCode && /^[0-9A-Z]{6}$/.test(typeCode) && code.trim() === code && code.length > 0
        ? []
        : [issue(TurnkeyValidationCode.INVALID_CARRIER, '會員或平台載具需填 6 碼載具類別號碼與載具號碼', 'carrier')];
  }
};

const checkAmounts = (
  input: TurnkeyInvoiceIssueInput,
  computed: TurnkeyInvoiceAmounts,
): readonly TurnkeyValidationIssue[] => {
  const given = input.amounts;

  if (!given) return [];

  const sales = [
    ['salesAmount', computed.salesAmount],
    ['taxFreeSalesAmount', computed.taxFreeSalesAmount],
    ['zeroRatedSalesAmount', computed.zeroRatedSalesAmount],
  ] as const;

  const salesIssues = sales
    .filter(([field, value]) => given[field] !== undefined && given[field] !== value)
    .map(([field]) => issue(TurnkeyValidationCode.ITEM_SUM_MISMATCH, '明細加總與銷售額不符', `amounts.${field}`));

  const taxIssues =
    given.taxAmount !== undefined && given.taxAmount !== computed.taxAmount
      ? [issue(TurnkeyValidationCode.TAX_AMOUNT_MISMATCH, `稅額應為 ${computed.taxAmount}`, 'amounts.taxAmount')]
      : [];

  const totalIssues =
    given.totalAmount !== undefined && given.totalAmount !== computed.totalAmount
      ? [issue(TurnkeyValidationCode.TOTAL_AMOUNT_MISMATCH, `總計應為 ${computed.totalAmount}`, 'amounts.totalAmount')]
      : [];

  return [...salesIssues, ...taxIssues, ...totalIssues];
};

const checkDates = (
  input: TurnkeyInvoiceIssueInput,
  context: InvoiceRuleContext,
): readonly TurnkeyValidationIssue[] => {
  const issuedAt = input.issuedAt ?? context.now;
  const deadline =
    (input.buyer?.taxId ? (context.b2bIssueDeadlineHours ?? 168) : (context.issueDeadlineHours ?? 48)) * HOUR;

  const tolerance = (context.futureToleranceDays ?? 3) * 24 * HOUR;

  return [
    ...(issuedAt.getTime() - context.now.getTime() > tolerance
      ? [issue(TurnkeyValidationCode.ISSUED_IN_FUTURE, '開立日期不得晚於未來 3 日', 'issuedAt')]
      : []),
    ...(context.now.getTime() - issuedAt.getTime() > deadline
      ? [issue(TurnkeyValidationCode.ISSUE_DEADLINE_PASSED, '已超過開立後上傳期限', 'issuedAt')]
      : []),
  ];
};

/**
 * 不需要查 DB 的開立檢核：金額、統編、載具、捐贈、零稅率、列印註記、日期。
 * 字軌、號碼與日期順序等需要 DB 的檢核由 service 在取號時處理。
 * 只用於新開立；同號重送送的是已存下的發票，不再跑這裡的日期檢核。
 */
const isValidSpecialTaxRate = (rate: number | undefined): boolean =>
  typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && rate < 1;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** 結構檢核：型別不對時後面的金額計算沒有意義，先擋下（REST body 未經 DTO 轉換） */
export const validateInvoiceShape = (input: TurnkeyInvoiceIssueInput): readonly TurnkeyValidationIssue[] => {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return [issue(TurnkeyValidationCode.ITEM_SUM_MISMATCH, '至少要有一筆明細', 'items')];
  }

  return input.items
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        typeof item !== 'object' ||
        item === null ||
        typeof item.description !== 'string' ||
        !isFiniteNumber(item.quantity) ||
        !isFiniteNumber(item.unitPrice) ||
        (item.amount != null && !isFiniteNumber(item.amount)) ||
        !Object.values(TurnkeyTaxType).includes(item.taxType) ||
        item.taxType === TurnkeyTaxType.MIXED,
    )
    .map(({ index }) =>
      issue(
        TurnkeyValidationCode.ITEM_SUM_MISMATCH,
        '品名需為字串、數量與單價需為數字、課稅別需為 TAXABLE／ZERO_RATED／TAX_FREE／SPECIAL',
        `items[${index}]`,
      ),
    );
};

export const validateInvoiceInput = (
  input: TurnkeyInvoiceIssueInput,
  context: InvoiceRuleContext,
): readonly TurnkeyValidationIssue[] => {
  const shapeIssues = validateInvoiceShape(input);

  if (shapeIssues.length) return shapeIssues;

  const buyerTaxId = input.buyer?.taxId;
  const isB2B = !!buyerTaxId;
  const isExchange = input.deliveryMode === TurnkeyDeliveryMode.EXCHANGE;
  const printed = input.printed ?? (!input.carrier && !input.donation);
  const computed = computeInvoiceAmounts(input.items, { isB2B, specialTaxRate: input.specialTaxRate });
  const hasSpecial = input.items.some(item => item.taxType === TurnkeyTaxType.SPECIAL);

  const itemIssues = input.items.length
    ? input.items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !(item.quantity > 0) || item.description.trim().length === 0 || itemAmount(item) < 0)
        .map(({ index }) =>
          issue(TurnkeyValidationCode.ITEM_SUM_MISMATCH, '品名不可空白、數量需大於 0、金額不可為負', `items[${index}]`),
        )
    : [issue(TurnkeyValidationCode.ITEM_SUM_MISMATCH, '至少要有一筆明細', 'items')];

  const itemAmountIssues = input.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.amount != null && roundTo(item.quantity * item.unitPrice) !== roundTo(item.amount))
    .map(({ index }) =>
      issue(TurnkeyValidationCode.ITEM_SUM_MISMATCH, '明細金額應等於數量乘以單價', `items[${index}].amount`),
    );

  return [
    ...itemIssues,
    ...itemAmountIssues,
    ...(computed.totalAmount <= 0
      ? [issue(TurnkeyValidationCode.TOTAL_AMOUNT_MISMATCH, '不得開立零元或負數發票', 'items')]
      : []),
    ...checkAmounts(input, computed),
    ...(buyerTaxId != null && !isTaxIdValid(buyerTaxId)
      ? [issue(TurnkeyValidationCode.INVALID_TAX_ID, '買方統編檢查碼錯誤', 'buyer.taxId')]
      : []),
    ...(isExchange && !isB2B
      ? [issue(TurnkeyValidationCode.BUYER_TAX_ID_REQUIRED, '交換發票必須有買方統編', 'buyer.taxId')]
      : []),
    // 特種稅額發票只能單一課稅別（MIG 課稅別 9 只涵蓋應稅、零稅率、免稅混合），稅率必須給
    ...(hasSpecial && computed.taxType === TurnkeyTaxType.MIXED
      ? [issue(TurnkeyValidationCode.TAX_TYPE_NOT_ALLOWED, '特種稅率品項不可與其他課稅別混開', 'items')]
      : []),
    ...(hasSpecial && !isValidSpecialTaxRate(input.specialTaxRate)
      ? [
          issue(
            TurnkeyValidationCode.TAX_TYPE_NOT_ALLOWED,
            '特種稅率品項需提供 specialTaxRate（0 到 1 之間）',
            'specialTaxRate',
          ),
        ]
      : []),
    ...(isExchange && computed.taxType === TurnkeyTaxType.MIXED
      ? [issue(TurnkeyValidationCode.TAX_TYPE_NOT_ALLOWED, '交換發票不可使用混合課稅別', 'items')]
      : []),
    ...checkCarrier(input),
    ...(input.donation && !isNpoCodeFormatValid(input.donation.npoCode)
      ? [issue(TurnkeyValidationCode.UNKNOWN_NPO_CODE, '捐贈碼需為 3 到 7 位數字', 'donation.npoCode')]
      : []),
    ...(input.donation && (isB2B || printed)
      ? [issue(TurnkeyValidationCode.DONATION_NOT_ALLOWED, '有買方統編或列印證明聯時不可捐贈', 'donation')]
      : []),
    ...(!input.carrier && !input.donation && !printed
      ? [issue(TurnkeyValidationCode.PRINT_MARK_REQUIRED, '沒有載具也沒有捐贈時必須列印證明聯', 'printed')]
      : []),
    // MIG：PrintMark 為 Y 時載具必須空白；唯一例外是消費者以手機條碼索取含買方統編的發票
    ...(printed && input.carrier && !(input.carrier.type === TurnkeyCarrierType.MOBILE && isB2B)
      ? [
          issue(
            TurnkeyValidationCode.PRINT_MARK_REQUIRED,
            '列印證明聯時不可記載載具（手機條碼索取統編發票除外）',
            'carrier',
          ),
        ]
      : []),
    ...(computed.zeroRatedSalesAmount > 0 && (!input.zeroRated || !/^7[1-9]$/.test(input.zeroRated.reasonCode))
      ? [issue(TurnkeyValidationCode.ZERO_RATED_FIELDS_REQUIRED, '零稅率需填通關方式與 71–79 的原因代碼', 'zeroRated')]
      : []),
    ...checkDates(input, context),
  ];
};

/**
 * 交換發票與交換折讓（A0101、B0101）必須帶賣方地址。
 * 缺了 Turnkey 本機就以 7001 擋下，號碼卻已用掉，所以在取號前檢查。
 */
export const validateExchangeSeller = (
  deliveryMode: TurnkeyDeliveryMode,
  seller: { readonly address: string | null },
): readonly TurnkeyValidationIssue[] =>
  deliveryMode === TurnkeyDeliveryMode.EXCHANGE && !seller.address?.trim()
    ? [
        issue(
          TurnkeyValidationCode.SELLER_ADDRESS_REQUIRED,
          '交換發票與折讓需要賣方地址，請先設定營業人地址',
          'companyTaxId',
        ),
      ]
    : [];
