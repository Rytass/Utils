import { Inject, Injectable, Logger } from '@nestjs/common';
import { STORAGE_ADAPTER, STORAGE_MODULE_OPTIONS } from '../typings/storages-base-module-providers';
import type { StorageAdapter, StorageBaseModuleOptions } from '../typings/storage-base-module-options.interface';
import { InputFile, StorageFile, WriteFileOptions } from '@rytass/storages';
import { LocalStorage } from '@rytass/storages-adapter-local';
import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';
import { StorageGCSService } from '@rytass/storages-adapter-gcs';
import { StorageS3Service } from '@rytass/storages-adapter-s3';
import { StorageR2Service } from '@rytass/storages-adapter-r2';
import { PresignedURLOptions } from 'storages-adapter-r2/src/typings';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_ADAPTER)
    private readonly _adapter: StorageAdapter,
    @Inject(STORAGE_MODULE_OPTIONS)
    private readonly _options: StorageBaseModuleOptions,
  ) {
    this.logger.log(`Storage adapter: ${this._adapter.constructor.name}`);
  }

  async url(key: string): Promise<string>;
  async url(key: string, expires: number): Promise<string>;
  async url(key: string, options?: PresignedURLOptions): Promise<string>;

  async url(key: string, params?: number | PresignedURLOptions): Promise<string> {
    if (this._adapter instanceof LocalStorage) {
      throw new Error('LocalStorage does not support URL generation');
    }

    if (this._adapter instanceof StorageAzureBlobService || this._adapter instanceof StorageGCSService) {
      const expires = params as number;

      return this._adapter.url(key, expires);
    } else if (this._adapter instanceof StorageS3Service) {
      return this._adapter.url(key);
    } else if (this._adapter instanceof StorageR2Service) {
      const options = params as PresignedURLOptions;

      return this._adapter.url(key, options);
    } else {
      throw new Error('Unknown storage adapter');
    }
  }

  async write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    return this._adapter.write(file, options);
  }

  async batchWrite(files: InputFile[], options?: WriteFileOptions[]): Promise<StorageFile[]> {
    return this._adapter.batchWrite(files, options);
  }

  async remove(key: string): Promise<void> {
    return this._adapter.remove(key);
  }

  async isExists(key: string): Promise<boolean> {
    return this._adapter.isExists(key);
  }
}
