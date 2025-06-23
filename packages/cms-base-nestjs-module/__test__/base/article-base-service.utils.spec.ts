import { ArticleStage } from '../../src/typings/article-stage.enum';
import { ArticleBaseService } from '../../src/services/article-base.service';
import { BaseSignatureLevelEntity } from '../../src/models/base-signature-level.entity';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { ArticleSearchMode } from '../../src/typings/article-search-mode.enum';
import { ArticleSorter } from '../../src/typings/article-sorter.enum';
import { DEFAULT_LANGUAGE } from '../../src/constants/default-language';

jest.mock('@node-rs/jieba', () => ({
  cut: jest.fn(() => ['token1', 'token2']),
}));

describe('queryStagesFeaturesCheck', () => {
  let service: ArticleBaseService;

  beforeEach(() => {
    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [], // signatureLevels (default empty)
      {} as any,
      {} as any,
      true,
      { query: jest.fn() } as any,
    );
  });

  it('should throw if stage is DRAFT and draftMode is false', () => {
    (service as any).draftMode = false;
    expect(() =>
      (service as any).queryStagesFeaturesCheck(ArticleStage.DRAFT),
    ).toThrow('Draft mode is disabled.');
  });

  it('should NOT throw if stage is DRAFT and draftMode is true', () => {
    (service as any).draftMode = true;
    expect(() =>
      (service as any).queryStagesFeaturesCheck(ArticleStage.DRAFT),
    ).not.toThrow();
  });

  it('should throw if stage is REVIEWING and signatureEnabled is false', () => {
    (service as any).signatureLevels = [];
    expect(() =>
      (service as any).queryStagesFeaturesCheck(ArticleStage.REVIEWING),
    ).toThrow('Signature mode is disabled.');
  });

  it('should NOT throw if stage is REVIEWING and signatureEnabled is true', () => {
    (service as any).signatureLevels = ['dummy'];
    expect(() =>
      (service as any).queryStagesFeaturesCheck(ArticleStage.REVIEWING),
    ).not.toThrow();
  });

  it('should throw if stage is VERIFIED and signatureEnabled is false', () => {
    (service as any).signatureLevels = [];
    expect(() =>
      (service as any).queryStagesFeaturesCheck(ArticleStage.VERIFIED),
    ).toThrow('Signature mode is disabled.');
  });

  it('should NOT throw if stage is VERIFIED and signatureEnabled is true', () => {
    (service as any).signatureLevels = ['dummy'];
    expect(() =>
      (service as any).queryStagesFeaturesCheck(ArticleStage.VERIFIED),
    ).not.toThrow();
  });

  it('should do nothing for RELEASED or unknown stage', () => {
    expect(() =>
      (service as any).queryStagesFeaturesCheck(ArticleStage.RELEASED),
    ).not.toThrow();
  });
});

describe('limitStageWithQueryBuilder', () => {
  let service: ArticleBaseService;
  let qb: any;

  beforeEach(() => {
    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [], // signatureLevels
      {} as any,
      {} as any,
      true,
      { query: jest.fn() } as any,
    );

    qb = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };
  });

  it('should apply DRAFT stage logic with subQb', () => {
    const result = (service as any).limitStageWithQueryBuilder(
      qb,
      ArticleStage.DRAFT,
    );

    const subQbFn = qb.innerJoin.mock.calls[0][0];

    const subQb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    subQbFn(subQb);

    expect(subQb.from).toHaveBeenCalled();
    expect(subQb.select).toHaveBeenCalledWith(
      'versions.articleId',
      'articleId',
    );

    expect(subQb.andWhere).toHaveBeenCalledWith('versions.releasedAt IS NULL');
    expect(result).toBe(qb);
  });

  it('should apply VERIFIED stage logic with subQb', () => {
    jest
      .spyOn(service as any, 'finalSignatureLevel', 'get')
      .mockReturnValue({ id: 123 });

    const result = (service as any).limitStageWithQueryBuilder(
      qb,
      ArticleStage.VERIFIED,
    );

    const subQbFn = qb.innerJoin.mock.calls[0][0];

    const subQb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    subQbFn(subQb);

    expect(subQb.from).toHaveBeenCalled();
    expect(subQb.innerJoin).toHaveBeenCalledWith(
      'signatures.articleVersion',
      'articleVersion',
    );

    expect(subQb.andWhere).toHaveBeenCalledWith(
      'signatures.result = :result AND signatures."signatureLevelId" = :signatureLevelId',
      {
        result: 'APPROVED',
        signatureLevelId: 123,
      },
    );

    expect(result).toBe(qb);
  });

  it('should apply SCHEDULED stage logic with subQb', () => {
    const result = (service as any).limitStageWithQueryBuilder(
      qb,
      ArticleStage.SCHEDULED,
    );

    const subQbFn = qb.innerJoin.mock.calls[0][0];

    const subQb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    subQbFn(subQb);

    expect(subQb.andWhere).toHaveBeenCalledWith(
      'versions.releasedAt IS NOT NULL',
    );

    expect(subQb.andWhere).toHaveBeenCalledWith(
      'versions.releasedAt > CURRENT_TIMESTAMP',
    );

    expect(result).toBe(qb);
  });

  it('should apply RELEASED stage logic with subQb', () => {
    const result = (service as any).limitStageWithQueryBuilder(
      qb,
      ArticleStage.RELEASED,
    );

    const subQbFn = qb.innerJoin.mock.calls[0][0];

    const subQb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    subQbFn(subQb);

    expect(subQb.andWhere).toHaveBeenCalledWith(
      'versions.releasedAt IS NOT NULL',
    );

    expect(subQb.andWhere).toHaveBeenCalledWith(
      'versions.releasedAt <= CURRENT_TIMESTAMP',
    );

    expect(result).toBe(qb);
  });

  it('should apply REVIEWING stage logic with correct joins and where clauses', () => {
    const qbMock = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    const service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [], // signatureLevels
      {} as any,
      {} as any,
      true,
      { query: jest.fn() } as any,
    );

    jest.spyOn(service as any, 'finalSignatureLevel', 'get').mockReturnValue({
      id: 'mock-id',
      name: 'Level1',
      sequence: 1,
      required: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = (service as any).limitStageWithQueryBuilder(
      qbMock,
      ArticleStage.REVIEWING,
    );

    expect(qbMock.andWhere).toHaveBeenCalledWith('versions.releasedAt IS NULL');

    expect(qbMock.andWhere).toHaveBeenCalledWith(
      'versions.submittedAt IS NOT NULL',
    );

    expect(qbMock.leftJoin).toHaveBeenCalledWith(
      'versions.signatures',
      'signatures',
      'signatures.result = :result',
      { result: 'APPROVED' },
    );

    expect(qbMock.leftJoin).toHaveBeenCalledWith(
      'signatures.signatureLevel',
      'signatureLevel',
      'signatureLevel.name = :signatureLevel',
      { signatureLevel: 'Level1' },
    );

    expect(qbMock.andWhere).toHaveBeenCalledWith('signatureLevel.id IS NULL');

    expect(result).toBe(qbMock);
  });
});

describe('getDefaultQueryBuilder', () => {
  let service: ArticleBaseService;

  const mockQb = (): any => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    getSql: () => 'SELECT ... WHERE versions.version = :version',
  });

  beforeEach(() => {
    service = new ArticleBaseService(
      { createQueryBuilder: jest.fn(() => mockQb()) } as any, // baseArticleRepo
      {} as any,
      {} as any,
      {} as any,
      true, // fullTextSearchMode
      true, // multilingualMode
      true, // signatureMode
      [
        {
          id: 'mock-id',
          name: 'L1',
          sequence: 1,
          required: true,
          createdAt: new Date(),
          deletedAt: null,
          signatures: [],
        },
      ] as BaseSignatureLevelEntity[], // signatureLevels
      {} as any,
      {} as any,
      true,
      { query: jest.fn() } as any,
    );
  });

  it('should warn when both version and stage are provided', () => {
    const spy = jest.spyOn((service as any).logger, 'warn');

    (service as any).getDefaultQueryBuilder('alias', {
      version: 1,
      stage: ArticleStage.DRAFT,
    });

    expect(spy).toHaveBeenCalledWith(
      'Combining version and stage filters, only version filter will be applied.',
    );
  });

  it('should call queryStagesFeaturesCheck when stage is provided', () => {
    const checkSpy = jest.spyOn(service as any, 'queryStagesFeaturesCheck');

    (service as any).getDefaultQueryBuilder('alias', {
      stage: ArticleStage.RELEASED,
    });

    expect(checkSpy).toHaveBeenCalledWith(ArticleStage.RELEASED);
  });

  it('should add version filter when version is passed', () => {
    const qb = (service as any).getDefaultQueryBuilder('alias', { version: 2 });

    expect(qb.getSql()).toContain('versions.version =');
  });

  it('should use default alias "articles" when none is provided', () => {
    const result = (service as any).getDefaultQueryBuilder();

    expect(result).toBeDefined();
  });

  it('should use QueryRunner to create query builder if provided', () => {
    const mockRunner = {
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue(mockQb()),
      },
    };

    const result = (service as any).getDefaultQueryBuilder(
      'custom',
      {},
      mockRunner,
    );

    expect(mockRunner.manager.createQueryBuilder).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should call limitStageWithQueryBuilder when stage is REVIEWING', () => {
    const spy = jest
      .spyOn(service as any, 'limitStageWithQueryBuilder')
      .mockReturnValue(mockQb());

    const options = { stage: ArticleStage.REVIEWING, signatureLevel: 'L1' };

    const result = (service as any).getDefaultQueryBuilder('alias', options);

    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      ArticleStage.REVIEWING,
      'L1',
    );

    expect(result).toBeDefined();
  });

  it('should join latest version when neither version nor stage is specified', () => {
    const innerJoinMock = jest.fn().mockReturnThis();

    const serviceWithJoinSpy = new ArticleBaseService(
      {
        createQueryBuilder: jest.fn(() => ({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          innerJoinAndSelect: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          innerJoin: innerJoinMock,
        })),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [
        {
          id: 'mock-id',
          name: 'L1',
          sequence: 1,
          required: true,
          createdAt: new Date(),
          deletedAt: null,
          signatures: [],
        },
      ],
      {} as any,
      {} as any,
      true,
      { query: jest.fn() } as any,
    );

    const result = (serviceWithJoinSpy as any).getDefaultQueryBuilder(
      'alias',
      {},
    );

    expect(innerJoinMock).toHaveBeenCalledWith(
      expect.any(Function),
      'target',
      'target.version = versions.version AND target."articleId" = versions."articleId"',
    );

    const subqueryBuilder = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
    };

    const subqueryFn = innerJoinMock.mock.calls[0][0];

    subqueryFn(subqueryBuilder);

    expect(subqueryBuilder.from).toHaveBeenCalledWith(undefined, 'versions');

    expect(subqueryBuilder.select).toHaveBeenCalledWith(
      'versions.articleId',
      'articleId',
    );

    expect(subqueryBuilder.addSelect).toHaveBeenCalledWith(
      'MAX(versions.version)',
      'version',
    );

    expect(subqueryBuilder.groupBy).toHaveBeenCalledWith('versions.articleId');

    expect(result).toBeDefined();
  });
});

describe('getFindAllQueryBuilder', () => {
  let service: any;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<any>>;
  let mockBaseArticleRepo: any;
  let mockBaseCategoryRepo: any;
  let mockBaseArticleVersionContentRepo: any;

  // Mock the jieba module at the top level
  const mockCut = jest.fn();

  jest.mock('@node-rs/jieba', () => ({
    cut: mockCut,
  }));

  beforeEach(() => {
    // Reset the mock before each test
    mockCut.mockReset();

    mockDataSource = {
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<DataSource>;

    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      andWhereExists: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<SelectQueryBuilder<any>>;

    mockBaseArticleRepo = {
      metadata: {
        schema: 'public',
        tableName: 'articles',
        manyToManyRelations: [
          {
            propertyPath: 'categories',
            junctionEntityMetadata: {
              tableName: 'article_categories',
            },
          },
        ],
      },
    };

    mockBaseCategoryRepo = {
      metadata: {
        tablePath: 'public.categories',
      },
    };

    mockBaseArticleVersionContentRepo = {
      metadata: {
        schema: 'public',
        tableName: 'article_version_contents',
        targetName: 'ArticleVersionContentEntity',
      },
    };

    mockDataSource.createQueryBuilder.mockReturnValue(mockQueryBuilder);

    // Create a proper instance or extend the prototype
    service = Object.create(ArticleBaseService.prototype);
    service.dataSource = mockDataSource;
    service.baseArticleRepo = mockBaseArticleRepo;
    service.baseCategoryRepo = mockBaseCategoryRepo;
    service.baseArticleVersionContentRepo = mockBaseArticleVersionContentRepo;
    service.getDefaultQueryBuilder = jest
      .fn()
      .mockReturnValue(mockQueryBuilder);

    service.fullTextSearchMode = true;
  });

  it('should return a basic query builder with no options', async () => {
    const result = await service.getFindAllQueryBuilder();

    expect(result).toBe(mockQueryBuilder);
    expect(service.getDefaultQueryBuilder).toHaveBeenCalledWith('articles', {
      stage: undefined,
      signatureLevel: undefined,
    });

    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      'articles.createdAt',
      'DESC',
    );
  });

  it('should pass stage and signatureLevel to getDefaultQueryBuilder', async () => {
    const options = { stage: 'draft', signatureLevel: 'high' };

    await service.getFindAllQueryBuilder(options);

    expect(service.getDefaultQueryBuilder).toHaveBeenCalledWith('articles', {
      stage: 'draft',
      signatureLevel: 'high',
    });
  });

  it('should add ID filter when ids are provided', async () => {
    const options = { ids: [1, 2, 3] };

    await service.getFindAllQueryBuilder(options);

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'articles.id IN (:...ids)',
      { ids: [1, 2, 3] },
    );
  });

  it('should not add ID filter when ids array is empty', async () => {
    const options = { ids: [] };

    await service.getFindAllQueryBuilder(options);

    expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
      'articles.id IN (:...ids)',
      expect.anything(),
    );
  });

  it('should add language filter when language is provided', async () => {
    const options = { language: 'en' };

    await service.getFindAllQueryBuilder(options);

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'multiLanguageContents.language = :language',
      { language: 'en' },
    );
  });

  it('should create subquery for each required category ID', async () => {
    const options = { requiredCategoryIds: [10, 20, 30] };

    await service.getFindAllQueryBuilder(options);

    expect(mockDataSource.createQueryBuilder).toHaveBeenCalledTimes(3);
    expect(mockQueryBuilder.andWhereExists).toHaveBeenCalledTimes(3);
    expect(mockQueryBuilder.from).toHaveBeenCalledWith(
      'public.article_categories',
      'requiredCategoryRelations0',
    );

    expect(mockQueryBuilder.from).toHaveBeenCalledWith(
      'public.article_categories',
      'requiredCategoryRelations1',
    );

    expect(mockQueryBuilder.from).toHaveBeenCalledWith(
      'public.article_categories',
      'requiredCategoryRelations2',
    );
  });

  it('should create single subquery for category IDs filter', async () => {
    const options = { categoryIds: [5, 6, 7] };

    await service.getFindAllQueryBuilder(options);

    expect(mockDataSource.createQueryBuilder).toHaveBeenCalledTimes(1);
    expect(mockQueryBuilder.andWhereExists).toHaveBeenCalledTimes(1);
    expect(mockQueryBuilder.from).toHaveBeenCalledWith(
      'public.article_categories',
      'categoryRelations',
    );

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      '"categoryRelations"."categoryId" IN (:...categoryIds)',
      { categoryIds: [5, 6, 7] },
    );
  });

  it('should perform full text search when searchMode is FULL_TEXT', async () => {
    // Set up the mock to return the expected tokens
    mockCut.mockReturnValue(['test', 'search']);

    const options = {
      searchTerm: 'test search',
      searchMode: ArticleSearchMode.FULL_TEXT,
    };

    await service.getFindAllQueryBuilder(options);

    // Verify jieba.cut was called with the search term
    expect(mockCut).toHaveBeenCalledWith('test search');

    expect(mockDataSource.createQueryBuilder).toHaveBeenCalled();
    expect(mockQueryBuilder.andWhereExists).toHaveBeenCalled();
    expect(mockQueryBuilder.from).toHaveBeenCalledWith(
      'public.article_version_contents',
      'contents',
    );

    // Check that the full text search query was called with the correct parameters
    const andWhereCalls = mockQueryBuilder.andWhere.mock.calls;
    const fullTextSearchCall = andWhereCalls.find(
      (call) =>
        typeof call[0] === 'string' &&
        call[0].includes('contents.searchTokens @@ to_tsquery'),
    );

    expect(fullTextSearchCall).toBeDefined();
    expect(fullTextSearchCall![0]).toBe(
      // eslint-disable-next-line quotes
      "contents.searchTokens @@ to_tsquery('simple', :searchTerm)",
    );

    expect(fullTextSearchCall![1]).toEqual({ searchTerm: 'test|search' });
  });

  it('should throw error when full text search is disabled', async () => {
    service.fullTextSearchMode = false;
    const options = {
      searchTerm: 'test search',
      searchMode: ArticleSearchMode.FULL_TEXT,
    };

    await expect(service.getFindAllQueryBuilder(options)).rejects.toThrow(
      'Full text search is disabled.',
    );
  });

  it('should perform title and tag search when searchMode is TITLE_AND_TAG', async () => {
    const options = {
      searchTerm: 'Test',
      searchMode: ArticleSearchMode.TITLE_AND_TAG,
    };

    await service.getFindAllQueryBuilder(options);

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      ':tagSearchTerm = ANY (SELECT LOWER(value) FROM jsonb_array_elements_text(versions.tags))',
      { tagSearchTerm: 'test' },
    );

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'contents.title ILIKE :searchTerm',
      { searchTerm: '%Test%' },
    );

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'contents.description ILIKE :searchTerm',
      { searchTerm: '%Test%' },
    );
  });

  it('should perform title search only when searchMode is TITLE', async () => {
    const options = {
      searchTerm: 'test',
      searchMode: ArticleSearchMode.TITLE,
    };

    await service.getFindAllQueryBuilder(options);

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'contents.title ILIKE :searchTerm',
      { searchTerm: '%test%' },
    );

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'contents.description ILIKE :searchTerm',
      { searchTerm: '%test%' },
    );

    expect(mockQueryBuilder.orWhere).not.toHaveBeenCalledWith(
      ':tagSearchTerm = ANY (SELECT LOWER(value) FROM jsonb_array_elements_text(versions.tags))',
      expect.anything(),
    );
  });

  it('should perform title search by default when no searchMode specified', async () => {
    const options = { searchTerm: 'test' };

    await service.getFindAllQueryBuilder(options);

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'contents.title ILIKE :searchTerm',
      { searchTerm: '%test%' },
    );

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'contents.description ILIKE :searchTerm',
      { searchTerm: '%test%' },
    );
  });

  it('should add correct entity name and version conditions for search', async () => {
    const options = { searchTerm: 'test' };

    await service.getFindAllQueryBuilder(options);

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'contents."entityName" = :entityName',
      { entityName: 'ArticleVersionContentEntity' },
    );

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'contents."articleId" = "versions"."articleId"',
    );

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'contents."version" = "versions"."version"',
    );
  });

  it('should add createdAt ASC order when sorter is CREATED_AT_ASC', async () => {
    const options = { sorter: ArticleSorter.CREATED_AT_ASC };

    await service.getFindAllQueryBuilder(options);

    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      'articles.createdAt',
      'ASC',
    );
  });

  it('should add createdAt DESC order when sorter is CREATED_AT_DESC', async () => {
    const options = { sorter: ArticleSorter.CREATED_AT_DESC };

    await service.getFindAllQueryBuilder(options);

    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      'articles.createdAt',
      'DESC',
    );
  });

  it('should add createdAt DESC order by default when no sorter specified', async () => {
    await service.getFindAllQueryBuilder();

    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      'articles.createdAt',
      'DESC',
    );
  });

  it('should handle combination of filters correctly', async () => {
    const options = {
      ids: [1, 2],
      language: 'en',
      categoryIds: [10, 20],
      searchTerm: 'test',
      searchMode: ArticleSearchMode.TITLE_AND_TAG,
      sorter: ArticleSorter.CREATED_AT_ASC,
    };

    await service.getFindAllQueryBuilder(options);

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'articles.id IN (:...ids)',
      { ids: [1, 2] },
    );

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'multiLanguageContents.language = :language',
      { language: 'en' },
    );

    expect(mockQueryBuilder.andWhereExists).toHaveBeenCalledTimes(2); // Once for categories, once for search
    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      'articles.createdAt',
      'ASC',
    );
  });
});

describe('ArticleBaseService - getPlacedArticleStage', () => {
  let service: ArticleBaseService;

  beforeEach(() => {
    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      {} as any,
    );
  });

  it('should return REVIEWING if submitted is true', () => {
    const result = (service as any).getPlacedArticleStage({
      submitted: true,
      releasedAt: null,
      signatureLevel: null,
    });

    expect(result).toBe(ArticleStage.REVIEWING);
  });

  it('should return VERIFIED if signatureLevel equals finalSignatureLevel.name', () => {
    jest
      .spyOn(service as any, 'finalSignatureLevel', 'get')
      .mockReturnValue({ name: 'Level3' });

    const result = (service as any).getPlacedArticleStage({
      submitted: false,
      releasedAt: null,
      signatureLevel: 'Level3',
    });

    expect(result).toBe(ArticleStage.VERIFIED);
  });

  it('should return REVIEWING if signatureLevel exists but not equal to finalSignatureLevel.name', () => {
    jest
      .spyOn(service as any, 'finalSignatureLevel', 'get')
      .mockReturnValue({ name: 'Level3' });

    const result = (service as any).getPlacedArticleStage({
      submitted: false,
      releasedAt: null,
      signatureLevel: 'Level1',
    });

    expect(result).toBe(ArticleStage.REVIEWING);
  });

  it('should return SCHEDULED if releasedAt is in the future', () => {
    const futureDate = new Date(Date.now() + 100000);

    const result = (service as any).getPlacedArticleStage({
      submitted: false,
      releasedAt: futureDate,
      signatureLevel: null,
    });

    expect(result).toBe(ArticleStage.SCHEDULED);
  });

  it('should return RELEASED if releasedAt is in the past', () => {
    const pastDate = new Date(Date.now() - 100000);

    const result = (service as any).getPlacedArticleStage({
      submitted: false,
      releasedAt: pastDate,
      signatureLevel: null,
    });

    expect(result).toBe(ArticleStage.RELEASED);
  });

  it('should return DRAFT if draftMode is enabled and no other conditions match', () => {
    (service as any).draftMode = true;

    const result = (service as any).getPlacedArticleStage({
      submitted: false,
      releasedAt: null,
      signatureLevel: null,
    });

    expect(result).toBe(ArticleStage.DRAFT);
  });

  it('should return RELEASED if no other conditions match and draftMode is false', () => {
    (service as any).draftMode = false;

    const result = (service as any).getPlacedArticleStage({
      submitted: false,
      releasedAt: null,
      signatureLevel: null,
    });

    expect(result).toBe(ArticleStage.RELEASED);
  });
});

describe('ArticleBaseService - optionsCheck', () => {
  let service: ArticleBaseService;

  beforeEach(() => {
    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      true, // signatureEnabled
      true,
      true,
      [],
      {} as any,
      {} as any,
      true, // draftMode
      {} as any,
    );
  });

  it('should throw if submitted and signatureLevel are both set', () => {
    expect(() =>
      (service as any).optionsCheck({
        submitted: true,
        signatureLevel: 'Level1',
      }),
    ).toThrow(
      'Signature level is not allowed when submitting an article version.',
    );
  });

  it('should throw if submitted and releasedAt are both set', () => {
    expect(() =>
      (service as any).optionsCheck({
        submitted: true,
        releasedAt: new Date(),
      }),
    ).toThrow('Released at is not allowed when submitting an article version.');
  });

  it('should throw if releasedAt and non-final signatureLevel are both set', () => {
    jest
      .spyOn(service as any, 'finalSignatureLevel', 'get')
      .mockReturnValue({ name: 'FinalLevel' });

    expect(() =>
      (service as any).optionsCheck({
        releasedAt: new Date(),
        signatureLevel: 'NotFinal',
      }),
    ).toThrow(
      'Only final signature level is allowed when releasing an article version.',
    );
  });

  it('should throw if submitted and signature mode is disabled', () => {
    jest
      .spyOn(service as any, 'signatureEnabled', 'get')
      .mockReturnValue(false);

    expect(() =>
      (service as any).optionsCheck({
        submitted: true,
      }),
    ).toThrow('Signature mode is disabled.');
  });

  it('should throw if releasedAt is set but draftMode is disabled', () => {
    (service as any).draftMode = false;

    expect(() =>
      (service as any).optionsCheck({
        releasedAt: new Date(),
      }),
    ).toThrow('Draft mode is disabled.');
  });

  it('should NOT throw when valid: submitted only with signatureEnabled', () => {
    jest.spyOn(service as any, 'signatureEnabled', 'get').mockReturnValue(true);

    expect(() =>
      (service as any).optionsCheck({
        submitted: true,
      }),
    ).not.toThrow();
  });

  it('should NOT throw when valid: releasedAt only with draftMode', () => {
    expect(() =>
      (service as any).optionsCheck({
        releasedAt: new Date(),
      }),
    ).not.toThrow();
  });

  it('should NOT throw when valid: releasedAt + final signature level', () => {
    jest
      .spyOn(service as any, 'finalSignatureLevel', 'get')
      .mockReturnValue({ name: 'FinalLevel' });

    expect(() =>
      (service as any).optionsCheck({
        releasedAt: new Date(),
        signatureLevel: 'FinalLevel',
      }),
    ).not.toThrow();
  });
});
