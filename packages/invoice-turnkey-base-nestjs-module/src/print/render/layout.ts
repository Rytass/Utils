export type TextAlign = 'left' | 'center' | 'right';

/** 點陣資料：外層為列、內層為欄，true 代表深色格 */
export type BitRows = readonly (readonly boolean[])[];

export interface TextOp {
  readonly kind: 'text';
  /** 左上角，單位 mm */
  readonly x: number;
  readonly y: number;
  /** 對齊所用的寬度，單位 mm */
  readonly width: number;
  readonly text: string;
  readonly sizePt: number;
  readonly align: TextAlign;
}

export interface RectOp {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** false 時畫外框線（線寬 0.2 mm） */
  readonly fill: boolean;
}

/** QR Code 或條碼的點陣；cellWidth、cellHeight 為每格的毫米尺寸 */
export interface BitmapOp {
  readonly kind: 'bitmap';
  readonly x: number;
  readonly y: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly rows: BitRows;
}

export type DrawOp = TextOp | RectOp | BitmapOp;

export interface Page {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly ops: readonly DrawOp[];
}

/** 由字型提供的量測能力；版面與各輸出後端共用，確保換行結果一致 */
export interface TextMetrics {
  readonly widthMm: (text: string, sizePt: number) => number;
  readonly lineHeightMm: (sizePt: number) => number;
}

export const PT_TO_MM = 25.4 / 72;
export const RECT_STROKE_MM = 0.2;

/** 逐字換行（CJK 與英文都適用）；至少回傳一行 */
export const wrapText = (text: string, maxWidthMm: number, sizePt: number, metrics: TextMetrics): readonly string[] => {
  const split = Array.from(text).reduce<{ readonly lines: readonly string[]; readonly current: string }>(
    (state, char) => {
      const next = `${state.current}${char}`;

      return state.current === '' || metrics.widthMm(next, sizePt) <= maxWidthMm
        ? { lines: state.lines, current: next }
        : { lines: [...state.lines, state.current], current: char };
    },
    { lines: [], current: '' },
  );

  return [...split.lines, split.current];
};

export interface LayoutOptions {
  readonly widthMm: number;
  /** 單頁高度；熱感紙無分頁時為 Infinity */
  readonly pageHeightMm: number;
  readonly marginMm: number;
  readonly topMarginMm: number;
  readonly bottomMarginMm: number;
  readonly metrics: TextMetrics;
}

export interface ParagraphOptions {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly sizePt: number;
  readonly align: TextAlign;
}

/**
 * 由上往下排版的游標。以累加方式放置繪圖操作，遇到分頁時換到新的一頁。
 * 內部以陣列累積各頁操作，屬於版面產生時的暫存狀態，對外仍是純資料（Page）。
 */
export class LayoutCursor {
  private readonly pageOps: DrawOp[][] = [[]];

  private yPosition: number;

  constructor(private readonly options: LayoutOptions) {
    this.yPosition = options.topMarginMm;
  }

  get y(): number {
    return this.yPosition;
  }

  get marginMm(): number {
    return this.options.marginMm;
  }

  get contentWidth(): number {
    return this.options.widthMm - 2 * this.options.marginMm;
  }

  get metrics(): TextMetrics {
    return this.options.metrics;
  }

  get widthMm(): number {
    return this.options.widthMm;
  }

  get pageHeightMm(): number {
    return this.options.pageHeightMm;
  }

  get bottomMarginMm(): number {
    return this.options.bottomMarginMm;
  }

  get topMarginMm(): number {
    return this.options.topMarginMm;
  }

  get pageCount(): number {
    return this.pageOps.length;
  }

  advance(mm: number): void {
    this.yPosition += mm;
  }

  fits(mm: number): boolean {
    return this.yPosition + mm <= this.options.pageHeightMm - this.options.bottomMarginMm;
  }

  /** 剩餘空間不足時換頁，回傳是否換頁（呼叫端可據此重畫表頭） */
  ensure(mm: number): boolean {
    if (this.fits(mm)) return false;

    this.newPage();

    return true;
  }

  newPage(): void {
    this.pageOps.push([]);
    this.yPosition = this.options.topMarginMm;
  }

  place(op: DrawOp): void {
    this.pageOps[this.pageOps.length - 1].push(op);
  }

  /** 換行後放置文字，回傳佔用的高度（不推進游標） */
  paragraph(text: string, options: ParagraphOptions): number {
    const lines = wrapText(text, options.width, options.sizePt, this.options.metrics);
    const lineHeight = this.options.metrics.lineHeightMm(options.sizePt);

    lines.forEach((line, index) => {
      this.place({
        kind: 'text',
        x: options.x,
        y: options.y + index * lineHeight,
        width: options.width,
        text: line,
        sizePt: options.sizePt,
        align: options.align,
      });
    });

    return lines.length * lineHeight;
  }

  /** 只計算換行後的高度，不放置 */
  measure(text: string, width: number, sizePt: number): number {
    return wrapText(text, width, sizePt, this.options.metrics).length * this.options.metrics.lineHeightMm(sizePt);
  }

  /** 在目前游標位置排一段文字（內容寬度），並推進游標 */
  text(text: string, sizePt: number, align: TextAlign = 'center'): void {
    const height = this.paragraph(text, {
      x: this.marginMm,
      y: this.yPosition,
      width: this.contentWidth,
      sizePt,
      align,
    });

    this.advance(height);
  }

  rect(x: number, y: number, width: number, height: number, fill = false): void {
    this.place({ kind: 'rect', x, y, width, height, fill });
  }

  bitmap(x: number, y: number, cellWidth: number, cellHeight: number, rows: BitRows): void {
    this.place({ kind: 'bitmap', x, y, cellWidth, cellHeight, rows });
  }

  pages(): readonly (readonly DrawOp[])[] {
    return this.pageOps;
  }
}
