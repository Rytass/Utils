import { XMLParser } from 'fast-xml-parser';

/** E0501 營業人電子發票配號檔的一個配號區間（InvoiceAssignNo） */
export interface TurnkeyAssignmentEntry {
  /** 營業人統編（Ban） */
  readonly companyTaxId: string;
  /** 07 一般稅額、08 特種稅額 */
  readonly invoiceType: string;
  /** 期別，民國年 3 碼＋雙數月 */
  readonly period: string;
  readonly track: string;
  readonly beginNumber: string;
  readonly endNumber: string;
  /** 本數 */
  readonly booklets: number;
}

// 去掉命名空間前綴並以本地名稱取值：v31、v32、v41 的 namespace 不同，結構相同
const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  removeNSPrefix: true,
});

type Node = Readonly<Record<string, unknown>>;

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null;

/** 找出任意深度的 InvoiceAssignNo（可能包在 InvoiceEnvelope／InvoicePack 內，也可能有多筆） */
const findAssignments = (node: unknown): readonly Node[] => {
  if (Array.isArray(node)) return node.flatMap(findAssignments);

  if (!isNode(node)) return [];

  return Object.entries(node).flatMap(([key, value]) =>
    key === 'InvoiceAssignNo' ? (Array.isArray(value) ? value : [value]).filter(isNode) : findAssignments(value),
  );
};

const text = (node: Node, key: string): string => {
  const value = node[key];

  return typeof value === 'string' ? value : '';
};

/** 解析 E0501 配號檔；不是配號檔（找不到 InvoiceAssignNo）時回傳空陣列 */
export const parseAssignmentFile = (xml: string): readonly TurnkeyAssignmentEntry[] =>
  findAssignments(parser.parse(xml)).map(node => ({
    companyTaxId: text(node, 'Ban'),
    invoiceType: text(node, 'InvoiceType'),
    period: text(node, 'YearMonth'),
    track: text(node, 'InvoiceTrack'),
    beginNumber: text(node, 'InvoiceBeginNo'),
    endNumber: text(node, 'InvoiceEndNo'),
    booklets: Number(text(node, 'InvoiceBooklet')),
  }));
