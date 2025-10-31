import { Injectable } from '@nestjs/common';
import { IStorageAdapter, IStorageAdapterUrlOptions } from '../typings/storage-base-module-options.interface';
import { StorageGCSService } from '@rytass/storages-adapter-gcs';
import type { GCSOptions } from 'storages-adapter-gcs/src/typings';
import { InputFile, StorageFile, WriteFileOptions } from '@rytass/storages';

@Injectable()
export class GCSAdapter implements IStorageAdapter {
  private readonly gcsService: StorageGCSService;

  constructor(config: GCSOptions) {
    this.gcsService = new StorageGCSService(config);
  }

  url(key: string, options?: IStorageAdapterUrlOptions): Promise<string> {
    return this.gcsService.url(key, options?.expires);
  }

  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    return this.gcsService.write(file, options);
  }

  batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    return this.gcsService.batchWrite(files);
  }

  remove(key: string): Promise<void> {
    return this.gcsService.remove(key);
  }

  isExists(key: string): Promise<boolean> {
    return this.gcsService.isExists(key);
  }
}
