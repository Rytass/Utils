import { StorageService } from '../src/services/storages-base.service';
import { Test, TestingModule } from '@nestjs/testing';
import { IStorageAdapter, IStorageAdapterUrlOptions } from '../src/typings/storage-base-module-options.interface';
import { Type } from '@nestjs/common';
import { STORAGE_ADAPTER, STORAGE_MODULE_OPTIONS } from '../src/typings/storages-base-module-providers';
import { jest } from '@jest/globals';
import { InputFile, StorageFile, WriteFileOptions } from '@rytass/storages';

class MockGCSAdapter implements IStorageAdapter {
  url: jest.Mock<(key: string, expires?: number) => Promise<string>>;
  write: jest.Mock<(file: InputFile, options?: WriteFileOptions) => Promise<StorageFile>>;
  batchWrite: jest.Mock<(files: InputFile[], options?: WriteFileOptions[]) => Promise<StorageFile[]>>;
  remove: jest.Mock<(key: string) => Promise<void>>;
  isExists: jest.Mock<(key: string) => Promise<boolean>>;

  constructor() {
    this.url = jest.fn(async (key: string, _expires?: number) => `http://mock-url.com/${key}`);
    this.write = jest.fn();
    this.batchWrite = jest.fn();
    this.remove = jest.fn();
    this.isExists = jest.fn();
  }
}

class MockS3Adapter implements IStorageAdapter {
  url: jest.Mock<(key: string) => Promise<string>>;
  write: jest.Mock<(file: InputFile, options?: WriteFileOptions) => Promise<StorageFile>>;
  batchWrite: jest.Mock<(files: InputFile[], options?: WriteFileOptions[]) => Promise<StorageFile[]>>;
  remove: jest.Mock<(key: string) => Promise<void>>;
  isExists: jest.Mock<(key: string) => Promise<boolean>>;

  constructor() {
    this.url = jest.fn(async (key: string) => `http://mock-url.com/${key}`);
    this.write = jest.fn();
    this.batchWrite = jest.fn();
    this.remove = jest.fn();
    this.isExists = jest.fn();
  }
}

class MockR2Adapter implements IStorageAdapter {
  url: jest.Mock<(key: string, options?: IStorageAdapterUrlOptions) => Promise<string>>;
  write: jest.Mock<(file: InputFile, options?: WriteFileOptions) => Promise<StorageFile>>;
  batchWrite: jest.Mock<(files: InputFile[], options?: WriteFileOptions[]) => Promise<StorageFile[]>>;
  remove: jest.Mock<(key: string) => Promise<void>>;
  isExists: jest.Mock<(key: string) => Promise<boolean>>;

  constructor() {
    this.url = jest.fn(async (key: string, _options?: IStorageAdapterUrlOptions) => `http://mock-url.com/${key}`);
    this.write = jest.fn();
    this.batchWrite = jest.fn();
    this.remove = jest.fn();
    this.isExists = jest.fn();
  }
}

class MockLocalAdapter implements IStorageAdapter {
  write: jest.Mock<(file: InputFile, options?: WriteFileOptions) => Promise<StorageFile>>;
  batchWrite: jest.Mock<(files: InputFile[], options?: WriteFileOptions[]) => Promise<StorageFile[]>>;
  remove: jest.Mock<(key: string) => Promise<void>>;
  isExists: jest.Mock<(key: string) => Promise<boolean>>;

  constructor() {
    this.write = jest.fn();
    this.batchWrite = jest.fn();
    this.remove = jest.fn();
    this.isExists = jest.fn();
  }
}

describe('Storages Base Service', () => {
  let service: StorageService;
  let adapter: IStorageAdapter;

  describe('StorageService.url', () => {
    it('should throw error if adapter does not support URL generation', async () => {
      const localAdapter = new MockLocalAdapter();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: STORAGE_ADAPTER,
            useValue: localAdapter,
          },
          {
            provide: STORAGE_MODULE_OPTIONS,
            useValue: {
              adapter: MockLocalAdapter as Type<IStorageAdapter>,
              config: {},
            },
          },
        ],
      }).compile();

      service = module.get(StorageService);

      expect(() => service.url('my-key')).toThrow('This storage adapter does not support URL generation');
    });

    it('should call url() with expires parameter - GCS-like adapter', async () => {
      const gcsAdapter = new MockGCSAdapter();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: STORAGE_ADAPTER,
            useValue: gcsAdapter,
          },
          {
            provide: STORAGE_MODULE_OPTIONS,
            useValue: {
              adapter: MockGCSAdapter as Type<IStorageAdapter>,
              config: {},
            },
          },
        ],
      }).compile();

      service = module.get(StorageService);
      adapter = module.get(STORAGE_ADAPTER);

      await service.url('my-key', 3600);

      expect(adapter.url).toHaveBeenCalledWith('my-key', 3600);
      expect(adapter.url).toHaveBeenCalledTimes(1);
    });

    it('should call url() with only key parameter - S3-like adapter', async () => {
      const s3Adapter = new MockS3Adapter();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: STORAGE_ADAPTER,
            useValue: s3Adapter,
          },
          {
            provide: STORAGE_MODULE_OPTIONS,
            useValue: {
              adapter: MockS3Adapter as Type<IStorageAdapter>,
              config: {},
            },
          },
        ],
      }).compile();

      service = module.get(StorageService);
      adapter = module.get(STORAGE_ADAPTER);

      // TypeScript should enforce this signature - only key, no expires
      await service.url('my-key');

      expect(adapter.url).toHaveBeenCalledWith('my-key');
      expect(adapter.url).toHaveBeenCalledTimes(1);
    });

    it('should call url() with options parameter - R2-like adapter', async () => {
      const r2Adapter = new MockR2Adapter();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: STORAGE_ADAPTER,
            useValue: r2Adapter,
          },
          {
            provide: STORAGE_MODULE_OPTIONS,
            useValue: {
              adapter: MockR2Adapter as Type<IStorageAdapter>,
              config: {},
            },
          },
        ],
      }).compile();

      service = module.get(StorageService);
      adapter = module.get(STORAGE_ADAPTER);

      await service.url('my-key', { expires: 3600 });

      expect(adapter.url).toHaveBeenCalledWith('my-key', { expires: 3600 });
      expect(adapter.url).toHaveBeenCalledTimes(1);
    });
  });

  describe('Other Functions', () => {
    const mockFile = Buffer.from('This is a test file content');

    const writeOptions: WriteFileOptions = {
      filename: 'my-file-name',
      contentType: 'application/pdf',
    };

    beforeEach(async () => {
      jest.clearAllMocks();

      const gcsAdapter = new MockGCSAdapter();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: STORAGE_ADAPTER,
            useValue: gcsAdapter,
          },
          {
            provide: STORAGE_MODULE_OPTIONS,
            useValue: {
              adapter: MockGCSAdapter as Type<IStorageAdapter>,
              config: {},
            },
          },
        ],
      }).compile();

      service = module.get(StorageService);
      adapter = module.get(STORAGE_ADAPTER);
    });

    it('should write file', async () => {
      await service.write(mockFile, writeOptions);

      expect(adapter.write).toHaveBeenCalledWith(mockFile, writeOptions);
      expect(adapter.write).toHaveBeenCalledTimes(1);
    });

    it('should batch write files', async () => {
      await service.batchWrite([mockFile], [writeOptions]);

      expect(adapter.batchWrite).toHaveBeenCalledWith([mockFile], [writeOptions]);
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
