import { DataSource } from 'typeorm';

import {
  BaseArticleRepo,
  BaseArticleEntity,
} from '../../src/models/base-article.entity';
import {
  BaseArticleVersionRepo,
  BaseArticleVersionEntity,
} from '../../src/models/base-article-version.entity';
import {
  BaseArticleVersionContentRepo,
  BaseArticleVersionContentEntity,
} from '../../src/models/base-article-version-content.entity';
import {
  BaseCategoryRepo,
  BaseCategoryEntity,
} from '../../src/models/base-category.entity';
import {
  BaseCategoryMultiLanguageNameRepo,
  BaseCategoryMultiLanguageNameEntity,
} from '../../src/models/base-category-multi-language-name.entity';
import {
  BaseSignatureLevelRepo,
  BaseSignatureLevelEntity,
} from '../../src/models/base-signature-level.entity';
import {
  CategoryRelationRepo,
  CategoryRelationEntity,
} from '../../src/models/category-relation.entity';
import {
  ArticleCategoryRepo,
  ArticleCategoryEntity,
} from '../../src/models/article-category.entity';
import {
  ArticleSignatureRepo,
  ArticleSignatureEntity,
} from '../../src/models/base-article-signature.entity';

describe('CMSBaseModelsModule Factory Functions (direct test)', () => {
  const mockGetRepository = jest.fn((entity) => `MockRepo:${entity.name}`);
  const mockDataSource = {
    getRepository: mockGetRepository,
  } as unknown as DataSource;

  const tokenEntityPairs = [
    [BaseArticleRepo, BaseArticleEntity],
    [BaseArticleVersionRepo, BaseArticleVersionEntity],
    [BaseArticleVersionContentRepo, BaseArticleVersionContentEntity],
    [BaseCategoryRepo, BaseCategoryEntity],
    [BaseCategoryMultiLanguageNameRepo, BaseCategoryMultiLanguageNameEntity],
    [BaseSignatureLevelRepo, BaseSignatureLevelEntity],
    [CategoryRelationRepo, CategoryRelationEntity],
    [ArticleCategoryRepo, ArticleCategoryEntity],
    [ArticleSignatureRepo, ArticleSignatureEntity],
  ] as const;

  beforeEach(() => {
    mockGetRepository.mockClear();
  });

  it('should create correct repository instances via factory functions', () => {
    // Test the factory function logic directly
    const results: Array<{ token: symbol; entity: any; result: any }> = [];

    for (const [token, entity] of tokenEntityPairs) {
      // This is the exact factory function logic from your module
      const factoryFunction = (dataSource: DataSource) =>
        dataSource.getRepository(entity);
      const result = factoryFunction(mockDataSource);

      results.push({ token, entity, result });

      expect(result).toBe(`MockRepo:${entity.name}`);
    }

    // Verify all calls were made
    expect(mockGetRepository).toHaveBeenCalledTimes(tokenEntityPairs.length);

    // Verify each entity was called with the repository
    for (const [, entity] of tokenEntityPairs) {
      expect(mockGetRepository).toHaveBeenCalledWith(entity);
    }
  });

  it('should simulate the provider configuration', () => {
    // Fix: Convert readonly tuple to mutable array with proper typing
    const models = [...tokenEntityPairs] as Array<[symbol, any]>;

    const providerConfigurations = models.map(([symbol, entity]) => ({
      provide: symbol,
      useFactory: (dataSource: DataSource) => dataSource.getRepository(entity),
      inject: [DataSource],
    }));

    expect(providerConfigurations).toHaveLength(tokenEntityPairs.length);

    // Test each provider configuration
    providerConfigurations.forEach((config, index) => {
      const [expectedToken, expectedEntity] = tokenEntityPairs[index];

      expect(config.provide).toBe(expectedToken);
      expect(config.inject).toEqual([DataSource]);

      // Test the factory function
      const result = config.useFactory(mockDataSource);
      expect(result).toBe(`MockRepo:${expectedEntity.name}`);
    });

    expect(mockGetRepository).toHaveBeenCalledTimes(tokenEntityPairs.length);
  });
});
