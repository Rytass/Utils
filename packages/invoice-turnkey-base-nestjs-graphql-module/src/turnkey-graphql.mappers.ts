import {
  BaseTurnkeyInvoiceEntity,
  TurnkeyAllowanceEntity,
  TurnkeyAllowanceIssueInput,
  TurnkeyBlankNumberReport,
  TurnkeyCompanyView,
  TurnkeyEvent,
  TurnkeyInvoiceNumberEntity,
  TurnkeyReceivedDocumentEntity,
  TurnkeyInvoiceIssueInput,
  TurnkeyInvoiceTrackEntity,
  TurnkeyItemTaxType,
  TurnkeySubmissionEntity,
  TurnkeySubmissionStatus,
  TurnkeyTaxType,
  TurnkeyValidationCode,
  TurnkeyValidationError,
} from '@rytass/invoice-turnkey-base-nestjs-module';
import { TurnkeyAllowanceDto, TurnkeyAllowanceItemDto } from './dto/turnkey-allowance.dto';
import { TurnkeyEventDto } from './dto/turnkey-event.dto';
import {
  IssueTurnkeyAllowanceInput,
  IssueTurnkeyInvoiceInput,
  TurnkeyInvoiceItemInput,
} from './dto/turnkey-invoice.input';
import { TurnkeyInvoiceDto, TurnkeyInvoiceItemDto } from './dto/turnkey-invoice.dto';
import { TurnkeyInvoiceTrackDto } from './dto/turnkey-track.dto';
import { TurnkeySubmissionDto } from './dto/turnkey-submission.dto';
import { TurnkeyReceivedDocumentDto } from './dto/turnkey-received-document.dto';
import { TurnkeyInvoiceNumberDto } from './dto/turnkey-invoice-number.dto';
import { TurnkeyBlankNumberReportDto } from './dto/turnkey-blank-number.dto';
import { TurnkeyCompanyDto } from './dto/turnkey-company.dto';
import { parseIsoDate } from './turnkey-graphql.helpers';

const byNullable = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

/** MIXED 只能用在發票整體，不能用在明細（與 Core 的 TurnkeyItemTaxType 一致） */
export const toItemTaxType = (taxType: TurnkeyTaxType): TurnkeyItemTaxType => {
  if (taxType === TurnkeyTaxType.MIXED) {
    throw new TurnkeyValidationError([
      { code: TurnkeyValidationCode.TAX_TYPE_NOT_ALLOWED, message: '明細不可使用 MIXED 課稅別', field: 'taxType' },
    ]);
  }

  return taxType;
};

export const toInvoiceItemDto = (item: BaseTurnkeyInvoiceEntity['items'][number]): TurnkeyInvoiceItemDto => ({
  id: item.id,
  sequenceNumber: item.sequenceNumber,
  description: item.description,
  quantity: item.quantity,
  unit: item.unit,
  unitPrice: item.unitPrice,
  amount: item.amount,
  taxType: item.taxType,
  remark: item.remark,
});

export const toInvoiceDto = (invoice: BaseTurnkeyInvoiceEntity): TurnkeyInvoiceDto => ({
  id: invoice.id,
  companyTaxId: invoice.companyTaxId,
  invoiceNumber: invoice.invoiceNumber,
  externalId: invoice.externalId,
  deliveryMode: invoice.deliveryMode,
  status: invoice.status,
  issuedAt: invoice.issuedAt,
  buyerTaxId: invoice.buyerTaxId,
  buyerName: invoice.buyerName,
  buyerAddress: invoice.buyerAddress,
  taxType: invoice.taxType,
  taxRate: invoice.taxRate,
  salesAmount: invoice.salesAmount,
  taxFreeSalesAmount: invoice.taxFreeSalesAmount,
  zeroRatedSalesAmount: invoice.zeroRatedSalesAmount,
  taxAmount: invoice.taxAmount,
  totalAmount: invoice.totalAmount,
  carrierType: invoice.carrierType,
  carrierCode: invoice.carrierCode,
  carrierHiddenCode: invoice.carrierHiddenCode,
  carrierTypeCode: invoice.carrierTypeCode,
  npoCode: invoice.npoCode,
  printed: invoice.printed,
  randomNumber: invoice.randomNumber,
  zeroRatedReasonCode: invoice.zeroRatedReasonCode,
  customsClearance: invoice.customsClearance,
  mainRemark: invoice.mainRemark,
  voidedAt: invoice.voidedAt,
  voidReason: invoice.voidReason,
  items: [...(invoice.items ?? [])].sort((a, b) => a.sequenceNumber - b.sequenceNumber).map(toInvoiceItemDto),
  createdAt: invoice.createdAt,
  updatedAt: invoice.updatedAt,
});

export const toAllowanceDto = (allowance: TurnkeyAllowanceEntity): TurnkeyAllowanceDto => ({
  id: allowance.id,
  companyTaxId: allowance.companyTaxId,
  allowanceNumber: allowance.allowanceNumber,
  externalId: allowance.externalId,
  invoiceNumber: allowance.invoiceNumber,
  deliveryMode: allowance.deliveryMode,
  status: allowance.status,
  allowanceDate: allowance.allowanceDate,
  buyerTaxId: allowance.buyerTaxId,
  totalAmount: allowance.totalAmount,
  taxAmount: allowance.taxAmount,
  voidedAt: allowance.voidedAt,
  voidReason: allowance.voidReason,
  items: [...(allowance.items ?? [])]
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    .map(
      (item): TurnkeyAllowanceItemDto => ({
        id: item.id,
        sequenceNumber: item.sequenceNumber,
        originalSequenceNumber: item.originalSequenceNumber,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        tax: item.tax,
        taxType: item.taxType,
      }),
    ),
  createdAt: allowance.createdAt,
  updatedAt: allowance.updatedAt,
});

export const toTrackDto = (track: TurnkeyInvoiceTrackEntity, remaining: number | null): TurnkeyInvoiceTrackDto => ({
  id: track.id,
  companyTaxId: track.companyTaxId,
  period: track.period,
  track: track.track,
  beginNumber: track.beginNumber,
  endNumber: track.endNumber,
  remaining,
  createdAt: track.createdAt,
});

export const toSubmissionDto = (submission: TurnkeySubmissionEntity): TurnkeySubmissionDto => ({
  id: submission.id,
  companyTaxId: submission.companyTaxId,
  messageType: submission.messageType,
  category: submission.category,
  documentNumber: submission.documentNumber,
  status: submission.status,
  turnkeyUuid: submission.turnkeyUuid,
  resultCode: submission.resultCode,
  resultMessage: submission.resultMessage,
  previousSubmissionId: submission.previousSubmissionId,
  writtenAt: submission.writtenAt,
  resolvedAt: submission.resolvedAt,
  createdAt: submission.createdAt,
  updatedAt: submission.updatedAt,
});

export const toEventDto = (event: TurnkeyEvent): TurnkeyEventDto => ({
  id: event.id,
  type: event.type,
  companyTaxId: event.companyTaxId,
  data: event.data,
  createdAt: event.createdAt,
});

const toInvoiceItemInput = (item: TurnkeyInvoiceItemInput): TurnkeyInvoiceIssueInput['items'][number] => ({
  description: item.description,
  quantity: item.quantity,
  unitPrice: item.unitPrice,
  taxType: toItemTaxType(item.taxType),
  amount: byNullable(item.amount),
  unit: byNullable(item.unit),
  remark: byNullable(item.remark),
});

/** GraphQL 輸入轉成 Core 的開立參數；issuedAt 在這裡才解析成 Date */
export const toInvoiceIssueInput = (
  input: IssueTurnkeyInvoiceInput,
  companyTaxId: string,
): TurnkeyInvoiceIssueInput => ({
  companyTaxId,
  deliveryMode: input.deliveryMode,
  externalId: byNullable(input.externalId),
  buyer: input.buyer
    ? {
        taxId: byNullable(input.buyer.taxId),
        name: byNullable(input.buyer.name),
        address: byNullable(input.buyer.address),
      }
    : undefined,
  items: input.items.map(toInvoiceItemInput),
  issuedAt: parseIsoDate(input.issuedAt, 'issuedAt'),
  carrier: input.carrier
    ? {
        type: input.carrier.type,
        code: input.carrier.code,
        hiddenCode: byNullable(input.carrier.hiddenCode),
        typeCode: byNullable(input.carrier.typeCode),
      }
    : undefined,
  donation: input.donation ? { npoCode: input.donation.npoCode } : undefined,
  printed: byNullable(input.printed),
  zeroRated: input.zeroRated
    ? {
        reasonCode: input.zeroRated.reasonCode,
        customsClearance: input.zeroRated.customsClearance,
      }
    : undefined,
  specialTaxRate: byNullable(input.specialTaxRate),
  mainRemark: byNullable(input.mainRemark),
});

export const toAllowanceIssueInput = (
  input: IssueTurnkeyAllowanceInput,
  companyTaxId: string,
): TurnkeyAllowanceIssueInput => ({
  companyTaxId,
  invoiceNumber: input.invoiceNumber,
  externalId: byNullable(input.externalId),
  allowanceNumber: byNullable(input.allowanceNumber),
  allowanceDate: parseIsoDate(input.allowanceDate, 'allowanceDate'),
  items: input.items.map(item => ({
    originalSequenceNumber: byNullable(item.originalSequenceNumber),
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    taxType: toItemTaxType(item.taxType),
    amount: byNullable(item.amount),
  })),
});

export const toReceivedDocumentDto = (document: TurnkeyReceivedDocumentEntity): TurnkeyReceivedDocumentDto => ({
  id: document.id,
  buyerTaxId: document.buyerTaxId,
  sellerTaxId: document.sellerTaxId,
  messageType: document.messageType,
  documentNumber: document.documentNumber,
  documentDate: document.documentDate,
  occurredAt: document.occurredAt ?? null,
  reason: document.reason ?? null,
  status: document.status,
  fileName: document.fileName,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
});

export const toInvoiceNumberDto = (entry: TurnkeyInvoiceNumberEntity): TurnkeyInvoiceNumberDto => ({
  id: entry.id,
  companyTaxId: entry.companyTaxId,
  period: entry.period,
  invoiceNumber: entry.invoiceNumber,
  status: entry.status,
  updatedAt: entry.updatedAt,
});

export const toBlankNumberReportDto = (report: TurnkeyBlankNumberReport): TurnkeyBlankNumberReportDto => ({
  id: report.submissionId,
  track: report.track,
  submissionId: report.submissionId,
  ranges: report.ranges.map(range => ({
    id: `${report.submissionId}:${range.begin}-${range.end}`,
    begin: range.begin,
    end: range.end,
  })),
});

export const toCompanyDto = (company: TurnkeyCompanyView): TurnkeyCompanyDto => ({ ...company, id: company.taxId });

/** service 實際使用的筆數（1 到 500） */
const effectiveLimit = (limit: number): number => Math.min(Math.max(limit, 1), 500);

/**
 * 集合的 id 由正規化後的查詢條件組成：等價的查詢（省略 status 與 PENDING、超過上限的 limit）得到同一個 id，
 * 讓 Apollo Client 把它們視為同一個快取項目。
 */
export const submissionCollectionId = (
  companyTaxId: string,
  status: TurnkeySubmissionStatus | null,
  documentNumber: string | null,
  limit: number,
): string =>
  [
    'turnkeySubmissions',
    companyTaxId,
    // 指定單號時 status 只是額外篩選，省略代表全部；未指定單號時省略等同 PENDING
    documentNumber ? (status ?? '') : (status ?? TurnkeySubmissionStatus.PENDING),
    documentNumber ?? '',
    effectiveLimit(limit),
  ].join(':');

export const eventCollectionId = (companyTaxId: string, after: string | null, limit: number): string =>
  ['turnkeyEvents', companyTaxId, after ?? '', effectiveLimit(limit)].join(':');
