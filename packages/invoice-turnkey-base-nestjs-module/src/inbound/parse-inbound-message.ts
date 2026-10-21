import { XMLParser } from 'fast-xml-parser';
import { TurnkeyMigMessageType } from '../typings/turnkey-enums';
import { parseMigDateTime } from '../utils/taipei-time';

export interface TurnkeyInboundMessage {
  readonly messageType: TurnkeyMigMessageType;
  /** 發票號碼或折讓單號 */
  readonly documentNumber: string;
  /** 原發票日期或折讓日期（yyyyMMdd） */
  readonly documentDate: string;
  readonly buyerTaxId: string;
  readonly sellerTaxId: string;
  /** 確認、退回、作廢的日期時間；A0101、B0101 為開立日期時間 */
  readonly occurredAt: Date | null;
  readonly reason: string | null;
  readonly xml: string;
}

const NAMESPACE_PATTERN = /^urn:GEINV:eInvoiceMessage:([A-Z]\d{4}):/;

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true });

type Node = Readonly<Record<string, unknown>>;

const text = (node: Node | undefined, key: string): string => {
  const value = node?.[key];

  return typeof value === 'string' ? value : '';
};

const at = (date: string, time: string): Date | null => (date ? parseMigDateTime(date, time || '00:00:00') : null);

/** 各訊息的號碼、日期與事件時間欄位（MIG 4.1） */
const extractors: Readonly<
  Partial<Record<TurnkeyMigMessageType, (root: Node) => Omit<TurnkeyInboundMessage, 'messageType' | 'xml'>>>
> = {
  [TurnkeyMigMessageType.A0101]: root => {
    const main = root.Main as Node;

    return {
      documentNumber: text(main, 'InvoiceNumber'),
      documentDate: text(main, 'InvoiceDate'),
      buyerTaxId: text(main.Buyer as Node, 'Identifier'),
      sellerTaxId: text(main.Seller as Node, 'Identifier'),
      occurredAt: at(text(main, 'InvoiceDate'), text(main, 'InvoiceTime')),
      reason: null,
    };
  },
  [TurnkeyMigMessageType.A0102]: root => ({
    documentNumber: text(root, 'InvoiceNumber'),
    documentDate: text(root, 'InvoiceDate'),
    buyerTaxId: text(root, 'BuyerId'),
    sellerTaxId: text(root, 'SellerId'),
    occurredAt: at(text(root, 'ReceiveDate'), text(root, 'ReceiveTime')),
    reason: null,
  }),
  [TurnkeyMigMessageType.A0201]: root => ({
    documentNumber: text(root, 'CancelInvoiceNumber'),
    documentDate: text(root, 'InvoiceDate'),
    buyerTaxId: text(root, 'BuyerId'),
    sellerTaxId: text(root, 'SellerId'),
    occurredAt: at(text(root, 'CancelDate'), text(root, 'CancelTime')),
    reason: text(root, 'CancelReason') || null,
  }),
  [TurnkeyMigMessageType.A0202]: root => ({
    documentNumber: text(root, 'CancelInvoiceNumber'),
    documentDate: text(root, 'InvoiceDate'),
    buyerTaxId: text(root, 'BuyerId'),
    sellerTaxId: text(root, 'SellerId'),
    occurredAt: at(text(root, 'CancelDate'), text(root, 'CancelTime')),
    reason: null,
  }),
  [TurnkeyMigMessageType.A0301]: root => ({
    documentNumber: text(root, 'RejectInvoiceNumber'),
    documentDate: text(root, 'InvoiceDate'),
    buyerTaxId: text(root, 'BuyerId'),
    sellerTaxId: text(root, 'SellerId'),
    occurredAt: at(text(root, 'RejectDate'), text(root, 'RejectTime')),
    reason: text(root, 'RejectReason') || null,
  }),
  [TurnkeyMigMessageType.A0302]: root => ({
    documentNumber: text(root, 'RejectInvoiceNumber'),
    documentDate: text(root, 'InvoiceDate'),
    buyerTaxId: text(root, 'BuyerId'),
    sellerTaxId: text(root, 'SellerId'),
    occurredAt: at(text(root, 'RejectDate'), text(root, 'RejectTime')),
    reason: null,
  }),
  [TurnkeyMigMessageType.B0101]: root => {
    const main = root.Main as Node;

    return {
      documentNumber: text(main, 'AllowanceNumber'),
      documentDate: text(main, 'AllowanceDate'),
      buyerTaxId: text(main.Buyer as Node, 'Identifier'),
      sellerTaxId: text(main.Seller as Node, 'Identifier'),
      occurredAt: at(text(main, 'AllowanceDate'), ''),
      reason: null,
    };
  },
  [TurnkeyMigMessageType.B0102]: root => ({
    documentNumber: text(root, 'AllowanceNumber'),
    documentDate: text(root, 'AllowanceDate'),
    buyerTaxId: text(root, 'BuyerId'),
    sellerTaxId: text(root, 'SellerId'),
    occurredAt: at(text(root, 'ReceiveDate'), text(root, 'ReceiveTime')),
    reason: null,
  }),
  [TurnkeyMigMessageType.B0201]: root => ({
    documentNumber: text(root, 'CancelAllowanceNumber'),
    documentDate: text(root, 'AllowanceDate'),
    buyerTaxId: text(root, 'BuyerId'),
    sellerTaxId: text(root, 'SellerId'),
    occurredAt: at(text(root, 'CancelDate'), text(root, 'CancelTime')),
    reason: text(root, 'CancelReason') || null,
  }),
  [TurnkeyMigMessageType.B0202]: root => ({
    documentNumber: text(root, 'CancelAllowanceNumber'),
    documentDate: text(root, 'AllowanceDate'),
    buyerTaxId: text(root, 'BuyerId'),
    sellerTaxId: text(root, 'SellerId'),
    occurredAt: at(text(root, 'CancelDate'), text(root, 'CancelTime')),
    reason: null,
  }),
};

/** 解析 RecvTarget 收到的 MIG XML；不認得的訊息回傳 null */
export const parseInboundMessage = (xml: string): TurnkeyInboundMessage | null => {
  const parsed = parser.parse(xml) as Record<string, Node>;
  const rootName = Object.keys(parsed).find(key => key !== '?xml');
  const root = rootName ? parsed[rootName] : undefined;
  const namespace = typeof root?.['@_xmlns'] === 'string' ? root['@_xmlns'] : '';
  const code = NAMESPACE_PATTERN.exec(namespace)?.[1] as TurnkeyMigMessageType | undefined;
  const extract = code ? extractors[code] : undefined;

  if (!root || !code || !extract) return null;

  const fields = extract(root);

  return fields.documentNumber ? { messageType: code, ...fields, xml } : null;
};
