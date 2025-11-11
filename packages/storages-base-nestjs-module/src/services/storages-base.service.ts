import { Inject, Injectable, Type } from '@nestjs/common';
import { STORAGE_ADAPTER, STORAGE_MODULE_OPTIONS } from '../typings/storages-base-module-providers';
import type {
  IStorageAdapter,
  StorageBaseModuleOptions,
  StorageModuleCommonOptions,
} from '../typings/storage-base-module-options.interface';
import { InputFile, StorageFile, WriteFileOptions } from '@rytass/storages';

type ParametersOfUrl<A extends IStorageAdapter> =
  NonNullable<A['url']> extends (...params: infer P) => unknown ? P : never;

type ReturnTypeOfUrl<A extends IStorageAdapter> =
  NonNullable<A['url']> extends (...params: unknown[]) => infer R ? R : never;

@Injectable()
export class StorageService<A extends IStorageAdapter = IStorageAdapter> {
  private readonly _commonOptions: StorageModuleCommonOptions;

  constructor(
    @Inject(STORAGE_ADAPTER)
    private readonly _adapter: A,
    @Inject(STORAGE_MODULE_OPTIONS)
    private readonly _options: StorageBaseModuleOptions<Type<A>>,
  ) {
    const { commonOptions = {} } = this._options;

    this._commonOptions = {
      formDataFieldName: commonOptions.formDataFieldName ?? 'files',
      allowMultiple: commonOptions.allowMultiple ?? true,
      MaxFileSizeInBytes: commonOptions.MaxFileSizeInBytes ?? 10 * 1024 * 1024,
      defaultPublic: commonOptions.defaultPublic ?? false,
    };
  }

  url(...args: ParametersOfUrl<A>): ReturnTypeOfUrl<A> {
    if (!this._adapter.url || typeof this._adapter.url !== 'function') {
      throw new Error('This storage adapter does not support URL generation');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this._adapter.url.apply(this._adapter, args as any) as ReturnTypeOfUrl<A>;
  }

  get commonOptions(): StorageModuleCommonOptions {
    return this._commonOptions;
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
