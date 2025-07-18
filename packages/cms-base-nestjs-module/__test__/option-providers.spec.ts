import { OptionProviders } from '../src/constants/option-providers';
import { DEFAULT_SIGNATURE_LEVEL } from '../src/constants/default-signature-level';

import {
  MULTIPLE_LANGUAGE_MODE,
  MULTIPLE_CATEGORY_PARENT_MODE,
  CIRCULAR_CATEGORY_MODE,
  DRAFT_MODE,
  AUTO_RELEASE_AFTER_APPROVED,
  SIGNATURE_LEVELS,
  PROVIDE_ARTICLE_ENTITY,
  PROVIDE_ARTICLE_VERSION_ENTITY,
  PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY,
  PROVIDE_CATEGORY_ENTITY,
  PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY,
  PROVIDE_SIGNATURE_LEVEL_ENTITY,
  FULL_TEXT_SEARCH_MODE,
} from '../src/typings/cms-base-providers';

describe('OptionProviders', () => {
  function getFactory(
    token: any,
  ): ((options?: any) => any | Promise<any>) | undefined {
    const provider = OptionProviders.find(
      (p): p is { provide: any; useFactory: (options?: any) => any } =>
        typeof p === 'object' &&
        'provide' in p &&
        p.provide === token &&
        'useFactory' in p,
    );

    return provider?.useFactory;
  }

  const mockDefaultOptions = {
    multipleLanguageMode: true,
    allowMultipleParentCategories: true,
    allowCircularCategories: true,
    signatureLevels: ['A', 'B'],
    articleEntity: 'ArticleEntity',
    articleVersionEntity: 'VersionEntity',
    articleVersionContentEntity: 'ContentEntity',
    categoryEntity: 'CategoryEntity',
    categoryMultiLanguageNameEntity: 'CategoryNameEntity',
    signatureLevelEntity: 'SignatureEntity',
    fullTextSearchMode: true,
    enableDraftMode: false,
    autoReleaseWhenLatestSignatureApproved: true,
  };

  it('should return correct values for boolean feature flags', () => {
    expect(getFactory(MULTIPLE_LANGUAGE_MODE)?.(mockDefaultOptions)).toBe(true);
    expect(
      getFactory(MULTIPLE_CATEGORY_PARENT_MODE)?.(mockDefaultOptions),
    ).toBe(true);

    expect(getFactory(CIRCULAR_CATEGORY_MODE)?.(mockDefaultOptions)).toBe(true);
    expect(getFactory(DRAFT_MODE)?.(mockDefaultOptions)).toBe(false);
    expect(getFactory(AUTO_RELEASE_AFTER_APPROVED)?.(mockDefaultOptions)).toBe(
      true,
    );
  });

  it('should fallback to defaults if options are missing', async () => {
    expect(getFactory(MULTIPLE_LANGUAGE_MODE)?.({})).toBe(false);
    expect(getFactory(MULTIPLE_CATEGORY_PARENT_MODE)?.({})).toBe(false);
    expect(getFactory(CIRCULAR_CATEGORY_MODE)?.({})).toBe(false);
    expect(getFactory(SIGNATURE_LEVELS)?.({})).toEqual([
      DEFAULT_SIGNATURE_LEVEL,
    ]);

    expect(getFactory(DRAFT_MODE)?.({})).toBe(true);
    expect(getFactory(AUTO_RELEASE_AFTER_APPROVED)?.({})).toBe(false);
  });

  it('should return provided values for entity providers', () => {
    expect(getFactory(PROVIDE_ARTICLE_ENTITY)?.(mockDefaultOptions)).toBe(
      'ArticleEntity',
    );

    expect(
      getFactory(PROVIDE_ARTICLE_VERSION_ENTITY)?.(mockDefaultOptions),
    ).toBe('VersionEntity');

    expect(
      getFactory(PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY)?.(mockDefaultOptions),
    ).toBe('ContentEntity');

    expect(getFactory(PROVIDE_CATEGORY_ENTITY)?.(mockDefaultOptions)).toBe(
      'CategoryEntity',
    );

    expect(
      getFactory(PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY)?.(
        mockDefaultOptions,
      ),
    ).toBe('CategoryNameEntity');

    expect(
      getFactory(PROVIDE_SIGNATURE_LEVEL_ENTITY)?.(mockDefaultOptions),
    ).toBe('SignatureEntity');
  });

  it('should fallback to null when entity options are undefined', () => {
    const emptyOptions = {};

    expect(getFactory(PROVIDE_ARTICLE_ENTITY)?.(emptyOptions)).toBeNull();
    expect(
      getFactory(PROVIDE_ARTICLE_VERSION_ENTITY)?.(emptyOptions),
    ).toBeNull();

    expect(
      getFactory(PROVIDE_ARTICLE_VERSION_CONTENT_ENTITY)?.(emptyOptions),
    ).toBeNull();

    expect(getFactory(PROVIDE_CATEGORY_ENTITY)?.(emptyOptions)).toBeNull();
    expect(
      getFactory(PROVIDE_CATEGORY_MULTI_LANGUAGE_NAME_ENTITY)?.(emptyOptions),
    ).toBeNull();

    expect(
      getFactory(PROVIDE_SIGNATURE_LEVEL_ENTITY)?.(emptyOptions),
    ).toBeNull();
  });

  describe('FULL_TEXT_SEARCH_MODE', () => {
    beforeEach(() => {
      jest.resetModules();
    });

    it('should return true if module is installed and enabled', async () => {
      jest.mock('@node-rs/jieba', () => ({}), { virtual: true });

      const factory = getFactory(FULL_TEXT_SEARCH_MODE);
      const result = await factory?.({ fullTextSearchMode: true });

      expect(result).toBe(true);
    });

    it('should return false if fullTextSearchMode is disabled', async () => {
      const factory = getFactory(FULL_TEXT_SEARCH_MODE);
      const result = await factory?.({ fullTextSearchMode: false });

      expect(result).toBe(false);
    });

    it('should throw error if jieba is not installed', async () => {
      jest.mock('@node-rs/jieba', () => {
        throw new Error('Module not found');
      });

      const factory = getFactory(FULL_TEXT_SEARCH_MODE);

      await expect(factory?.({ fullTextSearchMode: true })).rejects.toThrow(
        'Full Text Search Mode requires @node-rs/jieba module, please install it first.',
      );
    });
  });
});
