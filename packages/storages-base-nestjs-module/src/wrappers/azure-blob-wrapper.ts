import { Injectable } from '@nestjs/common';
import { IStorageAdapter, IStorageAdapterUrlOptions } from '../typings/storage-base-module-options.interface';
import { InputFile, WriteFileOptions, StorageFile } from '@rytass/storages';
import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';
import type { AzureBlobOptions } from 'storages-adapter-azure-blob/lib';

@Injectable()
export class AzureBlobAdapter implements IStorageAdapter {
  private readonly azureBlobService: StorageAzureBlobService;

  constructor(config: AzureBlobOptions) {
    this.azureBlobService = new StorageAzureBlobService(config);
  }

  url(key: string, options?: IStorageAdapterUrlOptions): Promise<string> {
    return this.azureBlobService.url(key, options?.expires);
  }

  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    return this.azureBlobService.write(file, options);
  }

  batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    return this.azureBlobService.batchWrite(files);
  }

  remove(key: string): Promise<void> {
    return this.azureBlobService.remove(key);
  }

  isExists(key: string): Promise<boolean> {
    return this.azureBlobService.isExists(key);
  }
}
