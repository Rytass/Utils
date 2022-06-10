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
import { DetectLocalFileType, StorageLocalOptions } from '.';
import { join, resolve } from 'path';
import { createHash } from 'crypto';
import LRU from 'lru-cache';
import { Magic, MAGIC_MIME_TYPE } from 'mmmagic';
import * as mimes from 'mime-types';
import * as fs from 'fs';

export class StorageLocalService implements StorageService {
  readonly defaultDirectory?: string;
  private readonly cache?: LRU<string, FileType>;

  constructor(options?: StorageLocalOptions) {
    if (options?.defaultDirectory)
      this.defaultDirectory = options.defaultDirectory;
    if (options?.cache) this.cache = new LRU(options.cache);
  }

  private createFileName(input: Buffer): string {
    const hash = createHash('sha1');

    hash.update(input.toString());

    return hash.digest('hex');
  }
  private detectFileType(input: Buffer): Promise<DetectLocalFileType> {
    const magic = new Magic(MAGIC_MIME_TYPE);

    return new Promise((resolve, reject) => {
      magic.detect(input, (error: Error, result: string| string[]) => {
        if (error) reject(error);
        const mime = result instanceof Array? result[0] : result
        const extension = mimes.extension(mime)

        resolve({mime: mime, extension: extension ? extension: undefined});
      });
    });
  }

  async createFile(input: WriteFileInput): Promise<FileType> {
    const buffer = input instanceof Buffer ? input : Buffer.from(input);
    const size = Buffer.byteLength(buffer);
    const { mime, extension } =  await this.detectFileType(buffer)

    return { buffer, size, mime: mime, extension: extension };
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
    file: FileType,
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

    const [name, extension] = fileName.split('.');

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
    const fullPath = join(fileName, directory)

    if (this.cache)
      this.cache.get(fullPath)

    const buffer = await fs.promises.readFile(fullPath);
    const file =  await this.createFile(buffer);

    if (this.cache)
      this.cache.set(fullPath, file)

    return file;
  }

  async find(directory: string): Promise<string[]> {
    if (!fs.existsSync(directory))
      throw new StorageError(ErrorCode.DIRECTORY_NOT_FOUND);

    const searchSubDirectory = async (directory: string) => {
      const found: string[] = [];
      const subs = await fs.promises.readdir(directory);

      await Promise.all(
        subs.map(async (sub) => {
          (await fs.promises.stat(resolve(directory, sub))).isDirectory()
            ? (await searchSubDirectory(resolve(directory, sub))).map(sub =>
                found.push(sub)
              )
            : found.push(sub);
        })
      );

      return found;
    };

    return searchSubDirectory(directory);
  }
}
