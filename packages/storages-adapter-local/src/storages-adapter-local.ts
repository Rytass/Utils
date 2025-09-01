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
import {
  StorageLocalOptions,
  StorageLocalUsageInfo,
  StorageLocalHelperCommands,
} from './typings';
import { resolve } from 'path';
import { Readable } from 'stream';
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
    const used = Number(
      (
        await exec(
          StorageLocalHelperCommands.USED.replace('__DIR__', this.directory),
        )
      ).stdout,
    );

    const free = Number(
      (
        await exec(
          StorageLocalHelperCommands.FREE.replace('__DIR__', this.directory),
        )
      ).stdout,
    );

    const total = Number(
      (
        await exec(
          StorageLocalHelperCommands.TOTAL.replace('__DIR__', this.directory),
        )
      ).stdout,
    );

    return {
      used,
      free,
      total,
    };
  }

  private getFileFullPath(key: string) {
    return resolve(this.directory, key);
  }

  private checkFileExists(fullPath: string) {
    try {
      if (!lstatSync(fullPath).isFile()) {
        throw new StorageError(ErrorCode.FILE_NOT_FOUND);
      }
    } catch (ex) {
      throw new StorageError(ErrorCode.FILE_NOT_FOUND);
    }
  }

  private async writeBuffer(
    buffer: Buffer,
    options?: WriteFileOptions,
  ): Promise<StorageFile> {
    const convertedBuffer = await this.converterManager.convert<Buffer>(buffer);

    const fileInfo =
      options?.filename || (await this.getBufferFilename(buffer));

    const filename = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;

    await writeFile(this.getFileFullPath(filename), convertedBuffer);

    return { key: filename };
  }

  private async writeStream(
    stream: Readable,
    options?: WriteFileOptions,
  ): Promise<StorageFile> {
    return new Promise<StorageFile>(async (promiseResolve) => {
      const convertedStream =
        await this.converterManager.convert<Readable>(stream);

      if (options?.filename) {
        const writeStream = createWriteStream(
          this.getFileFullPath(options.filename),
        );

        convertedStream.pipe(writeStream);

        await new Promise<void>((pResolve) => {
          stream.on('end', pResolve);
        });

        promiseResolve({ key: options.filename });

        return;
      }

      const tempFilename = uuid();
      const writeStream = createWriteStream(this.getFileFullPath(tempFilename));

      this.getStreamFilename(convertedStream).then(async ([filename]) => {
        await rename(
          this.getFileFullPath(tempFilename),
          this.getFileFullPath(filename),
        );

        promiseResolve({ key: filename });
      });

      convertedStream.pipe(writeStream);
    });
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
  read(
    key: string,
    options?: ReadBufferFileOptions | ReadStreamFileOptions,
  ): Promise<Readable> | Promise<Buffer> {
    if (options?.format === 'buffer') {
      return this.readFileBuffer(key);
    }

    return Promise.resolve(this.readFileStream(key));
  }

  async write(
    file: InputFile,
    options?: WriteFileOptions,
  ): Promise<StorageFile> {
    const convertedFile = await this.converterManager.convert(file);

    if (convertedFile instanceof Buffer) {
      return this.writeBuffer(convertedFile, options);
    }

    return this.writeStream(convertedFile as Readable, options);
  }

  batchWrite(
    files: InputFile[],
    options?: WriteFileOptions[],
  ): Promise<StorageFile[]> {
    return Promise.all(
      files.map((file, index) => this.write(file, options?.[index])),
    );
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
    } catch (ex: any) {
      return false;
    }
  }
}
