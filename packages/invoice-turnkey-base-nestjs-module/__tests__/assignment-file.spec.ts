/**
 * @jest-environment node
 */

import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import {
  ASSIGNMENT_FILE_DIRECTORY,
  parseAssignmentFile,
  scanAssignmentFiles,
  TurnkeyAssignmentFileInput,
  TurnkeyAssignmentFileOutcome,
} from '../src';

// 驗證區 Unpack/BAK/E0501 實際收到的檔案結構（v31），統編與字軌已去識別
const fixture = (): Promise<string> => readFile(path.join(__dirname, 'fixtures', 'E0501.xml'), 'utf8');

const assignment = (track: string, begin: string, end: string): string => `
  <InvoiceAssignNo xmlns="urn:GEINV:E0501:4.1">
    <Ban>12345675</Ban>
    <InvoiceType>08</InvoiceType>
    <YearMonth>11512</YearMonth>
    <InvoiceTrack>${track}</InvoiceTrack>
    <InvoiceBeginNo>${begin}</InvoiceBeginNo>
    <InvoiceEndNo>${end}</InvoiceEndNo>
    <InvoiceBooklet>3</InvoiceBooklet>
  </InvoiceAssignNo>`;

describe('parseAssignmentFile', () => {
  it('reads an assignment wrapped in an envelope (v31)', async () => {
    expect(parseAssignmentFile(await fixture())).toEqual([
      {
        companyTaxId: '12345675',
        invoiceType: '07',
        period: '10808',
        track: 'ZY',
        beginNumber: '00000100',
        endNumber: '00000149',
        booklets: 1,
      },
    ]);
  });

  it('reads several assignments regardless of the namespace version', () => {
    const xml = `<InvoiceEnvelope xmlns="urn:GEINV:InvoiceEnvelope:4.1"><InvoicePack count="2" messageType="E0501">${assignment(
      'ZX',
      '00000000',
      '00000149',
    )}${assignment('ZW', '00000150', '00000199')}</InvoicePack></InvoiceEnvelope>`;

    expect(parseAssignmentFile(xml).map(entry => [entry.track, entry.beginNumber, entry.endNumber])).toEqual([
      ['ZX', '00000000', '00000149'],
      ['ZW', '00000150', '00000199'],
    ]);
  });

  it('reads a bare InvoiceAssignNo root and returns nothing for other messages', () => {
    expect(parseAssignmentFile(assignment('ZX', '00000000', '00000049'))).toHaveLength(1);
    expect(parseAssignmentFile('<ProcessResult xmlns="urn:GEINV:ProcessResult:4.1"><Result/></ProcessResult>')).toEqual(
      [],
    );
  });
});

describe('scanAssignmentFiles', () => {
  let dataPath: string;

  beforeEach(async () => {
    dataPath = await mkdtemp(path.join(tmpdir(), 'turnkey-e0501-'));
  });

  afterEach(async () => {
    await rm(dataPath, { recursive: true, force: true });
  });

  const place = async (relative: string, content: string, mtime?: Date): Promise<void> => {
    const file = path.join(dataPath, ASSIGNMENT_FILE_DIRECTORY, relative);

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);

    if (mtime) await utimes(file, mtime, mtime);
  };

  it('imports new files with their receive time, skips processed ones and leaves files in place', async () => {
    const receivedAt = new Date('2026-11-09T05:00:00Z');

    await place('20261109/13/v41-12345675-20261109-130000000.E0501', await fixture(), receivedAt);
    await place('20261019/18/v31-12345675-20190801-150022257.E0501', await fixture());

    const imported: TurnkeyAssignmentFileInput[] = [];

    const results = await scanAssignmentFiles(dataPath, {
      processed: async names => new Set(names.filter(name => name.includes('20190801'))),
      importFile: async input => {
        imported.push(input);

        return { outcome: TurnkeyAssignmentFileOutcome.IMPORTED, entries: [] };
      },
    });

    expect(results).toEqual([
      { fileName: 'v41-12345675-20261109-130000000.E0501', outcome: TurnkeyAssignmentFileOutcome.IMPORTED },
    ]);

    expect(imported).toHaveLength(1);
    expect(imported[0].receivedAt).toEqual(receivedAt);
    expect(imported[0].entries[0]).toMatchObject({ track: 'ZY', beginNumber: '00000100' });

    // 檔案留在 Turnkey 的備份區
    await expect(
      readFile(path.join(dataPath, ASSIGNMENT_FILE_DIRECTORY, '20261109/13/v41-12345675-20261109-130000000.E0501')),
    ).resolves.toBeTruthy();
  });

  it('passes no entries for a broken file so the ledger records it once, and reports import errors', async () => {
    await place('20261109/13/a-broken.E0501', '<InvoiceEnvelope><oops');
    await place('20261109/13/b-fails.E0501', await fixture());

    const results = await scanAssignmentFiles(dataPath, {
      processed: async () => new Set(),
      importFile: async input => {
        if (input.fileName.startsWith('b-')) throw new Error('db down');

        expect(input.entries).toEqual([]);

        return { outcome: TurnkeyAssignmentFileOutcome.INVALID, entries: [] };
      },
    });

    expect(results).toEqual([
      { fileName: 'a-broken.E0501', outcome: TurnkeyAssignmentFileOutcome.INVALID },
      { fileName: 'b-fails.E0501', outcome: 'ERROR', error: 'db down' },
    ]);
  });

  it('returns nothing when the directory does not exist', async () => {
    await expect(
      scanAssignmentFiles(dataPath, {
        processed: async () => new Set(),
        importFile: async () => ({ outcome: null, entries: [] }),
      }),
    ).resolves.toEqual([]);
  });
});
