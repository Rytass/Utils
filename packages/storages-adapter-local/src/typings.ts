import { StorageOptions } from 'storages/src/typings';

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
