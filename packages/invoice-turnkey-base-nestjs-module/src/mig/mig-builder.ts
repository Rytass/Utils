import { XMLBuilder } from 'fast-xml-parser';
import { TurnkeyCarrierType, TurnkeyCustomsClearance, TurnkeyMigMessageType } from '../typings/turnkey-enums';
import {
  TurnkeyAllowanceCancelDocument,
  TurnkeyAllowanceDocument,
  TurnkeyBlankNumberDocument,
  TurnkeyInvoiceCancelDocument,
  TurnkeyInvoiceDocument,
  TurnkeyOutboundDocument,
  TurnkeyParty,
  TurnkeyReplyDocument,
} from '../typings/turnkey-invoice.types';
import { TAX_TYPE_CODE } from '../utils/amounts';
import { formatMigDate, formatMigTime } from '../utils/taipei-time';

export const MIG_VERSION = '4.1';

/** B2C 的買方識別碼 */
export const CONSUMER_BUYER_ID = '0000000000';

/** 一般稅額計算的發票類別 */
const INVOICE_TYPE = '07';

/** 開立折讓證明單的折讓種類：2 為賣方開立 */
const ALLOWANCE_TYPE_SELLER = '2';

export const CARRIER_TYPE_CODE: Readonly<Partial<Record<TurnkeyCarrierType, string>>> = {
  [TurnkeyCarrierType.MOBILE]: '3J0002',
  [TurnkeyCarrierType.MOICA]: 'CQ0001',
};

const CUSTOMS_CLEARANCE_CODE: Readonly<Record<TurnkeyCustomsClearance, string>> = {
  [TurnkeyCustomsClearance.NOT_VIA_CUSTOMS]: '1',
  [TurnkeyCustomsClearance.VIA_CUSTOMS]: '2',
};

type XmlNode = { readonly [key: string]: XmlValue };
type XmlValue = string | number | XmlNode | readonly XmlNode[] | undefined;

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  format: true,
  indentBy: '  ',
  suppressEmptyNode: false,
  processEntities: true,
});

export const migNamespace = (type: TurnkeyMigMessageType): string => `urn:GEINV:eInvoiceMessage:${type}:${MIG_VERSION}`;

const ROOT_ELEMENT: Readonly<Record<TurnkeyMigMessageType, string>> = {
  [TurnkeyMigMessageType.F0401]: 'Invoice',
  [TurnkeyMigMessageType.A0101]: 'Invoice',
  [TurnkeyMigMessageType.F0501]: 'CancelInvoice',
  [TurnkeyMigMessageType.A0201]: 'CancelInvoice',
  [TurnkeyMigMessageType.F0701]: 'VoidInvoice',
  [TurnkeyMigMessageType.G0401]: 'Allowance',
  [TurnkeyMigMessageType.B0101]: 'Allowance',
  [TurnkeyMigMessageType.G0501]: 'CancelAllowance',
  [TurnkeyMigMessageType.B0201]: 'CancelAllowance',
  [TurnkeyMigMessageType.A0102]: 'InvoiceConfirm',
  [TurnkeyMigMessageType.A0202]: 'CancelInvoiceConfirm',
  [TurnkeyMigMessageType.A0301]: 'RejectInvoice',
  [TurnkeyMigMessageType.A0302]: 'RejectInvoiceConfirm',
  [TurnkeyMigMessageType.B0102]: 'AllowanceConfirm',
  [TurnkeyMigMessageType.B0202]: 'CancelAllowanceConfirm',
  [TurnkeyMigMessageType.E0402]: 'BranchTrackBlank',
};

/** 去掉 undefined 欄位，讓 XML 不出現空元素 */
const compact = (node: Record<string, XmlValue>): XmlNode =>
  Object.fromEntries(Object.entries(node).filter(([, value]) => value !== undefined)) as XmlNode;

const party = (value: TurnkeyParty): XmlNode =>
  compact({ Identifier: value.taxId, Name: value.name, Address: value.address });

/** XML 1.0 不允許的字元（TAB、LF、CR 以外的控制字元、U+FFFE/U+FFFF）；從其他系統複製來的品名常夾帶 */
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

const sanitize = (value: XmlValue): XmlValue => {
  if (typeof value === 'string') return value.replace(INVALID_XML_CHARACTERS, '');

  if (Array.isArray(value)) return value.map(node => sanitize(node) as XmlNode);

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sanitize(child)])) as XmlNode;
  }

  return value;
};

const toXml = (type: TurnkeyMigMessageType, body: XmlNode): string => {
  const root = ROOT_ELEMENT[type];
  const xml = builder.build({ [root]: { '@_xmlns': migNamespace(type), ...(sanitize(body) as XmlNode) } }) as string;

  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`;
};

const buildInvoice = (doc: TurnkeyInvoiceDocument): XmlNode => {
  const isStorage = doc.messageType === TurnkeyMigMessageType.F0401;
  const carrierTypeCode = doc.carrier ? (doc.carrier.typeCode ?? CARRIER_TYPE_CODE[doc.carrier.type]) : undefined;

  const main = compact({
    InvoiceNumber: doc.invoiceNumber,
    InvoiceDate: formatMigDate(doc.issuedAt),
    InvoiceTime: formatMigTime(doc.issuedAt),
    Seller: party(doc.seller),
    Buyer: party(doc.buyer),
    MainRemark: doc.mainRemark,
    CustomsClearanceMark: doc.zeroRated ? CUSTOMS_CLEARANCE_CODE[doc.zeroRated.customsClearance] : undefined,
    InvoiceType: INVOICE_TYPE,
    DonateMark: doc.donation ? '1' : '0',
    CarrierType: isStorage ? carrierTypeCode : undefined,
    CarrierId1: isStorage ? doc.carrier?.code : undefined,
    CarrierId2: isStorage && doc.carrier ? (doc.carrier.hiddenCode ?? doc.carrier.code) : undefined,
    PrintMark: isStorage ? (doc.printed ? 'Y' : 'N') : undefined,
    NPOBAN: isStorage ? doc.donation?.npoCode : undefined,
    RandomNumber: isStorage ? doc.randomNumber : undefined,
    ZeroTaxRateReason: doc.zeroRated?.reasonCode,
  });

  const details = {
    ProductItem: doc.items.map((item, index) =>
      compact({
        Description: item.description,
        Quantity: item.quantity,
        Unit: item.unit,
        UnitPrice: item.unitPrice,
        TaxType: TAX_TYPE_CODE[item.taxType],
        Amount: item.amount,
        SequenceNumber: String(index + 1),
        Remark: item.remark,
      }),
    ),
  };

  const amount = compact({
    SalesAmount: doc.amounts.salesAmount,
    FreeTaxSalesAmount: isStorage ? doc.amounts.taxFreeSalesAmount : undefined,
    ZeroTaxSalesAmount: isStorage ? doc.amounts.zeroRatedSalesAmount : undefined,
    TaxType: TAX_TYPE_CODE[doc.amounts.taxType],
    TaxRate: doc.amounts.taxRate,
    TaxAmount: doc.amounts.taxAmount,
    TotalAmount: doc.amounts.totalAmount,
  });

  return { Main: main, Details: details, Amount: amount };
};

const buildInvoiceCancel = (doc: TurnkeyInvoiceCancelDocument): XmlNode => {
  const isAnnul = doc.messageType === TurnkeyMigMessageType.F0701;
  const prefix = isAnnul ? 'Void' : 'Cancel';

  return compact({
    [`${prefix}InvoiceNumber`]: doc.invoiceNumber,
    InvoiceDate: formatMigDate(doc.invoiceIssuedAt),
    BuyerId: doc.buyerTaxId ?? CONSUMER_BUYER_ID,
    SellerId: doc.sellerTaxId,
    [`${prefix}Date`]: formatMigDate(doc.cancelledAt),
    [`${prefix}Time`]: formatMigTime(doc.cancelledAt),
    [`${prefix}Reason`]: doc.reason,
    Remark: doc.remark,
  });
};

const buildAllowance = (doc: TurnkeyAllowanceDocument): XmlNode => ({
  Main: {
    AllowanceNumber: doc.allowanceNumber,
    AllowanceDate: formatMigDate(doc.allowanceDate),
    Seller: party(doc.seller),
    Buyer: party(doc.buyer),
    AllowanceType: ALLOWANCE_TYPE_SELLER,
  },
  Details: {
    ProductItem: doc.items.map((item, index) =>
      compact({
        OriginalInvoiceDate: formatMigDate(item.originalInvoiceIssuedAt),
        OriginalInvoiceNumber: item.originalInvoiceNumber,
        OriginalSequenceNumber:
          item.originalSequenceNumber !== undefined ? String(item.originalSequenceNumber) : undefined,
        OriginalDescription: item.originalDescription,
        Quantity: item.quantity,
        Unit: item.unit,
        UnitPrice: item.unitPrice,
        Amount: item.amount,
        Tax: item.tax,
        AllowanceSequenceNumber: String(index + 1),
        TaxType: TAX_TYPE_CODE[item.taxType],
      }),
    ),
  },
  Amount: {
    TaxAmount: doc.taxAmount,
    TotalAmount: doc.totalAmount,
  },
});

const buildAllowanceCancel = (doc: TurnkeyAllowanceCancelDocument): XmlNode => ({
  CancelAllowanceNumber: doc.allowanceNumber,
  AllowanceType: ALLOWANCE_TYPE_SELLER,
  AllowanceDate: formatMigDate(doc.allowanceDate),
  BuyerId: doc.buyerTaxId ?? CONSUMER_BUYER_ID,
  SellerId: doc.sellerTaxId,
  CancelDate: formatMigDate(doc.cancelledAt),
  CancelTime: formatMigTime(doc.cancelledAt),
  CancelReason: doc.reason,
});

const buildReply = (doc: TurnkeyReplyDocument): XmlNode => {
  const date = formatMigDate(doc.repliedAt);
  const time = formatMigTime(doc.repliedAt);
  const parties = { BuyerId: doc.buyerTaxId, SellerId: doc.sellerTaxId };
  const documentDate = formatMigDate(doc.documentDate);

  switch (doc.messageType) {
    case TurnkeyMigMessageType.A0102:
      return compact({
        InvoiceNumber: doc.documentNumber,
        InvoiceDate: documentDate,
        ...parties,
        ReceiveDate: date,
        ReceiveTime: time,
        Remark: doc.remark,
      });

    case TurnkeyMigMessageType.A0202:
      return compact({
        CancelInvoiceNumber: doc.documentNumber,
        InvoiceDate: documentDate,
        ...parties,
        CancelDate: date,
        CancelTime: time,
        Remark: doc.remark,
      });

    case TurnkeyMigMessageType.A0301:
      return compact({
        RejectInvoiceNumber: doc.documentNumber,
        InvoiceDate: documentDate,
        ...parties,
        RejectDate: date,
        RejectTime: time,
        RejectReason: doc.reason ?? '',
        Remark: doc.remark,
      });

    case TurnkeyMigMessageType.A0302:
      return compact({
        RejectInvoiceNumber: doc.documentNumber,
        InvoiceDate: documentDate,
        ...parties,
        RejectDate: date,
        RejectTime: time,
        Remark: doc.remark,
      });

    case TurnkeyMigMessageType.B0102:
      return compact({
        AllowanceNumber: doc.documentNumber,
        AllowanceDate: documentDate,
        ...parties,
        ReceiveDate: date,
        ReceiveTime: time,
        AllowanceType: ALLOWANCE_TYPE_SELLER,
        Remark: doc.remark,
      });

    case TurnkeyMigMessageType.B0202:
      return compact({
        CancelAllowanceNumber: doc.documentNumber,
        AllowanceDate: documentDate,
        ...parties,
        CancelDate: date,
        CancelTime: time,
        AllowanceType: ALLOWANCE_TYPE_SELLER,
        Remark: doc.remark,
      });
  }
};

const buildBlankNumbers = (doc: TurnkeyBlankNumberDocument): XmlNode => ({
  Main: {
    HeadBan: doc.headTaxId,
    BranchBan: doc.branchTaxId,
    InvoiceType: INVOICE_TYPE,
    YearMonth: doc.period,
    InvoiceTrack: doc.track,
  },
  Details: {
    BranchTrackBlankItem: doc.ranges.map(range => ({ InvoiceBeginNo: range.begin, InvoiceEndNo: range.end })),
  },
});

const buildBody = (doc: TurnkeyOutboundDocument): XmlNode => {
  switch (doc.messageType) {
    case TurnkeyMigMessageType.F0401:
    case TurnkeyMigMessageType.A0101:
      return buildInvoice(doc);

    case TurnkeyMigMessageType.F0501:
    case TurnkeyMigMessageType.A0201:
    case TurnkeyMigMessageType.F0701:
      return buildInvoiceCancel(doc);

    case TurnkeyMigMessageType.G0401:
    case TurnkeyMigMessageType.B0101:
      return buildAllowance(doc);

    case TurnkeyMigMessageType.G0501:
    case TurnkeyMigMessageType.B0201:
      return buildAllowanceCancel(doc);

    case TurnkeyMigMessageType.E0402:
      return buildBlankNumbers(doc);

    default:
      return buildReply(doc);
  }
};

/** 產生 MIG 4.1 XML（UTF-8，含 XML 宣告） */
export const buildMigXml = (doc: TurnkeyOutboundDocument): string => toXml(doc.messageType, buildBody(doc));
