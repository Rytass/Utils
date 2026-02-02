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
import {
  TestableArticleBaseService,
  MockRepositoryForService,
  MockServiceDataSource,
  MockServiceDataLoader,
  MockUtilsRepository,
  MockUtilsQueryRunner,
  MockQueryBuilder,
} from '../typings/mock-types.interface';
import { MockSignatureService } from '../typings/mock-repository.interface';
import { ArticleSearchMode } from '../../src/typings/article-search-mode.enum';
import { ArticleSorter } from '../../src/typings/article-sorter.enum';
import { BaseSignatureLevelEntity } from '../../src/models/base-signature-level.entity';

describe('queryStagesFeaturesCheck', () => {
  let service: ArticleBaseService;
  let mockSignatureService: MockSignatureService;

  class MockSignatureService {
    private _enabled = true;

    setEnabled(value: boolean): void {
      this._enabled = value;
    }

    get signatureEnabled(): boolean {
      return this._enabled;
    }
  }

  beforeEach(() => {
    mockSignatureService = new MockSignatureService();

    service = new ArticleBaseService(
      {} as MockRepositoryForService, // baseArticleRepo
      {} as MockRepositoryForService, // baseArticleVersionRepo
      {} as MockRepositoryForService, // baseArticleVersionContentRepo
      {} as MockRepositoryForService, // baseCategoryRepo
      true, // multipleLanguageMode
      true, // fullTextSearchMode
      true, // draftMode
      [], // signatureLevels
      {} as MockRepositoryForService, // signatureLevelRepo
      {} as MockRepositoryForService, // articleSignatureRepo
      true, // autoReleaseAfterApproved
      {} as MockServiceDataSource, // dataSource
      {} as MockServiceDataLoader, // articleDataLoader
      mockSignatureService as unknown as SignatureService<BaseSignatureLevelEntity>,
    );
  });

  it('should pass silently if stage is DRAFT and draftMode is enabled', () => {
    expect(() => service['queryStagesFeaturesCheck'](ArticleStage.DRAFT)).not.toThrow();
  });

  it('should throw an error if stage is DRAFT and draftMode is disabled', () => {
    service = new ArticleBaseService(
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      true,
      false, // draftMode disabled
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      mockSignatureService as unknown as SignatureService<BaseSignatureLevelEntity>,
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
  let mockSignatureService: MockSignatureService;

  beforeEach(() => {
    qb = {
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
    } as MockQueryBuilder;

    mockSignatureService = {
      finalSignatureLevel: { id: 'level-id', name: 'Final' },
    };

    service = new ArticleBaseService(
      {} as MockRepositoryForService,
      { target: 'mock_target' } as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
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
        innerJoin: jest.fn((subQueryFactory: (qb: unknown) => unknown, _alias: string, _condition: string) => {
          subQueryFactory(mockSubQueryBuilder);

          return qb;
        }),
        andWhere: jest.fn().mockReturnThis(),
      } as unknown as SelectQueryBuilder<BaseArticleEntity>;

      const mockBaseArticleVersionRepo = {
        metadata: {
          tableName: 'versions',
        },
      };

      const service = new ArticleBaseService(
        {} as MockRepositoryForService, // baseArticleRepo
        mockBaseArticleVersionRepo as MockRepositoryForService, // baseArticleVersionRepo
        {} as MockRepositoryForService, // baseArticleVersionContentRepo
        {} as MockRepositoryForService, // baseCategoryRepo
        true, // multipleLanguageMode
        true, // fullTextSearchMode
        true, // draftMode
        [], // signatureLevels
        {} as MockRepositoryForService, // signatureLevelRepo
        {} as MockRepositoryForService, // articleSignatureRepo
        true, // autoReleaseAfterApproved
        {} as MockServiceDataSource, // dataSource
        {} as MockServiceDataLoader, // articleDataLoader
        {} as MockRepositoryForService, // signatureService
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
        innerJoin: jest.fn((subQueryFactory: (qb: unknown) => unknown, _alias: string, _condition: string) => {
          subQueryFactory(mockSubQueryBuilder);

          return qb;
        }),
        andWhere: jest.fn().mockReturnThis(),
      } as unknown as SelectQueryBuilder<BaseArticleEntity>;

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
        signatureLevelRepo: {} as MockRepositoryForService,
        dataSource: {} as MockServiceDataSource,
        articleSignatureRepo: mockArticleSignatureRepo,
        reloadLevels: jest.fn(),
        findSignatureLevel: jest.fn(),
      } as unknown as SignatureService<BaseSignatureLevelEntity>;

      const service = new ArticleBaseService(
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
        true,
        true,
        true,
        [],
        {} as MockRepositoryForService,
        mockArticleSignatureRepo as MockRepositoryForService,
        true,
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
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
        innerJoin: jest.fn((fn, _alias, _condition) => {
          fn(mockSubQueryBuilder as MockQueryBuilder);

          return qb;
        }),
        andWhere: jest.fn().mockReturnThis(),
      } as MockQueryBuilder;

      const mockBaseArticleVersionRepo = {
        metadata: {
          tableName: 'versions',
        },
      };

      const service = new ArticleBaseService(
        {} as MockRepositoryForService,
        mockBaseArticleVersionRepo as MockRepositoryForService,
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
        true,
        true,
        true,
        [],
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
        true,
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
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
        innerJoin: jest.fn((fn, _alias, _condition) => {
          fn(mockSubQueryBuilder as MockQueryBuilder);

          return qb;
        }),
        andWhere: jest.fn().mockReturnThis(),
      } as MockQueryBuilder;

      const mockBaseArticleVersionRepo = {
        metadata: {
          tableName: 'versions',
        },
      };

      const service = new ArticleBaseService(
        {} as MockRepositoryForService,
        mockBaseArticleVersionRepo as MockRepositoryForService,
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
        true,
        true,
        true,
        [],
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
        true,
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
        {} as MockRepositoryForService,
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
  let mockRepo: MockUtilsRepository;
  let mockRunner: MockUtilsQueryRunner;

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
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    jest.spyOn(service as TestableArticleBaseService, 'queryStagesFeaturesCheck').mockImplementation();
    jest.spyOn(service as TestableArticleBaseService, 'limitStageWithQueryBuilder').mockImplementation(qb => qb);
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

    expect((service as TestableArticleBaseService).logger.warn).toHaveBeenCalledWith(
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
    service['getDefaultQueryBuilder']('articles', {}, mockRunner as MockUtilsQueryRunner);

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
      innerJoin: jest.fn((subQueryFn: (qb: unknown) => unknown, _alias: string, _condition: string) => {
        subQueryFn(mockSubQueryBuilder);

        return mockQueryBuilder;
      }),
    } as unknown as SelectQueryBuilder<BaseArticleEntity>;

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
      mockRepo as MockUtilsRepository, // baseArticleRepo
      mockVersionRepo as MockRepositoryForService, // baseArticleVersionRepo
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
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
  let mockQb: MockQueryBuilder;

  beforeEach(() => {
    mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      andWhereExists: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };

    service = new ArticleBaseService(
      {} as MockRepositoryForService, // baseArticleRepo
      {} as MockRepositoryForService, // baseArticleVersionRepo
      {} as MockRepositoryForService, // baseArticleVersionContentRepo
      {} as MockRepositoryForService, // baseCategoryRepo
      true, // multipleLanguageMode
      true, // allowMultipleParentCategories
      true, // allowCircularCategories
      [],
      {} as MockRepositoryForService, // baseArticleContentRepo
      {} as MockRepositoryForService, // tagRepo
      true, // fullTextSearchMode
      {} as MockServiceDataSource, // dataSource
      {} as MockRepositoryForService, // logger
      {} as MockServiceDataLoader, // articleDataLoader
    );

    jest.spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue(mockQb);
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
          cut(): string[] {
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
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as MockRepositoryForService,
      {
        metadata: { tablePath: 'public.categories', manyToManyRelations: [] },
      } as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true, // fullTextSearchMode set here
      mockDataSource as MockServiceDataSource,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    jest.spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue(mockQb);

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
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      mockBaseArticleVersionContentRepo as MockRepositoryForService,
      {
        metadata: {
          tablePath: 'public.categories',
          manyToManyRelations: [],
        },
      } as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      {
        createQueryBuilder: mockCreateQueryBuilder,
      } as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    jest.spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue(mockQb);

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

    const baseCategoryRepo = {
      metadata: {
        tablePath: 'public.categories',
      },
    };

    const mockRelation = {
      propertyPath: 'categories',
      junctionEntityMetadata: { tableName: 'article_categories', schema: 'public' },
      inverseEntityMetadata: baseCategoryRepo.metadata,
    };

    const baseArticleRepo = {
      metadata: {
        schema: 'public',
        manyToManyRelations: [mockRelation],
      },
    };

    service = new ArticleBaseService(
      baseArticleRepo as MockRepositoryForService,
      {} as MockRepositoryForService,
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as MockRepositoryForService,
      baseCategoryRepo as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      {
        createQueryBuilder: mockCreateQueryBuilder,
      } as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    const mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      andWhereExists: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };

    jest.spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue(mockQb);

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

    const baseCategoryRepo = {
      metadata: {
        tablePath: 'public.categories',
      },
    };

    const mockRelation = {
      propertyPath: 'categories',
      junctionEntityMetadata: { tableName: 'article_categories', schema: 'public' },
      inverseEntityMetadata: baseCategoryRepo.metadata,
    };

    const baseArticleRepo = {
      metadata: {
        schema: 'public',
        manyToManyRelations: [mockRelation],
      },
    };

    const dataSource = {
      createQueryBuilder: jest.fn().mockReturnValue(innerQb),
    };

    const service = new ArticleBaseService(
      baseArticleRepo as MockRepositoryForService,
      {} as MockRepositoryForService,
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as MockRepositoryForService,
      baseCategoryRepo as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      dataSource as MockServiceDataSource,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    jest.spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue(outerQb);

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

  it('should handle undefined schema in requiredCategoryIds filter', async () => {
    jest.resetAllMocks();

    const mockAndWhere = jest.fn().mockReturnThis();
    const mockFrom = jest.fn().mockReturnThis();
    const mockCreateQueryBuilder = jest.fn().mockReturnValue({
      from: mockFrom,
      andWhere: mockAndWhere,
    });

    const baseCategoryRepo = {
      metadata: {
        tablePath: 'categories',
      },
    };

    const mockRelation = {
      propertyPath: 'categories',
      junctionEntityMetadata: { tableName: 'article_categories' }, // no schema
      inverseEntityMetadata: baseCategoryRepo.metadata,
    };

    const baseArticleRepo = {
      metadata: {
        schema: undefined, // no schema
        manyToManyRelations: [mockRelation],
      },
    };

    service = new ArticleBaseService(
      baseArticleRepo as MockRepositoryForService,
      {} as MockRepositoryForService,
      {
        metadata: {
          schema: undefined,
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as MockRepositoryForService,
      baseCategoryRepo as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      {
        createQueryBuilder: mockCreateQueryBuilder,
      } as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    const mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      andWhereExists: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };

    jest.spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue(mockQb);

    await service['getFindAllQueryBuilder']({
      requiredCategoryIds: ['cat-1'],
    });

    // Should use 'article_categories' without schema prefix (not 'undefined.article_categories')
    expect(mockFrom).toHaveBeenCalledWith('article_categories', 'requiredCategoryRelations0');
  });

  it('should handle undefined schema in categoryIds filter', async () => {
    const innerQb = {
      from: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    const outerQb = {
      andWhereExists: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };

    const baseCategoryRepo = {
      metadata: {
        tablePath: 'categories',
      },
    };

    const mockRelation = {
      propertyPath: 'categories',
      junctionEntityMetadata: { tableName: 'article_categories' }, // no schema
      inverseEntityMetadata: baseCategoryRepo.metadata,
    };

    const baseArticleRepo = {
      metadata: {
        schema: undefined, // no schema
        manyToManyRelations: [mockRelation],
      },
    };

    const dataSource = {
      createQueryBuilder: jest.fn().mockReturnValue(innerQb),
    };

    const service = new ArticleBaseService(
      baseArticleRepo as MockRepositoryForService,
      {} as MockRepositoryForService,
      {
        metadata: {
          schema: undefined,
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as MockRepositoryForService,
      baseCategoryRepo as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      dataSource as MockServiceDataSource,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    jest.spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue(outerQb);

    await service['getFindAllQueryBuilder']({
      categoryIds: ['c1', 'c2'],
    });

    expect(dataSource.createQueryBuilder).toHaveBeenCalled();
    // Should use 'article_categories' without schema prefix (not 'undefined.article_categories')
    expect(innerQb.from).toHaveBeenCalledWith('article_categories', 'categoryRelations');
  });

  it('should handle undefined schema in FULL_TEXT search', async () => {
    jest.resetModules();
    jest.doMock('@node-rs/jieba', () => ({
      __esModule: true,
      default: {
        Jieba: class MockJieba {
          cut(): string[] {
            return ['test'];
          }
        },
      },
    }));

    const mockFrom = jest.fn().mockReturnThis();
    const mockCreateQueryBuilder = jest.fn().mockReturnValue({
      from: mockFrom,
      andWhere: jest.fn().mockReturnThis(),
    });

    const mockDataSource = {
      createQueryBuilder: mockCreateQueryBuilder,
    };

    service = new ArticleBaseService(
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      {
        metadata: {
          schema: undefined, // no schema
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as MockRepositoryForService,
      {
        metadata: { tablePath: 'categories', manyToManyRelations: [] },
      } as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      mockDataSource as MockServiceDataSource,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    jest.spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue(mockQb);

    await service['getFindAllQueryBuilder']({
      searchTerm: 'test',
      searchMode: ArticleSearchMode.FULL_TEXT,
    });

    // Should use 'contents' without schema prefix (not 'undefined.contents')
    expect(mockFrom).toHaveBeenCalledWith('contents', 'contents');
  });

  it('should handle undefined schema in TITLE search', async () => {
    const mockFrom = jest.fn().mockReturnThis();
    const mockCreateQueryBuilder = jest.fn().mockReturnValue({
      from: mockFrom,
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
    });

    const mockBaseArticleVersionContentRepo = {
      metadata: {
        schema: undefined, // no schema
        tableName: 'contents',
        targetName: 'ArticleVersionContent',
      },
    };

    service = new ArticleBaseService(
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      mockBaseArticleVersionContentRepo as MockRepositoryForService,
      {
        metadata: {
          tablePath: 'categories',
          manyToManyRelations: [],
        },
      } as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      {
        createQueryBuilder: mockCreateQueryBuilder,
      } as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    jest.spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue(mockQb);

    await service['getFindAllQueryBuilder']({
      searchTerm: 'test',
      searchMode: ArticleSearchMode.TITLE,
    });

    // Should use 'contents' without schema prefix (not 'undefined.contents')
    expect(mockFrom).toHaveBeenCalledWith('contents', 'contents');
  });

  it('should throw error if fullTextSearchMode is disabled when using FULL_TEXT search', async () => {
    const service = new ArticleBaseService(
      {
        metadata: {
          schema: 'public',
          manyToManyRelations: [],
        },
      } as MockRepositoryForService, // baseArticleRepo
      {} as MockRepositoryForService, // baseArticleVersionRepo
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as MockRepositoryForService, // baseArticleVersionContentRepo
      {
        metadata: {
          tablePath: 'public.categories',
        },
      } as MockRepositoryForService, // baseCategoryRepo
      true, // multipleLanguageMode
      false, // fullTextSearchMode = disabled
      true, // draftMode
      [], // signatureLevels
      {} as MockRepositoryForService, // signatureLevelRepo
      {} as MockRepositoryForService, // articleSignatureRepo
      true, // autoReleaseAfterApproved
      {
        createQueryBuilder: () => ({
          from: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
        }),
      } as MockRepositoryForService, // dataSource
      {} as MockServiceDataLoader, // articleDataLoader
      {} as MockRepositoryForService, // signatureService
    );

    jest.spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue({
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
      } as MockRepositoryForService,
      {} as MockRepositoryForService,
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as MockRepositoryForService,
      {
        metadata: {
          tablePath: 'public.categories',
        },
      } as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true, // fullTextSearchMode
      {
        createQueryBuilder: () => {
          const qb = {
            from: jest.fn().mockReturnThis(),
            orWhere: mockOrWhere,
          } as unknown as MockQueryBuilder;

          qb.andWhere = jest.fn().mockImplementation((condition: unknown) => {
            if (
              condition &&
              typeof condition === 'object' &&
              'whereFactory' in condition &&
              typeof (condition as { whereFactory: unknown }).whereFactory === 'function'
            ) {
              (condition as { whereFactory: (qb: MockQueryBuilder) => void }).whereFactory(qb);
            }

            return qb;
          });

          return qb;
        },
      } as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    jest.spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue({
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

    jest
      .spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder')
      .mockReturnValue(qbMock as MockQueryBuilder);

    await (service as TestableArticleBaseService).getFindAllQueryBuilder({
      sorter: ArticleSorter.RELEASED_AT_ASC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.releasedAt', 'ASC');
  });

  it('should sort by RELEASED_AT_DESC', async () => {
    const qbMock = {
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    jest
      .spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder')
      .mockReturnValue(qbMock as MockQueryBuilder);

    await (service as TestableArticleBaseService).getFindAllQueryBuilder({
      sorter: ArticleSorter.RELEASED_AT_DESC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.releasedAt', 'DESC');
  });

  it('should sort by SUBMITTED_AT_ASC', async () => {
    const qbMock = {
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    jest
      .spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder')
      .mockReturnValue(qbMock as MockQueryBuilder);

    await (service as TestableArticleBaseService).getFindAllQueryBuilder({
      sorter: ArticleSorter.SUBMITTED_AT_ASC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.submittedAt', 'ASC');
  });

  it('should sort by SUBMITTED_AT_DESC', async () => {
    const qbMock = {
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    jest
      .spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder')
      .mockReturnValue(qbMock as MockQueryBuilder);

    await (service as TestableArticleBaseService).getFindAllQueryBuilder({
      sorter: ArticleSorter.SUBMITTED_AT_DESC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.submittedAt', 'DESC');
  });

  it('should sort by UPDATED_AT_ASC', async () => {
    const qbMock = {
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    jest
      .spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder')
      .mockReturnValue(qbMock as MockQueryBuilder);

    await (service as TestableArticleBaseService).getFindAllQueryBuilder({
      sorter: ArticleSorter.UPDATED_AT_ASC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.createdAt', 'ASC');
  });

  it('should sort by UPDATED_AT_DESC', async () => {
    const qbMock = {
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    jest
      .spyOn(service as TestableArticleBaseService, 'getDefaultQueryBuilder')
      .mockReturnValue(qbMock as MockQueryBuilder);

    await (service as TestableArticleBaseService).getFindAllQueryBuilder({
      sorter: ArticleSorter.UPDATED_AT_DESC,
    });

    expect(qbMock.addOrderBy).toHaveBeenCalledWith('versions.createdAt', 'DESC');
  });

  it('should handle ChildEntity inheritance where metadata objects differ but tableName matches', async () => {
    // This test simulates the Single Table Inheritance (ChildEntity) scenario
    // where relation.inverseEntityMetadata points to the parent entity metadata
    // but baseCategoryRepo.metadata points to the child entity metadata
    // They are different object references but share the same tableName

    const mockFrom = jest.fn().mockReturnThis();
    const mockAndWhere = jest.fn().mockReturnThis();
    const mockCreateQueryBuilder = jest.fn().mockReturnValue({
      from: mockFrom,
      andWhere: mockAndWhere,
    });

    // Parent entity metadata (used in relation.inverseEntityMetadata)
    const parentCategoryMetadata = {
      tablePath: 'public.categories',
      tableName: 'categories', // Same tableName
    };

    // Child entity metadata (used in baseCategoryRepo.metadata)
    const childCategoryMetadata = {
      tablePath: 'public.categories',
      tableName: 'categories', // Same tableName, but different object reference
    };

    const mockRelation = {
      propertyPath: 'categories',
      junctionEntityMetadata: { tableName: 'article_categories', schema: 'public' },
      inverseEntityMetadata: parentCategoryMetadata, // Points to parent
    };

    const baseArticleRepo = {
      metadata: {
        schema: 'public',
        manyToManyRelations: [mockRelation],
      },
    };

    const baseCategoryRepo = {
      metadata: childCategoryMetadata, // Points to child (different object)
    };

    const localService = new ArticleBaseService(
      baseArticleRepo as MockRepositoryForService,
      {} as MockRepositoryForService,
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as MockRepositoryForService,
      baseCategoryRepo as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      {
        createQueryBuilder: mockCreateQueryBuilder,
      } as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    const mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      andWhereExists: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };

    jest.spyOn(localService as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue(mockQb);

    await localService['getFindAllQueryBuilder']({
      categoryIds: ['cat-1'],
    });

    // Should correctly find the junction table using tableName comparison
    expect(mockFrom).toHaveBeenCalledWith('public.article_categories', 'categoryRelations');
    expect(mockAndWhere).toHaveBeenCalledWith('"categoryRelations"."categoryId" IN (:...categoryIds)', {
      categoryIds: ['cat-1'],
    });
  });

  it('should use fallback table name when relation metadata is not found', async () => {
    const mockFrom = jest.fn().mockReturnThis();
    const mockAndWhere = jest.fn().mockReturnThis();
    const mockCreateQueryBuilder = jest.fn().mockReturnValue({
      from: mockFrom,
      andWhere: mockAndWhere,
    });

    // No matching relation (manyToManyRelations is empty)
    const baseArticleRepo = {
      metadata: {
        schema: undefined,
        manyToManyRelations: [],
      },
    };

    const baseCategoryRepo = {
      metadata: {
        tablePath: 'categories',
        tableName: 'categories',
      },
    };

    const localService = new ArticleBaseService(
      baseArticleRepo as MockRepositoryForService,
      {} as MockRepositoryForService,
      {
        metadata: {
          schema: undefined,
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as MockRepositoryForService,
      baseCategoryRepo as MockRepositoryForService,
      true,
      true,
      true,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      {
        createQueryBuilder: mockCreateQueryBuilder,
      } as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
    );

    const mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      andWhereExists: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };

    jest.spyOn(localService as TestableArticleBaseService, 'getDefaultQueryBuilder').mockReturnValue(mockQb);

    await localService['getFindAllQueryBuilder']({
      categoryIds: ['cat-1'],
    });

    // Should use fallback 'article_categories' when relation is not found
    expect(mockFrom).toHaveBeenCalledWith('article_categories', 'categoryRelations');
  });
});

describe('optionsCheck', () => {
  let service: TestableArticleBaseService;

  const mockSignatureService = {
    signatureEnabled: true,
    finalSignatureLevel: {
      name: 'FINAL',
    },
  };

  beforeEach(() => {
    service = new ArticleBaseService(
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true,
      true,
      true, // draftMode
      [], // signatureLevels
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      true, // autoReleaseAfterApproved
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      mockSignatureService as MockSignatureService,
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
