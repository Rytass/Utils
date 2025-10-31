import { Injectable } from '@nestjs/common';
import { IStorageAdapter, IStorageAdapterUrlOptions } from '../typings/storage-base-module-options.interface';
import { InputFile, WriteFileOptions, StorageFile } from '@rytass/storages';
import { StorageR2Service } from '@rytass/storages-adapter-r2/src';
import type { StorageR2Options } from 'storages-adapter-r2/src/typings';

@Injectable()
export class R2Adapter implements IStorageAdapter {
  private readonly r2Service: StorageR2Service;

  constructor(config: StorageR2Options) {
    this.r2Service = new StorageR2Service(config);
  }

  url(key: string, options: IStorageAdapterUrlOptions): Promise<string> {
    return this.r2Service.url(key, options);
  }

  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    return this.r2Service.write(file, options);
  }

  batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    return this.r2Service.batchWrite(files);
  }

  remove(key: string): Promise<void> {
    return this.r2Service.remove(key);
  }

  isExists(key: string): Promise<boolean> {
    return this.r2Service.isExists(key);
  }
}
