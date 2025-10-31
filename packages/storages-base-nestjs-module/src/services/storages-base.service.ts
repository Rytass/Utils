import { Inject, Injectable, Logger, Type } from '@nestjs/common';
import { STORAGE_ADAPTER, STORAGE_MODULE_OPTIONS } from '../typings/storages-base-module-providers';
import type {
  IStorageAdapter,
  StorageBaseModuleOptions,
  StorageModuleCommonOptions,
} from '../typings/storage-base-module-options.interface';
import { InputFile, StorageFile, WriteFileOptions } from '@rytass/storages';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly _commonOptions: StorageModuleCommonOptions;

  constructor(
    @Inject(STORAGE_ADAPTER)
    private readonly _adapter: IStorageAdapter,
    @Inject(STORAGE_MODULE_OPTIONS)
    private readonly _options: StorageBaseModuleOptions<Type<IStorageAdapter>>,
  ) {
    this.logger.log(`Storage adapter: ${this._adapter.constructor.name}`);

    const { commonOptions = {} } = this._options;

    this._commonOptions = {
      formDataFieldName: commonOptions.formDataFieldName ?? 'files',
      allowMultiple: commonOptions.allowMultiple ?? true,
      MaxFileSizeInBytes: commonOptions.MaxFileSizeInBytes ?? 10 * 1024 * 1024,
      defaultPublic: commonOptions.defaultPublic ?? false,
    };
  }

  get commonOptions(): StorageModuleCommonOptions {
    return this._commonOptions;
  }

  async url(key: string): Promise<string>;
  async url(key: string, expires: number): Promise<string>;
  async url(key: string, options?: unknown): Promise<string>;

  async url(key: string, params?: number | unknown): Promise<string> {
    const adapterName = this._adapter.constructor.name;

    if (adapterName === 'LocalAdapter') {
      throw new Error('LocalStorage does not support URL generation');
    }

    if (adapterName === 'AzureBlobAdapter' || adapterName === 'GCSAdapter') {
      const expires = params as number;

      type UrlWithExpires = { url: (k: string, e: number) => Promise<string> };
      const adapter = this._adapter as unknown as UrlWithExpires;

      return adapter.url(key, expires);
    } else if (adapterName === 'S3Adapter') {
      type UrlNoOptions = { url: (k: string) => Promise<string> };
      const adapter = this._adapter as unknown as UrlNoOptions;

      return adapter.url(key);
    } else if (adapterName === 'R2Adapter') {
      type R2Like = { url: (k: string, o?: unknown) => Promise<string> };
      const r2 = this._adapter as unknown as R2Like;
      const options = params as unknown;

      return r2.url(key, options);
    } else {
      throw new Error('Unknown storage adapter');
    }
  }

  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    return this._adapter.write(file, options);
  }

  batchWrite(files: InputFile[], options?: WriteFileOptions[]): Promise<StorageFile[]> {
    return this._adapter.batchWrite(files, options);
  }

  async remove(key: string): Promise<void> {
    return this._adapter.remove(key);
  }

  async isExists(key: string): Promise<boolean> {
    return this._adapter.isExists(key);
  }
}
