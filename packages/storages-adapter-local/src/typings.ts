import {
  Convertable,
  ErrorCallback,
  StorageAsyncCallback,
  StorageOptions,
  StorageWriteOptions,
} from '@rytass/storages';

export interface StorageLocalCacheOptions {
  maxSize: number;
  ttl: number;
}

export interface StorageLocalOptions extends StorageOptions {
  defaultDirectory?: string;
  cache?: StorageLocalCacheOptions;
}

export interface DetectLocalFileType {
  mime: string;
  extension?: string;
}

export interface StorageLocalFileOptions<T extends StorageLocalOptions> {
  buffer: Buffer;
  size: number;
  extension?: string;
  defaultDirectory?: string;
  mime?: string;
  to: (
    extension: Convertable<T['converters']>['extension'],
    options?: Convertable<T['converters']>['options'] & {
      errors?: ErrorCallback;
    }
  ) => Buffer | undefined | Promise<Buffer | undefined>;
  write: (options: StorageWriteOptions & StorageAsyncCallback) => Promise<void>;
}
