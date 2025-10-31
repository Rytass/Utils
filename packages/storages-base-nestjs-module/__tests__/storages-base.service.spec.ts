import { StorageService } from '../src/services/storages-base.service';
import { Test, TestingModule } from '@nestjs/testing';
import {
  IStorageAdapter,
  IStorageAdapterUrlOptions,
  StorageBaseModuleOptions,
} from '../src/typings/storage-base-module-options.interface';
import { Injectable, Type } from '@nestjs/common';
import { STORAGE_ADAPTER, STORAGE_MODULE_OPTIONS } from '../src/typings/storages-base-module-providers';
import { jest } from '@jest/globals';
import { InputFile, StorageFile, WriteFileOptions } from '@rytass/storages';

@Injectable()
class mockAdapter implements IStorageAdapter {
  url: jest.Mock<(key: string, options?: IStorageAdapterUrlOptions) => Promise<string>>;
  write: jest.Mock<(file: InputFile, options?: WriteFileOptions) => Promise<StorageFile>>;
  batchWrite: jest.Mock<(files: InputFile[]) => Promise<StorageFile[]>>;
  remove: jest.Mock<(key: string) => Promise<void>>;
  removeSync: jest.Mock<(key: string) => Promise<void>>;
  isExists: jest.Mock<(key: string) => Promise<boolean>>;

  constructor(_config: unknown) {
    this.url = jest.fn(async (key: string, _options?: IStorageAdapterUrlOptions) => `http://mock-url.com/${key}`);
    this.write = jest.fn();
    this.batchWrite = jest.fn();
    this.remove = jest.fn();
    this.removeSync = jest.fn();
    this.isExists = jest.fn();
  }
}

const mockOptions: StorageBaseModuleOptions<Type<IStorageAdapter>> = {
  adapter: mockAdapter,
  config: {},
  commonOptions: {
    MaxFileSizeInBytes: 100,
  },
};

describe('Storages Base Service', () => {
  let service: StorageService;
  let adapter: IStorageAdapter;

  describe('StorageService.url', () => {
    it('should throw error if adapter is not in the list', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: STORAGE_ADAPTER,
            useValue: new mockAdapter({}),
          },
          {
            provide: STORAGE_MODULE_OPTIONS,
            useValue: mockOptions,
          },
        ],
      }).compile();

      service = module.get(StorageService);

      await expect(service.url('my-key', 3600)).rejects.toThrow('Unknown storage adapter');
    });

    it('should throw error if adapter is LocalAdapter', async () => {
      const localMockInstance = new mockAdapter({});

      Object.defineProperty(localMockInstance, 'constructor', {
        value: { name: 'LocalAdapter' },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: STORAGE_ADAPTER,
            useValue: localMockInstance,
          },
          {
            provide: STORAGE_MODULE_OPTIONS,
            useValue: mockOptions,
          },
        ],
      }).compile();

      service = module.get(StorageService);
      adapter = module.get(STORAGE_ADAPTER);

      await expect(service.url('my-key', 3600)).rejects.toThrow('LocalStorage does not support URL generation');
    });

    it('should call url() with a number - GCS', async () => {
      const gcsMockInstance = new mockAdapter({});

      Object.defineProperty(gcsMockInstance, 'constructor', {
        value: { name: 'GCSAdapter' },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: STORAGE_ADAPTER,
            useValue: gcsMockInstance,
          },
          {
            provide: STORAGE_MODULE_OPTIONS,
            useValue: mockOptions,
          },
        ],
      }).compile();

      service = module.get(StorageService);
      adapter = module.get(STORAGE_ADAPTER);

      await service.url('my-key', 3600);

      expect(adapter.url).toHaveBeenCalledWith('my-key', 3600);
    });

    it('should call url() with no options - S3', async () => {
      const s3MockInstance = new mockAdapter({});

      Object.defineProperty(s3MockInstance, 'constructor', {
        value: { name: 'S3Adapter' },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: STORAGE_ADAPTER,
            useValue: s3MockInstance,
          },
          {
            provide: STORAGE_MODULE_OPTIONS,
            useValue: mockOptions,
          },
        ],
      }).compile();

      service = module.get(StorageService);
      adapter = module.get(STORAGE_ADAPTER);

      await service.url('my-key', 3600);

      expect(adapter.url).toHaveBeenCalledWith('my-key');
    });

    it('should call url() with options - R2', async () => {
      const r2MockInstance = new mockAdapter({});

      Object.defineProperty(r2MockInstance, 'constructor', {
        value: { name: 'R2Adapter' },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: STORAGE_ADAPTER,
            useValue: r2MockInstance,
          },
          {
            provide: STORAGE_MODULE_OPTIONS,
            useValue: mockOptions,
          },
        ],
      }).compile();

      service = module.get(StorageService);
      adapter = module.get(STORAGE_ADAPTER);

      await service.url('my-key', {
        expires: 3600,
      });

      expect(adapter.url).toHaveBeenCalledWith('my-key', {
        expires: 3600,
      });
    });
  });

  describe('Other Functions', () => {
    const mockFile = Buffer.from('This is a test file content');

    const mockOptions: WriteFileOptions = {
      filename: 'my-file-name',
      contentType: 'application/pdf',
    };

    beforeEach(async () => {
      jest.clearAllMocks();

      const gcsMockInstance = new mockAdapter({});

      Object.defineProperty(gcsMockInstance, 'constructor', {
        value: { name: 'GCSAdapter' },
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: STORAGE_ADAPTER,
            useValue: gcsMockInstance,
          },
          {
            provide: STORAGE_MODULE_OPTIONS,
            useValue: mockOptions,
          },
        ],
      }).compile();

      service = module.get(StorageService);
      adapter = module.get(STORAGE_ADAPTER);
    });

    it('should write file', async () => {
      await service.write(mockFile, mockOptions);

      expect(adapter.write).toHaveBeenCalledWith(mockFile, mockOptions);
      expect(adapter.write).toHaveBeenCalledTimes(1);
    });

    it('should batch write files', async () => {
      await service.batchWrite([mockFile], [mockOptions]);

      expect(adapter.batchWrite).toHaveBeenCalledWith([mockFile], [mockOptions]);
      expect(adapter.batchWrite).toHaveBeenCalledTimes(1);
    });

    it('should remove file', async () => {
      await service.remove('my-key');

      expect(adapter.remove).toHaveBeenCalledWith('my-key');
      expect(adapter.remove).toHaveBeenCalledTimes(1);
    });

    it('should call isExists with correct key', async () => {
      await service.isExists('my-key');

      expect(adapter.isExists).toHaveBeenCalledWith('my-key');
      expect(adapter.isExists).toHaveBeenCalledTimes(1);
    });
  });
});
