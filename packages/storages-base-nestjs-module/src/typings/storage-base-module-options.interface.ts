import { InjectionToken, ModuleMetadata, OptionalFactoryDependency, Type } from '@nestjs/common';
import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';
import { StorageGCSService } from '@rytass/storages-adapter-gcs';
import { LocalStorage } from '@rytass/storages-adapter-local';
import { StorageR2Service } from '@rytass/storages-adapter-r2';
import { StorageS3Service } from '@rytass/storages-adapter-s3';

export type StorageAdapter =
  | LocalStorage
  | StorageAzureBlobService
  | StorageGCSService
  | StorageR2Service
  | StorageS3Service;

export interface StorageBaseModuleOptions {
  adapter: new (config: unknown) => StorageAdapter;
  config: unknown;
  formDataFieldName?: string; // default: 'files'
  allowMultiple?: boolean; // default: true
  MaxFileSizeInBytes?: number; // default: 10 * 1024 * 1024
  defaultPublic?: boolean; // default: false
}

export interface StorageBaseModuleOptionsFactory {
  createStorageBaseModuleOptions(): Promise<StorageBaseModuleOptions> | StorageBaseModuleOptions;
}

export interface StorageBaseModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useFactory?: (...args: any[]) => Promise<StorageBaseModuleOptions> | StorageBaseModuleOptions;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
  useClass?: Type<StorageBaseModuleOptionsFactory>;
  useExisting?: Type<StorageBaseModuleOptionsFactory>;
}
