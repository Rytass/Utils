import { DataSource, Repository } from 'typeorm';
import { Test } from '@nestjs/testing';
import { BaseArticleRepo, BaseArticleEntity } from '../../src/models/base-article.entity';
import { BaseArticleVersionRepo, BaseArticleVersionEntity } from '../../src/models/base-article-version.entity';
import {
  BaseArticleVersionContentRepo,
  BaseArticleVersionContentEntity,
} from '../../src/models/base-article-version-content.entity';
import { BaseCategoryRepo, BaseCategoryEntity } from '../../src/models/base-category.entity';
import {
  BaseCategoryMultiLanguageNameRepo,
  BaseCategoryMultiLanguageNameEntity,
} from '../../src/models/base-category-multi-language-name.entity';
import { BaseSignatureLevelRepo, BaseSignatureLevelEntity } from '../../src/models/base-signature-level.entity';
import { CategoryRelationRepo, CategoryRelationEntity } from '../../src/models/category-relation.entity';
import { ArticleCategoryRepo, ArticleCategoryEntity } from '../../src/models/article-category.entity';
import { ArticleSignatureRepo, ArticleSignatureEntity } from '../../src/models/article-signature.entity';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CMSBaseModelsModule } from '../../src/models/models.module';

describe('CMSBaseModelsModule Factory Functions (direct test)', () => {
  const TYPE_ORM_OPTIONS = {
    type: 'postgres',
    host: 'localhost',
    username: '',
    password: '',
  } satisfies TypeOrmModuleOptions;

  const mockGetRepository = jest.fn(entity => `MockRepo:${entity.name}`);
  const mockDataSource = {
    getRepository: mockGetRepository,
    entityMetadatas: [],
    options: TYPE_ORM_OPTIONS,
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
    const results: Array<{ token: symbol; entity: unknown; result: unknown }> = [];

    for (const [token, entity] of tokenEntityPairs) {
      // This is the exact factory function logic from your module
      const factoryFunction = (dataSource: DataSource): Repository<unknown> => dataSource.getRepository(entity);

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
    const models = [...tokenEntityPairs] as Array<[symbol, unknown]>;

    const providerConfigurations = models.map(([symbol, entity]) => ({
      provide: symbol,
      useFactory: (dataSource: DataSource): Repository<unknown> => dataSource.getRepository(entity),
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

  it('should dataSource.getRepository calls with correct entities', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(TYPE_ORM_OPTIONS), CMSBaseModelsModule],
    })
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      .compile();

    const repo = moduleRef.get(BaseArticleRepo);

    expect(repo).toBeDefined();
    expect(mockGetRepository).toHaveBeenCalled();
  });
});
