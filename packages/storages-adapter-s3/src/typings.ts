import { StorageOptions } from '@rytass/storages';
import type { Endpoint } from 'aws-sdk';

export interface StorageS3Options extends StorageOptions {
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
}
