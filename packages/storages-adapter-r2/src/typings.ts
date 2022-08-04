import { StorageOptions } from '@rytass/storages';

export interface StorageR2Options extends StorageOptions {
  accessKey: string;
  secretKey: string;
  bucket: string;
  account: string;
}
