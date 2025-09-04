// Mock NestJS Logger constructor to prevent DEBUG outputs - MUST be at the top
const mockLoggerMethods = {
  debug: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  verbose: jest.fn(),
};

jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  Logger: jest.fn().mockImplementation(() => mockLoggerMethods),
}));

import { SignatureService } from '../../src/services/signature.service';
import { ArticleBaseService } from '../../src/services/article-base.service';
import { ArticleStage } from '../../src/typings/article-stage.enum';
import { SelectQueryBuilder } from 'typeorm';
import { BaseArticleEntity } from '../../src/models/base-article.entity';
import { ArticleSignatureResult } from '../../src/typings/article-signature-result.enum';
import { ArticleSearchMode } from '../../src/typings/article-search-mode.enum';
import { ArticleSorter } from '../../src/typings/article-sorter.enum';
import { BaseSignatureLevelEntity } from '../../src/models/base-signature-level.entity';

describe('queryStagesFeaturesCheck', () => {
  let service: ArticleBaseService;
  let mockSignatureService: MockSignatureService;

  class MockSignatureService {
    private _enabled = true;

    setEnabled(value: boolean) {
      this._enabled = value;
    }

    get signatureEnabled(): boolean {
      return this._enabled;
    }
  }

  beforeEach(() => {
    mockSignatureService = new MockSignatureService();

    service = new ArticleBaseService(
      {} as any, // baseArticleRepo
      {} as any, // baseArticleVersionRepo
      {} as any, // baseArticleVersionContentRepo
      {} as any, // baseCategoryRepo
      true, // multipleLanguageMode
      true, // fullTextSearchMode
      true, // draftMode
      [], // signatureLevels
      {} as any, // signatureLevelRepo
      {} as any, // articleSignatureRepo
      true, // autoReleaseAfterApproved
      {} as any, // dataSource
      {} as any, // articleDataLoader
      mockSignatureService as unknown as SignatureService<any>,
    );
  });

  it('should pass silently if stage is DRAFT and draftMode is enabled', () => {
    expect(() => service['queryStagesFeaturesCheck'](ArticleStage.DRAFT)).not.toThrow();
  });

  it('should throw an error if stage is DRAFT and draftMode is disabled', () => {
    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      true,
      true,
      false, // draftMode disabled
      [],
      {} as any,
      {} as any,
      true,
      {} as any,
      {} as any,
      mockSignatureService as unknown as SignatureService<any>,
    );

    expect(() => service['queryStagesFeaturesCheck'](ArticleStage.DRAFT)).toThrow('Draft mode is disabled.');
  });

  it('should pass silently if stage is REVIEWING and signatureEnabled is true', () => {
    expect(() => service['queryStagesFeaturesCheck'](ArticleStage.REVIEWING)).not.toThrow();
  });

  it('should throw an error if stage is REVIEWING and signatureEnabled is false', () => {
    jest.spyOn(mockSignatureService, 'signatureEnabled', 'get').mockReturnValue(false);

    expect(() => service['queryStagesFeaturesCheck'](ArticleStage.REVIEWING)).toThrow('Signature mode is disabled.');
  });

  it('should pass silently if stage is VERIFIED and signatureEnabled is true', () => {
    expect(() => service['queryStagesFeaturesCheck'](ArticleStage.VERIFIED)).not.toThrow();
  });

  it('should throw an error if stage is VERIFIED and signatureEnabled is false', () => {
    jest.spyOn(mockSignatureService, 'signatureEnabled', 'get').mockReturnValue(false);

    expect(() => service['queryStagesFeaturesCheck'](ArticleStage.VERIFIED)).toThrow('Signature mode is disabled.');
  });

  it('should do nothing for stages not explicitly handled', () => {
    expect(() => service['queryStagesFeaturesCheck'](ArticleStage.RELEASED)).not.toThrow();

    expect(() => service['queryStagesFeaturesCheck'](ArticleStage.UNKNOWN)).not.toThrow();

    expect(() => service['queryStagesFeaturesCheck'](ArticleStage.SCHEDULED)).not.toThrow();
  });
});

describe('limitStageWithQueryBuilder', () => {
  let service: ArticleBaseService;
  let qb: jest.Mocked<SelectQueryBuilder<BaseArticleEntity>>;
  let mockSignatureService: any;

  beforeEach(() => {
    qb = {
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
    } as any;

    mockSignatureService = {
      finalSignatureLevel: { id: 'level-id', name: 'Final' },
    };

    service = new ArticleBaseService(
      {} as any,
      { target: 'mock_target' } as any,
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
      {} as any,
      mockSignatureService,
    );
  });

  describe('DRAFT', () => {
    it('should apply constraints using correct subquery', () => {
      const mockSubQueryBuilder = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };

      const qb = {
        innerJoin: jest.fn((subQueryFactory: any, alias: string, condition: string) => {
          subQueryFactory(mockSubQueryBuilder);

          return qb;
        }),
        andWhere: jest.fn().mockReturnThis(),
      } as unknown as SelectQueryBuilder<any>;

      const mockBaseArticleVersionRepo = {
        metadata: {
          tableName: 'versions',
        },
      };

      const service = new ArticleBaseService(
        {} as any, // baseArticleRepo
        mockBaseArticleVersionRepo as any, // baseArticleVersionRepo
        {} as any, // baseArticleVersionContentRepo
        {} as any, // baseCategoryRepo
        true, // multipleLanguageMode
        true, // fullTextSearchMode
        true, // draftMode
        [], // signatureLevels
        {} as any, // signatureLevelRepo
        {} as any, // articleSignatureRepo
        true, // autoReleaseAfterApproved
        {} as any, // dataSource
        {} as any, // articleDataLoader
        {} as any, // signatureService
      );

      service['limitStageWithQueryBuilder'](qb, ArticleStage.DRAFT);

      expect(qb.innerJoin).toHaveBeenCalledWith(
        expect.any(Function),
        'stage_ranked',
        'stage_ranked."articleId" = versions."articleId" AND stage_ranked."version" = versions."version" AND stage_ranked."rowIndex" = 1',
      );

      expect(mockSubQueryBuilder.from).toHaveBeenCalledWith('versions', 'versions');

      expect(mockSubQueryBuilder.select).toHaveBeenCalledWith('versions.articleId', 'articleId');

      expect(mockSubQueryBuilder.addSelect).toHaveBeenCalledWith('versions.version', 'version');

      expect(mockSubQueryBuilder.addSelect).toHaveBeenCalledWith(
        'ROW_NUMBER() OVER (PARTITION BY versions."articleId" ORDER BY versions."createdAt" DESC)',
        'rowIndex',
      );

      expect(mockSubQueryBuilder.andWhere).toHaveBeenCalledWith('versions.releasedAt IS NULL');

      expect(mockSubQueryBuilder.andWhere).toHaveBeenCalledWith('versions.submittedAt IS NULL');
    });
  });

  describe('REVIEWING', () => {
    it('should apply constraints with provided signature level', () => {
      service['limitStageWithQueryBuilder'](qb, ArticleStage.REVIEWING, 'L1');

      expect(qb.andWhere).toHaveBeenCalledWith('versions.releasedAt IS NULL');

      expect(qb.leftJoin).toHaveBeenCalledWith(
        'signatures.signatureLevel',
        'signatureLevel',
        'signatureLevel.name = :signatureLevel',
        { signatureLevel: 'L1' },
      );

      expect(qb.andWhere).toHaveBeenCalledWith('signatureLevel.id IS NULL');
    });

    it('should fallback to finalSignatureLevel.name if no signatureLevel is provided', () => {
      service['limitStageWithQueryBuilder'](qb, ArticleStage.REVIEWING);

      expect(qb.leftJoin).toHaveBeenCalledWith(
        'signatures.signatureLevel',
        'signatureLevel',
        'signatureLevel.name = :signatureLevel',
        { signatureLevel: 'Final' },
      );
    });
  });

  describe('VERIFIED', () => {
    it('should apply VERIFIED stage constraints using correct subquery', () => {
      const mockSubQueryBuilder = {
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };

      const qb = {
        innerJoin: jest.fn((subQueryFactory: any, alias: string, condition: string) => {
          subQueryFactory(mockSubQueryBuilder);

          return qb;
        }),
        andWhere: jest.fn().mockReturnThis(),
      } as unknown as SelectQueryBuilder<any>;

      const mockFinalSignatureLevel: BaseSignatureLevelEntity = {
        id: 'final-level-id',
        name: 'Final Signature Level',
        sequence: 1,
        required: true,
        createdAt: new Date(),
        deletedAt: null,
        signatures: [],
      };

      const mockArticleSignatureRepo = {
        metadata: {
          tableName: 'signatures',
        },
      };

      const mockSignatureService = {
        finalSignatureLevel: mockFinalSignatureLevel,
        signatureLevelsCache: [mockFinalSignatureLevel],
        signatureLevels: [],
        signatureLevelRepo: {} as any,
        dataSource: {} as any,
        articleSignatureRepo: mockArticleSignatureRepo,
        reloadLevels: jest.fn(),
        findSignatureLevel: jest.fn(),
      } as unknown as SignatureService<BaseSignatureLevelEntity>;

      const service = new ArticleBaseService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        true,
        true,
        true,
        [],
        {} as any,
        mockArticleSignatureRepo as any,
        true,
        {} as any,
        {} as any,
        mockSignatureService,
      );

      service['limitStageWithQueryBuilder'](qb, ArticleStage.VERIFIED);

      expect(mockSubQueryBuilder.from).toHaveBeenCalledWith('signatures', 'signatures');

      expect(mockSubQueryBuilder.innerJoin).toHaveBeenCalledWith('signatures.articleVersion', 'articleVersion');

      expect(mockSubQueryBuilder.select).toHaveBeenCalledWith('signatures.articleId', 'articleId');

      expect(mockSubQueryBuilder.addSelect).toHaveBeenCalledWith('signatures.version', 'version');

      expect(mockSubQueryBuilder.addSelect).toHaveBeenCalledWith(
        'ROW_NUMBER() OVER (PARTITION BY signatures."articleId" ORDER BY signatures."signedAt" DESC)',
        'rowIndex',
      );

      expect(mockSubQueryBuilder.andWhere).toHaveBeenCalledWith(
        'signatures.result = :result AND signatures."signatureLevelId" = :signatureLevelId',
        {
          result: ArticleSignatureResult.APPROVED,
          signatureLevelId: 'final-level-id',
        },
      );
    });
  });

  describe('SCHEDULED', () => {
    it('should apply constraints using correct subquery', () => {
      const mockSubQueryBuilder = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };

      const qb = {
        innerJoin: jest.fn((fn, alias, condition) => {
          fn(mockSubQueryBuilder as any);

          return qb;
        }),
        andWhere: jest.fn().mockReturnThis(),
      } as any;

      const mockBaseArticleVersionRepo = {
        metadata: {
          tableName: 'versions',
        },
      };

      const service = new ArticleBaseService(
        {} as any,
        mockBaseArticleVersionRepo as any,
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
        {} as any,
        {} as any,
      );

      service['limitStageWithQueryBuilder'](qb, ArticleStage.SCHEDULED);

      expect(mockSubQueryBuilder.from).toHaveBeenCalledWith('versions', 'versions');

      expect(mockSubQueryBuilder.addSelect).toHaveBeenCalledWith(
        'ROW_NUMBER() OVER (PARTITION BY versions."articleId" ORDER BY versions."releasedAt" ASC)',
        'rowIndex',
      );

      expect(mockSubQueryBuilder.andWhere).toHaveBeenCalledWith('versions.releasedAt IS NOT NULL');

      expect(mockSubQueryBuilder.andWhere).toHaveBeenCalledWith('versions.releasedAt > CURRENT_TIMESTAMP');
    });
  });

  describe('RELEASED / Default', () => {
    it('should apply constraints using correct subquery', () => {
      const mockSubQueryBuilder = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
      };

      const qb = {
        innerJoin: jest.fn((fn, alias, condition) => {
          fn(mockSubQueryBuilder as any);

          return qb;
        }),
        andWhere: jest.fn().mockReturnThis(),
      } as any;

      const mockBaseArticleVersionRepo = {
        metadata: {
          tableName: 'versions',
        },
      };

      const service = new ArticleBaseService(
        {} as any,
        mockBaseArticleVersionRepo as any,
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
        {} as any,
        {} as any,
      );

      service['limitStageWithQueryBuilder'](qb, 'NON_EXISTENT' as ArticleStage);

      expect(mockSubQueryBuilder.from).toHaveBeenCalledWith('versions', 'versions');

      expect(mockSubQueryBuilder.andWhere).toHaveBeenCalledWith('versions.releasedAt IS NOT NULL');

      expect(mockSubQueryBuilder.andWhere).toHaveBeenCalledWith('versions.releasedAt <= CURRENT_TIMESTAMP');
    });
  });
});

describe('getDefaultQueryBuilder', () => {
  let service: ArticleBaseService;
  let mockRepo: any;
  let mockRunner: any;
  beforeEach(() => {
    mockRepo = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
      target: 'ArticleEntity',
      metadata: {
        tableName: 'articles',
      },
    };

    mockRunner = {
      manager: {
        createQueryBuilder: jest.fn(() => mockQueryBuilder),
      },
    };

    service = new ArticleBaseService(
      mockRepo,
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
      {} as any,
      {} as any,
    );
    jest.spyOn(service as any, 'queryStagesFeaturesCheck').mockImplementation();
    jest.spyOn(service as any, 'limitStageWithQueryBuilder').mockImplementation(qb => qb);
  });

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
  };

  it('should log a warning if both version and stage are provided', () => {
    service['getDefaultQueryBuilder']('articles', {
      version: 2,
      stage: ArticleStage.DRAFT,
    });

    expect((service as any).logger.warn).toHaveBeenCalledWith(
      'Combining version and stage filters, only version filter will be applied.',
    );
  });

  it('should call queryStagesFeaturesCheck if stage is provided', () => {
    service['getDefaultQueryBuilder']('articles', {
      stage: ArticleStage.RELEASED,
    });

    expect(service['queryStagesFeaturesCheck']).toHaveBeenCalledWith(ArticleStage.RELEASED);
  });

  it('should use runner.manager.createQueryBuilder if runner is provided', () => {
    service['getDefaultQueryBuilder']('articles', {}, mockRunner as any);

    expect(mockRunner.manager.createQueryBuilder).toHaveBeenCalledWith('articles', 'articles');
  });

  it('should use baseArticleRepo.createQueryBuilder if no runner is provided', () => {
    service['getDefaultQueryBuilder']('articles');

    expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('articles');
  });

  it('should add correct joins and filter by version if version is provided', () => {
    const result = service['getDefaultQueryBuilder']('articles', {
      version: 3,
    });

    expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('articles.categories', 'categories');

    expect(mockQueryBuilder.innerJoinAndSelect).toHaveBeenCalledWith('articles.versions', 'versions');

    expect(mockQueryBuilder.innerJoinAndSelect).toHaveBeenCalledWith(
      'versions.multiLanguageContents',
      'multiLanguageContents',
    );

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('versions.version = :version', {
      version: 3,
    });

    expect(result).toBe(mockQueryBuilder);
  });

  it('should call limitStageWithQueryBuilder if only stage is provided', () => {
    const result = service['getDefaultQueryBuilder']('articles', {
      stage: ArticleStage.REVIEWING,
    });

    expect(service['limitStageWithQueryBuilder']).toHaveBeenCalledWith(
      mockQueryBuilder,
      ArticleStage.REVIEWING,
      undefined,
    );

    expect(result).toBe(mockQueryBuilder);
  });

  it('should join latest version by default if no version or stage is provided', () => {
    service['getDefaultQueryBuilder']('articles');

    expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
      expect.any(Function),
      'target',
      'target.version = versions.version AND target."articleId" = versions."articleId"',
    );
  });

  it('should use default alias "articles" when alias is not provided', () => {
    service['getDefaultQueryBuilder']();

    expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('articles');

    expect(mockQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('articles.categories', 'categories');

    expect(mockQueryBuilder.innerJoinAndSelect).toHaveBeenCalledWith('articles.versions', 'versions');

    expect(mockQueryBuilder.innerJoinAndSelect).toHaveBeenCalledWith(
      'versions.multiLanguageContents',
      'multiLanguageContents',
    );
  });

  it('should join with subquery selecting MAX version per article if no version or stage is provided', () => {
    const mockSubQueryBuilder = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
    };

    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn((subQueryFn: any, alias: string, condition: string) => {
        subQueryFn(mockSubQueryBuilder);

        return mockQueryBuilder;
      }),
    } as unknown as SelectQueryBuilder<any>;

    const mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      target: 'MockArticleEntity',
      metadata: {
        tableName: 'articles',
      },
    };

    const mockVersionRepo = {
      target: class MockArticleVersionEntity {},
      metadata: {
        tableName: 'versions',
      },
    };

    const service = new ArticleBaseService(
      mockRepo as any, // baseArticleRepo
      mockVersionRepo as any, // baseArticleVersionRepo
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
      {} as any,
      {} as any,
    );

    service['getDefaultQueryBuilder']();

    expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
      expect.any(Function),
      'target',
      'target.version = versions.version AND target."articleId" = versions."articleId"',
    );

    expect(mockSubQueryBuilder.from).toHaveBeenCalledWith(mockVersionRepo.metadata.tableName, 'versions');

    expect(mockSubQueryBuilder.select).toHaveBeenCalledWith('versions.articleId', 'articleId');

    expect(mockSubQueryBuilder.addSelect).toHaveBeenCalledWith('MAX(versions.version)', 'version');

    expect(mockSubQueryBuilder.groupBy).toHaveBeenCalledWith('versions.articleId');
  });
});

describe('ArticleBaseService - getFindAllQueryBuilder', () => {
  let service: ArticleBaseService;
  let mockQb: any;

  beforeEach(() => {
    mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      andWhereExists: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };

    service = new ArticleBaseService(
      {} as any, // baseArticleRepo
      {} as any, // baseArticleVersionRepo
      {} as any, // baseArticleVersionContentRepo
      {} as any, // baseCategoryRepo
      true, // multipleLanguageMode
      true, // allowMultipleParentCategories
      true, // allowCircularCategories
      [],
      {} as any, // baseArticleContentRepo
      {} as any, // tagRepo
      true, // fullTextSearchMode
      {} as any, // dataSource
      {} as any, // logger
      {} as any, // articleDataLoader
    );

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue(mockQb);
  });

  it('should add ids filter if options.ids is provided', async () => {
    await service['getFindAllQueryBuilder']({ ids: ['id1', 'id2'] });
    expect(mockQb.andWhere).toHaveBeenCalledWith('articles.id IN (:...ids)', {
      ids: ['id1', 'id2'],
    });
  });

  it('should add language filter if options.language is provided', async () => {
    await service['getFindAllQueryBuilder']({ language: 'en' });
    expect(mockQb.andWhere).toHaveBeenCalledWith('multiLanguageContents.language = :language', { language: 'en' });
  });

  it('should add search filter with FULL_TEXT mode', async () => {
    jest.resetModules(); // Clear previous mocks
    jest.doMock('@node-rs/jieba', () => ({
      __esModule: true,
      default: {
        Jieba: class MockJieba {
          cut() {
            return ['test'];
          }
        },
      },
    }));

    const mockCreateQueryBuilder = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    });

    const mockDataSource = {
      createQueryBuilder: mockCreateQueryBuilder,
    };

    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as any,
      {
        metadata: { tablePath: 'public.categories', manyToManyRelations: [] },
      } as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true, // fullTextSearchMode set here
      mockDataSource as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue(mockQb);

    await service['getFindAllQueryBuilder']({
      searchTerm: 'test',
      searchMode: ArticleSearchMode.FULL_TEXT,
    });

    expect(mockCreateQueryBuilder).toHaveBeenCalled();
  });

  it('should add search filter with TITLE mode', async () => {
    const mockCreateQueryBuilder = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
    });

    const mockBaseArticleVersionContentRepo = {
      metadata: {
        schema: 'public',
        tableName: 'contents',
        targetName: 'ArticleVersionContent',
      },
    };

    service = new ArticleBaseService(
      {} as any,
      {} as any,
      mockBaseArticleVersionContentRepo as any,
      {
        metadata: {
          tablePath: 'public.categories',
          manyToManyRelations: [],
        },
      } as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      {
        createQueryBuilder: mockCreateQueryBuilder,
      } as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue(mockQb);

    await service['getFindAllQueryBuilder']({
      searchTerm: 'test',
      searchMode: ArticleSearchMode.TITLE,
    });

    expect(mockCreateQueryBuilder).toHaveBeenCalled();
  });

  it('should sort by CREATED_AT_ASC', async () => {
    await service['getFindAllQueryBuilder']({
      sorter: ArticleSorter.CREATED_AT_ASC,
    });

    expect(mockQb.addOrderBy).toHaveBeenCalledWith('articles.createdAt', 'ASC');
  });

  it('should sort by CREATED_AT_DESC by default', async () => {
    await service['getFindAllQueryBuilder']({});
    expect(mockQb.addOrderBy).toHaveBeenCalledWith('articles.createdAt', 'DESC');
  });

  it('should construct category filter using real relation metadata', async () => {
    jest.resetAllMocks();

    const mockAndWhere = jest.fn().mockReturnThis();
    const mockFrom = jest.fn().mockReturnThis();
    const mockCreateQueryBuilder = jest.fn().mockReturnValue({
      from: mockFrom,
      andWhere: mockAndWhere,
    });

    const mockRelation = {
      propertyPath: 'categories',
      junctionEntityMetadata: { tableName: 'article_categories' },
    };

    const baseArticleRepo = {
      metadata: {
        schema: 'public',
        manyToManyRelations: [mockRelation],
      },
    };

    const baseCategoryRepo = {
      metadata: {
        tablePath: 'public.categories',
      },
    };

    service = new ArticleBaseService(
      baseArticleRepo as any,
      {} as any,
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as any,
      baseCategoryRepo as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      {
        createQueryBuilder: mockCreateQueryBuilder,
      } as any,
      {} as any,
      {} as any,
    );

    const mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      andWhereExists: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue(mockQb);

    await service['getFindAllQueryBuilder']({
      requiredCategoryIds: ['cat-1', 'cat-2'],
    });

    expect(mockFrom).toHaveBeenCalledWith('public.article_categories', 'requiredCategoryRelations0');

    expect(mockFrom).toHaveBeenCalledWith('public.article_categories', 'requiredCategoryRelations1');

    expect(mockAndWhere).toHaveBeenCalledWith('"requiredCategoryRelations0"."categoryId" = :requiredCategoryId0', {
      requiredCategoryId0: 'cat-1',
    });

    expect(mockAndWhere).toHaveBeenCalledWith('"requiredCategoryRelations1"."categoryId" = :requiredCategoryId1', {
      requiredCategoryId1: 'cat-2',
    });

    expect(mockAndWhere).toHaveBeenCalledWith('"requiredCategoryRelations0"."articleId" = articles.id');

    expect(mockAndWhere).toHaveBeenCalledWith('"requiredCategoryRelations1"."articleId" = articles.id');

    expect(mockQb.andWhereExists).toHaveBeenCalled();
  });

  it('should build query with categoryIds using real relation metadata', async () => {
    const innerQb = {
      from: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    const outerQb = {
      andWhereExists: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };

    const mockRelation = {
      propertyPath: 'categories',
      junctionEntityMetadata: { tableName: 'article_categories' },
    };

    const baseArticleRepo = {
      metadata: {
        schema: 'public',
        manyToManyRelations: [mockRelation],
      },
    };

    const baseCategoryRepo = {
      metadata: {
        tablePath: 'public.categories',
      },
    };

    const dataSource = {
      createQueryBuilder: jest.fn().mockReturnValue(innerQb),
    };

    const service = new ArticleBaseService(
      baseArticleRepo as any,
      {} as any,
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as any,
      baseCategoryRepo as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      dataSource as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue(outerQb);

    await service['getFindAllQueryBuilder']({
      categoryIds: ['c1', 'c2'],
    });

    expect(dataSource.createQueryBuilder).toHaveBeenCalled();
    expect(innerQb.from).toHaveBeenCalledWith('public.article_categories', 'categoryRelations');

    expect(innerQb.andWhere).toHaveBeenCalledWith('"categoryRelations"."categoryId" IN (:...categoryIds)', {
      categoryIds: ['c1', 'c2'],
    });

    expect(innerQb.andWhere).toHaveBeenCalledWith('"categoryRelations"."articleId" = articles.id');

    expect(outerQb.andWhereExists).toHaveBeenCalledWith(innerQb);
  });

  it('should throw error if fullTextSearchMode is disabled when using FULL_TEXT search', async () => {
    const service = new ArticleBaseService(
      {
        metadata: {
          schema: 'public',
          manyToManyRelations: [],
        },
      } as any, // baseArticleRepo
      {} as any, // baseArticleVersionRepo
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as any, // baseArticleVersionContentRepo
      {
        metadata: {
          tablePath: 'public.categories',
        },
      } as any, // baseCategoryRepo
      true, // multipleLanguageMode
      false, // fullTextSearchMode = disabled
      true, // draftMode
      [], // signatureLevels
      {} as any, // signatureLevelRepo
      {} as any, // articleSignatureRepo
      true, // autoReleaseAfterApproved
      {
        createQueryBuilder: () => ({
          from: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
        }),
      } as any, // dataSource
      {} as any, // articleDataLoader
      {} as any, // signatureService
    );

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      andWhereExists: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    });

    await expect(
      service['getFindAllQueryBuilder']({
        searchTerm: 'example query',
        searchMode: ArticleSearchMode.FULL_TEXT,
      }),
    ).rejects.toThrow('Full text search is disabled.');
  });

  it('should add orWhere for tags when using TITLE_AND_TAG search mode', async () => {
    const mockOrWhere = jest.fn().mockReturnThis();

    const service = new ArticleBaseService(
      {
        metadata: {
          schema: 'public',
          manyToManyRelations: [],
        },
      } as any,
      {} as any,
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as any,
      {
        metadata: {
          tablePath: 'public.categories',
        },
      } as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true, // fullTextSearchMode
      {
        createQueryBuilder: () => ({
          from: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orWhere: mockOrWhere, // ✅ required
        }),
      } as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      andWhereExists: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    });

    const { ArticleSearchMode } = await import('../../src/typings/article-search-mode.enum');

    await service['getFindAllQueryBuilder']({
      searchTerm: 'environment',
      searchMode: ArticleSearchMode.TITLE_AND_TAG,
    });

    expect(mockOrWhere).toHaveBeenCalledWith(
      ':tagSearchTerm = ANY (SELECT LOWER(value) FROM jsonb_array_elements_text(versions.tags))',
      { tagSearchTerm: 'environment' },
    );
  });

  it('should sort by RELEASED_AT_ASC', async () => {
    const qbMock = {
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue(qbMock as any);

    await (service as any).getFindAllQueryBuilder({
      sorter: ArticleSorter.RELEASED_AT_ASC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.releasedAt', 'ASC');
  });

  it('should sort by RELEASED_AT_DESC', async () => {
    const qbMock = {
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue(qbMock as any);

    await (service as any).getFindAllQueryBuilder({
      sorter: ArticleSorter.RELEASED_AT_DESC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.releasedAt', 'DESC');
  });

  it('should sort by SUBMITTED_AT_ASC', async () => {
    const qbMock = {
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue(qbMock as any);

    await (service as any).getFindAllQueryBuilder({
      sorter: ArticleSorter.SUBMITTED_AT_ASC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.submittedAt', 'ASC');
  });

  it('should sort by SUBMITTED_AT_DESC', async () => {
    const qbMock = {
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue(qbMock as any);

    await (service as any).getFindAllQueryBuilder({
      sorter: ArticleSorter.SUBMITTED_AT_DESC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.submittedAt', 'DESC');
  });

  it('should sort by UPDATED_AT_ASC', async () => {
    const qbMock = {
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue(qbMock as any);

    await (service as any).getFindAllQueryBuilder({
      sorter: ArticleSorter.UPDATED_AT_ASC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.createdAt', 'ASC');
  });

  it('should sort by UPDATED_AT_DESC', async () => {
    const qbMock = {
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    jest.spyOn(service as any, 'getDefaultQueryBuilder').mockReturnValue(qbMock as any);

    await (service as any).getFindAllQueryBuilder({
      sorter: ArticleSorter.UPDATED_AT_DESC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.createdAt', 'DESC');
  });
});

describe('optionsCheck', () => {
  let service: any;

  const mockSignatureService = {
    signatureEnabled: true,
    finalSignatureLevel: {
      name: 'FINAL',
    },
  };

  beforeEach(() => {
    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      true,
      true,
      true, // draftMode
      [], // signatureLevels
      {} as any,
      {} as any,
      true, // autoReleaseAfterApproved
      {} as any,
      {} as any,
      mockSignatureService as any,
    );
  });

  it('should throw if submitted and signatureLevel are both set', () => {
    expect(() =>
      service['optionsCheck']({
        submitted: true,
        signatureLevel: 'FINAL',
      }),
    ).toThrow('Signature level is not allowed when submitting an article version.');
  });

  it('should throw if submitted and releasedAt are both set', () => {
    expect(() =>
      service['optionsCheck']({
        submitted: true,
        releasedAt: new Date(),
      }),
    ).toThrow('Released at is not allowed when submitting an article version.');
  });

  it('should throw if releasedAt is set with non-final signature level', () => {
    expect(() =>
      service['optionsCheck']({
        releasedAt: new Date(),
        signatureLevel: 'NOT_FINAL',
      }),
    ).toThrow('Only final signature level is allowed when releasing an article version.');
  });

  it('should throw if submitted is true but signature mode is disabled', () => {
    service.signatureService.signatureEnabled = false;

    expect(() =>
      service['optionsCheck']({
        submitted: true,
      }),
    ).toThrow('Signature mode is disabled.');
  });

  it('should throw if releasedAt is set and draftMode is disabled', () => {
    service.draftMode = false;

    expect(() =>
      service['optionsCheck']({
        releasedAt: new Date(),
        signatureLevel: 'FINAL',
      }),
    ).toThrow('Draft mode is disabled.');
  });

  it('should not throw if only submitted is set and signature mode is enabled', () => {
    service.signatureService = {
      ...service.signatureService,
      signatureEnabled: true,
    };

    expect(() =>
      service['optionsCheck']({
        submitted: true,
      }),
    ).not.toThrow();
  });

  it('should not throw if releasedAt is set with final signature level and draft mode enabled', () => {
    expect(() =>
      service['optionsCheck']({
        releasedAt: new Date(),
        signatureLevel: 'FINAL',
      }),
    ).not.toThrow();
  });

  it('should not throw if no restricted options are set', () => {
    expect(() =>
      service['optionsCheck']({
        submitted: false,
      }),
    ).not.toThrow();
  });
});
