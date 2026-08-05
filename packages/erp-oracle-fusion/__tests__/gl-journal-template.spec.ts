import {
  buildBatchName,
  buildFbdiRow,
  buildGlJournalContent,
  buildGlJournalRows,
  buildJournalImportParameterList,
  GL_INTERFACE_COLUMN_COUNT,
  GL_INTERFACE_FILE,
  GL_JOURNAL_TEMPLATE,
} from '@rytass/erp-oracle-fusion';
import type { GlJournalBuildConfig, GlJournalInput, GlJournalLineInput } from '@rytass/erp-oracle-fusion';

/**
 * GL Journal 模板 parity 測試。
 *
 * 基準為一筆已對真實 Fusion pod 送出並成功匯入的傳票（2 列 debit/credit、Jun-26 期間）。
 * 本測試確保重構為模板引擎後，產生的欄位值與位置與當時完全一致——GL 模板是本套件唯一
 * 經真實 pod 端到端驗證的模板，不可在重構中漂移。
 */

const journal: GlJournalInput = {
  sourceKey: 'a1b2c3d4-0000-0000-0000-000000000001',
  accountingDate: '2026-06-30',
  currencyCode: 'TWD',
  description: 'Fusion FBDI contract probe journal',
};

const lines: readonly GlJournalLineInput[] = [
  {
    accountCode: '759000000',
    companyCode: null,
    departmentCode: '00000',
    debit: 0,
    credit: 1,
    lineDescription: 'probe credit line',
  },
  {
    accountCode: '759000000',
    companyCode: null,
    departmentCode: 'AA110',
    debit: 1,
    credit: 0,
    lineDescription: 'probe debit line',
  },
];

const config: GlJournalBuildConfig = {
  ledgerId: '300000002498206',
  journalSource: 'Manual',
  journalCategory: 'Adjustment',
  periodName: 'Jun-26',
  groupId: '990101001',
  companySegmentDefault: '01',
  extraSegmentDefaults: ['0000', '0000'],
  batchNamePrefix: 'SHUTTLE-ALLOC',
};

const rows = buildGlJournalRows(journal, lines, config).map(row => buildFbdiRow(GL_INTERFACE_FILE, row));

describe('GL Journal 模板', () => {
  it('模板宣告 149 欄的單一資料檔與正確的匯入目標', () => {
    expect(GL_INTERFACE_FILE.columnCount).toBe(GL_INTERFACE_COLUMN_COUNT);
    expect(GL_INTERFACE_COLUMN_COUNT).toBe(149);
    expect(GL_JOURNAL_TEMPLATE.files).toHaveLength(1);
    expect(GL_JOURNAL_TEMPLATE.documentAccount).toBe('fin$/journal$/import');
    expect(GL_JOURNAL_TEMPLATE.jobName).toContain('JournalImportLauncher');
    expect(GL_JOURNAL_TEMPLATE.zipFileName).toBe('GlInterface.zip');
  });

  it('每列恰為 149 欄', () => {
    expect(rows).toHaveLength(2);
    rows.forEach(row => expect(row).toHaveLength(149));
  });

  it('欄位值落在已驗證的位置（credit 列）', () => {
    const creditRow = rows[0];

    expect(creditRow[0]).toBe('NEW'); // STATUS
    expect(creditRow[1]).toBe('300000002498206'); // LEDGER_ID
    expect(creditRow[2]).toBe('2026/06/30'); // ACCOUNTING_DATE（轉為 Fusion 格式）
    expect(creditRow[3]).toBe('Manual'); // JOURNAL_SOURCE
    expect(creditRow[4]).toBe('Adjustment'); // JOURNAL_CATEGORY
    expect(creditRow[5]).toBe('TWD'); // CURRENCY_CODE
    expect(creditRow[6]).toBe('2026/06/30'); // DATE_CREATED
    expect(creditRow[7]).toBe('A'); // ACTUAL_FLAG
    expect(creditRow[8]).toBe('01'); // SEGMENT1（company 預設）
    expect(creditRow[9]).toBe('00000'); // SEGMENT2（department）
    expect(creditRow[10]).toBe('759000000'); // SEGMENT3（account）
    expect(creditRow[11]).toBe('0000'); // SEGMENT4（保留段）
    expect(creditRow[12]).toBe('0000'); // SEGMENT5（保留段）
    expect(creditRow[38]).toBe(''); // ENTERED_DR（0 寫成空字串）
    expect(creditRow[39]).toBe('1'); // ENTERED_CR
    expect(creditRow[42]).toBe('SHUTTLE-ALLOC-a1b2c3d4-0000-0000-0000-000000000001'); // REFERENCE1
    expect(creditRow[45]).toBe('SHUTTLE-ALLOC-a1b2c3d4-0000-0000-0000-000000000001'); // REFERENCE4
    expect(creditRow[51]).toBe('probe credit line'); // REFERENCE10
    expect(creditRow[66]).toBe('990101001'); // GROUP_ID
    expect(creditRow[94]).toBe('Jun-26'); // PERIOD_NAME
  });

  it('debit 列的金額欄互換，其餘一致', () => {
    const debitRow = rows[1];

    expect(debitRow[38]).toBe('1'); // ENTERED_DR
    expect(debitRow[39]).toBe(''); // ENTERED_CR
    expect(debitRow[9]).toBe('AA110'); // SEGMENT2
  });

  it('未列出的欄位一律留空（TRAILING NULLCOLS 語意）', () => {
    const creditRow = rows[0];
    const filledIndexes = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 39, 42, 43, 45, 46, 51, 66, 94]);

    creditRow.forEach((value, index) => {
      if (!filledIndexes.has(index)) {
        expect(value).toBe('');
      }
    });
  });

  it('批次名稱前綴可參數化，預設為 FBDI', () => {
    expect(buildBatchName('v-1')).toBe('FBDI-v-1');
    expect(buildBatchName('v-1', 'MYAPP-AP')).toBe('MYAPP-AP-v-1');
  });

  it('description 與行說明截斷至 240 字元', () => {
    const longRows = buildGlJournalRows(
      { ...journal, description: 'x'.repeat(300) },
      [{ ...lines[0], lineDescription: 'y'.repeat(300) }],
      config,
    ).map(row => buildFbdiRow(GL_INTERFACE_FILE, row));

    expect(longRows[0][43]).toHaveLength(240);
    expect(longRows[0][51]).toHaveLength(240);
  });

  it('可用 extraSegments 支援不同段數的 COA', () => {
    const sixSegmentRows = buildGlJournalRows(
      journal,
      [{ ...lines[0], extraSegments: ['0000', '0000', 'X1', 'Y2'] }],
      config,
    ).map(row => buildFbdiRow(GL_INTERFACE_FILE, row));

    expect(sixSegmentRows[0][11]).toBe('0000'); // SEGMENT4
    expect(sixSegmentRows[0][12]).toBe('0000'); // SEGMENT5
    expect(sixSegmentRows[0][13]).toBe('X1'); // SEGMENT6
    expect(sixSegmentRows[0][14]).toBe('Y2'); // SEGMENT7
  });

  it('buildGlJournalContent 產出可直接送進 import 的內容', () => {
    const content = buildGlJournalContent(buildGlJournalRows(journal, lines, config));

    expect(content.entryFileName).toBe('GlInterface.csv');
    expect(content.rows).toHaveLength(2);
  });
});

describe('Journal Import ParameterList', () => {
  it('產出已驗證的 7 位格式', () => {
    expect(
      buildJournalImportParameterList({
        dataAccessSetId: null,
        journalSource: 'Manual',
        ledgerId: '300000002498206',
        groupId: '990101001',
      }),
    ).toBe('#NULL,Manual,300000002498206,990101001,N,N,N');
  });

  it('有 Data Access Set 時填入該值，旗標可覆寫', () => {
    expect(
      buildJournalImportParameterList({
        dataAccessSetId: '300000001',
        journalSource: 'Manual',
        ledgerId: '1',
        groupId: '2',
        postErrorsToSuspense: 'Y',
        createSummaryJournals: 'Y',
        importDescriptiveFlexfields: 'Y',
      }),
    ).toBe('300000001,Manual,1,2,Y,Y,Y');
  });
});
