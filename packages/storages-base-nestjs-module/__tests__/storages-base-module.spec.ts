import { Injectable, Module, Type } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StorageBaseModule } from '../src/storages-base.module';
import {
  IStorageAdapter,
  StorageBaseModuleOptions,
  StorageBaseModuleOptionsFactory,
} from '../src/typings/storage-base-module-options.interface';
import { STORAGE_ADAPTER, STORAGE_MODULE_OPTIONS } from '../src/typings/storages-base-module-providers';
import { GCSAdapter } from '../src/wrappers/storages-base-gcs-wrapper';
import { StorageService } from '@rytass/storages-base-nestjs-module';

describe('Storages Base Nestjs Module', () => {
  @Injectable()
  class mockAdapter implements IStorageAdapter {
    static config: unknown;
    url = jest.fn(async (_key: string, _options?: unknown) => 'https://mockURL.com');

    write = jest.fn();
    batchWrite = jest.fn();
    remove = jest.fn();
    removeSync = jest.fn();
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

  describe('integration test', () => {
    it('GCS', async () => {
      const options = {
        adapter: GCSAdapter,
        config: {
          bucket: 'test-bucket',
          projectId: 'test-projectId',
          credentials: { client_email: 'test-client_email', private_key: 'test-private_key' },
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [StorageBaseModule.forRoot(options)],
      }).compile();

      expect(module.get(STORAGE_MODULE_OPTIONS)).toEqual(options);

      const adapter = module.get(STORAGE_ADAPTER);

      expect(adapter).toBeInstanceOf(GCSAdapter);
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
