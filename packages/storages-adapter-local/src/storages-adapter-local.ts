import {
  Storage,
  StorageError,
  ErrorCode,
  InputFile,
  StorageFile,
  ReadBufferFileOptions,
  ReadStreamFileOptions,
  WriteFileOptions,
} from '@rytass/storages';
import { v4 as uuid } from 'uuid';
import { promisify } from 'util';
import { StorageLocalOptions, StorageLocalUsageInfo, StorageLocalHelperCommands } from './typings';
import { resolve } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { lstatSync, mkdirSync, createReadStream, createWriteStream } from 'fs';
import { readFile, unlink, writeFile, rename } from 'fs/promises';
import { exec as execInCb } from 'child_process';

// @dev: using the
const exec = promisify(execInCb);

export class LocalStorage extends Storage {
  private readonly directory: string;

  constructor(options: StorageLocalOptions) {
    super(options);

    this.directory = options.directory;

    if (options.autoMkdir) {
      mkdirSync(this.directory, { recursive: true });
    }

    if (!lstatSync(this.directory).isDirectory()) {
      throw new StorageError(ErrorCode.DIRECTORY_NOT_FOUND);
    }
  }

  public async getUsageInfo(): Promise<StorageLocalUsageInfo> {
    const _usage: StorageLocalUsageInfo = await this.getFsUsage();

    return _usage;
  }

  // @dev: returns file system usage in 1M-blocks
  private async getFsUsage(): Promise<StorageLocalUsageInfo> {
    const used = Number((await exec(StorageLocalHelperCommands.USED.replace('__DIR__', this.directory))).stdout);

    const free = Number((await exec(StorageLocalHelperCommands.FREE.replace('__DIR__', this.directory))).stdout);

    const total = Number((await exec(StorageLocalHelperCommands.TOTAL.replace('__DIR__', this.directory))).stdout);

    return {
      used,
      free,
      total,
    };
  }

  private getFileFullPath(key: string): string {
    return resolve(this.directory, key);
  }

  private checkFileExists(fullPath: string): void {
    try {
      if (!lstatSync(fullPath).isFile()) {
        throw new StorageError(ErrorCode.FILE_NOT_FOUND);
      }
    } catch (_ex) {
      throw new StorageError(ErrorCode.FILE_NOT_FOUND);
    }
  }

  // @dev: receives the already-converted buffer from write(), so the hash matches the stored content
  private async writeBuffer(buffer: Buffer, options?: WriteFileOptions): Promise<StorageFile> {
    const fileInfo = options?.filename || (await this.getBufferFilename(buffer));

    const filename = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;

    await writeFile(this.getFileFullPath(filename), buffer);

    return { key: filename };
  }

  // @dev: receives the already-converted stream from write(); converting again would apply converters twice
  private async writeStream(convertedStream: Readable, options?: WriteFileOptions): Promise<StorageFile> {
    // Always write to a temp file and rename afterwards, so a failed write never leaves a partial file
    // at the target path (or truncates an existing one).
    const tempFilename = uuid();
    const tempFilePath = this.getFileFullPath(tempFilename);

    const writeStream = createWriteStream(tempFilePath);
    const writePromise = pipeline(convertedStream, writeStream);

    try {
      // Wait for both the hash (when needed) and the write stream before renaming; either side failing rejects
      const [filename] = await Promise.all([
        options?.filename
          ? options.filename
          : this.getStreamFilename(convertedStream).then(([hashFilename]): string => hashFilename),
        writePromise,
      ]);

      await rename(tempFilePath, this.getFileFullPath(filename));

      return { key: filename };
    } catch (ex: unknown) {
      // Stop a write that may still be running (e.g. filename detection failed first) before removing the file
      writeStream.on('error', (): void => undefined);
      writeStream.destroy(ex instanceof Error ? ex : new Error(String(ex)));

      await writePromise.catch((): undefined => undefined);

      // Best-effort cleanup of the temp file; never mask the original error.
      await unlink(tempFilePath).catch((): undefined => undefined);

      throw ex;
    }
  }

  private readFileBuffer(key: string): Promise<Buffer> {
    const path = this.getFileFullPath(key);

    this.checkFileExists(path);

    return readFile(path);
  }

  private readFileStream(key: string): Readable {
    const path = this.getFileFullPath(key);

    this.checkFileExists(path);

    return createReadStream(path);
  }

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  read(key: string, options?: ReadBufferFileOptions | ReadStreamFileOptions): Promise<Readable> | Promise<Buffer> {
    if (options?.format === 'buffer') {
      return this.readFileBuffer(key);
    }

    return Promise.resolve(this.readFileStream(key));
  }

  async write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    const convertedFile = await this.converterManager.convert(file);

    if (convertedFile instanceof Buffer) {
      return this.writeBuffer(convertedFile, options);
    }

    return this.writeStream(convertedFile as Readable, options);
  }

  batchWrite(files: InputFile[], options?: WriteFileOptions[]): Promise<StorageFile[]> {
    return Promise.all(files.map((file, index) => this.write(file, options?.[index])));
  }

  remove(key: string): Promise<void> {
    const path = this.getFileFullPath(key);

    this.checkFileExists(path);

    return unlink(path);
  }

  async isExists(key: string): Promise<boolean> {
    const path = this.getFileFullPath(key);

    try {
      await this.checkFileExists(path);

      return true;
    } catch (_ex: unknown) {
      return false;
    }
  }
}
