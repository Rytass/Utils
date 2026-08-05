import { FUSION_EXTRACT_ALL_FILES, FUSION_UCM_ACCOUNTS } from '../../constants/resources';
import { formatFbdiDate, truncate } from '../csv';
import { defineFbdiFile, defineFbdiTemplate } from '../template';
import type { FbdiFileContent, FbdiRow, FbdiTemplate } from '../../typings/fbdi';

/**
 * Oracle Fusion GL_INTERFACE FBDI（`GlInterface.csv`）模板。
 *
 * 來源：Oracle 官方 25c FBDI 樣板 `JournalImportTemplate.xlsm`
 * （`https://www.oracle.com/webfolder/technetwork/docs/fbdi-25c/fbdi/xlsm/JournalImportTemplate.xlsm`，
 * 解析 `GL_INTERFACE` 分頁第 4 列標題，欄位數 = 149），並已對真實 Fusion pod 端到端
 * 匯入驗證通過。
 *
 * CSV 為 headerless、位置對應（TRAILING NULLCOLS 語意：未列出的欄位一律留空字串）。
 * 下方只命名一般 GL journal 匯入會填值的欄位；需要其他欄位時，可用 `columns` 以外的索引
 * 自行擴充一份模板。
 */
export const GL_INTERFACE_COLUMN_COUNT = 149;

export const GL_INTERFACE_FILE = defineFbdiFile({
  entryFileName: 'GlInterface.csv',
  columnCount: GL_INTERFACE_COLUMN_COUNT,
  columns: {
    /** 固定 `NEW` */
    STATUS: 0,
    LEDGER_ID: 1,
    /** 交易生效日，格式 `YYYY/MM/DD` */
    ACCOUNTING_DATE: 2,
    /** `USER_JE_SOURCE_NAME`（字串，非 id） */
    JOURNAL_SOURCE: 3,
    /** `USER_JE_CATEGORY_NAME`（字串，非 id） */
    JOURNAL_CATEGORY: 4,
    CURRENCY_CODE: 5,
    DATE_CREATED: 6,
    /** 固定 `A`（實際帳） */
    ACTUAL_FLAG: 7,
    SEGMENT1: 8,
    SEGMENT2: 9,
    SEGMENT3: 10,
    SEGMENT4: 11,
    SEGMENT5: 12,
    SEGMENT6: 13,
    SEGMENT7: 14,
    SEGMENT8: 15,
    SEGMENT9: 16,
    SEGMENT10: 17,
    ENTERED_DR: 38,
    ENTERED_CR: 39,
    ACCOUNTED_DR: 40,
    ACCOUNTED_CR: 41,
    /** Batch Name */
    REFERENCE1: 42,
    /** Batch Description */
    REFERENCE2: 43,
    REFERENCE3: 44,
    /** Journal Entry Name */
    REFERENCE4: 45,
    /** Journal Entry Description */
    REFERENCE5: 46,
    /** Journal Entry Line Description */
    REFERENCE10: 51,
    /** 批次隔離鍵（NUMBER），須與 ParameterList 第 4 位一致 */
    GROUP_ID: 66,
    PERIOD_NAME: 94,
  },
});

/** GL journal import 的完整 FBDI 定義（已對真實 Fusion pod 驗證）。 */
export const GL_JOURNAL_TEMPLATE: FbdiTemplate = defineFbdiTemplate({
  name: 'GL Journal Import',
  documentAccount: FUSION_UCM_ACCOUNTS.GL_JOURNAL_IMPORT,
  jobName: '/oracle/apps/ess/financials/generalLedger/programs/common,JournalImportLauncher',
  zipFileName: 'GlInterface.zip',
  files: [GL_INTERFACE_FILE],
});

export interface JournalImportParameterListConfig {
  /** `#NULL` 或 Data Access Set Id；單一 ledger 且無 DAS 的環境可留 null。 */
  readonly dataAccessSetId?: string | null;
  /** Journal Source **名稱**（字串，非 id）。 */
  readonly journalSource: string;
  readonly ledgerId: string;
  /** 與 CSV `GROUP_ID` 欄位一致。 */
  readonly groupId: string;
  readonly postErrorsToSuspense?: 'Y' | 'N';
  readonly createSummaryJournals?: 'Y' | 'N';
  readonly importDescriptiveFlexfields?: 'Y' | 'N';
}

/**
 * Journal Import 的 `ParameterList`（7 位，逗號分隔，已對真實 Fusion pod 驗證）：
 * `<DataAccessSetId|#NULL>,<JournalSourceName>,<LedgerId>,<GroupId>,<PostErrorsToSuspense>,<CreateSummaryJournals>,<ImportDFF>`
 *
 * ⚠️ **此格式為 Journal Import 專屬**，其他 ESS job 的參數格式完全不同，不可沿用。
 */
export function buildJournalImportParameterList(config: JournalImportParameterListConfig): string {
  const dataAccessSetId = config.dataAccessSetId?.trim() || '#NULL';

  return [
    dataAccessSetId,
    config.journalSource,
    config.ledgerId,
    config.groupId,
    config.postErrorsToSuspense ?? 'N',
    config.createSummaryJournals ?? 'N',
    config.importDescriptiveFlexfields ?? 'N',
  ].join(',');
}

/** Oracle GL_INTERFACE REFERENCE 欄位的長度上限。 */
export const REFERENCE_MAX_LENGTH = 240;

export const DEFAULT_BATCH_NAME_PREFIX = 'FBDI';

/** Batch Name／Journal Entry Name：由來源單據鍵確定性產生，供 Fusion 端反查來源。 */
export function buildBatchName(sourceKey: string, prefix: string = DEFAULT_BATCH_NAME_PREFIX): string {
  return `${prefix}-${sourceKey}`;
}

/** 單一分錄行。 */
export interface GlJournalLineInput {
  readonly accountCode: string;
  readonly companyCode?: string | null;
  readonly departmentCode?: string | null;
  /** 其餘會科段值（SEGMENT4 起），依序對應。 */
  readonly extraSegments?: readonly string[];
  readonly debit: number;
  readonly credit: number;
  readonly lineDescription?: string | null;
}

/** 傳票 header。 */
export interface GlJournalInput {
  /** 來源單據鍵，用於 batch name 與（若未指定）group id。 */
  readonly sourceKey: string;
  /** 會計日期 `YYYY-MM-DD`，內部轉為 Fusion 慣用的 `YYYY/MM/DD`。 */
  readonly accountingDate: string;
  readonly currencyCode: string;
  readonly description?: string | null;
}

export interface GlJournalBuildConfig {
  readonly ledgerId: string;
  readonly journalSource: string;
  readonly journalCategory: string;
  /** Fusion 期間名稱（如 `Jul-26`），由呼叫端依會計日期解析後帶入。 */
  readonly periodName: string;
  /** 須與 ParameterList 第 4 位一致。 */
  readonly groupId: string;
  /** COMPANY 段預設值（分錄行未指定時採用）。 */
  readonly companySegmentDefault: string;
  /** 分錄行未指定 `extraSegments` 時，SEGMENT4 起的預設值。 */
  readonly extraSegmentDefaults?: readonly string[];
  /** Batch／Journal 名稱前綴，預設 `FBDI`。 */
  readonly batchNamePrefix?: string;
}

function formatAmount(value: number): string {
  return value === 0 ? '' : String(value);
}

/**
 * 把傳票行組成 GL_INTERFACE 的資料列（以欄位名為鍵，交由模板轉成位置對應）。
 *
 * 5 段以上的會科組合請用 `extraSegments`／`extraSegmentDefaults` 帶入；若貴環境的 COA
 * 段數或順序不同，可直接改用 `GL_INTERFACE_FILE` 自行組列。
 */
export function buildGlJournalRows(
  journal: GlJournalInput,
  lines: readonly GlJournalLineInput[],
  config: GlJournalBuildConfig,
): readonly FbdiRow[] {
  const accountingDate = formatFbdiDate(journal.accountingDate);
  const batchName = buildBatchName(journal.sourceKey, config.batchNamePrefix);
  const description = truncate(journal.description ?? '', REFERENCE_MAX_LENGTH);
  const extraDefaults = config.extraSegmentDefaults ?? [];

  return lines.map(line => {
    const extras = line.extraSegments ?? extraDefaults;
    const extraColumns: Record<string, string> = {};

    extras.forEach((value, index) => {
      // SEGMENT4 起（SEGMENT1..3 已由 company/department/account 佔用）
      extraColumns[`SEGMENT${index + 4}`] = value;
    });

    return {
      STATUS: 'NEW',
      LEDGER_ID: config.ledgerId,
      ACCOUNTING_DATE: accountingDate,
      JOURNAL_SOURCE: config.journalSource,
      JOURNAL_CATEGORY: config.journalCategory,
      CURRENCY_CODE: journal.currencyCode,
      DATE_CREATED: accountingDate,
      ACTUAL_FLAG: 'A',
      SEGMENT1: line.companyCode?.trim() || config.companySegmentDefault,
      SEGMENT2: line.departmentCode ?? '',
      SEGMENT3: line.accountCode,
      ...extraColumns,
      ENTERED_DR: formatAmount(line.debit),
      ENTERED_CR: formatAmount(line.credit),
      REFERENCE1: batchName,
      REFERENCE2: description,
      REFERENCE4: batchName,
      REFERENCE5: description,
      REFERENCE10: truncate(line.lineDescription ?? '', REFERENCE_MAX_LENGTH),
      GROUP_ID: config.groupId,
      PERIOD_NAME: config.periodName,
    };
  });
}

/** 把 GL journal 的列包裝成 `FbdiFileContent`，可直接餵給 `FusionFbdiService.import()`。 */
export function buildGlJournalContent(rows: readonly FbdiRow[]): FbdiFileContent {
  return { entryFileName: GL_INTERFACE_FILE.entryFileName, rows };
}

/**
 * `InterfaceDetails` value for Journal Import.
 *
 * ⚠️ **Community-sourced, not verified against a live pod.** The verified import path in this
 * package runs without `InterfaceDetails` at all, so this is offered for opt-in use rather than
 * applied by default — a wrong value stops the job from locating the interface layout, turning a
 * working import into a failing one. Confirm against your environment before adopting it.
 */
export const GL_JOURNAL_IMPORT_INTERFACE_DETAILS = 15;

/**
 * Suggested job options for Journal Import.
 *
 * `ExtractFileType=ALL` is safe and strongly recommended: it is what makes error files retrievable
 * when an import fails. `InterfaceDetails` carries the caveat described above, so it is **not**
 * included here; add it explicitly once verified:
 *
 * ```ts
 * jobOptions: { ...GL_JOURNAL_IMPORT_JOB_OPTIONS, InterfaceDetails: GL_JOURNAL_IMPORT_INTERFACE_DETAILS }
 * ```
 */
export const GL_JOURNAL_IMPORT_JOB_OPTIONS = FUSION_EXTRACT_ALL_FILES;

/** AutoPost（`AutomaticPosting`）ESS job 的預設座標。 */
export const GL_AUTO_POST_JOB = {
  jobPackageName: '/oracle/apps/ess/financials/generalLedger/programs/common/',
  jobDefName: 'AutomaticPosting',
} as const;
