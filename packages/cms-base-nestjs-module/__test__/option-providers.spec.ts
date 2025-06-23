import { Test } from '@nestjs/testing';
import {
  AUTO_RELEASE_AFTER_APPROVED,
  CIRCULAR_CATEGORY_MODE,
  CMS_BASE_MODULE_OPTIONS,
  DRAFT_MODE,
  FULL_TEXT_SEARCH_MODE,
  MULTIPLE_CATEGORY_PARENT_MODE,
  MULTIPLE_LANGUAGE_MODE,
  PROVIDE_ARTICLE_ENTITY,
  PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY,
  PROVIDE_ARTICLE_VERSION_ENTITY,
  PROVIDE_CATEGORY_ENTITY,
  PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY,
  PROVIDE_SIGNATURE_LEVEL_ENTITY,
  SIGNATURE_LEVELS,
} from '../src/typings/cms-base-providers';
import { OptionProviders } from '../src/constants/option-providers';
import { DEFAULT_SIGNATURE_LEVEL } from '../src/constants/default-signature-level';

describe('OptionProviders', () => {
  const mockOptions = {
    multipleLanguageMode: true,
    allowMultipleParentCategories: true,
    allowCircularCategories: true,
    signatureLevels: ['L1', 'L2'],
    articleEntity: 'ArticleEntity',
    articleVersionEntity: 'ArticleVersionEntity',
    articleVersionContentEntity: 'ArticleVersionContentEntity',
    categoryEntity: 'CategoryEntity',
    categoryMultiLanguageNameEntity: 'CategoryNameEntity',
    signatureLevelEntity: 'SignatureLevelEntity',
    fullTextSearchMode: true,
    enableDraftMode: false,
    autoReleaseWhenLatestSignatureApproved: true,
  };

  let moduleRef: any;

  beforeEach(async () => {
    const testingModule = await Test.createTestingModule({
      providers: [
        { provide: CMS_BASE_MODULE_OPTIONS, useValue: mockOptions },
        ...OptionProviders,
      ],
    }).compile();

    moduleRef = testingModule;
  });

  it('should provide MULTIPLE_LANGUAGE_MODE as true', () => {
    expect(moduleRef.get(MULTIPLE_LANGUAGE_MODE)).toBe(true);
  });

  it('should provide MULTIPLE_CATEGORY_PARENT_MODE as true', () => {
    expect(moduleRef.get(MULTIPLE_CATEGORY_PARENT_MODE)).toBe(true);
  });

  it('should provide CIRCULAR_CATEGORY_MODE as true', () => {
    expect(moduleRef.get(CIRCULAR_CATEGORY_MODE)).toBe(true);
  });

  it('should provide SIGNATURE_LEVELS from options', () => {
    expect(moduleRef.get(SIGNATURE_LEVELS)).toEqual(['L1', 'L2']);
  });

  it('should fallback SIGNATURE_LEVELS to DEFAULT_SIGNATURE_LEVEL if not provided', async () => {
    const testingModule = await Test.createTestingModule({
      providers: [
        { provide: CMS_BASE_MODULE_OPTIONS, useValue: {} },
        ...OptionProviders,
      ],
    }).compile();

    expect(testingModule.get(SIGNATURE_LEVELS)).toEqual([
      DEFAULT_SIGNATURE_LEVEL,
    ]);
  });

  it('should provide all entity injection tokens from options', () => {
    expect(moduleRef.get(PROVIDE_ARTICLE_ENTITY)).toBe('ArticleEntity');
    expect(moduleRef.get(PROVIDE_ARTICLE_VERSION_ENTITY)).toBe(
      'ArticleVersionEntity',
    );

    expect(moduleRef.get(PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY)).toBe(
      'ArticleVersionContentEntity',
    );

    expect(moduleRef.get(PROVIDE_CATEGORY_ENTITY)).toBe('CategoryEntity');
    expect(moduleRef.get(PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY)).toBe(
      'CategoryNameEntity',
    );

    expect(moduleRef.get(PROVIDE_SIGNATURE_LEVEL_ENTITY)).toBe(
      'SignatureLevelEntity',
    );
  });

  it('should provide DRAFT_MODE as false', () => {
    expect(moduleRef.get(DRAFT_MODE)).toBe(false);
  });

  it('should provide AUTO_RELEASE_AFTER_APPROVED as true', () => {
    expect(moduleRef.get(AUTO_RELEASE_AFTER_APPROVED)).toBe(true);
  });

  it('should provide FULL_TEXT_SEARCH_MODE as true if @node-rs/jieba is available', async () => {
    const result = await moduleRef.get(FULL_TEXT_SEARCH_MODE);

    expect(result).toBe(true);
  });

  it('should throw error if FULL_TEXT_SEARCH_MODE enabled but jieba is missing', async () => {
    jest.resetModules();

    // simulate @node-rs/jieba not being installed
    jest.doMock('@node-rs/jieba', () => {
      throw new Error('jieba not found');
    });

    await expect(async () => {
      await jest.isolateModulesAsync(async () => {
        const { CMS_BASE_MODULE_OPTIONS, FULL_TEXT_SEARCH_MODE } = await import(
          '../src/typings/cms-base-providers'
        );

        const { OptionProviders } = await import(
          '../src/constants/option-providers'
        );

        const testingModule = await Test.createTestingModule({
          providers: [
            {
              provide: CMS_BASE_MODULE_OPTIONS,
              useValue: { fullTextSearchMode: true },
            },
            ...OptionProviders,
          ],
        }).compile();

        await testingModule.get(FULL_TEXT_SEARCH_MODE);
      });
    }).rejects.toThrow(
      'Full Text Search Mode requires @node-rs/jieba module, please install it first.',
    );
  });
});
