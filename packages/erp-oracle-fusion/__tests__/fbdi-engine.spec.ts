import { execFileSync } from 'child_process';
import { deflateRawSync } from 'zlib';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  FUSION_CALLBACK_DISABLED,
  FUSION_EXTRACT_ALL_FILES,
  GL_JOURNAL_IMPORT_JOB_OPTIONS,
  GL_JOURNAL_TEMPLATE,
  serializeJobOptions,
  buildFbdiCsv,
  buildFbdiImportPayload,
  buildFbdiRow,
  buildFbdiZip,
  classifyEssStatus,
  defineFbdiFile,
  defineFbdiTemplate,
  deriveGroupId,
  parseEssStatusResponse,
  crc32,
  serializeCsv,
  unzipFiles,
  zipFiles,
} from '@rytass/erp-oracle-fusion';
import type { FbdiTemplate } from '@rytass/erp-oracle-fusion';

/**
 * FBDI 引擎：模板定義驗證、位置對應列建構、多檔 zip（AP 型 FBDI 的必要能力）、
 * importBulkData payload 組裝、ESS 狀態語意。
 */

const FIXED_MTIME = new Date('2026-01-02T03:04:05Z');

const HEADER_FILE = defineFbdiFile({
  entryFileName: 'HeaderInterface.csv',
  columnCount: 5,
  columns: { INVOICE_ID: 0, VENDOR: 1, AMOUNT: 3 },
});

const LINE_FILE = defineFbdiFile({
  entryFileName: 'LineInterface.csv',
  columnCount: 4,
  columns: { INVOICE_ID: 0, LINE_NUMBER: 1, LINE_AMOUNT: 2 },
});

const TWO_FILE_TEMPLATE: FbdiTemplate = defineFbdiTemplate({
  name: 'Test Two-File Import',
  documentAccount: 'fin$/payables$/import',
  jobName: '/oracle/apps/ess/financials/payables,TestImport',
  zipFileName: 'TestImport.zip',
  files: [HEADER_FILE, LINE_FILE],
});

describe('模板定義驗證', () => {
  it('欄位索引超出範圍時拒絕定義', () => {
    expect(() => defineFbdiFile({ entryFileName: 'x.csv', columnCount: 3, columns: { A: 5 } })).toThrow('out of range');
  });

  it('兩個欄位對到同一索引時拒絕定義', () => {
    expect(() => defineFbdiFile({ entryFileName: 'x.csv', columnCount: 3, columns: { A: 1, B: 1 } })).toThrow(
      'both map to index 1',
    );
  });

  it('模板沒有資料檔或檔名重複時拒絕定義', () => {
    expect(() =>
      defineFbdiTemplate({ name: 'empty', documentAccount: 'a', jobName: 'b', zipFileName: 'c.zip', files: [] }),
    ).toThrow('at least one file');

    expect(() =>
      defineFbdiTemplate({
        name: 'dup',
        documentAccount: 'a',
        jobName: 'b',
        zipFileName: 'c.zip',
        files: [HEADER_FILE, HEADER_FILE],
      }),
    ).toThrow('duplicated file');
  });
});

describe('列建構', () => {
  it('依欄位名填到正確位置，其餘留空', () => {
    expect(buildFbdiRow(HEADER_FILE, { INVOICE_ID: 'INV-1', AMOUNT: 100 })).toEqual(['INV-1', '', '', '100', '']);
  });

  it('null/undefined 一律寫成空字串', () => {
    expect(buildFbdiRow(HEADER_FILE, { INVOICE_ID: null, VENDOR: undefined })).toEqual(['', '', '', '', '']);
  });

  it('未知欄位名立刻拋錯，不靜默丟失', () => {
    expect(() => buildFbdiRow(HEADER_FILE, { INVOCE_ID: 'typo' })).toThrow('has no column named "INVOCE_ID"');
  });

  it('CSV 依 RFC 規則跳脫逗號與引號', () => {
    expect(serializeCsv([['a,b', 'say "hi"', '']])).toBe('"a,b","say ""hi""",');
  });

  it('buildFbdiCsv 產出 headerless、位置對應的內容', () => {
    const csv = buildFbdiCsv(LINE_FILE, [
      { INVOICE_ID: 'INV-1', LINE_NUMBER: 1, LINE_AMOUNT: 60 },
      { INVOICE_ID: 'INV-1', LINE_NUMBER: 2, LINE_AMOUNT: 40 },
    ]);

    expect(csv).toBe('INV-1,1,60,\nINV-1,2,40,');
  });
});

describe('多檔 zip', () => {
  it('一個 zip 內可放多支資料檔（AP 型 FBDI 的必要能力）', () => {
    const buffer = buildFbdiZip(
      TWO_FILE_TEMPLATE,
      [
        { entryFileName: 'HeaderInterface.csv', rows: [{ INVOICE_ID: 'INV-1', AMOUNT: 100 }] },
        { entryFileName: 'LineInterface.csv', rows: [{ INVOICE_ID: 'INV-1', LINE_NUMBER: 1, LINE_AMOUNT: 100 }] },
      ],
      FIXED_MTIME,
    );

    expect(buffer.subarray(0, 2).toString('latin1')).toBe('PK');
    // End of central directory 記錄的 entry 數
    const eocdEntryCount = buffer.readUInt16LE(buffer.length - 22 + 10);

    expect(eocdEntryCount).toBe(2);
  });

  it('產物可被系統 unzip 正確解出（真實驗證，非只看 magic bytes）', () => {
    const buffer = buildFbdiZip(
      TWO_FILE_TEMPLATE,
      [
        { entryFileName: 'HeaderInterface.csv', rows: [{ INVOICE_ID: 'INV-1', VENDOR: 'ACME', AMOUNT: 100 }] },
        { entryFileName: 'LineInterface.csv', rows: [{ INVOICE_ID: 'INV-1', LINE_NUMBER: 1, LINE_AMOUNT: 100 }] },
      ],
      FIXED_MTIME,
    );

    const dir = mkdtempSync(join(tmpdir(), 'fbdi-zip-'));

    try {
      const zipPath = join(dir, 'out.zip');

      writeFileSync(zipPath, buffer);
      execFileSync('unzip', ['-q', '-o', zipPath, '-d', dir]);

      expect(readFileSync(join(dir, 'HeaderInterface.csv'), 'utf-8')).toBe('INV-1,ACME,,100,');
      expect(readFileSync(join(dir, 'LineInterface.csv'), 'utf-8')).toBe('INV-1,1,100,');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('固定 mtime 時輸出位元組可重現', () => {
    const contents = [{ entryFileName: 'HeaderInterface.csv', rows: [{ INVOICE_ID: 'INV-1' }] }];

    expect(buildFbdiZip(TWO_FILE_TEMPLATE, contents, FIXED_MTIME)).toEqual(
      buildFbdiZip(TWO_FILE_TEMPLATE, contents, FIXED_MTIME),
    );
  });

  it('內容指涉模板未定義的檔名時拋錯', () => {
    expect(() => buildFbdiZip(TWO_FILE_TEMPLATE, [{ entryFileName: 'Unknown.csv', rows: [] }])).toThrow(
      'has no file "Unknown.csv"',
    );
  });

  it('zipFiles 至少需要一個 entry', () => {
    expect(() => zipFiles([])).toThrow('at least one entry');
  });

  it('unzipFiles 可讀回自己壓的檔案（STORED）', () => {
    const archive = zipFiles([
      { name: 'a.csv', content: Buffer.from('1,2,3') },
      { name: 'b.log', content: Buffer.from('done') },
    ]);

    expect(unzipFiles(archive).map(e => ({ name: e.name, text: e.content.toString() }))).toEqual([
      { name: 'a.csv', text: '1,2,3' },
      { name: 'b.log', text: 'done' },
    ]);
  });

  it('unzipFiles 可讀 DEFLATE 壓縮的封存（Fusion 回傳的 log 即為此形式）', () => {
    // 以 Node zlib 產生一個 deflate 壓縮的最小 zip
    const content = Buffer.from('GL-98765: invalid account segment'.repeat(20));
    const compressed = deflateRawSync(content);
    const name = Buffer.from('198867.log');
    const local = Buffer.alloc(30);

    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(crc32(content), 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);

    const localEntry = Buffer.concat([local, name, compressed]);
    const central = Buffer.alloc(46);

    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(content), 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0, 42);

    const centralEntry = Buffer.concat([central, name]);
    const eocd = Buffer.alloc(22);

    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(centralEntry.length, 12);
    eocd.writeUInt32LE(localEntry.length, 16);

    const entries = unzipFiles(Buffer.concat([localEntry, centralEntry, eocd]));

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('198867.log');
    expect(entries[0].content.toString()).toBe(content.toString());
  });

  it('unzipFiles 對非 zip 內容明確報錯', () => {
    expect(() => unzipFiles(Buffer.from('not a zip'))).toThrow('Not a ZIP archive');
  });
});

describe('importBulkData payload', () => {
  it('採用模板的目標設定，並可單次覆寫', () => {
    const contents = [{ entryFileName: 'HeaderInterface.csv', rows: [{ INVOICE_ID: 'INV-1' }] }];

    const payload = buildFbdiImportPayload(TWO_FILE_TEMPLATE, contents, 'p1,p2', { mtime: FIXED_MTIME });

    expect(payload.OperationName).toBe('importBulkData');
    expect(payload.ContentType).toBe('zip');
    expect(payload.DocumentAccount).toBe('fin$/payables$/import');
    expect(payload.FileName).toBe('TestImport.zip');
    expect(payload.ParameterList).toBe('p1,p2');
    expect(Buffer.from(payload.DocumentContent, 'base64').subarray(0, 2).toString('latin1')).toBe('PK');

    const overridden = buildFbdiImportPayload(TWO_FILE_TEMPLATE, contents, 'p1', {
      documentAccount: 'fin$/other$/import',
      fileName: 'Other.zip',
      mtime: FIXED_MTIME,
    });

    expect(overridden.DocumentAccount).toBe('fin$/other$/import');
    expect(overridden.FileName).toBe('Other.zip');
  });
});

describe('JobOptions 與 CallbackURL', () => {
  it('未指定時完全不送 JobOptions 與 CallbackURL（維持既有行為）', () => {
    const payload = buildFbdiImportPayload(
      TWO_FILE_TEMPLATE,
      [{ entryFileName: 'HeaderInterface.csv', rows: [] }],
      'p',
      { mtime: FIXED_MTIME },
    );

    expect(payload.JobOptions).toBeUndefined();
    expect(payload.CallbackURL).toBeUndefined();
  });

  it('序列化為 Fusion 期望的逗號分隔形式', () => {
    expect(serializeJobOptions({ ExtractFileType: 'ALL', InterfaceDetails: 15 })).toBe(
      'ExtractFileType=ALL,InterfaceDetails=15',
    );
  });

  it('呼叫端的 jobOptions 覆蓋模板預設值', () => {
    const templateWithDefaults = defineFbdiTemplate({
      ...TWO_FILE_TEMPLATE,
      defaultJobOptions: { ExtractFileType: 'ALL', InterfaceDetails: 1 },
    });

    const payload = buildFbdiImportPayload(
      templateWithDefaults,
      [{ entryFileName: 'HeaderInterface.csv', rows: [] }],
      'p',
      { jobOptions: { InterfaceDetails: 99 }, mtime: FIXED_MTIME },
    );

    expect(payload.JobOptions).toBe('ExtractFileType=ALL,InterfaceDetails=99');
  });

  it('callbackUrl 帶入時送出，傳 null 則明確送 #NULL', () => {
    const withCallback = buildFbdiImportPayload(
      TWO_FILE_TEMPLATE,
      [{ entryFileName: 'HeaderInterface.csv', rows: [] }],
      'p',
      { callbackUrl: 'https://my-service/fusion-callback', jobOptions: FUSION_EXTRACT_ALL_FILES, mtime: FIXED_MTIME },
    );

    expect(withCallback.CallbackURL).toBe('https://my-service/fusion-callback');

    const disabled = buildFbdiImportPayload(
      TWO_FILE_TEMPLATE,
      [{ entryFileName: 'HeaderInterface.csv', rows: [] }],
      'p',
      { callbackUrl: null, mtime: FIXED_MTIME },
    );

    expect(disabled.CallbackURL).toBe(FUSION_CALLBACK_DISABLED);
  });

  it('內建 GL 模板不預設帶 InterfaceDetails（未經驗證的值不應改變已驗證的行為）', () => {
    expect(GL_JOURNAL_TEMPLATE.defaultJobOptions).toBeUndefined();
    expect(GL_JOURNAL_IMPORT_JOB_OPTIONS).toEqual({ ExtractFileType: 'ALL' });
  });
});

describe('ESS 狀態語意', () => {
  it('PAUSED 是進行中而非終態（父 job 等待子 job）', () => {
    const status = classifyEssStatus('PAUSED');

    expect(status.state).toBe('IN_PROGRESS');
    expect(status.isTerminal).toBe(false);
  });

  it('SUCCEEDED 為成功終態，ERROR/WARNING 為失敗終態', () => {
    expect(classifyEssStatus('SUCCEEDED')).toMatchObject({ state: 'SUCCEEDED', isTerminal: true });
    expect(classifyEssStatus('ERROR')).toMatchObject({ state: 'FAILED', isTerminal: true });
    expect(classifyEssStatus('WARNING')).toMatchObject({ state: 'FAILED', isTerminal: true });
  });

  it('未知狀態保守視為未結束', () => {
    expect(classifyEssStatus('SOMETHING_NEW')).toMatchObject({ state: 'UNKNOWN', isTerminal: false });
  });

  it('由回應解析狀態，缺 items 時視為進行中', () => {
    expect(parseEssStatusResponse({ items: [{ RequestStatus: 'SUCCEEDED' }] }).state).toBe('SUCCEEDED');
    expect(parseEssStatusResponse({}).isTerminal).toBe(false);
  });
});

describe('deriveGroupId', () => {
  it('同一來源鍵恆得同值，不同鍵不同值', () => {
    expect(deriveGroupId('voucher-1')).toBe(deriveGroupId('voucher-1'));
    expect(deriveGroupId('voucher-1')).not.toBe(deriveGroupId('voucher-2'));
  });

  it('產出正整數字串，落在安全整數範圍內', () => {
    const id = Number(deriveGroupId('voucher-1'));

    expect(Number.isSafeInteger(id)).toBe(true);
    expect(id).toBeGreaterThan(0);
  });
});
