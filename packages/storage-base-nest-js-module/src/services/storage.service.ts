import { Inject, Injectable, Logger, Type } from '@nestjs/common';
import { STORAGE_ADAPTER } from '../typings/storages-base-module-providers';
import { StorageAdapter } from '../typings/storage-base-module-options.interface';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  // constructor(
  //   // @Inject(STORAGE_ADAPTER)
  //   // private readonly adapter: Type<StorageAdapter>,
  // ) {}
}
