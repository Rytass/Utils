import { Injectable } from '@nestjs/common';
import { IStorageAdapter } from '../typings/storage-base-module-options.interface';
import { StorageS3Service } from '@rytass/storages-adapter-s3/src';
import { InputFile, WriteFileOptions, StorageFile } from '@rytass/storages';
import type { StorageS3Options } from 'storages-adapter-s3/src/typings';

@Injectable()
export class S3Adapter implements IStorageAdapter {
  private readonly s3Service: StorageS3Service;

  constructor(config: StorageS3Options) {
    this.s3Service = new StorageS3Service(config);
  }

  url(key: string): Promise<string> {
    return this.s3Service.url(key);
  }

  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    return this.s3Service.write(file, options);
  }

  batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    return this.s3Service.batchWrite(files);
  }

  remove(key: string): Promise<void> {
    return this.s3Service.remove(key);
  }

  isExists(key: string): Promise<boolean> {
    return this.s3Service.isExists(key);
  }
}
