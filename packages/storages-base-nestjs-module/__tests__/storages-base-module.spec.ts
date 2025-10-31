import { Injectable, Module, Type } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StorageBaseModule } from '../src/storages-base.module';
import {
  IStorageAdapter,
  StorageBaseModuleOptions,
  StorageBaseModuleOptionsFactory,
} from '../src/typings/storage-base-module-options.interface';
import { STORAGE_ADAPTER, STORAGE_MODULE_OPTIONS } from '../src/typings/storages-base-module-providers';
import { GCSAdapter } from '../src/wrappers/gcs-wrapper';
import { StorageService } from '@rytass/storages-base-nestjs-module';
import { StorageGCSService } from '@rytass/storages-adapter-gcs';
import { WriteFileOptions } from '@rytass/storages';
import { AzureBlobAdapter } from '../src/wrappers/azure-blob-wrapper';
import { StorageAzureBlobService } from '@rytass/storages-adapter-azure-blob';
import { S3Adapter } from '../src/wrappers/s3-wrapper';
import { StorageS3Service } from '@rytass/storages-adapter-s3/src';
import { StorageR2Service } from '@rytass/storages-adapter-r2/src';
import { R2Adapter } from '../src/wrappers/r2-wrapper';
import { LocalAdapter } from '../src/wrappers/local-wrapper';
import { LocalStorage } from '@rytass/storages-adapter-local';

const mockInstance = {
  url: jest.fn(),
  write: jest.fn(),
  batchWrite: jest.fn(),
  remove: jest.fn(),
  isExists: jest.fn(),
};

jest.mock('@rytass/storages-adapter-gcs', () => ({
  StorageGCSService: jest.fn(() => mockInstance),
  GCSOptions: jest.fn(),
}));

jest.mock('@rytass/storages-adapter-azure-blob', () => ({
  StorageAzureBlobService: jest.fn(() => mockInstance),
  AzureBlobOptions: jest.fn(),
}));

jest.mock('@rytass/storages-adapter-s3/src', () => ({
  StorageS3Service: jest.fn(() => mockInstance),
  StorageS3Options: jest.fn(),
}));

jest.mock('@rytass/storages-adapter-r2/src', () => ({
  StorageR2Service: jest.fn(() => mockInstance),
  StorageR2Options: jest.fn(),
}));

jest.mock('@rytass/storages-adapter-local', () => ({
  LocalStorage: jest.fn(() => mockInstance),
  StorageLocalOptions: jest.fn(),
}));

describe('Storages Base Nestjs Module', () => {
  @Injectable()
  class mockAdapter implements IStorageAdapter {
    static config: unknown;
    url = jest.fn(async (_key: string, _options?: unknown) => 'https://mockURL.com');

    write = jest.fn();
    batchWrite = jest.fn();
    remove = jest.fn();
    isExists = jest.fn();

    constructor(config: unknown) {
      mockAdapter.config = config;
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockOptions = {
    adapter: mockAdapter,
    config: { test: true },
    commonOptions: {
      formDataFieldName: 'files',
      allowMultiple: true,
      MaxFileSizeInBytes: 10 * 1024 * 1024,
      defaultPublic: false,
    },
  };

  const mockCommonOptions = {
    formDataFieldName: 'files',
    allowMultiple: true,
    MaxFileSizeInBytes: 10 * 1024 * 1024,
    defaultPublic: false,
  };

  describe('Integration test', () => {
    describe('GCSAdapter Wrapper Unit Test', () => {
      let adapter: GCSAdapter;
      const mockConfig = {
        bucket: 'test-bucket',
        projectId: 'test-project',
        credentials: {
          client_email: 'test@test.iam.gserviceaccount.com',
          private_key: 'test-private-key',
        },
      };

      beforeEach(() => {
        jest.clearAllMocks();

        adapter = new GCSAdapter(mockConfig);
      });

      it('should create and configure the real GCS service on construction', () => {
        expect(StorageGCSService).toHaveBeenCalledWith(mockConfig);
      });

      it('should cover the "url" wrapper method', async () => {
        mockInstance.url.mockResolvedValue('http://mocked-url.com');

        const url = await adapter.url('test.txt', { expires: 3600 });

        expect(mockInstance.url).toHaveBeenCalledWith('test.txt', 3600);
        expect(url).toBe('http://mocked-url.com');
      });

      it('should cover the "write" wrapper method', async () => {
        const mockFile = Buffer.from('This is a test file content');
        const mockOptions: WriteFileOptions = {
          filename: 'my-file-name',
          contentType: 'application/pdf',
        };

        await adapter.write(mockFile, mockOptions);

        expect(mockInstance.write).toHaveBeenCalledWith(mockFile, mockOptions);
      });

      it('should cover the "batchWrite" wrapper method', async () => {
        const mockFile = Buffer.from('This is a test file content');

        await adapter.batchWrite([mockFile]);
        expect(mockInstance.batchWrite).toHaveBeenCalledWith([mockFile]);
      });

      it('should cover the "remove" wrapper method', async () => {
        await adapter.remove('test.txt');
        expect(mockInstance.remove).toHaveBeenCalledWith('test.txt');
      });

      it('should cover the "isExists" wrapper method', async () => {
        await adapter.isExists('test.txt');
        expect(mockInstance.isExists).toHaveBeenCalledWith('test.txt');
      });
    });

    describe('AzureBlobAdapter Wrapper Unit Test', () => {
      let adapter: AzureBlobAdapter;
      const mockConfig = {
        connectionString:
          'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=test;EndpointSuffix=core.windows.net',
        container: 'test-container',
        key: 'test-key',
      };

      beforeEach(() => {
        jest.clearAllMocks();

        adapter = new AzureBlobAdapter(mockConfig);
      });

      it('should create and configure the real AzureBlob service on construction', () => {
        expect(StorageAzureBlobService).toHaveBeenCalledWith(mockConfig);
      });

      it('should cover the "url" wrapper method', async () => {
        mockInstance.url.mockResolvedValue('http://mocked-url.com');

        const url = await adapter.url('test.txt', { expires: 3600 });

        expect(mockInstance.url).toHaveBeenCalledWith('test.txt', 3600);
        expect(url).toBe('http://mocked-url.com');
      });

      it('should cover the "write" wrapper method', async () => {
        const mockFile = Buffer.from('This is a test file content');
        const mockOptions: WriteFileOptions = {
          filename: 'my-file-name',
          contentType: 'application/pdf',
        };

        await adapter.write(mockFile, mockOptions);

        expect(mockInstance.write).toHaveBeenCalledWith(mockFile, mockOptions);
      });

      it('should cover the "batchWrite" wrapper method', async () => {
        const mockFile = Buffer.from('This is a test file content');

        await adapter.batchWrite([mockFile]);
        expect(mockInstance.batchWrite).toHaveBeenCalledWith([mockFile]);
      });

      it('should cover the "remove" wrapper method', async () => {
        await adapter.remove('test.txt');
        expect(mockInstance.remove).toHaveBeenCalledWith('test.txt');
      });

      it('should cover the "isExists" wrapper method', async () => {
        await adapter.isExists('test.txt');
        expect(mockInstance.isExists).toHaveBeenCalledWith('test.txt');
      });
    });

    describe('S3Adapter Wrapper Unit Test', () => {
      let adapter: S3Adapter;
      const mockConfig = {
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        bucket: 'test-bucket',
        region: 'test-region',
        endpoint: 'test-endpoint',
        key: 'test-key',
      };

      beforeEach(() => {
        jest.clearAllMocks();

        adapter = new S3Adapter(mockConfig);
      });

      it('should create and configure the real S3 service on construction', () => {
        expect(StorageS3Service).toHaveBeenCalledWith(mockConfig);
      });

      it('should cover the "url" wrapper method', async () => {
        mockInstance.url.mockResolvedValue('http://mocked-url.com');

        const url = await adapter.url('test.txt');

        expect(mockInstance.url).toHaveBeenCalledWith('test.txt');
        expect(url).toBe('http://mocked-url.com');
      });

      it('should cover the "write" wrapper method', async () => {
        const mockFile = Buffer.from('This is a test file content');
        const mockOptions: WriteFileOptions = {
          filename: 'my-file-name',
          contentType: 'application/pdf',
        };

        await adapter.write(mockFile, mockOptions);

        expect(mockInstance.write).toHaveBeenCalledWith(mockFile, mockOptions);
      });

      it('should cover the "batchWrite" wrapper method', async () => {
        const mockFile = Buffer.from('This is a test file content');

        await adapter.batchWrite([mockFile]);
        expect(mockInstance.batchWrite).toHaveBeenCalledWith([mockFile]);
      });

      it('should cover the "remove" wrapper method', async () => {
        await adapter.remove('test.txt');
        expect(mockInstance.remove).toHaveBeenCalledWith('test.txt');
      });

      it('should cover the "isExists" wrapper method', async () => {
        await adapter.isExists('test.txt');
        expect(mockInstance.isExists).toHaveBeenCalledWith('test.txt');
      });
    });

    describe('R2Adapter Wrapper Unit Test', () => {
      let adapter: R2Adapter;
      const mockConfig = {
        accessKey: 'test-access-key',
        secretKey: 'test-secret-key',
        bucket: 'test-bucket',
        account: 'test-account',
        customeDomain: 'test-custom-domain',
        key: 'test-key',
      };

      beforeEach(() => {
        jest.clearAllMocks();

        adapter = new R2Adapter(mockConfig);
      });

      it('should create and configure the real R2 service on construction', () => {
        expect(StorageR2Service).toHaveBeenCalledWith(mockConfig);
      });

      it('should cover the "url" wrapper method', async () => {
        mockInstance.url.mockResolvedValue('http://mocked-url.com');

        const url = await adapter.url('test.txt', { expires: 3600 });

        expect(mockInstance.url).toHaveBeenCalledWith('test.txt', { expires: 3600 });
        expect(url).toBe('http://mocked-url.com');
      });

      it('should cover the "write" wrapper method', async () => {
        const mockFile = Buffer.from('This is a test file content');
        const mockOptions: WriteFileOptions = {
          filename: 'my-file-name',
          contentType: 'application/pdf',
        };

        await adapter.write(mockFile, mockOptions);

        expect(mockInstance.write).toHaveBeenCalledWith(mockFile, mockOptions);
      });

      it('should cover the "batchWrite" wrapper method', async () => {
        const mockFile = Buffer.from('This is a test file content');

        await adapter.batchWrite([mockFile]);
        expect(mockInstance.batchWrite).toHaveBeenCalledWith([mockFile]);
      });

      it('should cover the "remove" wrapper method', async () => {
        await adapter.remove('test.txt');
        expect(mockInstance.remove).toHaveBeenCalledWith('test.txt');
      });

      it('should cover the "isExists" wrapper method', async () => {
        await adapter.isExists('test.txt');
        expect(mockInstance.isExists).toHaveBeenCalledWith('test.txt');
      });
    });

    describe('LocalAdapter Wrapper Unit Test', () => {
      let adapter: LocalAdapter;
      const mockConfig = {
        directory: 'test-directory',
        autoMkdir: true,
      };

      beforeEach(() => {
        jest.clearAllMocks();

        adapter = new LocalAdapter(mockConfig);
      });

      it('should create and configure the real Local service on construction', () => {
        expect(LocalStorage).toHaveBeenCalledWith(mockConfig);
      });

      it('should cover the "write" wrapper method', async () => {
        const mockFile = Buffer.from('This is a test file content');
        const mockOptions: WriteFileOptions = {
          filename: 'my-file-name',
          contentType: 'application/pdf',
        };

        await adapter.write(mockFile, mockOptions);

        expect(mockInstance.write).toHaveBeenCalledWith(mockFile, mockOptions);
      });

      it('should cover the "batchWrite" wrapper method', async () => {
        const mockFile = Buffer.from('This is a test file content');

        await adapter.batchWrite([mockFile]);
        expect(mockInstance.batchWrite).toHaveBeenCalledWith([mockFile]);
      });

      it('should cover the "remove" wrapper method', async () => {
        await adapter.remove('test.txt');
        expect(mockInstance.remove).toHaveBeenCalledWith('test.txt');
      });

      it('should cover the "isExists" wrapper method', async () => {
        await adapter.isExists('test.txt');
        expect(mockInstance.isExists).toHaveBeenCalledWith('test.txt');
      });
    });
  });

  describe('forRoot', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw Error if adapter is not provided', async () => {
      await expect(
        Test.createTestingModule({
          imports: [StorageBaseModule.forRoot({ adapter: undefined as unknown as Type<IStorageAdapter>, config: {} })],
        }).compile(),
      ).rejects.toThrow('No storage adapter class was provided in forRoot!');
    });

    it('should apply default commonOptions when none are provided', async () => {
      const options = { ...mockOptions, commonOptions: undefined };

      const module: TestingModule = await Test.createTestingModule({
        imports: [StorageBaseModule.forRoot(options)],
      }).compile();

      const adapter = module.get(STORAGE_ADAPTER);
      const service = module.get(StorageService);

      expect(adapter).toBeInstanceOf(mockAdapter);

      expect(service.commonOptions).toEqual(mockCommonOptions);
    });

    it('should merge provided commonOptions with defaults', async () => {
      const options = { ...mockOptions, commonOptions: { MaxFileSizeInBytes: 999 } };

      const module: TestingModule = await Test.createTestingModule({
        imports: [StorageBaseModule.forRoot(options)],
      }).compile();

      const service = module.get(StorageService);

      expect(service.commonOptions).toEqual({
        ...mockCommonOptions,
        MaxFileSizeInBytes: 999,
      });
    });
  });

  describe('forRootAsync', () => {
    @Injectable()
    class MockConfigService implements StorageBaseModuleOptionsFactory<Type<IStorageAdapter>> {
      createStorageBaseModuleOptions(): StorageBaseModuleOptions<Type<IStorageAdapter>> {
        return mockOptions;
      }
    }

    @Module({
      providers: [MockConfigService],
      exports: [MockConfigService],
    })
    class MockConfigModule {}

    it('should throw Error if adapter is not provided', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            StorageBaseModule.forRootAsync({
              useFactory: () => ({
                adapter: undefined as unknown as Type<IStorageAdapter>,
                config: {},
              }),
            }),
          ],
        }).compile(),
      ).rejects.toThrow('No storage adapter class was provided in forRootAsync!');
    });

    it('should work with useFactory', async () => {
      const options = mockOptions;

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          StorageBaseModule.forRootAsync({
            useFactory: () => options,
          }),
        ],
      }).compile();

      const adapter = module.get(STORAGE_ADAPTER);
      const service = module.get(StorageService);

      expect(adapter).toBeInstanceOf(mockAdapter);
      expect(module.get(STORAGE_MODULE_OPTIONS)).toEqual(options);
      expect(service.commonOptions).toEqual(mockCommonOptions);
    });

    it('should work with useClass', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          StorageBaseModule.forRootAsync({
            useClass: MockConfigService,
          }),
        ],
        providers: [MockConfigService],
      }).compile();

      const adapter = module.get(STORAGE_ADAPTER);
      const service = module.get(StorageService);

      expect(adapter).toBeInstanceOf(mockAdapter);
      expect(service.commonOptions).toEqual(mockCommonOptions);
    });

    it('should work with useExisting', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          MockConfigModule,
          StorageBaseModule.forRootAsync({
            imports: [MockConfigModule],
            useExisting: MockConfigService,
          }),
        ],
      }).compile();

      const adapter = module.get(STORAGE_ADAPTER);
      const service = module.get(StorageService);

      expect(adapter).toBeInstanceOf(mockAdapter);
      expect(service.commonOptions).toEqual(mockCommonOptions);
    });

    it('should throw an error if no async provider (useFactory, useClass, or useExisting) is given', async () => {
      await expect(
        Test.createTestingModule({
          imports: [
            StorageBaseModule.forRootAsync({
              imports: [],
            }),
          ],
        }).compile(),
      ).rejects.toThrow();
    });
  });
});
