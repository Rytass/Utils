import {
  Storage,
  StorageError,
  ErrorCode,
  InputFile,
  StorageFile,
  ReadBufferFileOptions,
  ReadStreamFileOptions,
} from '@rytass/storages';
import { v4 as uuid } from 'uuid';
import { StorageLocalOptions } from './typings';
import { resolve } from 'path';
import { Readable } from 'stream';
import { lstatSync, mkdirSync, createReadStream, createWriteStream } from 'fs';
import { readFile, unlink, writeFile, rename } from 'fs/promises';

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

  private async writeBuffer(buffer: Buffer, givenFilename?: string): Promise<StorageFile> {
    const convertedBuffer = await this.converterManager.convert<Buffer>(buffer);

    const filename = givenFilename || await this.getBufferFilename(convertedBuffer);

    await writeFile(this.getFileFullPath(filename), convertedBuffer);

    return { key: filename };
  }

  private async writeStream(stream: Readable, givenFilename?: string): Promise<StorageFile> {
    return new Promise<StorageFile>(async (promiseResolve) => {
      const convertedStream = await this.converterManager.convert<Readable>(stream);

      if (givenFilename) {
        const writeStream = createWriteStream(this.getFileFullPath(givenFilename));

        convertedStream.pipe(writeStream);

        await new Promise<void>((pResolve) => {
          stream.on('end', pResolve);
        });

        promiseResolve({ key: givenFilename });

        return;
      }

      const tempFilename = uuid();
      const writeStream = createWriteStream(this.getFileFullPath(tempFilename));

      this.getStreamFilename(convertedStream).then(async (filename) => {
        await rename(this.getFileFullPath(tempFilename), this.getFileFullPath(filename));

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
  read(key: string, options?: ReadBufferFileOptions | ReadStreamFileOptions): Promise<Readable> | Promise<Buffer> {
    if (options?.format === 'buffer') {
      return this.readFileBuffer(key);
    }

    return Promise.resolve(this.readFileStream(key));
  }

  async write(file: InputFile, filename?: string): Promise<StorageFile> {
    const convertedFile = await this.converterManager.convert(file);

    if (convertedFile instanceof Buffer) {
      return this.writeBuffer(convertedFile, filename);
    }

    return this.writeStream(convertedFile, filename);
  }

  batchWrite(files: InputFile[], filenames?: string[]): Promise<StorageFile[]> {
    return Promise.all(files.map((file, index) => this.write(file, filenames?.[index])));
  }

  remove(key: string): Promise<void> {
    const path = this.getFileFullPath(key);

    this.checkFileExists(path);

    return unlink(path);
  }
}
