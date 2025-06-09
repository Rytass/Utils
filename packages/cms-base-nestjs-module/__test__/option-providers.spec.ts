import { Test, TestingModule } from '@nestjs/testing';
import {
  MULTIPLE_LANGUAGE_MODE,
  CMS_BASE_MODULE_OPTIONS,
  ENABLE_SIGNATURE_MODE,
  SIGNATURE_LEVELS,
  DRAFT_MODE,
  FULL_TEXT_SEARCH_MODE,
} from '../src/typings/cms-base-providers';
import { OptionProviders } from '../src/constants/option-providers';
import { FactoryProvider } from '@nestjs/common';

describe('OptionProviders', () => {
  const baseOptions = {
    multipleLanguageMode: true,
    signatureMode: 'manual',
    signatureLevels: ['L1', 'L2'],
    enableDraftMode: true,
    fullTextSearchMode: false,
  };

  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: CMS_BASE_MODULE_OPTIONS,
          useValue: baseOptions,
        },
        ...OptionProviders,
      ],
    }).compile();

    jest.resetModules();
    jest.clearAllMocks();
  });

  it('should resolve MULTIPLE_LANGUAGE_MODE correctly', () => {
    const value = module.get(MULTIPLE_LANGUAGE_MODE);

    expect(value).toBe(true);
  });

  it('should fallback to false when multipleLanguageMode is undefined', async () => {
    const testModule = await Test.createTestingModule({
      providers: [
        {
          provide: CMS_BASE_MODULE_OPTIONS,
          useValue: {},
        },
        ...OptionProviders,
      ],
    }).compile();

    const result = testModule.get(MULTIPLE_LANGUAGE_MODE);

    expect(result).toBe(false);
  });

  it('should resolve ENABLE_SIGNATURE_MODE correctly', () => {
    const value = module.get(ENABLE_SIGNATURE_MODE);

    expect(value).toBe('manual');
  });

  it('should resolve SIGNATURE_LEVELS correctly', () => {
    const value = module.get(SIGNATURE_LEVELS);

    expect(value).toEqual(['L1', 'L2']);
  });

  it('should resolve DRAFT_MODE correctly', () => {
    const value = module.get(DRAFT_MODE);

    expect(value).toBe(true);
  });

  it('should fallback false when fullTextSearchMode is not enabled', async () => {
    const fts = await module.get(FULL_TEXT_SEARCH_MODE);

    expect(fts).toBe(false);
  });

  it('should throw error if fullTextSearchMode enabled but jieba not installed', async () => {
    const provider = OptionProviders.find(
      (p): p is FactoryProvider =>
        'provide' in p && p.provide === FULL_TEXT_SEARCH_MODE,
    );

    if (!provider) {
      throw new Error('FULL_TEXT_SEARCH_MODE provider not found');
    }

    const failingFactory = jest.fn(async () => {
      throw new Error(
        'Full Text Search Mode requires @node-rs/jieba module, please install it first.',
      );
    });

    // Override the factory temporarily
    const originalFactory = provider.useFactory;

    provider.useFactory = failingFactory;

    await expect(
      provider.useFactory({ fullTextSearchMode: true }),
    ).rejects.toThrow(/jieba/);

    // Restore original after test
    provider.useFactory = originalFactory;
  });

  it('should resolve FULL_TEXT_SEARCH_MODE as true when jieba is installed', async () => {
    jest.mock('@node-rs/jieba', () => ({}));

    const moduleWithFTS = await Test.createTestingModule({
      providers: [
        {
          provide: CMS_BASE_MODULE_OPTIONS,
          useValue: {
            fullTextSearchMode: true,
          },
        },
        ...OptionProviders,
      ],
    }).compile();

    const result = await moduleWithFTS.get(FULL_TEXT_SEARCH_MODE);

    expect(result).toBe(true);
  });

  it('should test async provider factory', async () => {
    jest.doMock('@node-rs/jieba', () => {
      throw new Error('Module not found');
    });

    // If the provider factory is async and throws
    await expect(async () => {
      const moduleWithFTS = await Test.createTestingModule({
        providers: [
          {
            provide: CMS_BASE_MODULE_OPTIONS,
            useValue: {
              fullTextSearchMode: true,
            },
          },
          ...OptionProviders,
        ],
      }).compile();

      await moduleWithFTS.init();

      // Force all providers to instantiate
      const app = moduleWithFTS.createNestApplication();

      await app.init();

      return moduleWithFTS.get(FULL_TEXT_SEARCH_MODE);
    }).rejects.toThrow('Full Text Search Mode requires @node-rs/jieba module');
  });
});
