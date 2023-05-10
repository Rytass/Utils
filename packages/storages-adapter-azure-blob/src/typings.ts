import { StorageOptions } from '@rytass/storages';

export interface AzureBlobOptions extends StorageOptions {
  connectionString: string;
  container: string;
}
