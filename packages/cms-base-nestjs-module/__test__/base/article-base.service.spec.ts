import { Test, TestingModule } from '@nestjs/testing';
import { ArticleBaseService } from '../../src/services/article-base.service';
import { DataSource, Repository } from 'typeorm';
import {
  ARTICLE_SIGNATURE_SERVICE,
  DRAFT_MODE,
  ENABLE_SIGNATURE_MODE,
  FULL_TEXT_SEARCH_MODE,
  MULTIPLE_LANGUAGE_MODE,
  RESOLVED_ARTICLE_REPO,
  RESOLVED_ARTICLE_VERSION_CONTENT_REPO,
  RESOLVED_ARTICLE_VERSION_REPO,
  RESOLVED_CATEGORY_REPO,
} from '../../src/typings/cms-base-providers';
import { ArticleFindVersionType } from '../../src/typings/article-find-version-type.enum';
import { ArticleSignatureResult } from '../../src/typings/article-signature-result.enum';

describe('ArticleBaseService (getDefaultQueryBuilder)', () => {
  let service: ArticleBaseService<any, any, any>;
  let mockRepo: Partial<Repository<any>>;

  let module: TestingModule;

  beforeEach(async () => {
    mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn(),
      }),
    };
  });

  it('should use default alias "articles" when no alias is passed', async () => {
    module = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: mockRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: false },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    const qb = service['getDefaultQueryBuilder']();

    expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('articles');
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      'articles.categories',
      'categories',
    );
  });

  it('should create a query builder with expected joins', async () => {
    module = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: mockRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: false },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    const qb = service['getDefaultQueryBuilder']('articles');

    expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('articles');
    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      'articles.categories',
      'categories',
    );

    expect(qb.innerJoinAndSelect).toHaveBeenCalledWith(
      'articles.versions',
      'versions',
    );

    expect(qb.innerJoinAndSelect).toHaveBeenCalledWith(
      'versions.multiLanguageContents',
      'multiLanguageContents',
    );

    expect(qb.innerJoin).toHaveBeenCalledWith(
      expect.any(Function),
      'target',
      'target.version = versions.version AND target."articleId" = versions."articleId"',
    );
  });

  it('should build a subquery with only base select logic and no filters when no options and modes are active', async () => {
    module = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: mockRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: false },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    const qb = service['getDefaultQueryBuilder']('articles');

    const innerJoinMock = qb.innerJoin as jest.Mock;

    const subQbFn = innerJoinMock.mock.calls.find(
      ([_, alias]) => alias === 'target',
    )[0];

    const mockSubQb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
    };

    expect(subQbFn).toBeDefined();
    subQbFn?.(mockSubQb);

    expect(mockSubQb.from).toHaveBeenCalledWith(
      expect.any(Function),
      'versions',
    );

    expect(mockSubQb.select).toHaveBeenCalledWith(
      'versions.articleId',
      'articleId',
    );

    expect(mockSubQb.addSelect).toHaveBeenCalledWith(
      'MAX(versions.version)',
      'version',
    );

    expect(mockSubQb.groupBy).toHaveBeenCalledWith('versions.articleId');

    expect(mockSubQb.andWhere).not.toHaveBeenCalled();
    expect(mockSubQb.innerJoin).not.toHaveBeenCalled();
  });

  it('should add releasedAt condition in subquery when draftMode is true and versionType is RELEASED', async () => {
    module = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: mockRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: true },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    const qb = service['getDefaultQueryBuilder']('articles', {
      versionType: ArticleFindVersionType.RELEASED,
    });

    const innerJoinMock = qb.innerJoin as jest.Mock;
    const subQb = innerJoinMock.mock.calls.find(
      ([_, alias]) => alias === 'target',
    )[0];

    const mockSubQb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
    };

    expect(subQb).toBeDefined();
    subQb?.(mockSubQb);

    expect(mockSubQb.andWhere).toHaveBeenCalledWith(
      'versions.releasedAt IS NOT NULL',
    );
  });

  it('should log a debug message and apply signatureLevel filter in subquery when both onlyApproved and signatureLevel are provided in signatureMode', async () => {
    const loggerMock = {
      debug: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: mockRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: true },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: false },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    (service as any).logger = loggerMock;

    const qb = service['getDefaultQueryBuilder']('articles', {
      onlyApproved: true,
      signatureLevel: 'test',
    });

    const innerJoinMock = qb.innerJoin as jest.Mock;
    const subQb = innerJoinMock.mock.calls.find(
      ([_, alias]) => alias === 'target',
    )[0];

    const mockSubQb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
    };

    expect(subQb).toBeDefined();
    subQb?.(mockSubQb);

    expect(loggerMock.debug).toHaveBeenCalledWith(
      'When signature level provided with onlyApproved, only signature level will be used.',
    );

    expect(mockSubQb.innerJoin).toHaveBeenCalledWith(
      'versions.signatures',
      'signatures',
    );

    expect(mockSubQb.andWhere).toHaveBeenCalledWith(
      'signatures.result = :result',
      {
        result: ArticleSignatureResult.APPROVED,
      },
    );

    expect(mockSubQb.andWhere).toHaveBeenCalledWith(
      'signatures.signatureLevelId = :signatureLevelId',
      {
        signatureLevelId: 'test',
      },
    );
  });

  it('should apply signatureLevel filter in subquery when only signatureLevel is provided in signatureMode', async () => {
    module = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: mockRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: true },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: false },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    const qb = service['getDefaultQueryBuilder']('articles', {
      signatureLevel: 'test',
    });

    const innerJoinMock = qb.innerJoin as jest.Mock;
    const subQb = innerJoinMock.mock.calls.find(
      ([_, alias]) => alias === 'target',
    )[0];

    const mockSubQb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
    };

    expect(subQb).toBeDefined();
    subQb?.(mockSubQb);

    expect(mockSubQb.innerJoin).toHaveBeenCalledWith(
      'versions.signatures',
      'signatures',
    );

    expect(mockSubQb.andWhere).toHaveBeenCalledWith(
      'signatures.result = :result',
      {
        result: ArticleSignatureResult.APPROVED,
      },
    );

    expect(mockSubQb.andWhere).toHaveBeenCalledWith(
      'signatures.signatureLevelId = :signatureLevelId',
      {
        signatureLevelId: 'test',
      },
    );
  });

  it('should apply IS NULL filter on signatureLevel when finalSignatureLevel is not available and onlyApproved is true in signatureMode', async () => {
    class MockSignatureServiceNoFinalLevel {
      signatureLevelsCache = [];

      get finalSignatureLevel() {
        return null;
      }
    }

    module = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: mockRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: true },
        {
          provide: ARTICLE_SIGNATURE_SERVICE,
          useValue: new MockSignatureServiceNoFinalLevel(),
        },
        { provide: DRAFT_MODE, useValue: false },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    const qb = service['getDefaultQueryBuilder']('articles', {
      onlyApproved: true,
    });

    const innerJoinMock = qb.innerJoin as jest.Mock;
    const subQb = innerJoinMock.mock.calls.find(
      ([_, alias]) => alias === 'target',
    )[0];

    const mockSubQb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
    };

    expect(subQb).toBeDefined();
    subQb?.(mockSubQb);

    expect(mockSubQb.innerJoin).toHaveBeenCalledWith(
      'versions.signatures',
      'signatures',
    );

    expect(mockSubQb.andWhere).toHaveBeenCalledWith(
      'signatures.result = :result',
      {
        result: ArticleSignatureResult.APPROVED,
      },
    );

    expect(mockSubQb.andWhere).toHaveBeenCalledWith(
      'signatures.signatureLevelId IS NULL',
    );
  });

  it('should apply finalSignatureLevel.id as signatureLevel filter when onlyApproved is true and signatureLevel is not provided in signatureMode', async () => {
    class MockArticleSignatureService {
      signatureLevelsCache = [{ id: 'testA' }];

      get finalSignatureLevel() {
        return (
          this.signatureLevelsCache[this.signatureLevelsCache.length - 1] ??
          null
        );
      }
    }

    module = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: mockRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: true },
        {
          provide: ARTICLE_SIGNATURE_SERVICE,
          useValue: new MockArticleSignatureService(),
        },
        { provide: DRAFT_MODE, useValue: false },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    const qb = service['getDefaultQueryBuilder']('articles', {
      onlyApproved: true,
    });

    const innerJoinMock = qb.innerJoin as jest.Mock;
    const subQb = innerJoinMock.mock.calls.find(
      ([_, alias]) => alias === 'target',
    )[0];

    const mockSubQb = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
    };

    expect(subQb).toBeDefined();
    subQb?.(mockSubQb);

    expect(mockSubQb.innerJoin).toHaveBeenCalledWith(
      'versions.signatures',
      'signatures',
    );

    expect(mockSubQb.andWhere).toHaveBeenCalledWith(
      'signatures.result = :result',
      {
        result: ArticleSignatureResult.APPROVED,
      },
    );

    expect(mockSubQb.andWhere).toHaveBeenCalledWith(
      'signatures.signatureLevelId = :signatureLevelId',
      {
        signatureLevelId: 'testA',
      },
    );
  });
});
