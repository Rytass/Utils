import { promises as fs } from 'fs';
import path from 'path';
import { TurnkeyMessageCategory, TurnkeyMigMessageType } from '../typings/turnkey-enums';

/** 暫存目錄放在 /data 底下但不在 UpCast 內，確保與 SRC 同一個檔案系統（rename 才是原子的） */
export const SIDECAR_TMP_DIRECTORY = 'sidecar/tmp';

export interface SubmissionFile {
  readonly category: TurnkeyMessageCategory;
  readonly messageType: TurnkeyMigMessageType;
  readonly fileName: string;
  readonly xml: string;
}

export const upCastSourceDirectory = (
  dataPath: string,
  category: TurnkeyMessageCategory,
  messageType: TurnkeyMigMessageType,
): string => path.join(dataPath, 'UpCast', category, messageType, 'SRC');

/**
 * 把 XML 交給 Turnkey：先寫進 SRC 以外的暫存檔、fsync，再 rename 進 SRC。
 * Turnkey 會撿走 SRC 內任何檔案，直接寫進 SRC 可能被撿到半個檔（實測出現過 -002 空檔）。
 */
export const writeSubmissionFile = async (dataPath: string, file: SubmissionFile): Promise<string> => {
  const tmpDirectory = path.join(dataPath, SIDECAR_TMP_DIRECTORY);
  const target = path.join(upCastSourceDirectory(dataPath, file.category, file.messageType), file.fileName);
  const tmp = path.join(tmpDirectory, `${file.fileName}.partial`);

  await fs.mkdir(tmpDirectory, { recursive: true });

  const handle = await fs.open(tmp, 'w', 0o664);

  try {
    await handle.writeFile(file.xml, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }

  await fs.rename(tmp, target);

  return target;
};
