import { TurnkeyCustomsClearance, TurnkeyDeliveryMode, TurnkeyTaxType } from '../../typings/turnkey-enums';
import type { TurnkeyAllowanceProof, TurnkeyInvoiceProof, TurnkeyProofParty } from '../turnkey-print.types';
import type { InvoiceCodeGraphics } from './codes';
import { formatAmount, formatDate, formatDateTime, formatInvoiceNumber } from './format';
import {
  type DrawOp,
  LayoutCursor,
  type Page,
  type TextAlign,
  type TextMetrics,
  type TextOp,
  wrapText,
} from './layout';

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_MM = 15;
/** 頁尾（頁碼與交換註記）保留的空間 */
const BOTTOM_RESERVE_MM = 24;
const CELL_PAD_MM = 1.5;
const BODY_PT = 9;
const HEADER_PT = 9;
const TOTAL_ROW_MM = 7;
const TOTAL_BOX_WIDTH_MM = 85;

/** A4 的條碼窄條較寬，約 82 mm 寬 */
const BARCODE_NARROW_MM = 0.3;
const BARCODE_HEIGHT_MM = 14;
const QR_MODULE_MM = 0.5;
const QR_QUIET_MM = 3;
const QR_GAP_MM = 6;

interface Column {
  readonly title: string;
  /** 未指定寬度的欄位吃掉剩下的寬度（只能有一欄） */
  readonly width?: number;
  readonly align: TextAlign;
}

interface ResolvedColumn {
  readonly title: string;
  readonly x: number;
  readonly width: number;
  readonly align: TextAlign;
}

type TotalRow = readonly [string, number];

const INVOICE_COLUMNS: readonly Column[] = [
  { title: '品名', align: 'left' },
  { title: '數量', width: 14, align: 'right' },
  { title: '單位', width: 12, align: 'center' },
  { title: '單價', width: 22, align: 'right' },
  { title: '金額', width: 24, align: 'right' },
  { title: '備註', width: 28, align: 'left' },
];

const ALLOWANCE_COLUMNS: readonly Column[] = [
  { title: '品名', align: 'left' },
  { title: '數量', width: 16, align: 'right' },
  { title: '單價', width: 24, align: 'right' },
  { title: '金額', width: 26, align: 'right' },
  { title: '稅額', width: 22, align: 'right' },
];

const createCursor = (metrics: TextMetrics): LayoutCursor =>
  new LayoutCursor({
    widthMm: PAGE_WIDTH_MM,
    pageHeightMm: PAGE_HEIGHT_MM,
    marginMm: MARGIN_MM,
    topMarginMm: MARGIN_MM,
    bottomMarginMm: BOTTOM_RESERVE_MM,
    metrics,
  });

const resolveColumns = (columns: readonly Column[], contentWidth: number): readonly ResolvedColumn[] => {
  const fixedWidth = columns.reduce((sum, column) => sum + (column.width ?? 0), 0);

  return columns.reduce<{ readonly list: readonly ResolvedColumn[]; readonly x: number }>(
    (state, column) => {
      const width = column.width ?? contentWidth - fixedWidth;

      return {
        list: [...state.list, { title: column.title, x: state.x, width, align: column.align }],
        x: state.x + width,
      };
    },
    { list: [], x: MARGIN_MM },
  ).list;
};

const rowHeight = (
  cursor: LayoutCursor,
  columns: readonly ResolvedColumn[],
  cells: readonly string[],
  sizePt: number,
): number => {
  const lineHeight = cursor.metrics.lineHeightMm(sizePt);
  const lineCount = columns.map(
    (column, index) => wrapText(cells[index] ?? '', column.width - 2 * CELL_PAD_MM, sizePt, cursor.metrics).length,
  );

  return Math.max(...lineCount) * lineHeight + 2 * CELL_PAD_MM;
};

const drawRow = (
  cursor: LayoutCursor,
  columns: readonly ResolvedColumn[],
  cells: readonly string[],
  sizePt: number,
): void => {
  const height = rowHeight(cursor, columns, cells, sizePt);

  columns.forEach((column, index) => {
    cursor.paragraph(cells[index] ?? '', {
      x: column.x + CELL_PAD_MM,
      y: cursor.y + CELL_PAD_MM,
      width: column.width - 2 * CELL_PAD_MM,
      sizePt,
      align: column.align,
    });

    cursor.rect(column.x, cursor.y, column.width, height);
  });

  cursor.advance(height);
};

/** 品項表：每頁重畫表頭，列高依內容換行數決定 */
const drawTable = (cursor: LayoutCursor, columns: readonly Column[], rows: readonly (readonly string[])[]): void => {
  const resolved = resolveColumns(columns, cursor.contentWidth);
  const headerCells = columns.map(column => column.title);

  cursor.ensure(rowHeight(cursor, resolved, headerCells, HEADER_PT));
  drawRow(cursor, resolved, headerCells, HEADER_PT);

  rows.forEach(row => {
    if (cursor.ensure(rowHeight(cursor, resolved, row, BODY_PT))) {
      drawRow(cursor, resolved, headerCells, HEADER_PT);
    }

    drawRow(cursor, resolved, row, BODY_PT);
  });
};

const stackHeight = (cursor: LayoutCursor, lines: readonly string[], width: number): number =>
  lines.reduce((sum, line) => sum + cursor.measure(line, width, BODY_PT), 0);

const partyLines = (party: TurnkeyProofParty, heading: string): readonly string[] => [
  heading,
  `名稱：${party.name}`,
  `統編：${party.taxId ?? '（消費者）'}`,
  `地址：${party.address ?? ''}`,
];

/** 賣方、買方兩個方框並排，高度取較高者 */
const drawParties = (cursor: LayoutCursor, seller: TurnkeyProofParty, buyer: TurnkeyProofParty): void => {
  const gap = 4;
  const boxWidth = (cursor.contentWidth - gap) / 2;
  const innerWidth = boxWidth - 2 * CELL_PAD_MM;
  const sellerLines = partyLines(seller, '賣方');
  const buyerLines = partyLines(buyer, '買方');
  const height =
    2 * CELL_PAD_MM +
    Math.max(stackHeight(cursor, sellerLines, innerWidth), stackHeight(cursor, buyerLines, innerWidth));

  cursor.ensure(height);

  const top = cursor.y;

  [
    { lines: sellerLines, x: MARGIN_MM },
    { lines: buyerLines, x: MARGIN_MM + boxWidth + gap },
  ].forEach(({ lines, x }) => {
    cursor.rect(x, top, boxWidth, height);
    lines.reduce((offset, line) => {
      const used = cursor.paragraph(line, {
        x: x + CELL_PAD_MM,
        y: top + CELL_PAD_MM + offset,
        width: innerWidth,
        sizePt: BODY_PT,
        align: 'left',
      });

      return offset + used;
    }, 0);
  });

  cursor.advance(height);
};

/** 一列四格的摘要資訊：上方小字標題、下方內容 */
const drawInfoRow = (cursor: LayoutCursor, items: readonly (readonly [string, string])[]): void => {
  const cellWidth = cursor.contentWidth / items.length;
  const labelHeight = cursor.metrics.lineHeightMm(7.5);
  const valueHeight = cursor.metrics.lineHeightMm(10);
  const height = labelHeight + valueHeight + 2 * CELL_PAD_MM;

  cursor.ensure(height);

  const top = cursor.y;

  items.forEach(([label, value], index) => {
    const x = MARGIN_MM + index * cellWidth;

    cursor.rect(x, top, cellWidth, height);
    cursor.paragraph(label, {
      x: x + CELL_PAD_MM,
      y: top + CELL_PAD_MM,
      width: cellWidth - 2 * CELL_PAD_MM,
      sizePt: 7.5,
      align: 'left',
    });

    cursor.paragraph(value, {
      x: x + CELL_PAD_MM,
      y: top + CELL_PAD_MM + labelHeight,
      width: cellWidth - 2 * CELL_PAD_MM,
      sizePt: 10,
      align: 'left',
    });
  });

  cursor.advance(height);
};

/** 右側金額框：每列左標籤、右數值 */
const drawTotals = (cursor: LayoutCursor, top: number, rows: readonly TotalRow[]): void => {
  const x = PAGE_WIDTH_MM - MARGIN_MM - TOTAL_BOX_WIDTH_MM;
  const height = rows.length * TOTAL_ROW_MM;

  rows.forEach(([label, value], index) => {
    const y = top + index * TOTAL_ROW_MM + 1.5;

    cursor.paragraph(label, { x: x + 3, y, width: TOTAL_BOX_WIDTH_MM / 2, sizePt: 10, align: 'left' });
    cursor.paragraph(formatAmount(value), {
      x: x + TOTAL_BOX_WIDTH_MM / 2,
      y,
      width: TOTAL_BOX_WIDTH_MM / 2 - 3,
      sizePt: 10,
      align: 'right',
    });
  });

  cursor.rect(x, top, TOTAL_BOX_WIDTH_MM, height);
};

const drawTaxTypeBoxes = (
  cursor: LayoutCursor,
  top: number,
  options: readonly (readonly [string, boolean])[],
): void => {
  options.reduce((x, [label, checked]) => {
    cursor.rect(x, top + 1, 3, 3, checked);
    cursor.paragraph(label, { x: x + 4.5, y: top, width: 18, sizePt: 9, align: 'left' });

    return x + 24;
  }, MARGIN_MM);
};

const TAX_LABEL: Readonly<Record<TurnkeyCustomsClearance, string>> = {
  [TurnkeyCustomsClearance.VIA_CUSTOMS]: '經海關',
  [TurnkeyCustomsClearance.NOT_VIA_CUSTOMS]: '非經海關',
};

/** 課稅別勾選：MIXED 依各銷售額是否大於 0 勾選；SPECIAL 不在規格的三個選項內，不勾選 */
const taxChecks = (proof: TurnkeyInvoiceProof): readonly (readonly [string, boolean])[] => {
  const byType = (type: TurnkeyTaxType): boolean => proof.taxType === type;
  const mixed = proof.taxType === TurnkeyTaxType.MIXED;

  return [
    ['應稅', mixed ? proof.salesAmount > 0 : byType(TurnkeyTaxType.TAXABLE)],
    ['零稅率', mixed ? proof.zeroRatedSalesAmount > 0 : byType(TurnkeyTaxType.ZERO_RATED)],
    ['免稅', mixed ? proof.taxFreeSalesAmount > 0 : byType(TurnkeyTaxType.TAX_FREE)],
  ];
};

const drawInvoiceSummary = (cursor: LayoutCursor, proof: TurnkeyInvoiceProof): void => {
  const leftWidth = cursor.contentWidth - TOTAL_BOX_WIDTH_MM - 5;
  const totals: readonly TotalRow[] = [
    ['應稅銷售額', proof.salesAmount],
    ['免稅銷售額', proof.taxFreeSalesAmount],
    ['零稅率銷售額', proof.zeroRatedSalesAmount],
    ['稅額', proof.taxAmount],
    ['總計', proof.totalAmount],
  ];

  const totalsHeight = totals.length * TOTAL_ROW_MM;

  cursor.ensure(totalsHeight + 30);

  const start = cursor.y;
  const headingHeight = cursor.paragraph('課稅別', {
    x: MARGIN_MM,
    y: start,
    width: leftWidth,
    sizePt: 9,
    align: 'left',
  });

  drawTaxTypeBoxes(cursor, start + headingHeight + 1, taxChecks(proof));

  const afterBoxes = start + headingHeight + 8;
  const zeroRatedHeight = proof.zeroRated
    ? [
        cursor.paragraph(`通關方式：${TAX_LABEL[proof.zeroRated.customsClearance]}`, {
          x: MARGIN_MM,
          y: afterBoxes,
          width: leftWidth,
          sizePt: BODY_PT,
          align: 'left',
        }),
        cursor.paragraph(`零稅率原因代號：${proof.zeroRated.reasonCode}`, {
          x: MARGIN_MM,
          y: afterBoxes + cursor.metrics.lineHeightMm(BODY_PT),
          width: leftWidth,
          sizePt: BODY_PT,
          align: 'left',
        }),
      ].reduce((sum, height) => sum + height, 0)
    : 0;

  const remarkY = afterBoxes + zeroRatedHeight + 1;
  const remarkHeight = proof.mainRemark
    ? cursor.paragraph(`備註：${proof.mainRemark}`, {
        x: MARGIN_MM,
        y: remarkY,
        width: leftWidth,
        sizePt: BODY_PT,
        align: 'left',
      })
    : 0;

  // 右側金額框與左側課稅別、備註並排，游標推進到較低者的底部
  drawTotals(cursor, start, totals);
  cursor.advance(Math.max(totalsHeight, remarkY + remarkHeight - start));
};

/** A4 的條碼與左右 QR Code，放在最後一頁的頁面下方 */
const drawCodes = (cursor: LayoutCursor, codes: InvoiceCodeGraphics, barcodeText: string): void => {
  const side = codes.qrLeft.length * QR_MODULE_MM + 2 * QR_QUIET_MM;
  const height = BARCODE_HEIGHT_MM + 2 + cursor.metrics.lineHeightMm(8) + 3 + side;

  cursor.ensure(height);

  const barcodeX = (PAGE_WIDTH_MM - codes.barcodeBars.length * BARCODE_NARROW_MM) / 2;

  cursor.bitmap(barcodeX, cursor.y, BARCODE_NARROW_MM, BARCODE_HEIGHT_MM, [codes.barcodeBars]);
  cursor.advance(BARCODE_HEIGHT_MM + 2);
  cursor.text(barcodeText.trimEnd(), 8);
  cursor.advance(3);

  const pairX = (PAGE_WIDTH_MM - (2 * side + QR_GAP_MM)) / 2;
  const top = cursor.y + QR_QUIET_MM;

  cursor.bitmap(pairX + QR_QUIET_MM, top, QR_MODULE_MM, QR_MODULE_MM, codes.qrLeft);
  cursor.bitmap(pairX + side + QR_GAP_MM + QR_QUIET_MM, top, QR_MODULE_MM, QR_MODULE_MM, codes.qrRight);
  cursor.advance(side);
};

const footerOps = (pageNumber: number, pageCount: number, exchange: boolean): readonly TextOp[] => {
  const pageText: TextOp = {
    kind: 'text',
    x: MARGIN_MM,
    y: PAGE_HEIGHT_MM - 12,
    width: PAGE_WIDTH_MM - 2 * MARGIN_MM,
    text: `第 ${pageNumber} 頁／共 ${pageCount} 頁`,
    sizePt: 8,
    align: 'center',
  };

  const exchangeNote: TextOp = { ...pageText, y: PAGE_HEIGHT_MM - 17, text: '本發票已以電子方式交換' };

  return exchange ? [pageText, exchangeNote] : [pageText];
};

/** 所有頁完成後補上頁碼（第 N 頁／共 M 頁）與頁尾註記 */
const finalizePages = (cursor: LayoutCursor, exchange: boolean): readonly Page[] => {
  const pages = cursor.pages();

  return pages.map((ops, index) => ({
    widthMm: PAGE_WIDTH_MM,
    heightMm: PAGE_HEIGHT_MM,
    ops: [...ops, ...footerOps(index + 1, pages.length, exchange)] as readonly DrawOp[],
  }));
};

/** A4 證明聯（B2B）：表頭、品項表（自動分頁）、合計、課稅別、條碼與左右 QR Code */
export const layoutA4Invoice = (
  proof: TurnkeyInvoiceProof,
  codes: InvoiceCodeGraphics,
  metrics: TextMetrics,
): readonly Page[] => {
  const cursor = createCursor(metrics);

  cursor.text('電子發票證明聯', 18);

  if (proof.reprint) cursor.text('補印', 11);

  cursor.advance(2);
  drawParties(cursor, proof.seller, proof.buyer);
  cursor.advance(3);
  drawInfoRow(cursor, [
    ['發票號碼', formatInvoiceNumber(proof.invoiceNumber)],
    ['開立日期時間', formatDateTime(proof.issuedAt)],
    ['期別', proof.periodLabel],
    ['隨機碼', proof.randomNumber ?? '無'],
  ]);

  cursor.advance(3);
  drawTable(
    cursor,
    INVOICE_COLUMNS,
    proof.items.map(item => [
      item.description,
      String(item.quantity),
      item.unit ?? '',
      formatAmount(item.unitPrice),
      formatAmount(item.amount),
      item.remark ?? '',
    ]),
  );

  cursor.advance(3);
  drawInvoiceSummary(cursor, proof);
  cursor.advance(4);
  drawCodes(cursor, codes, proof.barcode);

  return finalizePages(cursor, proof.deliveryMode === TurnkeyDeliveryMode.EXCHANGE);
};

/** A4 折讓證明單：沒有條碼，留買受人簽收欄 */
export const layoutA4Allowance = (proof: TurnkeyAllowanceProof, metrics: TextMetrics): readonly Page[] => {
  const cursor = createCursor(metrics);

  cursor.text('折讓證明單', 18);

  if (proof.reprint) cursor.text('補印', 11);

  cursor.advance(2);
  drawParties(cursor, proof.seller, proof.buyer);
  cursor.advance(3);
  drawInfoRow(cursor, [
    ['折讓單號', proof.allowanceNumber],
    ['折讓日期', formatDate(proof.allowanceDate)],
    ['原發票號碼', formatInvoiceNumber(proof.originalInvoiceNumber)],
    ['原發票日期', formatDate(proof.originalInvoiceIssuedAt)],
  ]);

  cursor.advance(3);
  drawTable(
    cursor,
    ALLOWANCE_COLUMNS,
    proof.items.map(item => [
      item.description,
      String(item.quantity),
      formatAmount(item.unitPrice),
      formatAmount(item.amount),
      formatAmount(item.tax),
    ]),
  );

  cursor.advance(3);

  cursor.ensure(TOTAL_ROW_MM * 3 + 35);
  drawTotals(cursor, cursor.y, [
    ['未稅金額', proof.totalAmount],
    ['稅額', proof.taxAmount],
    ['折讓合計', proof.totalAmount + proof.taxAmount],
  ]);

  cursor.advance(TOTAL_ROW_MM * 3 + 8);

  const signatureWidth = 70;
  const signatureX = PAGE_WIDTH_MM - MARGIN_MM - signatureWidth;

  cursor.paragraph('買受人簽收', { x: MARGIN_MM, y: cursor.y + 1, width: 40, sizePt: 10, align: 'left' });
  cursor.rect(signatureX, cursor.y, signatureWidth, 25);
  cursor.advance(27);

  return finalizePages(cursor, false);
};
