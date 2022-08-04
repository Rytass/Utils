import type { StorageOptions } from '@rytass/storages';

export interface StorageLocalOptions extends StorageOptions {
  directory: string;
  autoMkdir?: boolean;
}
