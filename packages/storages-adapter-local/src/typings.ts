import type { StorageOptions } from '@rytass/storages';

export interface StorageLocalOptions extends StorageOptions {
  directory: string;
  autoMkdir?: boolean;
}

// @dev: for *NIX systems
export enum StorageLocalHelperCommands {
  USED = 'du -sm . | awk \'{ print $1 }\'',
  FREE = 'df -m . | awk \'$3 ~ /[0-9]+/ { print $4 }\'',
}
