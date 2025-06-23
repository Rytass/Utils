import { BadRequestException } from '@nestjs/common';
import {
  ArticleBaseService,
  ArticleSignatureResult,
  ArticleStage,
  BaseSignatureLevelEntity,
  RESOLVED_ARTICLE_REPO,
  RESOLVED_ARTICLE_VERSION_CONTENT_REPO,
  RESOLVED_ARTICLE_VERSION_REPO,
  RESOLVED_CATEGORY_REPO,
} from '../../src';
import {
  ArticleNotFoundError,
  ArticleVersionNotFoundError,
} from '../../src/constants/errors/article.errors';
import { CategoryNotFoundError } from '../../src/constants/errors/category.errors';
import { DataSource, EntityManager, IsNull, QueryRunner } from 'typeorm';
import { Test } from '@nestjs/testing';
import { ArticleSignatureRepo } from '../../src/models/base-article-signature.entity';
import {
  AUTO_RELEASE_AFTER_APPROVED,
  DRAFT_MODE,
  FULL_TEXT_SEARCH_MODE,
  MULTIPLE_LANGUAGE_MODE,
  RESOLVED_SIGNATURE_LEVEL_REPO,
  SIGNATURE_LEVELS,
} from '../../src/typings/cms-base-providers';

describe('ArticleBaseService - deleteVersion', () => {
  let service: ArticleBaseService;
  let mockQb: any;
  let mockRepo: any;

  beforeEach(() => {
    mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    mockRepo = {
      createQueryBuilder: jest.fn(() => mockQb),
      softRemove: jest.fn(),
    };

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
      {} as any, // placeholder, will patch below
      true,
      {} as any,
    );

    (service as any).baseArticleVersionRepo = mockRepo;
  });

  it('should throw ArticleVersionNotFoundError if version does not exist', async () => {
    mockQb.getOne.mockResolvedValue(null);

    await expect(service.deleteVersion('id-1', 1)).rejects.toThrow(
      ArticleVersionNotFoundError,
    );

    expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('versions');
    expect(mockQb.andWhere).toHaveBeenCalledTimes(2);
  });

  it('should call softRemove on the version if it exists', async () => {
    const mockVersion = { id: 'v1', articleId: 'id-1', version: 1 };

    mockQb.getOne.mockResolvedValue(mockVersion);

    await service.deleteVersion('id-1', 1);

    expect(mockRepo.softRemove).toHaveBeenCalledWith(mockVersion);
  });
});

describe('ArticleBaseService - archive', () => {
  let service: ArticleBaseService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findOne: jest.fn(),
      softDelete: jest.fn(),
    };

    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [],
      mockRepo, // baseArticleRepo
      {} as any,
      true,
      {} as any,
    );

    // Patch repo after instantiation
    (service as any).baseArticleRepo = mockRepo;
  });

  it('should throw ArticleNotFoundError if article not found', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await expect(service.archive('non-existent-id')).rejects.toThrow(
      ArticleNotFoundError,
    );

    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'non-existent-id' },
    });
  });

  it('should call softDelete if article is found', async () => {
    mockRepo.findOne.mockResolvedValue({ id: 'existing-id' });

    await service.archive('existing-id');

    expect(mockRepo.softDelete).toHaveBeenCalledWith('existing-id');
  });
});

describe('ArticleBaseService - withdraw', () => {
  let service: ArticleBaseService;
  let mockRunner: any;
  let mockDataSource: any;
  let mockBaseArticleRepo: any;

  beforeEach(() => {
    mockRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        softDelete: jest.fn(),
        update: jest.fn(),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn(() => mockRunner),
    };

    mockBaseArticleRepo = {
      findOne: jest.fn(),
      softDelete: jest.fn(),
      target: 'ArticleVersion',
    };

    service = new ArticleBaseService(
      mockBaseArticleRepo,
      {} as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [],
      mockDataSource,
      {} as any,
      true,
      {} as any,
    );

    (service as any).dataSource = mockDataSource;
    (service as any).baseArticleVersionRepo = mockBaseArticleRepo;
  });

  it('should throw if draftMode is disabled', async () => {
    (service as any).draftMode = false;

    await expect(service.withdraw('id-1')).rejects.toThrow(
      'Draft mode is disabled.',
    );
  });

  it('should withdraw article and update releasedAt to null', async () => {
    const mockReleasedArticle = {
      id: 'id-1',
      version: 3,
      releasedAt: new Date(),
    };

    const mockTargetArticle = {
      version: 2,
    };

    jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce(mockReleasedArticle) // RELEASED
      .mockResolvedValueOnce(mockTargetArticle); // VERIFIED/DRAFT

    const result = await service.withdraw('id-1');

    expect(mockRunner.connect).toHaveBeenCalled();
    expect(mockRunner.startTransaction).toHaveBeenCalled();

    expect(mockRunner.manager.softDelete).toHaveBeenNthCalledWith(
      1,
      'ArticleVersion',
      { articleId: 'id-1', version: 2 },
    );

    expect(mockRunner.manager.softDelete).toHaveBeenNthCalledWith(
      2,
      'ArticleVersion',
      expect.objectContaining({
        articleId: 'id-1',
        releasedAt: expect.any(Object), // Or use custom matcher if needed
        version: expect.any(Object),
      }),
    );

    expect(mockRunner.manager.update).toHaveBeenCalledWith(
      'ArticleVersion',
      { articleId: 'id-1', version: 3 },
      { releasedAt: null },
    );

    expect(mockRunner.commitTransaction).toHaveBeenCalled();
    expect(result.releasedAt).toBeNull();
  });

  it('should still withdraw if targetPlaceArticle not found', async () => {
    const mockReleasedArticle = {
      id: 'id-1',
      version: 3,
      releasedAt: new Date(),
    };

    jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce(mockReleasedArticle)
      .mockRejectedValueOnce(new Error('Not Found'));

    const result = await service.withdraw('id-1');

    const call = mockRunner.manager.softDelete.mock.calls[0];

    expect(call[0]).toBe('ArticleVersion');
    expect(call[1]).toEqual(
      expect.objectContaining({
        articleId: 'id-1',
        releasedAt: expect.any(Object),
        version: expect.any(Object),
      }),
    );

    expect(call[1].releasedAt._type).toBe('lessThanOrEqual');
    expect(call[1].version._type).toBe('not');
    expect(call[1].version._value).toBe(3);

    expect(mockRunner.manager.update).toHaveBeenCalledWith(
      'ArticleVersion',
      { articleId: 'id-1', version: 3 },
      { releasedAt: null },
    );

    expect(mockRunner.commitTransaction).toHaveBeenCalled();
    expect(result.releasedAt).toBeNull();
  });

  it('should rollback transaction on error', async () => {
    const mockReleasedArticle = {
      id: 'id-1',
      version: 3,
    };

    jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce(mockReleasedArticle)
      .mockRejectedValueOnce(null);

    mockRunner.manager.softDelete.mockImplementation(() => {
      throw new Error('Soft delete error');
    });

    await expect(service.withdraw('id-1')).rejects.toThrow('Soft delete error');
    expect(mockRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockRunner.release).toHaveBeenCalled();
  });

  it('should call findById with stage = VERIFIED when uncovered is undefined', async () => {
    const mockReleasedArticle = {
      id: 'id-1',
      version: 3,
      releasedAt: new Date(),
    };

    const mockTargetArticle = {
      version: 2,
    };

    // Backup and delete uncovered
    const originalUncovered = (service as any).uncovered;

    delete (service as any).uncovered;

    // Mock getter of signatureEnabled to return true
    jest.spyOn(service as any, 'signatureEnabled', 'get').mockReturnValue(true);

    const spy = jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce(mockReleasedArticle)
      .mockResolvedValueOnce(mockTargetArticle);

    const result = await service.withdraw('id-1');

    expect(spy).toHaveBeenNthCalledWith(
      2,
      'id-1',
      expect.objectContaining({
        stage: ArticleStage.VERIFIED,
      }),
    );

    // Restore uncovered to prevent side effects
    (service as any).uncovered = originalUncovered;
  });
});

describe('ArticleBaseService - release', () => {
  let service: ArticleBaseService;
  let mockRunner: any;
  let mockDataSource: any;
  let mockLogger: any;

  beforeEach(() => {
    mockRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        softRemove: jest.fn(),
        update: jest.fn(),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn(() => mockRunner),
    };

    mockLogger = {
      warn: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    service = new ArticleBaseService(
      {} as any, // baseArticleVersionRepo
      {} as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [],
      mockDataSource,
      {} as any,
      true,
      {} as any,
    );

    (service as any).logger = mockLogger;
    (service as any).dataSource = mockDataSource;
    (service as any).baseArticleVersionRepo = { target: 'ArticleVersion' };
  });

  it('should return early if article is already released', async () => {
    const releasedAt = new Date();
    const mockArticle = { id: 'id-1', version: 1, releasedAt };

    jest.spyOn(service as any, 'findById').mockResolvedValueOnce(mockArticle);

    const result = await service.release('id-1');

    expect(result.releasedAt).toEqual(releasedAt);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `Article id-1 is already released [1] at ${releasedAt}.`,
    );
  });

  it('should release the article and update releasedAt', async () => {
    const article = { id: 'id-1', version: 2, releasedAt: null };
    const shouldDelete = null;

    jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce(article) // article
      .mockRejectedValueOnce(shouldDelete); // no existing scheduled

    const result = await service.release('id-1');

    expect(mockRunner.connect).toHaveBeenCalled();
    expect(mockRunner.startTransaction).toHaveBeenCalled();

    expect(mockRunner.manager.update).toHaveBeenCalledWith(
      'ArticleVersion',
      { articleId: 'id-1', version: 2 },
      { releasedAt: expect.any(Date) },
    );

    expect(mockRunner.commitTransaction).toHaveBeenCalled();
    expect(result.releasedAt).toBeInstanceOf(Date);
  });

  it('should delete previous scheduled/released version before releasing new one', async () => {
    const article = { id: 'id-1', version: 3, releasedAt: null };
    const prev = { id: 'id-1', version: 2 };

    jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce(article) // current
      .mockResolvedValueOnce(prev); // should delete

    const result = await service.release('id-1');

    expect(mockRunner.manager.softRemove).toHaveBeenCalledWith(
      'ArticleVersion',
      { articleId: 'id-1', version: 2 },
    );

    expect(mockRunner.manager.update).toHaveBeenCalledWith(
      'ArticleVersion',
      { articleId: 'id-1', version: 3 },
      { releasedAt: expect.any(Date) },
    );

    expect(result.releasedAt).toBeInstanceOf(Date);
  });

  it('should rollback transaction on error', async () => {
    const article = { id: 'id-1', version: 4, releasedAt: null };

    jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce(article)
      .mockRejectedValueOnce(null); // no scheduled version

    mockRunner.manager.update.mockImplementation(() => {
      throw new Error('Update failed');
    });

    await expect(service.release('id-1')).rejects.toThrow('Update failed');
    expect(mockRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockRunner.release).toHaveBeenCalled();
  });

  it('should use uncovered stage if releasedAt is in the future and uncovered is defined', async () => {
    const now = new Date();
    const future = new Date(now.getTime() + 100000);

    const mockArticle = { id: 'id-1', version: 1, releasedAt: null };
    const mockOldVersion = { id: 'id-1', version: 0 };

    // Setup uncovered
    (service as any).uncovered = ArticleStage.SCHEDULED;

    jest.useFakeTimers().setSystemTime(now);

    const spy = jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce(mockArticle)
      .mockResolvedValueOnce(mockOldVersion);

    await service.release('id-1', { releasedAt: future });

    expect(spy).toHaveBeenNthCalledWith(
      2,
      'id-1',
      expect.objectContaining({
        stage: ArticleStage.SCHEDULED,
      }),
    );

    jest.useRealTimers();
  });
});

describe('ArticleBaseService - submit', () => {
  let queryRunner: any;
  let mockDataSource: any;
  let createService: (signatureEnabled: boolean) => ArticleBaseService;

  const article = {
    id: 'id-1',
    version: 1,
    submittedAt: null,
  };

  const pendingReview = {
    id: 'id-1',
    version: 0,
  };

  beforeEach(() => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        softRemove: jest.fn(),
        update: jest.fn(),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    createService = (signatureEnabled: boolean) => {
      const fakeRepo = {
        target: 'ArticleVersion',
      };

      const service = new ArticleBaseService(
        fakeRepo as any,
        {} as any,
        {} as any,
        {} as any,
        signatureEnabled,
        true,
        true,
        [],
        mockDataSource,
        {} as any,
        true,
        {} as any,
      );

      (service as any).dataSource = mockDataSource;
      (service as any).baseArticleVersionRepo = fakeRepo;

      return service;
    };
  });

  it('should throw if signature mode is disabled', async () => {
    const service = createService(false);

    await expect((service as any).submit('id-1')).rejects.toThrow(
      'Signature mode is disabled.',
    );
  });

  it('should throw if article is already submitted', async () => {
    const service = createService(true);

    jest.spyOn(service as any, 'signatureEnabled', 'get').mockReturnValue(true);

    const submittedAt = new Date();

    jest.spyOn(service as any, 'findById').mockResolvedValueOnce({
      ...article,
      submittedAt,
    });

    await expect((service as any).submit('id-1')).rejects.toThrow(
      new BadRequestException(
        `Article id-1 is already submitted [1] at ${submittedAt}.`,
      ),
    );
  });

  it('should remove existing review version and submit article', async () => {
    const service = createService(true);

    jest.spyOn(service as any, 'signatureEnabled', 'get').mockReturnValue(true);

    jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce(article)
      .mockResolvedValueOnce(pendingReview);

    await (service as any).submit('id-1', { userId: 'user-1' });

    expect(queryRunner.manager.softRemove).toHaveBeenCalledWith(
      'ArticleVersion',
      {
        articleId: 'id-1',
        version: 0,
      },
    );

    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      'ArticleVersion',
      {
        articleId: 'id-1',
        version: 1,
      },
      expect.objectContaining({
        submittedAt: expect.any(Date),
        submittedBy: 'user-1',
      }),
    );
  });

  it('should submit article even if no pending version is found', async () => {
    const service = createService(true);

    jest.spyOn(service as any, 'signatureEnabled', 'get').mockReturnValue(true);

    jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce({
        id: 'id-1',
        version: 1,
        submittedAt: null,
      })
      .mockResolvedValueOnce(null);

    await (service as any).submit('id-1', { userId: 'user-1' });

    expect(queryRunner.manager.softRemove).not.toHaveBeenCalled();
    expect(queryRunner.manager.update).toHaveBeenCalled();
  });

  it('should rollback transaction on error', async () => {
    const service = createService(true);

    jest.spyOn(service as any, 'signatureEnabled', 'get').mockReturnValue(true);

    jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce({
        id: 'id-1',
        version: 1,
        submittedAt: null,
      })
      .mockResolvedValueOnce(null);

    queryRunner.manager.update.mockRejectedValueOnce(new Error('fail'));

    await expect((service as any).submit('id-1')).rejects.toThrow('fail');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalled();
  });

  it('should submit article if pending review lookup throws', async () => {
    const service = createService(true);

    jest.spyOn(service as any, 'signatureEnabled', 'get').mockReturnValue(true);

    // First call (article by ID)
    jest
      .spyOn(service as any, 'findById')
      .mockResolvedValueOnce({
        id: 'id-1',
        version: 1,
        submittedAt: null,
      })
      // Second call (REVIEWING stage) throws
      .mockRejectedValueOnce(new Error('DB error during review check'));

    await (service as any).submit('id-1', { userId: 'user-1' });

    expect(queryRunner.manager.softRemove).not.toHaveBeenCalled();
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      'ArticleVersion',
      {
        articleId: 'id-1',
        version: 1,
      },
      expect.objectContaining({
        submittedAt: expect.any(Date),
        submittedBy: 'user-1',
      }),
    );
  });
});

describe('ArticleBaseService - addVersion', () => {
  let service: ArticleBaseService;
  let queryRunner: any;
  let mockDataSource: any;
  let mockLogger: any;

  beforeEach(() => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        softRemove: jest.fn(),
        save: jest.fn(),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    mockLogger = {
      warn: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const mockBaseArticleRepo = {
      create: jest.fn((data) => data),
      findOne: jest.fn(),
    };

    const mockBaseArticleVersionRepo = {
      create: jest.fn((data) => data),
      createQueryBuilder: jest.fn().mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ version: 2 }),
      }),
    };

    const mockBaseArticleVersionContentRepo = {
      create: jest.fn((data) => data),
    };

    const mockBaseCategoryRepo = {
      find: jest.fn(),
    };

    const mockBaseSignatureRepo = {
      find: jest.fn(),
    };

    const mockSignatureLevelRepo = {
      find: jest.fn(),
    };

    service = new ArticleBaseService(
      mockBaseArticleRepo as any,
      mockBaseArticleVersionRepo as any,
      mockBaseArticleVersionContentRepo as any,
      mockBaseCategoryRepo as any,
      mockBaseSignatureRepo as any,
      true,
      true,
      [] as any,
      mockSignatureLevelRepo as any,
      mockDataSource as any,
      true,
      mockLogger as any,
    );

    (service as any).dataSource = mockDataSource;
    (service as any).logger = mockLogger;
    (service as any).baseArticleContentRepo = mockBaseArticleVersionContentRepo;

    jest.spyOn(service as any, 'optionsCheck').mockImplementation(() => {});
  });

  it('throws if signature is not allowed', async () => {
    const options = { id: 'id-1', submitted: true, signatureLevel: 'S1' };

    await expect(service.addVersion('id-1', options as any)).rejects.toThrow(
      ArticleNotFoundError,
    );
  });

  it('throws if category not found', async () => {
    (service as any).baseCategoryRepo.find.mockResolvedValue([]);
    (service as any).baseArticleRepo.findOne.mockResolvedValue({
      id: 'id-1',
      categories: [],
    });

    await expect(
      service.addVersion('id-1', {
        id: 'id-1',
        categoryIds: ['x'],
        title: 'T',
        description: 'D',
      } as any),
    ).rejects.toThrow();
  });

  it('throws if article not found', async () => {
    (service as any).baseCategoryRepo.find.mockResolvedValue([]);
    (service as any).baseArticleRepo.findOne.mockResolvedValue(null);
    await expect(
      service.addVersion('id-1', {
        id: 'id-1',
        title: 'T',
        description: 'D',
      } as any),
    ).rejects.toThrow();
  });

  it('logs warning if article has categories but no categoryIds', async () => {
    (service as any).baseArticleRepo.findOne.mockResolvedValue({
      id: 'id-1',
      categories: ['cat'], // triggers categories.length > 0
    });

    // avoid full-text path or multi-language, just satisfy structure
    jest.spyOn(service as any, 'optionsCheck').mockImplementation(() => {});
    jest.spyOn(service, 'findById').mockResolvedValue(null);
    (service as any).baseCategoryRepo.find.mockResolvedValue([]);

    await expect(
      service.addVersion('id-1', {
        id: 'id-1',
        content: { title: 't', description: 'd' }, // keep minimal required fields
      } as any),
    ).rejects.toThrow(); // throws later due to no latestVersion, but log already happened

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('has categories'),
    );
  });

  it('throws if latest article version not found', async () => {
    Object.defineProperty(service as any, 'useMultiLanguage', {
      get: () => false,
    });

    (service as any).baseArticleRepo.findOne.mockResolvedValue({
      id: 'id-1',
      categories: [],
    });

    // Mock query builder chain and force getOne() to return null
    (service as any).baseArticleVersionRepo.createQueryBuilder = jest
      .fn()
      .mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null), // triggers the throw
      });

    await expect(
      service.addVersion('id-1', {
        id: 'id-1',
        content: {
          title: 'Title',
          description: 'Desc',
        },
      } as any),
    ).rejects.toThrow(ArticleVersionNotFoundError);
  });

  it('softRemoves previous version if placedArticle exists', async () => {
    const softRemoveMock = queryRunner.manager.softRemove;

    // Force `placedArticle` to exist
    jest.spyOn(service, 'findById').mockResolvedValue({
      id: 'id-1',
      version: 5,
    } as any);

    // Make sure article exists
    (service as any).baseArticleRepo.findOne.mockResolvedValue({
      id: 'id-1',
      categories: [],
    });

    // Mock latestVersion
    (service as any).baseArticleVersionRepo.createQueryBuilder = jest
      .fn()
      .mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ version: 6 }),
      });

    // Skip category lookup (no categoryIds)
    (service as any).baseCategoryRepo.find.mockResolvedValue([]);

    // Skip full-text search
    (service as any).bindSearchTokens = jest.fn();

    // Mock `approveVersion` to skip
    jest.spyOn(service as any, 'approveVersion').mockResolvedValue(undefined);

    const result = await service.addVersion('id-1', {
      id: 'id-1',
      title: 'Test Title',
      description: 'Test Desc',
      userId: 'u1',
      submitted: true,
    } as any);

    expect(softRemoveMock).toHaveBeenCalledWith(
      (service as any).baseArticleVersionRepo.target,
      {
        articleId: 'id-1',
        version: 5, // version from placedArticle
      },
    );
  });

  it('adds categories to article update when categoryIds are provided', async () => {
    const baseArticleRepo = (service as any).baseArticleRepo;
    const softRemoveMock = queryRunner.manager.softRemove;

    // Mock placedArticle = null (to skip softRemove)
    jest.spyOn(service, 'findById').mockResolvedValue(null);

    // Mock article found
    baseArticleRepo.findOne.mockResolvedValue({
      id: 'id-1',
      categories: [],
    });

    // Mock latest version
    (service as any).baseArticleVersionRepo.createQueryBuilder = jest
      .fn()
      .mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ version: 1 }),
      });

    // categoryIds provided, so mock categories returned
    const fakeCategories = [{ id: 'cat-1', bindable: true }];

    (service as any).baseCategoryRepo.find.mockResolvedValue(fakeCategories);

    // Spy on baseArticleRepo.create
    const createSpy = jest.spyOn(baseArticleRepo, 'create');

    // Skip token binding and approval
    jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'approveVersion').mockResolvedValue(undefined);

    await service.addVersion('id-1', {
      id: 'id-1',
      categoryIds: ['cat-1'],
      userId: 'u-1',
      submitted: true,
      title: 'Title',
      description: 'Desc',
    } as any);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: fakeCategories,
      }),
    );
  });

  it('sets releasedAt and releasedBy when draftMode is false and releasedAt not provided', async () => {
    (service as any).draftMode = false;

    jest.spyOn(service, 'findById').mockResolvedValue(null);

    (service as any).baseArticleRepo.findOne.mockResolvedValue({
      id: 'id-1',
      categories: [],
    });

    (service as any).baseArticleVersionRepo.createQueryBuilder = jest
      .fn()
      .mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ version: 1 }),
      });

    (service as any).baseCategoryRepo.find.mockResolvedValue([]);

    jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'approveVersion').mockResolvedValue(undefined);

    const createSpy = jest.spyOn(
      (service as any).baseArticleVersionRepo,
      'create',
    );

    const now = Date.now();

    jest.useFakeTimers().setSystemTime(now);

    await service.addVersion('id-1', {
      id: 'id-1',
      userId: 'user-1',
      submitted: true,
      title: 'Title',
      description: 'Desc',
    } as any);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        releasedAt: new Date(now),
        releasedBy: undefined,
      }),
    );

    jest.useRealTimers();
  });

  it('sets releasedBy to userId when releasedAt is provided', async () => {
    (service as any).draftMode = true;

    jest.spyOn(service, 'findById').mockResolvedValue(null);
    (service as any).baseArticleRepo.findOne.mockResolvedValue({
      id: 'id-1',
      categories: [],
    });

    (service as any).baseArticleVersionRepo.createQueryBuilder = jest
      .fn()
      .mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ version: 1 }),
      });

    (service as any).baseCategoryRepo.find.mockResolvedValue([]);

    jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'approveVersion').mockResolvedValue(undefined);

    const createSpy = jest.spyOn(
      (service as any).baseArticleVersionRepo,
      'create',
    );

    const releasedAt = new Date('2025-02-02T00:00:00Z');

    await service.addVersion('id-1', {
      id: 'id-1',
      title: 'T',
      description: 'D',
      releasedAt,
      userId: 'user-1',
    } as any);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        releasedAt,
        releasedBy: 'user-1',
      }),
    );
  });

  it('throws MultipleLanguageModeIsDisabledError when multiLanguageContents provided but mode is disabled', async () => {
    (service as any).multipleLanguageMode = false;

    jest.spyOn(service, 'findById').mockResolvedValue(null);
    (service as any).baseArticleRepo.findOne.mockResolvedValue({
      id: 'id-1',
      categories: [],
    });

    (service as any).baseArticleVersionRepo.createQueryBuilder = jest
      .fn()
      .mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ version: 1 }),
      });

    (service as any).baseCategoryRepo.find.mockResolvedValue([]);

    await expect(
      service.addVersion('id-1', {
        id: 'id-1',
        userId: 'user-1',
        multiLanguageContents: {
          en: { title: 'Title', description: 'Desc', content: 'C' },
        },
      } as any),
    ).rejects.toThrow('Multiple language mode is disabled');
  });

  it('calls bindSearchTokens for each saved multi-language content when fullTextSearchMode is enabled', async () => {
    (service as any).multipleLanguageMode = true;
    (service as any).fullTextSearchMode = true;

    jest.spyOn(service, 'findById').mockResolvedValue(null);
    (service as any).baseArticleRepo.findOne.mockResolvedValue({
      id: 'id-1',
      categories: [],
    });

    (service as any).baseArticleVersionRepo.createQueryBuilder = jest
      .fn()
      .mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ version: 1 }),
      });

    (service as any).baseCategoryRepo.find.mockResolvedValue([]);

    queryRunner.manager.save = jest.fn().mockImplementation((input) => {
      if (Array.isArray(input)) {
        return input.map((item) => ({ ...item }));
      }

      return input;
    });

    const bindTokenMock = jest
      .spyOn(service as any, 'bindSearchTokens')
      .mockResolvedValue(undefined);

    const createSpy = jest.spyOn(
      (service as any).baseArticleVersionContentRepo,
      'create',
    );

    await service.addVersion('id-1', {
      id: 'id-1',
      userId: 'user-1',
      multiLanguageContents: {
        en: { title: 'T1', description: 'D1', content: 'C1' },
        zh: { title: 'T2', description: 'D2', content: 'C2' },
      },
      tags: ['x'],
    } as any);

    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(bindTokenMock).toHaveBeenCalledTimes(2);
  });

  it('bindSearchTokens uses empty array when tags are not provided', async () => {
    (service as any).multipleLanguageMode = true;
    (service as any).fullTextSearchMode = true;

    jest.spyOn(service, 'findById').mockResolvedValue(null);
    (service as any).baseArticleRepo.findOne.mockResolvedValue({
      id: 'id-1',
      categories: [],
    });

    (service as any).baseArticleVersionRepo.createQueryBuilder = jest
      .fn()
      .mockReturnValue({
        withDeleted: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ version: 1 }),
      });

    (service as any).baseCategoryRepo.find.mockResolvedValue([]);

    queryRunner.manager.save = jest.fn().mockImplementation((input) => {
      if (Array.isArray(input)) {
        return input.map((item) => ({ ...item }));
      }

      return input;
    });

    const bindTokenMock = jest
      .spyOn(service as any, 'bindSearchTokens')
      .mockResolvedValue(undefined);

    await service.addVersion('id-1', {
      id: 'id-1',
      userId: 'user-1',
      multiLanguageContents: {
        en: { title: 'T1', description: 'D1', content: 'C1' },
      },
    } as any);

    expect(bindTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
      [], // fallback to empty array
      expect.any(Object),
    );
  });
});

describe('ArticleBaseService - create', () => {
  let service: ArticleBaseService;
  let queryRunner: any;
  let mockDataSource: any;
  let baseCategoryRepo: any;

  beforeEach(() => {
    baseCategoryRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn().mockImplementation((input) => {
          if (Array.isArray(input)) {
            return input.map((item) => ({
              ...item,
              articleId: item.articleId ?? 'article-1',
              version: item.version ?? 1,
              language: item.language ?? 'en',
            }));
          }

          if (input.title && !input.version) {
            return { ...input, id: 'article-1' };
          }

          if (input.version) {
            return { ...input, version: 1 };
          }

          return input;
        }),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    service = new ArticleBaseService(
      {
        create: jest.fn().mockImplementation((data) => ({ ...data })),
      } as any,
      {
        create: jest
          .fn()
          .mockImplementation((data) => ({ ...data, version: 1 })),
      } as any,
      {
        create: jest
          .fn()
          .mockImplementation((data) => ({ ...data, language: 'en' })),
      } as any,
      baseCategoryRepo,
      {} as any,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      {} as any,
    );

    (service as any).dataSource = mockDataSource;

    jest.spyOn(service as any, 'optionsCheck').mockImplementation(() => {});
    jest.spyOn(service, 'approveVersion').mockResolvedValue({
      id: 'sig-1',
      version: 1,
      result: 'APPROVED',
    } as any);

    jest.spyOn(service, 'findById').mockResolvedValue({} as any);
  });

  it('throws CategoryNotFoundError when categoryIds do not match', async () => {
    baseCategoryRepo.find.mockResolvedValue([]);
    await expect(
      service.create({
        categoryIds: ['c1'],
        title: 'T',
        description: 'D',
      } as any),
    ).rejects.toThrow(CategoryNotFoundError);
  });

  it('throws MultipleLanguageModeIsDisabledError when multiLanguageContents is provided and mode is off', async () => {
    (service as any).multipleLanguageMode = false;
    baseCategoryRepo.find.mockResolvedValue([]);

    await expect(
      service.create({
        multiLanguageContents: {
          en: { title: 'T', description: 'D', content: 'C' },
        },
      } as any),
    ).rejects.toThrow('Multiple language mode is disabled');
  });

  it('calls bindSearchTokens with empty tags when tags are not passed', async () => {
    (service as any).multipleLanguageMode = true;
    (service as any).fullTextSearchMode = true;
    baseCategoryRepo.find.mockResolvedValue([]);

    const bindSearchMock = jest
      .spyOn(service as any, 'bindSearchTokens')
      .mockResolvedValue(undefined);

    await service.create({
      userId: 'u1',
      multiLanguageContents: {
        en: { title: 'T', description: 'D', content: 'C' },
      },
    } as any);

    expect(bindSearchMock).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
      [],
      expect.any(Object),
    );
  });

  it('wraps unexpected errors in BadRequestException', async () => {
    baseCategoryRepo.find.mockImplementation(() => {
      throw new Error('DB failed');
    });

    await expect(
      service.create({ title: 'T', description: 'D' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('sets submittedAt and submittedBy when submitted is true', async () => {
    baseCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);

    jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);

    await service.create({
      submitted: true,
      userId: 'u1',
      title: 'T',
      description: 'D',
      content: 'just a dummy',
      categoryIds: ['cat-1'],
    } as any);

    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedAt: expect.any(Date),
        submittedBy: 'u1',
      }),
    );
  });

  it('sets submittedAt and submittedBy when releasedAt is provided', async () => {
    baseCategoryRepo.find.mockResolvedValue([]);

    jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);

    await service.create({
      releasedAt: new Date(),
      userId: 'u2',
      title: 'T',
      description: 'D',
      content: 'dummy',
    } as any);

    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedAt: expect.any(Date),
        submittedBy: 'u2',
      }),
    );
  });

  it('sets submittedAt and submittedBy when signatureLevel is provided', async () => {
    baseCategoryRepo.find.mockResolvedValue([]);

    jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);

    await service.create({
      signatureLevel: 'L1',
      userId: 'u3',
      title: 'T',
      description: 'D',
      content: 'mock', // dummy value
    } as any);

    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        submittedAt: expect.any(Date),
        submittedBy: 'u3',
      }),
    );
  });

  it('sets releasedAt to current date when draftMode is false', async () => {
    (service as any).draftMode = false;
    baseCategoryRepo.find.mockResolvedValue([]);

    jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);

    await service.create({
      title: 'T',
      description: 'D',
      content: 'mock',
    } as any);

    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        releasedAt: expect.any(Date),
      }),
    );
  });

  it('sets releasedBy when releasedAt is provided', async () => {
    baseCategoryRepo.find.mockResolvedValue([]);

    jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);

    await service.create({
      releasedAt: new Date(),
      userId: 'u5',
      title: 'T',
      description: 'D',
      content: 'X',
    } as any);

    expect(queryRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        releasedBy: 'u5',
      }),
    );
  });
});

describe('ArticleBaseService - rejectVersion', () => {
  let service: ArticleBaseService;

  beforeEach(() => {
    service = new ArticleBaseService(
      {} as any, // baseArticleRepo
      {} as any, // baseArticleVersionRepo
      {} as any, // baseArticleVersionContentRepo
      {} as any, // baseCategoryRepo
      {} as any, // tagService
      true, // useMultiLanguage
      true, // fullTextSearchMode
      [], // supportedLanguages
      {} as any, // dataSource
      {} as any, // eventEmitter
      true, // draftMode
      {} as any, // logger
    );

    jest.spyOn(service as any, 'signature').mockResolvedValue({
      id: 'sig-1',
      result: 'REJECTED',
    } as any);
  });

  it('calls signature with REJECTED and basic articleVersion', async () => {
    const result = await service.rejectVersion({ id: 'a1', version: 2 });

    expect((service as any).signature).toHaveBeenCalledWith(
      'REJECTED',
      { id: 'a1', version: 2 },
      undefined,
    );

    expect(result).toEqual({
      id: 'sig-1',
      result: 'REJECTED',
    });
  });

  it('calls signature with REJECTED and signatureInfo', async () => {
    const info = {
      signatureLevel: {
        id: 'lvl1',
        name: 'Level 1',
        sequence: 1,
        required: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,

      signerId: 'u1',
      reason: 'Invalid content',
      runner: {} as any,
    };

    await service.rejectVersion({ id: 'a2', version: 3 }, info);

    expect((service as any).signature).toHaveBeenCalledWith(
      'REJECTED',
      { id: 'a2', version: 3 },
      info,
    );
  });
});

describe('ArticleBaseService - approveVersion', () => {
  let service: ArticleBaseService;

  beforeEach(() => {
    service = new ArticleBaseService(
      {} as any, // baseArticleRepo
      {} as any, // baseArticleVersionRepo
      {} as any, // baseArticleVersionContentRepo
      {} as any, // baseCategoryRepo
      {} as any, // baseArticleSignatureRepo
      true, // fullTextSearchMode
      true, // multipleLanguageMode
      [], // searchableFields
      {} as any, // baseArticleSearchRepo
      {} as any, // searchService
      true, // draftMode
      {} as any, // logger
    );

    jest.spyOn(service as any, 'signature').mockResolvedValue({
      id: 'sig-123',
      result: 'APPROVED',
    } as any);
  });

  it('calls signature with APPROVED result', async () => {
    const articleVersion = { id: 'a1', version: 2 };
    const signatureInfo = {
      signatureLevel: 'level-1',
      signerId: 'user-1',
      runner: {} as any,
    };

    const result = await service.approveVersion(articleVersion, signatureInfo);

    expect((service as any).signature).toHaveBeenCalledWith(
      'APPROVED',
      articleVersion,
      signatureInfo,
    );

    expect(result).toEqual({
      id: 'sig-123',
      result: 'APPROVED',
    });
  });

  it('works with minimal info (no signatureInfo)', async () => {
    const result = await service.approveVersion({ id: 'a2', version: 5 });

    expect((service as any).signature).toHaveBeenCalledWith(
      'APPROVED',
      { id: 'a2', version: 5 },
      undefined,
    );

    expect(result).toEqual({
      id: 'sig-123',
      result: 'APPROVED',
    });
  });
});

describe('ArticleBaseService - signature', () => {
  let service: ArticleBaseService;
  let mockRunner: any;
  let mockSignatureRepo: any;
  let mockVersionRepo: any;
  let mockFindById: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    mockRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        createQueryBuilder: jest.fn().mockReturnValue({
          andWhere: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        }),
        exists: jest.fn().mockResolvedValue(true),
        update: jest.fn(),
        save: jest.fn().mockImplementation((sig) => ({ id: 'sig-id', ...sig })),
        softDelete: jest.fn(),
      },
    };

    mockSignatureRepo = {
      target: 'signatures',
      create: jest.fn((data) => data),
    };

    mockVersionRepo = {
      target: 'versions',
      exists: jest.fn().mockResolvedValue(true),
    };

    service = new ArticleBaseService(
      {} as any,
      mockVersionRepo,
      {} as any,
      {} as any,
      mockSignatureRepo,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      {} as any,
    );

    (service as any).dataSource = { createQueryRunner: () => mockRunner };
    (service as any).signatureLevels = ['L1', 'L2'];
    (service as any).articleSignatureRepo = mockSignatureRepo;
    (service as any).baseArticleVersionRepo = mockVersionRepo;

    Object.defineProperty(service as any, 'signatureLevelsCache', {
      get: () => [
        { id: 'lvl-1', name: 'L1', required: true },
        { id: 'lvl-2', name: 'L2', required: true },
      ],
    });

    Object.defineProperty(service as any, 'finalSignatureLevel', {
      get: () => ({ id: 'lvl-2', name: 'L2' }),
    });

    jest
      .spyOn(Object.getPrototypeOf(service), 'signatureEnabled', 'get')
      .mockReturnValue(true);

    mockFindById = jest
      .spyOn(service as any, 'findById')
      .mockResolvedValue({ id: 'a1', version: 0 });
  });

  it('signs an article with valid level and returns signature', async () => {
    (mockRunner.manager.createQueryBuilder as jest.Mock).mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          signatureLevelId: 'lvl-1',
          result: 'APPROVED',
          id: 'sig-1',
        },
      ]),
    });

    const result = await (service as any).signature(
      'APPROVED',
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'L2',
        signerId: 'u1',
      },
    );

    expect(result).toMatchObject({
      articleId: 'a1',
      version: 1,
      result: 'APPROVED',
      signerId: 'u1',
    });
  });

  it('throws error if signature level is not in cache', async () => {
    await expect(
      (service as any).signature(
        'APPROVED',
        { id: 'a1', version: 1 },
        {
          signatureLevel: 'INVALID',
          signerId: 'u1',
        },
      ),
    ).rejects.toThrow('Invalid signature level');
  });

  it('throws if signatureLevel is missing and multiple levels are defined', async () => {
    await expect(
      (service as any).signature(
        'APPROVED',
        { id: 'a1', version: 1 },
        {
          signerId: 'u1',
        },
      ),
    ).rejects.toThrow('Signature level is required');
  });

  it('throws error if article version does not exist', async () => {
    mockVersionRepo.exists.mockResolvedValue(false);
    await expect(
      (service as any).signature(
        'APPROVED',
        { id: 'a1', version: 1 },
        {
          signatureLevel: 'L1',
          signerId: 'u1',
        },
      ),
    ).rejects.toThrow('Invalid article version');
  });

  it('throws error when signature is already signed', async () => {
    mockRunner.manager.createQueryBuilder = jest.fn().mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          signatureLevelId: 'lvl-2',
          result: 'APPROVED',
          id: 'sig-id',
        },
      ]),
    });

    await expect(
      (service as any).signature(
        'APPROVED',
        { id: 'a1', version: 1 },
        {
          signatureLevel: 'L2',
          signerId: 'u1',
        },
      ),
    ).rejects.toThrow('Already signed');
  });

  it('throws if signature feature is disabled', async () => {
    (
      Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(service),
        'signatureEnabled',
      )?.get as jest.Mock
    ).mockReturnValue(false);

    await expect(
      (service as any).signature(
        'APPROVED',
        { id: 'a1', version: 1 },
        {
          signatureLevel: 'L2',
          signerId: 'u1',
        },
      ),
    ).rejects.toThrow('Signature is not enabled');
  });

  it('uses DRAFT stage if result is not APPROVED', async () => {
    const spy = jest.spyOn(service as any, 'findById');

    spy.mockResolvedValue({ id: 'a1', version: 1 });

    await (service as any).signature(
      'REJECTED',
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'L1',
        signerId: 'u1',
      },
    );

    expect(spy).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ stage: ArticleStage.DRAFT }),
      undefined, // <-- fix here
    );
  });

  it('uses REVIEWING stage if signatureLevel is not final level', async () => {
    jest
      .spyOn(service as any, 'findById')
      .mockResolvedValue({ id: 'a1', version: 1 });

    await (service as any).signature(
      'APPROVED',
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'L1', // not final
        signerId: 'u1',
      },
    );

    expect((service as any).findById).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ stage: ArticleStage.REVIEWING }),
      undefined, // <-- fix here
    );
  });

  it('gracefully handles exception from findById using .catch', async () => {
    // Simulate failure in findById
    jest
      .spyOn(service as any, 'findById')
      .mockRejectedValue(new Error('Unexpected DB error'));

    // Ensure getMany returns required previous APPROVED signature (e.g., level-1)
    mockRunner.manager.createQueryBuilder = jest.fn().mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          signatureLevelId: 'lvl-1',
          result: 'APPROVED',
          id: 'sig-1',
        },
      ]),
    });

    const result = await (service as any).signature(
      'APPROVED',
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'L2', // final level
        signerId: 'u1',
      },
    );

    expect(result).toMatchObject({
      articleId: 'a1',
      version: 1,
      result: 'APPROVED',
      signerId: 'u1',
    });
  });

  it('throws if article version does not exist (runner manager exists = false)', async () => {
    // Force `exists()` to return false
    mockRunner.manager.exists = jest.fn().mockResolvedValue(false);

    await expect(
      (service as any).signature(
        'APPROVED',
        { id: 'a1', version: 1 },
        {
          signatureLevel: 'L1',
          signerId: 'u1',
          runner: mockRunner, // required for .manager.exists
        },
      ),
    ).rejects.toThrow('Invalid article version');

    expect(mockRunner.manager.exists).toHaveBeenCalledWith(
      mockVersionRepo.target,
      {
        where: {
          articleId: 'a1',
          version: 1,
        },
      },
    );
  });

  it('uses level.id match when signatureLevel is instance of BaseSignatureLevelEntity', async () => {
    const mockLevel = new BaseSignatureLevelEntity();

    mockLevel.id = 'lvl-1';

    await (service as any).signature(
      'APPROVED',
      { id: 'a1', version: 1 },
      {
        signatureLevel: mockLevel,
        signerId: 'u1',
      },
    );

    // No need to assert deeply, call success is enough to cover this branch
    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        signatureLevelId: 'lvl-1',
      }),
    );
  });

  it('uses level.name match when signatureLevel is a string', async () => {
    await (service as any).signature(
      'APPROVED',
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'L1',
        signerId: 'u1',
      },
    );

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        signatureLevelId: 'lvl-1',
      }),
    );
  });

  it('uses index 0 when signatureLevel is undefined and only one level exists', async () => {
    (service as any).signatureLevels = ['L1'];

    Object.defineProperty(service as any, 'signatureLevelsCache', {
      get: () => [{ id: 'lvl-1', name: 'L1', required: true }],
    });

    await (service as any).signature(
      'APPROVED',
      { id: 'a1', version: 1 },
      {
        signerId: 'u1',
      },
    );

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        signatureLevelId: 'lvl-1',
      }),
    );
  });

  it('soft deletes existing rejected signature', async () => {
    const softDeleteMock = jest.spyOn(mockRunner.manager, 'softDelete');

    (mockRunner.manager.createQueryBuilder as jest.Mock).mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { signatureLevelId: 'lvl-1', result: 'APPROVED', id: 'sig-1' },
        { signatureLevelId: 'lvl-2', result: 'REJECTED', id: 'sig-id' },
      ]),
    });

    await (service as any).signature(
      'APPROVED',
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'L2',
        signerId: 'u1',
      },
    );

    expect(softDeleteMock).toHaveBeenCalledWith('signatures', {
      id: 'sig-id',
    });
  });

  it('throws if already signed with APPROVED', async () => {
    (mockRunner.manager.createQueryBuilder as jest.Mock).mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          signatureLevelId: 'lvl-2',
          result: 'APPROVED',
          id: 'sig-id',
        },
      ]),
    });

    await expect(
      (service as any).signature(
        'APPROVED',
        { id: 'a1', version: 1 },
        {
          signatureLevel: 'L2',
          signerId: 'u1',
        },
      ),
    ).rejects.toThrow('Already signed');
  });

  it('throws if previous signature is not APPROVED', async () => {
    (mockRunner.manager.createQueryBuilder as jest.Mock).mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { signatureLevelId: 'lvl-1', result: 'REJECTED', id: 'sig-1' },
        // no level-2 signature yet
      ]),
    });

    await expect(
      (service as any).signature(
        'APPROVED',
        { id: 'a1', version: 1 },
        {
          signatureLevel: 'L2',
          signerId: 'u1',
        },
      ),
    ).rejects.toThrow('Previous valid signature not found');
  });

  it('throws if previous required signature is missing in map', async () => {
    (mockRunner.manager.createQueryBuilder as jest.Mock).mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        // Missing lvl-1 completely — will trigger map miss
        {
          signatureLevelId: 'lvl-2',
          result: 'REJECTED', // rejected or anything non-approved
          id: 'sig-2',
        },
      ]),
    });

    await expect(
      (service as any).signature(
        'APPROVED',
        { id: 'a1', version: 1 },
        {
          signatureLevel: 'L2',
          signerId: 'u1',
        },
      ),
    ).rejects.toThrow('Previous valid signature not found');
  });

  it('sets signerId to null if undefined', async () => {
    (mockRunner.manager.createQueryBuilder as jest.Mock).mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]), // simulate no previous signatures
    });

    await (service as any).signature(
      'REJECTED',
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'L1',
        // signerId intentionally left out
      },
    );

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        signerId: null,
      }),
    );
  });

  it('sets rejectReason if result is REJECTED', async () => {
    (mockRunner.manager.createQueryBuilder as jest.Mock).mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });

    await (service as any).signature(
      'REJECTED',
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'L1',
        signerId: 'u1',
        reason: 'Invalid content',
      },
    );

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'REJECTED',
        rejectReason: 'Invalid content',
      }),
    );
  });

  it('throws "Already signed" if targetLevelIndex is NaN and signatures exist', async () => {
    // valid level, but we override the index to simulate NaN
    const info = {
      signerId: 'u1',
      signatureLevel: 'L1',
    };

    Object.defineProperty(service as any, 'signatureLevelsCache', {
      get: () => ({
        findIndex: () => NaN, // Force NaN so that first block is skipped
        slice: () => [],
      }),
    });

    (mockRunner.manager.createQueryBuilder as jest.Mock).mockReturnValue({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([{ signatureLevelId: 'whatever', result: null }]),
    });

    await expect(
      (service as any).signature('APPROVED', { id: 'a1', version: 1 }, info),
    ).rejects.toThrow('Already signed');
  });

  it('creates signature when targetLevelIndex is NaN and no existing signatures (fallback path)', async () => {
    class DummyLevel extends BaseSignatureLevelEntity {}
    const dummyLevel = new DummyLevel();

    dummyLevel.id = 'dummy-id';

    dummyLevel.name = 'DUMMY';

    Object.defineProperty(service, 'signatureLevelsCache', {
      get: () => {
        const fakeArr: any = [];

        fakeArr.findIndex = () => NaN;
        fakeArr.slice = () => [];
        fakeArr[NaN] = dummyLevel;

        return fakeArr;
      },
      configurable: true,
    });

    jest
      .spyOn(Object.getPrototypeOf(service), 'finalSignatureLevel', 'get')
      .mockReturnValue(dummyLevel);

    (service as any).baseArticleVersionRepo = { target: 'mock_versions_table' };
    (service as any).autoReleaseAfterApproved = false;
    (service as any).draftMode = false;

    const result = await (service as any).signature(
      ArticleSignatureResult.REJECTED,
      { id: 'article-1', version: 1 },
      {
        signerId: 'user-1',
        reason: 'fallback test',
        runner: mockRunner,
        signatureLevel: dummyLevel,
      },
    );

    expect(mockSignatureRepo.create).toHaveBeenCalledWith({
      articleId: 'article-1',
      version: 1,
      result: ArticleSignatureResult.REJECTED,
      signerId: 'user-1',
      rejectReason: 'fallback test',
    });

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: 'article-1',
        version: 1,
        result: ArticleSignatureResult.REJECTED,
        signerId: 'user-1',
        rejectReason: 'fallback test',
      }),
    );

    expect(result).toMatchObject({
      articleId: 'article-1',
      version: 1,
      result: ArticleSignatureResult.REJECTED,
      signerId: 'user-1',
      rejectReason: 'fallback test',
    });
  });

  describe('ArticleBaseService - signature (edge cases)', () => {
    class DummyLevel extends BaseSignatureLevelEntity {}
    const dummyLevel = new DummyLevel();

    dummyLevel.id = 'dummy-id';
    dummyLevel.name = 'DUMMY';

    beforeEach(() => {
      Object.defineProperty(service, 'signatureLevelsCache', {
        get: () => {
          const arr: any = [];

          arr.findIndex = () => NaN;
          arr.slice = () => [];
          arr[NaN] = dummyLevel;

          return arr;
        },
        configurable: true,
      });

      jest
        .spyOn(Object.getPrototypeOf(service), 'finalSignatureLevel', 'get')
        .mockReturnValue(dummyLevel);

      (service as any).baseArticleVersionRepo = {
        target: 'mock_versions_table',
      };

      (service as any).autoReleaseAfterApproved = false;
      (service as any).draftMode = false;
    });

    it('falls back to null for undefined signerId', async () => {
      const result = await (service as any).signature(
        ArticleSignatureResult.REJECTED,
        { id: 'article-1', version: 1 },
        {
          reason: 'rejected without signer',
          runner: mockRunner,
          signatureLevel: dummyLevel,
        },
      );

      expect(mockSignatureRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          signerId: null,
        }),
      );

      expect(result).toMatchObject({
        articleId: 'article-1',
        result: ArticleSignatureResult.REJECTED,
      });
    });

    it('falls back to null for undefined reason when REJECTED', async () => {
      const result = await (service as any).signature(
        ArticleSignatureResult.REJECTED,
        { id: 'article-1', version: 1 },
        {
          signerId: 'user-1',
          runner: mockRunner,
          signatureLevel: dummyLevel,
        },
      );

      expect(mockSignatureRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rejectReason: null,
        }),
      );

      expect(result).toMatchObject({
        signerId: 'user-1',
        result: ArticleSignatureResult.REJECTED,
      });
    });

    it('sets rejectReason to null when result is APPROVED even if reason exists', async () => {
      const result = await (service as any).signature(
        ArticleSignatureResult.APPROVED,
        { id: 'article-1', version: 1 },
        {
          signerId: 'user-1',
          reason: 'should be ignored',
          runner: mockRunner,
          signatureLevel: dummyLevel,
        },
      );

      expect(mockSignatureRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rejectReason: null,
        }),
      );

      expect(result).toMatchObject({
        result: ArticleSignatureResult.APPROVED,
      });
    });
  });

  it('updates releasedAt if draftMode and autoReleaseAfterApproved are both true', async () => {
    class DummyLevel extends BaseSignatureLevelEntity {}
    const dummyLevel = new DummyLevel();

    dummyLevel.id = 'lvl-id';
    dummyLevel.name = 'L1';

    Object.defineProperty(service, 'signatureLevelsCache', {
      get: () => {
        const arr: any = [];

        arr.findIndex = () => NaN;
        arr.slice = () => [];
        arr[NaN] = dummyLevel;

        return arr;
      },
      configurable: true,
    });

    jest
      .spyOn(Object.getPrototypeOf(service), 'finalSignatureLevel', 'get')
      .mockReturnValue(dummyLevel);

    (service as any).baseArticleVersionRepo = { target: 'mock_versions_table' };
    (service as any).autoReleaseAfterApproved = true;
    (service as any).draftMode = true;

    const result = await (service as any).signature(
      ArticleSignatureResult.APPROVED,
      { id: 'article-1', version: 1 },
      {
        signerId: 'user-1',
        runner: mockRunner,
        signatureLevel: dummyLevel,
      },
    );

    expect(mockRunner.manager.update).toHaveBeenCalledWith(
      'mock_versions_table',
      {
        id: 'article-1',
        version: 1,
        releasedAt: IsNull(),
      },
      {
        releasedAt: expect.any(Date),
      },
    );

    expect(result.result).toBe(ArticleSignatureResult.APPROVED);
  });

  it('commits transaction when runner is not provided in signatureInfo', async () => {
    class DummyLevel extends BaseSignatureLevelEntity {}
    const dummyLevel = new DummyLevel();

    dummyLevel.id = 'dummy-id';
    dummyLevel.name = 'DUMMY';

    Object.defineProperty(service, 'signatureLevelsCache', {
      get: () => {
        const fakeArr: any = [];

        fakeArr.findIndex = () => NaN;
        fakeArr.slice = () => [];
        fakeArr[NaN] = dummyLevel;

        return fakeArr;
      },
      configurable: true,
    });

    jest
      .spyOn(Object.getPrototypeOf(service), 'finalSignatureLevel', 'get')
      .mockReturnValue(dummyLevel);

    (service as any).baseArticleVersionRepo = {
      target: 'mock_versions_table',
      exists: jest.fn().mockResolvedValue(true), // 🔧 fix here
    };

    (service as any).autoReleaseAfterApproved = false;
    (service as any).draftMode = false;

    await (service as any).signature(
      ArticleSignatureResult.APPROVED,
      { id: 'article-1', version: 1 },
      {
        signerId: 'user-1',
        signatureLevel: dummyLevel,
        // no runner
      },
    );

    expect(mockRunner.commitTransaction).toHaveBeenCalled();
  });
});
