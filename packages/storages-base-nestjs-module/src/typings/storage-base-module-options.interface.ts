import { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';
import { StorageGCSService } from '@rytass/storages-adapter-gcs';
import { LocalStorage } from '@rytass/storages-adapter-local';
import { StorageR2Service } from '@rytass/storages-adapter-r2';
import { StorageS3Service } from '@rytass/storages-adapter-s3';
import { InputFile, StorageFile, WriteFileOptions } from 'storages/lib';

export type StorageAdapter =
  | LocalStorage
  | StorageAzureBlobService
  | StorageGCSService
  | StorageR2Service
  | StorageS3Service;

export interface StorageBaseModuleOptions<A extends Type<IStorageAdapter>> {
  adapter: A;
  config: ConstructorParameters<A>[0];
  commonOptions?: StorageModuleCommonOptions;
}

export interface StorageBaseModuleOptionsFactory<A extends Type<IStorageAdapter>> {
  createStorageBaseModuleOptions(): Promise<StorageBaseModuleOptions<A>> | StorageBaseModuleOptions<A>;
}

export interface StorageBaseModuleAsyncOptions<A extends Type<IStorageAdapter>>
  extends Pick<ModuleMetadata, 'imports'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory?: (...args: any[]) => Promise<StorageBaseModuleOptions<A>> | StorageBaseModuleOptions<A>;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<StorageBaseModuleOptionsFactory<A>>;
  useExisting?: Type<StorageBaseModuleOptionsFactory<A>>;
}

export interface StorageModuleCommonOptions {
  formDataFieldName?: string; // default: 'files'
  allowMultiple?: boolean; // default: true
  MaxFileSizeInBytes?: number; // default: 10 * 1024 * 1024
  defaultPublic?: boolean; // default: false
}

export interface IStorageAdapterUrlOptions {
  expires?: number;
  [key: string]: unknown;
}

export interface IStorageAdapter {
  url(key: string, options?: IStorageAdapterUrlOptions): Promise<string>;
  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile>;
  remove(key: string): Promise<void>;
  isExists(key: string): Promise<boolean>;
  batchWrite(files: InputFile[], options?: WriteFileOptions[]): Promise<StorageFile[]>;
}
