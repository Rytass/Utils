import { promises as fs } from 'fs';
import path from 'path';
import { formatMigDate } from '../utils/taipei-time';
import { parseInboundMessage, TurnkeyInboundMessage } from './parse-inbound-message';
import type { TurnkeyInboundOutcome } from './turnkey-inbound.service';

export const DEFAULT_INBOUND_ARCHIVE_DIRECTORY = 'sidecar/inbound';

export interface InboundScanResult {
  readonly fileName: string;
  readonly messageType: string;
  readonly outcome: TurnkeyInboundOutcome | 'UNRECOGNIZED' | 'ERROR';
  readonly error?: string;
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const moveFile = async (source: string, target: string): Promise<void> => {
  await fs.mkdir(path.dirname(target), { recursive: true });

  try {
    await fs.rename(source, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;

    // 封存目錄在別的檔案系統：先複製再刪
    await fs.copyFile(source, target);
    await fs.unlink(source);
  }
};

/**
 * 掃 RecvTarget/<訊息>/*.xml：解析、交給 process 套用，成功（含重複）後搬到封存目錄
 * `<archive>/<處理日>/<訊息>/`；不認得的檔案搬到 `<archive>/<處理日>/unrecognized/`，
 * 對不到營業人或文件的搬到 `unmatched/`。process 丟錯時檔案留在原地，下一輪重試。
 */
export const scanInbound = async (
  dataPath: string,
  archivePath: string,
  process: (message: TurnkeyInboundMessage, fileName: string) => Promise<TurnkeyInboundOutcome>,
  now: Date = new Date(),
): Promise<readonly InboundScanResult[]> => {
  const root = path.join(dataPath, 'RecvTarget');
  const types = await fs.readdir(root).catch(() => [] as string[]);
  const day = formatMigDate(now);

  const files = (
    await Promise.all(
      types.map(async type =>
        (await fs.readdir(path.join(root, type)).catch(() => [] as string[]))
          .filter(name => name.endsWith('.xml'))
          .sort()
          .map(name => ({ type, name })),
      ),
    )
  ).flat();

  const handleFile = async (type: string, name: string): Promise<InboundScanResult> => {
    const source = path.join(root, type, name);
    const read = await fs.readFile(source, 'utf8').then(
      text => ({ text, error: null }),
      (error: Error) => ({ text: '', error }),
    );

    // 讀不到（權限、名為 *.xml 的目錄）：留在原地回報錯誤，不擋後面的檔案
    if (read.error) {
      return { fileName: name, messageType: type, outcome: 'ERROR', error: read.error.message };
    }

    const xml = read.text;

    // 結構不完整的檔（例如缺 Main）解析會丟錯：歸為無法辨識，不讓單一壞檔擋住整批
    const message = ((): TurnkeyInboundMessage | null => {
      try {
        return parseInboundMessage(xml);
      } catch {
        return null;
      }
    })();

    if (!message) {
      await moveFile(source, path.join(archivePath, day, 'unrecognized', name));

      return { fileName: name, messageType: type, outcome: 'UNRECOGNIZED' };
    }

    // 以標記結果區分成敗：process 丟出非 Error 的值也算失敗，不會被當成 outcome
    const applied = await process(message, name).then(
      outcome => ({ outcome, error: null }),
      (error: unknown) => ({ outcome: null, error: errorMessage(error) }),
    );

    // 套用失敗：留在原地，下一輪重試，不擋後面的檔案
    if (applied.outcome === null) {
      return { fileName: name, messageType: message.messageType, outcome: 'ERROR', error: applied.error };
    }

    const { outcome } = applied;

    const folder = outcome === 'UNMATCHED' ? 'unmatched' : outcome === 'IGNORED' ? 'ignored' : message.messageType;

    await moveFile(source, path.join(archivePath, day, folder, name));

    return { fileName: name, messageType: message.messageType, outcome };
  };

  return files.reduce<Promise<readonly InboundScanResult[]>>(async (resultsPromise, { type, name }) => {
    const results = await resultsPromise;
    // 封存搬檔失敗（權限、磁碟滿）也只算這個檔的錯誤；已套用的訊息下一輪會以 DUPLICATE 再搬一次
    const result = await handleFile(type, name).catch(
      (error: unknown): InboundScanResult => ({
        fileName: name,
        messageType: type,
        outcome: 'ERROR',
        error: errorMessage(error),
      }),
    );

    return [...results, result];
  }, Promise.resolve([]));
};
