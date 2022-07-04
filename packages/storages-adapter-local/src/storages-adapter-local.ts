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
  ErrorCallback,
  ConverterManagerInterface,
  Converter,
  ConverterManager,
} from '@rytass/storages';
import { DetectLocalFileType, StorageLocalOptions } from '.';
import { resolve } from 'path';
import { createHash } from 'crypto';
import LRU from 'lru-cache';
import { Magic, MAGIC_MIME_TYPE } from 'mmmagic';
import * as mimes from 'mime-types';
import * as fs from 'fs';
import { ImagesConverter } from '@rytass/storages-images-converter';
import { StorageLocalFile } from './storage-adapter-file';

export class StorageLocalService<T extends StorageLocalOptions>
  implements StorageService<T>
{
  readonly defaultDirectory?: string;
  readonly converterManager?: ConverterManagerInterface<
    T['converters'] extends Converter[] ? T['converters'] : never
  >;
  private readonly cache?: LRU<string, StorageLocalFile<T>>;

  constructor(options?: T extends StorageLocalOptions ? T : never) {
    if (options?.defaultDirectory)
      this.defaultDirectory = options.defaultDirectory;
    if (options?.cache)
      this.cache = new LRU({
        ...options.cache,
        sizeCalculation: value => value?.buffer.length,
      });

    const converters = options?.converters?.length
      ? options.converters
      : [ImagesConverter];

    this.converterManager = new ConverterManager(converters);
  }

  private createFileName(input: Buffer): string {
    const hash = createHash('sha1');

    hash.update(input.toString());

    return hash.digest('hex');
  }
  private detectFileType(input: Buffer): Promise<DetectLocalFileType> {
    const magic = new Magic(MAGIC_MIME_TYPE);

    return new Promise((resolve, reject) => {
      magic.detect(input, (error: Error, result: string | string[]) => {
        if (error) reject(error);
        const mime = result instanceof Array ? result[0] : result;
        const extension = mimes.extension(mime);

        resolve({ mime: mime, extension: extension ? extension : undefined });
      });
    });
  }

  private async createFile(
    input: WriteFileInput
  ): Promise<StorageLocalFile<T>> {
    const buffer = input instanceof Buffer ? input : Buffer.from(input);
    const size = Buffer.byteLength(buffer);
    const { mime, extension } = await this.detectFileType(buffer);

    return new StorageLocalFile({
      buffer,
      size,
      mime: mime,
      extension: extension,
      to: async (target, options) => {
        try {
          if (!extension) throw new StorageError(ErrorCode.UNRECOGNIZED_ERROR);

          return this.converterManager?.convert(
            target,
            { buffer, extension },
            options
          );
        } catch (error) {
          if (options) {
            if (options.errors) options.errors(error as StorageError);
          }
        }
      },
      write: options => this.write(buffer, options),
    });
  }

  async write(
    input: WriteFileInput,
    options?: StorageWriteOptions & StorageAsyncCallback
  ): Promise<void> {
    try {
      const directory = options?.directory ?? this.defaultDirectory;

      if (!directory) throw new StorageError(ErrorCode.DIRECTORY_NOT_FOUND);

      if (!fs.existsSync(directory)) {
        if (options?.autoMkdir)
          await fs.promises.mkdir(directory, { recursive: true });
        else throw new StorageError(ErrorCode.DIRECTORY_NOT_FOUND);
      }

      const file = (await this.createFile(input)) as FileType<T>;

      let fileName = this.createFileName(file.buffer);

      if (options?.fileName)
        fileName =
          typeof options.fileName === 'string'
            ? options.fileName
            : options.fileName(file);

      const [name, extension] = fileName.split('.');

      if (!extension) fileName = [name, file.extension].join('.');

      fs.writeFile(
        resolve(directory, fileName),
        new Uint8Array(file.buffer), //ASCII
        (error) => {
          if (options?.callback) {
            if (error)
              options.callback(new StorageError(ErrorCode.WRITE_FILE_ERROR));
            else options.callback(undefined, file);
          }
        }
      );
    } catch (error) {
      if (options?.callback) options.callback(error as StorageErrorInterface);
    }
  }

  async read(
    fileName: string,
    options?: StorageReadOptions
  ): Promise<StorageLocalFile<T>> {
    const directory = options?.directory ?? this.defaultDirectory;

    if (!directory || !fs.existsSync(directory))
      throw new StorageError(ErrorCode.DIRECTORY_NOT_FOUND);
    const fullPath = resolve(directory, fileName);

    const cache = this.cache?.get(fullPath);

    if (cache) return cache;

    const buffer = await fs.promises.readFile(fullPath);
    const file = await this.createFile(buffer);

    if (this.cache) this.cache.set(fullPath, file);

    return file;
  }

  async readRaw(input: WriteFileInput): Promise<StorageLocalFile<T>> {
    return this.createFile(input);
  }

  /**
   * Search every files in given directory
   * @param {String} directory Path like string.
   * @returns {String[]} File names found in directory.
   */
  async search(directory: string): Promise<string[]> {
    if (!fs.existsSync(directory))
      throw new StorageError(ErrorCode.DIRECTORY_NOT_FOUND);

    if ((await fs.promises.stat(directory)).isFile()) return [directory];

    const searchSubDirectory = async (directory: string) => {
      const found: string[] = [];
      const subs = await fs.promises.readdir(directory);

      await Promise.all(
        subs.map(async (sub) => {
          const path = resolve(directory, sub);

          (await fs.promises.stat(path)).isDirectory()
            ? (await searchSubDirectory(path)).map(sub => found.push(sub))
            : found.push(path);
        })
      );

      return found;
    };

    return searchSubDirectory(directory);
  }

  async remove(directory: string, callback?: ErrorCallback) {
    if (!fs.existsSync(directory)) return;

    try {
      (await fs.promises.stat(directory)).isDirectory()
        ? fs.promises.rm(directory, { recursive: true })
        : fs.promises.unlink(directory);
    } catch (error) {
      if (callback)
        callback(
          new StorageError(ErrorCode.REMOVE_FILE_ERROR, error as string)
        );
    }
  }
}
