import { Injectable } from '@nestjs/common';
import { IStorageAdapter } from '../typings/storage-base-module-options.interface';
import { InputFile, WriteFileOptions, StorageFile } from '@rytass/storages';
import { LocalStorage } from '@rytass/storages-adapter-local';
import type { StorageLocalOptions } from 'storages-adapter-local/lib';

@Injectable()
export class LocalAdapter implements IStorageAdapter {
  private readonly localStorage: LocalStorage;

  constructor(options: StorageLocalOptions) {
    this.localStorage = new LocalStorage(options);
  }

  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    return this.localStorage.write(file, options);
  }

  batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    return this.localStorage.batchWrite(files);
  }

  remove(key: string): Promise<void> {
    return this.localStorage.remove(key);
  }

  isExists(key: string): Promise<boolean> {
    return this.localStorage.isExists(key);
  }
}
