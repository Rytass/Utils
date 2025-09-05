import { StorageOptions } from '@rytass/storages';

export interface StorageS3Options extends StorageOptions {
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}
