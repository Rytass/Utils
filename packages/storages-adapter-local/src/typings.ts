import type { StorageOptions } from '@rytass/storages';

export interface StorageLocalOptions extends StorageOptions {
  directory: string;
  autoMkdir?: boolean;
}

// @dev: for *NIX systems
export enum StorageLocalHelperCommands {
  USED = 'du -sm __DIR__ | awk \'{ print $1 }\'',
  FREE = 'df -m __DIR__ | awk \'$3 ~ /[0-9]+/ { print $4 }\'',
}

// @dev: in 1M blocks
export interface StorageLocalUsageInfo {
  used: number,
  free: number,
}
