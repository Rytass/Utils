import { promises as fs } from 'fs';
import path from 'path';
import { TurnkeyAssignmentFileOutcome } from '../models/turnkey-assignment-file.entity';
import { parseAssignmentFile, TurnkeyAssignmentEntry } from './parse-assignment-file';
import type { TurnkeyAssignmentFileInput, TurnkeyAssignmentFileResult } from './turnkey-assignment.service';

/** Turnkey 拆封後的 E0501 配號檔：`Unpack/BAK/E0501/<yyyyMMdd>/<HH>/*.E0501` */
export const ASSIGNMENT_FILE_DIRECTORY = path.join('Unpack', 'BAK', 'E0501');

export interface AssignmentScanResult {
  readonly fileName: string;
  /** null：對不到已登錄的營業人，下一輪再試；ERROR：讀取、解析或寫入失敗，下一輪重試 */
  readonly outcome: TurnkeyAssignmentFileOutcome | null | 'ERROR';
  readonly error?: string;
}

export interface AssignmentScanHandlers {
  readonly processed: (fileNames: readonly string[]) => Promise<ReadonlySet<string>>;
  readonly importFile: (input: TurnkeyAssignmentFileInput) => Promise<TurnkeyAssignmentFileResult>;
}

const listFiles = async (directory: string): Promise<readonly string[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);

  const nested = await Promise.all(
    entries.map(entry =>
      entry.isDirectory()
        ? listFiles(path.join(directory, entry.name))
        : Promise.resolve(entry.isFile() ? [path.join(directory, entry.name)] : []),
    ),
  );

  return nested.flat();
};

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * 掃描 E0501 配號檔並匯入字軌。Unpack/BAK 是 Turnkey 自己的備份區（依資料保留天數清理），
 * 檔案只讀不搬；已處理的檔名記在帳本，之後的輪次不再讀取。
 */
export const scanAssignmentFiles = async (
  dataPath: string,
  handlers: AssignmentScanHandlers,
): Promise<readonly AssignmentScanResult[]> => {
  const files = [...(await listFiles(path.join(dataPath, ASSIGNMENT_FILE_DIRECTORY)))].sort();
  const processed = await handlers.processed(files.map(file => path.basename(file)));
  const pending = files.filter(file => !processed.has(path.basename(file)));

  return pending.reduce<Promise<readonly AssignmentScanResult[]>>(async (resultsPromise, file) => {
    const results = await resultsPromise;
    const fileName = path.basename(file);

    const result = await (async (): Promise<AssignmentScanResult> => {
      const [xml, stat] = await Promise.all([fs.readFile(file, 'utf8'), fs.stat(file)]);
      // XML 壞掉或找不到 InvoiceAssignNo：以空區間交給帳本記成 INVALID，不每輪重試
      const entries = ((): readonly TurnkeyAssignmentEntry[] => {
        try {
          return parseAssignmentFile(xml);
        } catch {
          return [];
        }
      })();

      const imported = await handlers.importFile({ fileName, receivedAt: stat.mtime, entries });

      return { fileName, outcome: imported.outcome };
    })().catch((error: unknown): AssignmentScanResult => ({ fileName, outcome: 'ERROR', error: errorMessage(error) }));

    return [...results, result];
  }, Promise.resolve([]));
};
