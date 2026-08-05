import { inflateRawSync } from 'zlib';
import type { ZipEntry } from '../typings/fbdi';

/**
 * 手刻 STORED（不壓縮）ZIP 產生器，供 FBDI 資料檔打包，無外部套件依賴。
 *
 * 僅實作 PKZIP 格式所需最小子集：Local File Header + Central Directory File Header +
 * End of Central Directory Record，compression method 0（STORED）。**支援多個 entry**——
 * 多數 FBDI（如 AP invoice 的 header + lines）需要在同一個 zip 內放多支 csv。
 */

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

/** 標準 CRC-32（IEEE 802.3 多項式 0xEDB88320），逐位元運算，無需預算表。 */
export function crc32(data: Buffer): number {
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];

    for (let bit = 0; bit < 8; bit++) {
      const mask = -(crc & 1);

      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { readonly time: number; readonly date: number } {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() >> 1) & 0x1f);
  const dosDate =
    (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);

  return { time, date: dosDate };
}

/**
 * 打包多個檔案為 STORED（不壓縮）ZIP，回傳完整 zip 二進位內容。
 *
 * @param entries 依序寫入的檔案；FBDI 的檔名必須與該匯入的 `.ctl` 對應。
 * @param mtime 寫入 zip 的時間戳（預設現在）。傳入固定值可產生位元組完全相同的輸出，便於測試。
 */
export function zipFiles(entries: readonly ZipEntry[], mtime: Date = new Date()): Buffer {
  if (entries.length === 0) {
    throw new Error('zipFiles requires at least one entry');
  }

  const { time, date } = dosDateTime(mtime);
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf-8');
    const crc = crc32(entry.content);
    const size = entry.content.length;

    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
    localHeader.writeUInt16LE(20, 4); // version needed to extract
    localHeader.writeUInt16LE(0, 6); // general purpose bit flag
    localHeader.writeUInt16LE(0, 8); // compression method: stored
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18); // compressed size
    localHeader.writeUInt32LE(size, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    const localEntry = Buffer.concat([localHeader, nameBuffer, entry.content]);

    const centralHeader = Buffer.alloc(46);

    centralHeader.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed to extract
    centralHeader.writeUInt16LE(0, 8); // general purpose bit flag
    centralHeader.writeUInt16LE(0, 10); // compression method: stored
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20); // compressed size
    centralHeader.writeUInt32LE(size, 24); // uncompressed size
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // file comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0, 38); // external file attributes
    centralHeader.writeUInt32LE(offset, 42); // relative offset of this entry's local header

    localParts.push(localEntry);
    centralParts.push(Buffer.concat([centralHeader, nameBuffer]));
    offset += localEntry.length;
  }

  const localSection = Buffer.concat(localParts);
  const centralSection = Buffer.concat(centralParts);

  const eocd = Buffer.alloc(22);

  eocd.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
  eocd.writeUInt16LE(0, 4); // number of this disk
  eocd.writeUInt16LE(0, 6); // disk where central directory starts
  eocd.writeUInt16LE(entries.length, 8); // number of central directory records on this disk
  eocd.writeUInt16LE(entries.length, 10); // total number of central directory records
  eocd.writeUInt32LE(centralSection.length, 12); // size of central directory
  eocd.writeUInt32LE(localSection.length, 16); // offset of start of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localSection, centralSection, eocd]);
}

/** 打包單一檔案為 STORED ZIP（`zipFiles` 的便利包裝）。 */
export function zipSingleFile(fileName: string, content: Buffer, mtime: Date = new Date()): Buffer {
  return zipFiles([{ name: fileName, content }], mtime);
}

const COMPRESSION_STORED = 0;
const COMPRESSION_DEFLATE = 8;

/**
 * Reads a ZIP archive, returning every entry with its decompressed content.
 *
 * Supports the two methods Fusion uses: STORED and DEFLATE. Needed because several
 * `erpintegrations` operations return archives rather than plain files — `downloadESSJobExecutionDetails`
 * hands back a ZIP containing `<requestId>.log`, for example.
 *
 * Uses Node's built-in `zlib`, so the package still has no external dependencies.
 */
export function unzipFiles(archive: Buffer): ZipEntry[] {
  const eocdIndex = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));

  if (eocdIndex === -1) {
    throw new Error('Not a ZIP archive: end of central directory record not found');
  }

  const entryCount = archive.readUInt16LE(eocdIndex + 10);
  let offset = archive.readUInt32LE(eocdIndex + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    if (archive.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Malformed ZIP: central directory entry ${i} has an unexpected signature`);
    }

    const compressionMethod = archive.readUInt16LE(offset + 10);
    const compressedSize = archive.readUInt32LE(offset + 20);
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42);
    const name = archive.subarray(offset + 46, offset + 46 + nameLength).toString('utf-8');

    // The local header repeats the name/extra lengths, which may differ from the central copy.
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = archive.subarray(dataStart, dataStart + compressedSize);

    if (compressionMethod !== COMPRESSION_STORED && compressionMethod !== COMPRESSION_DEFLATE) {
      throw new Error(`Unsupported ZIP compression method ${compressionMethod} for entry "${name}"`);
    }

    entries.push({
      name,
      content: compressionMethod === COMPRESSION_STORED ? Buffer.from(raw) : inflateRawSync(raw),
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}
