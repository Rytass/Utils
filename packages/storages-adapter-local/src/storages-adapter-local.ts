import {
  FileType,
  StorageAsyncCallback,
  StorageReadOptions,
  StorageService,
  WriteFileInput,
  StorageError,
  StorageWriteOptions,
  ErrorCode,
  StorageErrorInterface,
} from '@rytass/storages';
import { StorageLocalOptions } from '.';
import { join, resolve } from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { createHash } from 'crypto';
import LRU from 'lru-cache';
import * as fs from 'fs';

export class StorageLocalService implements StorageService {
  readonly defaultDirectory?: string;
  private readonly cache?: LRU<string, FileType>;

  constructor({ defaultDirectory, cache }: StorageLocalOptions) {
    if (defaultDirectory) this.defaultDirectory = defaultDirectory;
    if (cache) this.cache = new LRU(cache);
  }

  private createFileName(input: Buffer): string {
    const hash = createHash('sha1');

    hash.update(input.toString());

    return hash.digest('hex');
  }

  async createFile(input: WriteFileInput): Promise<FileType> {
    const buffer = input instanceof Buffer ? input : Buffer.from(input);
    const size = Buffer.byteLength(buffer);
    const type = await fileTypeFromBuffer(buffer);

    return { buffer, size, mime: type?.ext, extension: type?.ext };
  }

  write(
    file: Required<FileType>,
    {
      directory = this.defaultDirectory,
      ...options
    }: StorageWriteOptions & StorageAsyncCallback
  ): void {
    try {
      if (!directory || !fs.existsSync(directory))
        throw new StorageError(ErrorCode.DIRECTORY_NOT_FOUND);

      let fileName = this.createFileName(file.buffer);

      if (options.fileName)
        fileName =
          typeof options.fileName === 'string'
            ? options.fileName
            : options.fileName(file);

      const [name, extension] = fileName.split(',');

      if (!extension) fileName = [name, file.extension].join('.');

      fs.writeFile(
        join(directory, fileName),
        new Uint8Array(file.buffer), //ASCII
        (error) => {
          if (options.callback) {
            if (error)
              options.callback(new StorageError(ErrorCode.WRITE_FILE_ERROR));
            else options.callback(undefined, file);
          }
        }
      );
    } catch (error) {
      if (options.callback) options.callback(error as StorageErrorInterface);
    }
  }

  writeSync(
    file: Required<FileType>,
    { directory = this.defaultDirectory, ...options }: StorageWriteOptions
  ): void {
    if (!directory || !fs.existsSync(directory))
      throw new StorageError(ErrorCode.DIRECTORY_NOT_FOUND);

    let fileName = this.createFileName(file.buffer);

    if (options.fileName)
      fileName =
        typeof options.fileName === 'string'
          ? options.fileName
          : options.fileName(file);

    const [name, extension] = fileName.split(',');

    if (!extension) fileName = [name, file.extension].join('.');

    return fs.writeFileSync(
      join(directory, fileName),
      new Uint8Array(file.buffer)
    );
  }

  async read(
    fileName: string,
    {
      directory = this.defaultDirectory,
    }: StorageReadOptions & Required<StorageAsyncCallback>
  ): Promise<FileType> {
    if (!directory || !fs.existsSync(directory))
      throw new StorageError(ErrorCode.DIRECTORY_NOT_FOUND);
    const buffer = await fs.promises.readFile(join(fileName, directory));
    const file = await this.createFile(buffer);

    return file;
  }

  async find(directory: string): Promise<string[]> {
    if (!fs.existsSync(directory))
      throw new StorageError(ErrorCode.DIRECTORY_NOT_FOUND);
    const searchSubDirectory = async (directory: string, found: string[]) => {
      const subs = await fs.promises.readdir(directory);

      subs.map(async (sub) => {
        (await fs.promises.stat(sub)).isDirectory()
          ? found.concat(await searchSubDirectory(sub, []))
          : found.push(sub);
      });

      return found;
    };

    return searchSubDirectory(directory, [])
  }
}
