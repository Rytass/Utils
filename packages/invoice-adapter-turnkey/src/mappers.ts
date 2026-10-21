import { InvoiceCarrierType, CustomsMark, isValidVATNumber, TaxType } from '@rytass/invoice';
import { TurnkeyCustomsClearance } from './constants';
import { TurnkeyInvoice } from './turnkey-invoice';
import { TurnkeyInvoiceAllowance } from './turnkey-allowance';
import {
  TurnkeyAllowanceItem,
  TurnkeyAllowanceRequestBody,
  TurnkeyAllowanceRequestItem,
  TurnkeyAllowanceResponse,
  TurnkeyDeliveryMode,
  TurnkeyInvoiceIssueOptions,
  TurnkeyInvoiceItemResponse,
  TurnkeyInvoiceResponse,
  TurnkeyIssueRequestBody,
  TurnkeyIssueRequestItem,
  TurnkeyItemTaxType,
  TurnkeyPaymentItem,
  TurnkeyTaxType,
} from './typings';
import { TURNKEY_ALLOWANCE_STATE, TURNKEY_INVOICE_STATE } from './constants';

type TurnkeyPaymentTaxType = TaxType.TAXED | TaxType.TAX_FREE | TaxType.ZERO_TAX | TaxType.SPECIAL;

export const toTurnkeyItemTaxType = (taxType: TaxType): TurnkeyItemTaxType => {
  switch (taxType) {
    case TaxType.TAXED:
      return 'TAXABLE';

    case TaxType.ZERO_TAX:
      return 'ZERO_RATED';

    case TaxType.TAX_FREE:
      return 'TAX_FREE';

    case TaxType.SPECIAL:
      return 'SPECIAL';

    case TaxType.MIXED:
      throw new Error('MIXED tax type is only valid at invoice level, not on an item');
  }
};

export const fromTurnkeyItemTaxType = (taxType: TurnkeyItemTaxType): TurnkeyPaymentTaxType => {
  switch (taxType) {
    case 'TAXABLE':
      return TaxType.TAXED;

    case 'ZERO_RATED':
      return TaxType.ZERO_TAX;

    case 'TAX_FREE':
      return TaxType.TAX_FREE;

    case 'SPECIAL':
      return TaxType.SPECIAL;
  }
};

export const fromTurnkeyTaxType = (taxType: TurnkeyTaxType): TaxType => {
  if (taxType === 'MIXED') return TaxType.MIXED;

  return fromTurnkeyItemTaxType(taxType);
};

const requireCarrierCode = (code: string | undefined, carrierType: string): string => {
  if (!code) {
    throw new Error(`carrier code is required for ${carrierType}`);
  }

  return code;
};

type CarrierFields = Pick<TurnkeyIssueRequestBody, 'printed' | 'donation' | 'carrier'>;

const requireTypeCode = (typeCode: string | undefined, carrierType: string): string => {
  if (!typeCode) {
    throw new Error(`carrier typeCode is required for ${carrierType}`);
  }

  return typeCode;
};

const toCarrierFields = (carrier: TurnkeyInvoiceIssueOptions['carrier']): CarrierFields => {
  if (!carrier) return {};

  switch (carrier.type) {
    case InvoiceCarrierType.PRINT:
      return { printed: true };

    case InvoiceCarrierType.LOVE_CODE:
      return { donation: { npoCode: requireCarrierCode(carrier.code, carrier.type) } };

    case InvoiceCarrierType.MOBILE:
      return { carrier: { type: 'MOBILE', code: requireCarrierCode(carrier.code, carrier.type) } };

    case InvoiceCarrierType.MOICA:
      return { carrier: { type: 'MOICA', code: requireCarrierCode(carrier.code, carrier.type) } };

    case InvoiceCarrierType.MEMBER:
      return {
        carrier: {
          type: 'MEMBER',
          code: requireCarrierCode(carrier.code, carrier.type),
          typeCode: requireTypeCode(carrier.typeCode, carrier.type),
        },
      };

    case InvoiceCarrierType.PLATFORM:
      return {
        carrier: {
          type: 'PLATFORM',
          code: requireCarrierCode(carrier.code, carrier.type),
          typeCode: requireTypeCode(carrier.typeCode, carrier.type),
        },
      };
  }
};

const hasItemTaxType = (items: TurnkeyPaymentItem[], taxType: TaxType): boolean =>
  items.some(item => item.taxType === taxType);

const toIssueRequestItem = (item: TurnkeyPaymentItem): TurnkeyIssueRequestItem => ({
  description: item.name,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  taxType: toTurnkeyItemTaxType(item.taxType ?? TaxType.TAXED),
  ...(item.unit !== undefined ? { unit: item.unit } : {}),
  ...(item.remark !== undefined ? { remark: item.remark } : {}),
});

const toBuyer = (options: TurnkeyInvoiceIssueOptions): TurnkeyIssueRequestBody['buyer'] => {
  const taxId = options.vatNumber;
  const name = options.buyer?.name;
  const address = options.buyer?.address;

  if (!taxId && !name && !address) return undefined;

  return {
    ...(taxId ? { taxId } : {}),
    ...(name ? { name } : {}),
    ...(address ? { address } : {}),
  };
};

export const toIssueRequestBody = (
  options: TurnkeyInvoiceIssueOptions,
  deliveryMode: TurnkeyDeliveryMode,
): TurnkeyIssueRequestBody => {
  if (!options.orderId) {
    throw new Error('`orderId` is required');
  }

  if (options.items.length === 0) {
    throw new Error('`items` should not be empty');
  }

  if (options.vatNumber && !isValidVATNumber(options.vatNumber)) {
    throw new Error('Invalid VAT number format');
  }

  const zeroRated = hasItemTaxType(options.items, TaxType.ZERO_TAX);

  if (zeroRated && !options.zeroRatedReasonCode) {
    throw new Error('`zeroRatedReasonCode` is required when ZERO_TAX items are provided');
  }

  const special = hasItemTaxType(options.items, TaxType.SPECIAL);

  if (special && options.specialTaxRate === undefined) {
    throw new Error('`specialTaxRate` is required when SPECIAL items are provided');
  }

  const buyer = toBuyer(options);

  return {
    deliveryMode,
    externalId: options.orderId,
    ...(buyer ? { buyer } : {}),
    items: options.items.map(toIssueRequestItem),
    ...(options.issuedAt ? { issuedAt: options.issuedAt.toISOString() } : {}),
    ...toCarrierFields(options.carrier),
    ...(zeroRated && options.zeroRatedReasonCode
      ? {
          zeroRated: {
            reasonCode: options.zeroRatedReasonCode,
            customsClearance: TurnkeyCustomsClearance[options.customsMark ?? CustomsMark.NO],
          },
        }
      : {}),
    ...(special && options.specialTaxRate !== undefined ? { specialTaxRate: options.specialTaxRate } : {}),
    ...(options.remark !== undefined ? { mainRemark: options.remark } : {}),
  };
};

export const toAllowanceItemRequest = (
  item: TurnkeyAllowanceItem,
  fallbackTaxType: TaxType,
): TurnkeyAllowanceRequestItem => ({
  ...(item.originalSequenceNumber !== undefined ? { originalSequenceNumber: item.originalSequenceNumber } : {}),
  description: item.name,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  taxType: toTurnkeyItemTaxType(item.taxType ?? fallbackTaxType),
});

export const toAllowanceRequestBody = (
  invoiceNumber: string,
  items: TurnkeyAllowanceItem[],
  fallbackTaxType: TaxType,
): TurnkeyAllowanceRequestBody => ({
  invoiceNumber,
  items: items.map(item => toAllowanceItemRequest(item, fallbackTaxType)),
});

const toPaymentItem = (item: TurnkeyInvoiceItemResponse): TurnkeyPaymentItem => ({
  name: item.description,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  taxType: fromTurnkeyItemTaxType(item.taxType),
});

export const toTurnkeyInvoice = (response: TurnkeyInvoiceResponse): TurnkeyInvoice =>
  new TurnkeyInvoice({
    invoiceNumber: response.invoiceNumber ?? '',
    randomCode: response.randomNumber ?? '',
    issuedOn: new Date(response.issuedAt),
    issuedAmount: response.totalAmount,
    items: response.items.map(toPaymentItem),
    taxType: fromTurnkeyTaxType(response.taxType),
    externalId: response.externalId,
    turnkeyStatus: response.status,
    state: TURNKEY_INVOICE_STATE[response.status],
    voidOn: response.voidedAt ? new Date(response.voidedAt) : null,
  });

/** 折讓金額（含稅）：REST 的 totalAmount 為未稅，與發票 totalAmount（含稅）比較時需加上 taxAmount。 */
export const toAllowanceAmount = (response: TurnkeyAllowanceResponse): number =>
  response.totalAmount + response.taxAmount;

/** VOIDED（已作廢）與 FAILED（未成立）的折讓不扣減發票餘額。 */
const isBalanceReducing = (status: TurnkeyAllowanceResponse['status']): boolean =>
  status !== 'VOIDED' && status !== 'FAILED';

export const toTurnkeyAllowance = (
  response: TurnkeyAllowanceResponse,
  parentInvoice: TurnkeyInvoice,
): TurnkeyInvoiceAllowance => {
  const amount = toAllowanceAmount(response);

  return new TurnkeyInvoiceAllowance({
    allowanceNumber: response.allowanceNumber ?? '',
    allowancePrice: amount,
    allowancedOn: new Date(response.allowanceDate),
    remainingAmount: parentInvoice.nowAmount - (isBalanceReducing(response.status) ? amount : 0),
    items: response.items.map(toPaymentItem),
    parentInvoice,
    status: TURNKEY_ALLOWANCE_STATE[response.status],
    turnkeyStatus: response.status,
    invalidOn: response.voidedAt ? new Date(response.voidedAt) : null,
  });
};
