/**
 * 一支 FBDI 資料檔的定義。
 *
 * FBDI 的 CSV 一律是 **headerless、純位置對應**（SQL*Loader TRAILING NULLCOLS 語意：
 * 未填的欄位留空字串），因此模板只需要「總欄位數」與「你會填的欄位名 → 索引」。
 * 一次 FBDI 匯入可能包含多支資料檔（例如 AP invoice 的 header 與 lines）。
 */
export interface FbdiFileTemplate {
  /** zip 內的檔名，必須與該 FBDI 的 `.ctl` 對應（如 `GlInterface.csv`）。 */
  readonly entryFileName: string;
  /** 該檔的總欄位數（依官方 FBDI 樣板）。 */
  readonly columnCount: number;
  /** 欄位名 → 0-based 欄索引。只需列出會填值的欄位。 */
  readonly columns: Readonly<Record<string, number>>;
}

/**
 * `JobOptions` entries for an FBDI import, for example
 * `{ InterfaceDetails: 15, ExtractFileType: 'ALL' }`.
 *
 * Oracle requires this parameter for FBDI imports: without it the import still runs, but no
 * callback fires and error/output files are not extracted back to UCM — which is why a failed
 * import can end up with no retrievable detail.
 */
export type FbdiJobOptions = Readonly<Record<string, string | number>>;

/** 一種 FBDI 匯入的完整定義（目標 UCM 帳戶、ESS job、zip 檔名與所有資料檔）。 */
export interface FbdiTemplate {
  /** 模板名稱，僅供辨識與錯誤訊息使用。 */
  readonly name: string;
  /** UCM 帳戶，如 GL 的 `fin$/journal$/import`、AP 的 `fin$/payables$/import`。 */
  readonly documentAccount: string;
  /** ESS job 的 `<package>,<jobDefName>`。 */
  readonly jobName: string;
  /** 上傳的 zip 檔名。 */
  readonly zipFileName: string;
  /** 本 FBDI 的所有資料檔。單檔 FBDI（如 GL journal）只有一支。 */
  readonly files: readonly FbdiFileTemplate[];
  /** Default `JobOptions` for this import; may be overridden per call. */
  readonly defaultJobOptions?: FbdiJobOptions;
}

/** FBDI 儲存格值。`null`／`undefined` 一律寫成空字串。 */
export type FbdiCellValue = string | number | null | undefined;

/** 一列資料：以欄位名為鍵，未提供的欄位留空。 */
export type FbdiRow = Readonly<Record<string, FbdiCellValue>>;

/** 一支資料檔要寫入的內容。 */
export interface FbdiFileContent {
  /** 對應 `FbdiTemplate.files[].entryFileName`。 */
  readonly entryFileName: string;
  readonly rows: readonly FbdiRow[];
}

/** zip 內的單一檔案。 */
export interface ZipEntry {
  readonly name: string;
  readonly content: Buffer;
}
