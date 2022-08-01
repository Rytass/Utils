import {
  Convertable,
  ErrorCallback,
  FileType,
  StorageAsyncCallback,
  StorageWriteOptions,
} from '@rytass/storages';
import { StorageLocalFileOptions, StorageLocalOptions } from '.';

export class StorageLocalFile<T extends StorageLocalOptions>
  implements FileType<T>
{
  public extension?: string;
  public mime?: string;
  readonly buffer: Buffer;
  readonly size: number;
  readonly defaultDirectory?: string;
  write: (options: StorageWriteOptions & StorageAsyncCallback) => Promise<void>;
  to: (
    extension: Convertable<T['converters']>['extension'],
    options?: Convertable<T['converters']>['options'] & {
      errors?: ErrorCallback;
    }
  ) => Buffer | undefined | Promise<Buffer | undefined>;
  constructor(options: StorageLocalFileOptions<T>) {
    this.buffer = options.buffer;
    this.size = options.size;
    this.extension = options.extension;
    this.defaultDirectory = options.defaultDirectory;
    this.mime = options.mime;

    this.to = options.to;
    this.write = options.write;
  }
  get metadata() {
    return {
      buffer: this.buffer,
      size: this.size,
      mime: this.mime,
      extension: this.extension,
    };
  }
}
