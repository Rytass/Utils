import { StorageOptions } from '@rytass/storages';

export interface StorageVercelBlobOptions extends StorageOptions {
  token?: string;
  pathPrefix?: string;
  access?: 'public';
  [key: string]: unknown;
}
