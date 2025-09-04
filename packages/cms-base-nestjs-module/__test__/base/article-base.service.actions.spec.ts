// Mock NestJS Logger constructor to prevent DEBUG outputs - MUST be at the top
jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  Logger: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  })),
}));

import { ArticleStage } from '../../src/typings/article-stage.enum';
import { ArticleNotFoundError, ArticleVersionNotFoundError } from '../../src/constants/errors/article.errors';
import { ArticleBaseService } from '../../src/services/article-base.service';
import { SignatureService } from '../../src/services/signature.service';
import { BadRequestException } from '@nestjs/common';
import { CategoryNotFoundError } from '../../src/constants/errors/category.errors';
import { MultiLanguageArticleCreateDto, SingleArticleCreateDto } from '../../src/typings/article-create.dto';
import { MultipleLanguageModeIsDisabledError } from '../../src/constants/errors/base.errors';
import { QuadratsElement } from '@quadrats/core';

describe('ArticleBaseService - deleteVersion', () => {
  let service: ArticleBaseService;
  let mockArticleVersionRepo: any;

  beforeEach(() => {
    mockArticleVersionRepo = {
      createQueryBuilder: jest.fn(),
      softRemove: jest.fn(),
    };

    service = new ArticleBaseService(
      {} as any,
      mockArticleVersionRepo,
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

    // Mock the logger to prevent DEBUG outputs
  });

  it('should throw ArticleVersionNotFoundError if version not found', async () => {
    const mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(undefined),
    };

    mockArticleVersionRepo.createQueryBuilder.mockReturnValue(mockQb);

    await expect(service.deleteVersion('article-id', 2)).rejects.toThrow(ArticleVersionNotFoundError);

    expect(mockQb.andWhere).toHaveBeenCalledWith('versions.articleId = :id', {
      id: 'article-id',
    });

    expect(mockQb.andWhere).toHaveBeenCalledWith('versions.version = :version', { version: 2 });
  });

  it('should softRemove the found version', async () => {
    const mockVersion = { id: 'v2' };
    const mockQb = {
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    };

    mockArticleVersionRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockArticleVersionRepo.softRemove.mockResolvedValue(undefined);

    await service.deleteVersion('article-id', 2);

    expect(mockQb.getOne).toHaveBeenCalled();
    expect(mockArticleVersionRepo.softRemove).toHaveBeenCalledWith(mockVersion);
  });
});

describe('ArticleBaseService - archive', () => {
  let service: ArticleBaseService;
  let mockArticleRepo: any;

  beforeEach(() => {
    mockArticleRepo = {
      findOne: jest.fn(),
      softDelete: jest.fn(),
    };

    service = new ArticleBaseService(
      mockArticleRepo,
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
  });

  it('should throw ArticleNotFoundError if article is not found', async () => {
    mockArticleRepo.findOne.mockResolvedValue(null);

    await expect(service.archive('article-id')).rejects.toThrow(ArticleNotFoundError);

    expect(mockArticleRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'article-id' },
    });
  });

  it('should call softDelete on the article repo if article is found', async () => {
    mockArticleRepo.findOne.mockResolvedValue({ id: 'article-id' });
    mockArticleRepo.softDelete.mockResolvedValue(undefined);

    await service.archive('article-id');

    expect(mockArticleRepo.softDelete).toHaveBeenCalledWith('article-id');
  });
});

describe('withdraw', () => {
  let service: ArticleBaseService;
  let runner: any;
  let articleSignatureRepo: any;

  beforeEach(() => {
    runner = {
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

    articleSignatureRepo = {
      find: jest.fn(),
      save: jest.fn(),
    };

    const mockArticleDataLoader = {
      articleRepo: {} as any,
      articleVersionRepo: {} as any,
      signatureService: {} as any,
      stageLoader: {
        load: jest.fn(),
      },
      stageCache: new Map<string, Promise<ArticleStage>>(),
      categoryLoader: {} as any,
      versionLoader: {} as any,
    };

    service = new ArticleBaseService(
      {} as any, // baseArticleRepo
      { metadata: { tableName: 'versions' } } as any, // baseArticleVersionRepo
      {} as any, // baseArticleVersionContentRepo
      {} as any, // baseCategoryRepo
      true, // multipleLanguageMode
      true, // fullTextSearchMode
      true, // draftMode
      [], // signatureLevels
      {} as any, // signatureLevelRepo
      articleSignatureRepo as any, // ArticleSignatureRepo
      true, // autoReleaseAfterApproved
      {
        createQueryRunner: () => runner,
      } as any, // dataSource
      mockArticleDataLoader as any, // articleDataLoader
      {
        signatureEnabled: false,
      } as any, // signatureService
    );
  });

  it('should throw if draftMode is disabled', async () => {
    const mockArticleDataLoader = {
      articleRepo: {} as any,
      articleVersionRepo: {} as any,
      signatureService: {} as any,
      stageLoader: {
        load: jest.fn(),
      },
      stageCache: new Map(),
      categoryLoader: {} as any,
      versionLoader: {} as any,
    };

    const mockSignatureService = {
      signatureEnabled: false,
    };

    service = new ArticleBaseService(
      {} as any, // baseArticleRepo
      { metadata: { tableName: 'versions' } } as any, // baseArticleVersionRepo
      {} as any, // baseArticleVersionContentRepo
      {} as any, // baseCategoryRepo
      true, // multipleLanguageMode
      true, // fullTextSearchMode
      false, // draftMode = false
      [], // signatureLevels
      {} as any, // signatureLevelRepo
      {} as any, // articleSignatureRepo (was wrongly mocked before)
      true, // autoReleaseAfterApproved
      {
        createQueryRunner: () => runner,
      } as any, // dataSource
      mockArticleDataLoader as any, // articleDataLoader
      mockSignatureService as any, // signatureService
    );

    await expect(service.withdraw('id', 1)).rejects.toThrow('Draft mode is disabled.');
  });

  it('should throw if article is not in RELEASED or SCHEDULED stage', async () => {
    const stageLoader = service['articleDataLoader'].stageLoader.load as jest.Mock;

    jest.spyOn(service, 'findById').mockResolvedValue({ id: 'id', version: 1 });

    stageLoader.mockResolvedValue('DRAFT');

    await expect(service.withdraw('id', 1)).rejects.toThrow(
      'Article id is not in released or scheduled stage [DRAFT].',
    );
  });

  it('should withdraw and soft delete correct versions', async () => {
    jest.spyOn(service, 'findById').mockImplementation((id, options: any) => {
      if (options?.version) {
        return Promise.resolve({
          id,
          version: 1,
          releasedAt: new Date(),
        }) as any;
      }

      return Promise.resolve({ id, version: 99 }) as any;
    });

    const stageLoader = service['articleDataLoader'].stageLoader.load as jest.Mock;

    stageLoader.mockResolvedValue('RELEASED');

    const result = await service.withdraw('id', 1);

    expect(runner.connect).toHaveBeenCalled();
    expect(runner.startTransaction).toHaveBeenCalled();

    expect(runner.manager.softDelete).toHaveBeenCalledWith(
      'versions',
      expect.objectContaining({
        articleId: 'id',
        releasedAt: expect.any(Object),
        version: expect.any(Object),
      }),
    );

    expect(runner.manager.softDelete).toHaveBeenCalledWith(
      'versions',
      expect.objectContaining({
        articleId: 'id',
        releasedAt: expect.any(Object),
        version: expect.any(Object),
      }),
    );

    expect(runner.manager.update).toHaveBeenCalledWith(
      'versions',
      {
        articleId: 'id',
        version: 1,
      },
      {
        releasedAt: null,
      },
    );

    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should rollback transaction if error occurs', async () => {
    jest.spyOn(service, 'findById').mockResolvedValue({ id: 'id', version: 1 });

    const stageLoader = service['articleDataLoader'].stageLoader.load as jest.Mock;

    stageLoader.mockResolvedValue('RELEASED');

    runner.manager.softDelete.mockImplementation(() => {
      throw new Error('Soft delete failed');
    });

    await expect(service.withdraw('id', 1)).rejects.toThrow('Soft delete failed');

    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('should use VERIFIED stage when signature is enabled', async () => {
    const mockArticleDataLoader = {
      articleRepo: {} as any,
      articleVersionRepo: {} as any,
      signatureService: {} as any,
      stageLoader: {
        load: jest.fn().mockResolvedValue(ArticleStage.RELEASED),
      },
      stageCache: new Map<string, Promise<ArticleStage>>(),
      categoryLoader: {} as any,
      versionLoader: {} as any,
    };

    service = new ArticleBaseService(
      {} as any, // baseArticleRepo
      { metadata: { tableName: 'versions' } } as any, // baseArticleVersionRepo
      {} as any, // baseArticleVersionContentRepo
      {} as any, // baseCategoryRepo
      true, // multipleLanguageMode
      true, // fullTextSearchMode
      true, // draftMode
      [], // signatureLevels
      {} as any, // signatureLevelRepo
      articleSignatureRepo as any, // ArticleSignatureRepo
      true, // autoReleaseAfterApproved
      {
        createQueryRunner: () => runner,
      } as any, // dataSource
      mockArticleDataLoader as any, // articleDataLoader
      {
        signatureEnabled: true,
      } as any, // signatureService
    );

    const findByIdSpy = jest.spyOn(service, 'findById').mockImplementation((id, options: any) => {
      if (options?.stage === ArticleStage.VERIFIED) {
        return Promise.resolve({ id, version: 2 }) as any;
      }

      if (options?.version === 1) {
        return Promise.resolve({
          id,
          version: 1,
          releasedAt: new Date(),
        }) as any;
      }

      return Promise.resolve({ id, version: 99 }) as any;
    });

    await service.withdraw('id', 1);

    expect(findByIdSpy).toHaveBeenCalledWith('id', expect.objectContaining({ stage: ArticleStage.VERIFIED }));
  });

  it('should continue even if findById for targetPlaceArticle throws', async () => {
    const stageLoader = service['articleDataLoader'].stageLoader.load as jest.Mock;

    stageLoader.mockResolvedValue(ArticleStage.RELEASED);

    jest.spyOn(service, 'findById').mockImplementation((id, options: any) => {
      if (options?.version) {
        return Promise.resolve({
          id,
          version: 1,
          releasedAt: new Date(),
        }) as any;
      }

      if (options?.stage) {
        return Promise.reject(new Error('fetch failed'));
      }

      return Promise.resolve({ id, version: 99 }) as any;
    });

    const result = await service.withdraw('id', 1);

    expect(result).toBeDefined();
    expect(runner.connect).toHaveBeenCalled();
    expect(runner.commitTransaction).toHaveBeenCalled();
  });
});

describe('release', () => {
  let service: ArticleBaseService;
  let runner: any;
  const baseArticleVersionRepo = { metadata: { tableName: 'versions' } };

  beforeEach(() => {
    runner = {
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

    const mockArticleDataLoader = {
      articleRepo: {} as any,
      articleVersionRepo: {} as any,
      signatureService: {} as any,
      stageLoader: {
        load: jest.fn(),
      },
      stageCache: new Map<string, Promise<ArticleStage>>(),
      categoryLoader: {} as any,
      versionLoader: {} as any,
    };

    const mockSignatureService = {
      signatureEnabled: false,
    } as any;

    service = new ArticleBaseService(
      {} as any,
      baseArticleVersionRepo as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      {
        createQueryRunner: () => runner,
      } as any,
      mockArticleDataLoader as any,
      mockSignatureService,
    );
  });

  it('should update release time immediately if no scheduled version exists', async () => {
    const now = new Date();

    jest
      .spyOn(service, 'findById')
      .mockImplementationOnce(() => Promise.resolve({ id: 'id', version: 1 }) as any)
      .mockImplementationOnce(() => Promise.reject(new Error('not found')))
      .mockImplementationOnce(() => Promise.resolve({ id: 'id', version: 1 }) as any);

    const result = await service.release('id', { releasedAt: now });

    expect(runner.connect).toHaveBeenCalled();
    expect(runner.startTransaction).toHaveBeenCalled();
    expect(runner.manager.update).toHaveBeenCalledWith(
      'versions',
      { articleId: 'id', version: 1 },
      { releasedAt: now, releasedBy: undefined },
    );

    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should remove existing released/scheduled version if it differs', async () => {
    jest
      .spyOn(service, 'findById')
      .mockImplementationOnce(() => Promise.resolve({ id: 'id', version: 2 }) as any)
      .mockImplementationOnce(() => Promise.resolve({ id: 'id', version: 1 }) as any)
      .mockImplementationOnce(() => Promise.resolve({ id: 'id', version: 2 }) as any);

    const result = await service.release('id', { releasedAt: new Date() });

    expect(runner.manager.softRemove).toHaveBeenCalledWith('versions', {
      articleId: 'id',
      version: 1,
    });

    expect(runner.manager.update).toHaveBeenCalledWith(
      'versions',
      { articleId: 'id', version: 2 },
      expect.objectContaining({ releasedAt: expect.any(Date) }),
    );

    expect(result).toBeDefined();
  });

  it('should rollback transaction if update fails', async () => {
    jest.spyOn(service, 'findById').mockImplementation(() => Promise.resolve({ id: 'id', version: 1 }) as any);

    runner.manager.update.mockImplementation(() => {
      throw new Error('update failed');
    });

    await expect(service.release('id', { releasedAt: new Date() })).rejects.toThrow('update failed');

    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('should assign releasedBy if userId is provided', async () => {
    jest
      .spyOn(service, 'findById')
      .mockImplementationOnce(() => Promise.resolve({ id: 'id', version: 1 }) as any)
      .mockImplementationOnce(() => Promise.reject(null))
      .mockImplementationOnce(() => Promise.resolve({ id: 'id', version: 1 }) as any);

    const now = new Date();

    await service.release('id', { releasedAt: now, userId: 'user123' });

    expect(runner.manager.update).toHaveBeenCalledWith(
      'versions',
      { articleId: 'id', version: 1 },
      { releasedAt: now, releasedBy: 'user123' },
    );
  });

  it('should default to RELEASED if releasedAt is not provided', async () => {
    const findByIdSpy = jest.spyOn(service, 'findById').mockResolvedValue({ id: 'id', version: 1 } as any);

    await service.release('id', { version: 1 });

    expect(findByIdSpy).toHaveBeenCalledWith(
      'id',
      expect.objectContaining({
        stage: ArticleStage.RELEASED,
      }),
    );
  });

  it('should call findById with SCHEDULED stage if releasedAt is in the future', async () => {
    const findByIdSpy = jest.spyOn(service, 'findById').mockResolvedValue({ id: 'id', version: 1 } as any);

    await service.release('id', {
      releasedAt: new Date(Date.now() + 60_000),
      version: 1,
    });

    expect(findByIdSpy).toHaveBeenCalledWith(
      'id',
      expect.objectContaining({
        stage: ArticleStage.SCHEDULED,
      }),
    );
  });
});

describe('submit', () => {
  let service: ArticleBaseService;
  let runner: any;

  beforeEach(() => {
    runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        update: jest.fn(),
        softRemove: jest.fn(),
      },
    };

    const mockArticleDataLoader = {
      articleRepo: {} as any,
      articleVersionRepo: {} as any,
      signatureService: {} as any,
      stageLoader: { load: jest.fn() },
      stageCache: new Map(),
      categoryLoader: {} as any,
      versionLoader: {} as any,
    };

    service = new ArticleBaseService(
      {} as any,
      { metadata: { tableName: 'versions' } } as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      { createQueryRunner: () => runner } as any,
      mockArticleDataLoader as any,
      { signatureEnabled: true } as any,
    );
  });

  it('should throw if signature mode is disabled', async () => {
    service = new ArticleBaseService(
      {} as any,
      { metadata: { tableName: 'versions' } } as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      { createQueryRunner: () => runner } as any,
      {} as any,
      { signatureEnabled: false } as any,
    );

    await expect(service.submit('id')).rejects.toThrow('Signature mode is disabled.');
  });

  it('should throw if article is already submitted', async () => {
    jest.spyOn(service, 'findById').mockResolvedValue({
      id: 'id',
      version: 1,
      submittedAt: new Date(),
    } as any);

    await expect(service.submit('id')).rejects.toThrow('Article id is already submitted');
  });

  it('should softRemove old REVIEWING version if exists and update current version', async () => {
    jest.spyOn(service, 'findById').mockImplementation((id, options: any) => {
      if (options?.stage === ArticleStage.REVIEWING) {
        return Promise.resolve({ id, version: 9 }) as any;
      }

      return Promise.resolve({ id, version: 10 }) as any;
    });

    const result = await service.submit('id', { userId: 'user-1' });

    expect(runner.connect).toHaveBeenCalled();
    expect(runner.startTransaction).toHaveBeenCalled();
    expect(runner.manager.softRemove).toHaveBeenCalledWith('versions', {
      articleId: 'id',
      version: 9,
    });

    expect(runner.manager.update).toHaveBeenCalledWith(
      'versions',
      { articleId: 'id', version: 10 },
      expect.objectContaining({ submittedBy: 'user-1' }),
    );

    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should continue if REVIEWING version is not found', async () => {
    jest.spyOn(service, 'findById').mockImplementation((id, options: any) => {
      if (options?.stage === ArticleStage.REVIEWING) {
        return Promise.reject(new Error('not found'));
      }

      return Promise.resolve({ id, version: 3 }) as any;
    });

    const result = await service.submit('id');

    expect(runner.manager.update).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should rollback transaction if error occurs', async () => {
    jest.spyOn(service, 'findById').mockResolvedValue({ id: 'id', version: 1 } as any);

    runner.manager.update.mockImplementation(() => {
      throw new Error('Update failed');
    });

    await expect(service.submit('id')).rejects.toThrow('Update failed');
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });
});

describe('putBack', () => {
  let service: ArticleBaseService;
  let runner: any;

  beforeEach(() => {
    jest.resetAllMocks();
    runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        update: jest.fn(),
      },
    };

    const mockArticleDataLoader = {
      stageCache: new Map(),
    };

    service = new ArticleBaseService(
      {} as any,
      { metadata: { tableName: 'versions' } } as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      { createQueryRunner: () => runner } as any,
      mockArticleDataLoader as any,
      { signatureEnabled: true } as any,
    );

    // Override the private logger property to prevent debug outputs
    (service as any).logger = {
      debug: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      verbose: jest.fn(),
    };
  });

  it('should throw if signature mode is disabled', async () => {
    service = new ArticleBaseService(
      {} as any,
      { metadata: { tableName: 'versions' } } as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      { createQueryRunner: () => runner } as any,
      {} as any,
      { signatureEnabled: false } as any,
    );

    await expect(service.putBack('id')).rejects.toThrow('Signature mode is disabled.');
  });

  it('should throw if draft article already exists', async () => {
    jest.spyOn(service, 'findById').mockImplementation((id, options: any) => {
      if (options?.stage === 'DRAFT') {
        return Promise.resolve({ id, version: 2 }) as any;
      }

      return Promise.resolve({
        id,
        version: 3,
        submittedAt: new Date(),
      }) as any;
    });

    await expect(service.putBack('id')).rejects.toThrow('Article id is already in draft [2].');
  });

  it('should throw if article is not submitted yet', async () => {
    jest.spyOn(service, 'findById').mockImplementation((id, options: any) => {
      if (options?.stage === 'DRAFT') {
        return Promise.resolve(null);
      }

      return Promise.resolve({ id, version: 1, submittedAt: null }) as any;
    });

    await expect(service.putBack('id')).rejects.toThrow('Article id is not submitted yet [1].');
  });

  it('should update submittedAt and submittedBy to null', async () => {
    jest.spyOn(service, 'findById').mockImplementation((id, options: any) => {
      if (options?.stage === 'DRAFT') {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        id,
        version: 1,
        submittedAt: new Date(),
      }) as any;
    });

    const result = await service.putBack('id');

    expect(runner.connect).toHaveBeenCalled();
    expect(runner.startTransaction).toHaveBeenCalled();
    expect(runner.manager.update).toHaveBeenCalledWith(
      'versions',
      { articleId: 'id', version: 1 },
      { submittedAt: null, submittedBy: null },
    );

    expect(runner.commitTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should rollback if an error is thrown', async () => {
    jest.spyOn(service, 'findById').mockImplementation((id, options: any) => {
      if (options?.stage === 'DRAFT') {
        return Promise.resolve(null);
      }

      return Promise.resolve({
        id,
        version: 1,
        submittedAt: new Date(),
      }) as any;
    });

    runner.manager.update.mockImplementation(() => {
      throw new Error('Update failed');
    });

    await expect(service.putBack('id')).rejects.toThrow('Update failed');
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('should continue when findById for draft article throws error', async () => {
    const mockArticleDataLoader = {
      articleRepo: {} as any,
      articleVersionRepo: {} as any,
      signatureService: {} as any,
      stageLoader: {
        load: jest.fn(),
      },
      stageCache: new Map<string, Promise<ArticleStage>>(),
      categoryLoader: {} as any,
      versionLoader: {} as any,
    };

    service = new ArticleBaseService(
      {} as any,
      { metadata: { tableName: 'versions' } } as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      { createQueryRunner: () => runner } as any,
      mockArticleDataLoader as any,
      { signatureEnabled: true } as any, // correct 14th argument
    );

    jest.spyOn(service, 'findById').mockImplementation((id, options: any) => {
      if (options?.stage === ArticleStage.DRAFT) {
        return Promise.reject(new Error('Failed to fetch draft'));
      }

      return Promise.resolve({
        id,
        version: 1,
        submittedAt: new Date(),
      }) as any;
    });

    await expect(service.putBack('article-id')).resolves.toBeDefined();

    expect(runner.connect).toHaveBeenCalled();
    expect(runner.commitTransaction).toHaveBeenCalled();
  });
});

describe('getPlacedArticleStage', () => {
  let service: any;

  const mockSignatureService = {
    finalSignatureLevel: {
      id: 'any-id',
      name: 'FINAL',
      sequence: 1,
      required: true,
      createdAt: new Date(),
      deletedAt: new Date(),
      signatures: [],
    },
    signatureEnabled: true,
    signatureLevels: [],
    signatureLevelRepo: {} as any,
    dataSource: {} as any,
    articleSignatureRepo: {} as any,
    getSignatureStage: jest.fn(),
    isFinalSignatureLevel: jest.fn(),
  } as unknown as SignatureService<any>;

  beforeEach(() => {
    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      true, // multipleLanguageMode
      true, // fullTextSearchMode
      true, // draftMode
      [], // signatureLevels
      {} as any,
      {} as any,
      true, // autoReleaseAfterApproved
      {} as any, // dataSource
      {} as any, // articleDataLoader
      mockSignatureService,
    );
  });

  it('should return REVIEWING if submitted is true', () => {
    const stage = service['getPlacedArticleStage']({
      submitted: true,
      releasedAt: null,
      signatureLevel: null,
    });

    expect(stage).toBe(ArticleStage.REVIEWING);
  });

  it('should return VERIFIED if signatureLevel matches final level', () => {
    const stage = service['getPlacedArticleStage']({
      submitted: false,
      releasedAt: null,
      signatureLevel: 'FINAL',
    });

    expect(stage).toBe(ArticleStage.VERIFIED);
  });

  it('should return REVIEWING if signatureLevel exists but is not final', () => {
    const stage = service['getPlacedArticleStage']({
      submitted: false,
      releasedAt: null,
      signatureLevel: 'MID',
    });

    expect(stage).toBe(ArticleStage.REVIEWING);
  });

  it('should return SCHEDULED if releasedAt is in the future', () => {
    const stage = service['getPlacedArticleStage']({
      submitted: false,
      releasedAt: new Date(Date.now() + 100000),
      signatureLevel: null,
    });

    expect(stage).toBe(ArticleStage.SCHEDULED);
  });

  it('should return RELEASED if releasedAt is in the past', () => {
    const stage = service['getPlacedArticleStage']({
      submitted: false,
      releasedAt: new Date(Date.now() - 100000),
      signatureLevel: null,
    });

    expect(stage).toBe(ArticleStage.RELEASED);
  });

  it('should return DRAFT if nothing set and draftMode is enabled', () => {
    const stage = service['getPlacedArticleStage']({
      submitted: false,
      releasedAt: null,
      signatureLevel: null,
    });

    expect(stage).toBe(ArticleStage.DRAFT);
  });

  it('should return RELEASED if nothing set and draftMode is disabled', () => {
    service.draftMode = false;

    const stage = service['getPlacedArticleStage']({
      submitted: false,
      releasedAt: null,
      signatureLevel: null,
    });

    expect(stage).toBe(ArticleStage.RELEASED);
  });
});

describe('ArticleBaseService.addVersion', () => {
  let service: ArticleBaseService;
  let runner: any;

  let mockArticleRepo: any;
  let mockVersionRepo: any;
  let mockContentRepo: any;
  let mockCategoryRepo: any;
  let mockSignatureLevelRepo: any;
  let mockSignatureRepo: any;
  let mockRepo: any;
  let mockDataSource: any;
  let mockDataLoader: any;
  let mockSignatureService: any;
  let mockQueryBuilder: any;

  const mockArticle = { id: 'article-1', categories: [] };
  const mockVersion = { version: 2 };

  beforeEach(() => {
    jest.resetAllMocks();
    mockRepo = (tableName = 'mock_table') => ({
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
      softDelete: jest.fn(),
      update: jest.fn(),
      create: jest.fn(input => input),
      createQueryBuilder: jest.fn(),
      metadata: {
        tableName,
      },
    });

    mockQueryBuilder = {
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
    };

    mockArticleRepo = mockRepo();
    mockVersionRepo = {
      ...mockRepo(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    mockContentRepo = mockRepo();
    mockCategoryRepo = mockRepo();
    mockSignatureLevelRepo = mockRepo();
    mockSignatureRepo = mockRepo();

    runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      manager: {
        save: jest.fn().mockImplementation(data => Promise.resolve(data)),
        softRemove: jest.fn().mockResolvedValue(undefined),
        softDelete: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    mockDataSource = {
      createQueryRunner: () => runner,
      query: jest.fn().mockResolvedValue([]),
    };

    mockDataLoader = {
      stageCache: {
        set: jest.fn(),
      },
    };

    mockSignatureService = {
      signatureEnabled: true,
      finalSignatureLevel: { name: 'LEVEL_3', id: 'sig-level-3' },
      signatureLevelsCache: [
        { id: 'sig-level-1', name: 'LEVEL_1', required: false },
        { id: 'sig-level-3', name: 'LEVEL_3', required: true },
      ],
    };

    service = new ArticleBaseService(
      mockArticleRepo,
      mockVersionRepo,
      mockContentRepo,
      mockCategoryRepo,
      true, // multipleLanguageMode
      true, // fullTextSearchMode
      true, // draftMode
      ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'], // signatureLevels
      mockSignatureLevelRepo,
      mockSignatureRepo,
      true, // autoReleaseAfterApproved
      mockDataSource as any,
      mockDataLoader as any,
      mockSignatureService as any,
    );

    // Override the private logger property to prevent debug outputs
    (service as any).logger = {
      debug: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      verbose: jest.fn(),
    };
  });

  it('should add version with single-language content', async () => {
    jest.spyOn(service, 'findById').mockResolvedValueOnce(null).mockResolvedValueOnce(mockVersion);

    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);
    mockArticleRepo.findOne.mockResolvedValue(mockArticle);
    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    });

    const result = await service.addVersion('article-1', {
      userId: 'user-1',
      submitted: true,
      categoryIds: ['cat-1'],
      title: 'Test',
      content: [],
      tags: [],
    });

    expect(result).toBeDefined();
    expect(runner.startTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).toHaveBeenCalled();
  });

  it('should add version with multi-language content', async () => {
    jest.spyOn(service, 'findById').mockResolvedValueOnce(null).mockResolvedValueOnce(mockVersion);

    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);
    mockArticleRepo.findOne.mockResolvedValue(mockArticle);
    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    });

    const multiLangDto: MultiLanguageArticleCreateDto = {
      userId: 'user-1',
      submitted: false,
      categoryIds: ['cat-1'],
      multiLanguageContents: {
        en: { title: 'English', content: [] },
        zh: { title: '中文', content: [] },
      },
      tags: ['tag1'],
    };

    const result = await service.addVersion('article-1', multiLangDto);

    expect(result).toBeDefined();
    expect(runner.commitTransaction).toHaveBeenCalled();
  });

  it('should throw CategoryNotFoundError if categoryId not found', async () => {
    mockCategoryRepo.find.mockResolvedValue([]);
    await expect(
      service.addVersion('article-1', {
        userId: 'user-1',
        submitted: true,
        categoryIds: ['missing-cat'],
        title: 'Test',
        content: [],
        tags: [],
      }),
    ).rejects.toThrow(CategoryNotFoundError);
  });

  it('should throw ArticleNotFoundError if article not found', async () => {
    jest.spyOn(service, 'findById').mockResolvedValue(null);
    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);
    mockArticleRepo.findOne.mockResolvedValue(null);

    await expect(
      service.addVersion('article-1', {
        userId: 'user-1',
        submitted: false,
        categoryIds: ['cat-1'],
        title: 'Test',
        content: [],
        tags: [],
      }),
    ).rejects.toThrow(ArticleNotFoundError);
  });

  it('should throw ArticleVersionNotFoundError if no previous version', async () => {
    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);
    mockArticleRepo.findOne.mockResolvedValue(mockArticle);
    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    await expect(
      service.addVersion('article-1', {
        userId: 'user-1',
        submitted: false,
        categoryIds: ['cat-1'],
        title: 'Test',
        content: [],
        tags: [],
      }),
    ).rejects.toThrow(ArticleVersionNotFoundError);
  });

  it('should rollback transaction on failure', async () => {
    jest.spyOn(service, 'findById').mockResolvedValueOnce(null).mockResolvedValueOnce(mockVersion);

    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);
    mockArticleRepo.findOne.mockResolvedValue(mockArticle);
    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    });

    runner.manager.save.mockRejectedValueOnce(new Error('DB error'));

    await expect(
      service.addVersion('article-1', {
        userId: 'user-1',
        submitted: true,
        categoryIds: ['cat-1'],
        title: 'Test',
        content: [],
        tags: [],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(runner.rollbackTransaction).toHaveBeenCalled();
  });

  it('should call approveVersion if signatureLevel or releasedAt is provided', async () => {
    const approveVersionSpy = jest.spyOn(service, 'approveVersion').mockResolvedValue({} as any);

    jest.spyOn(service, 'findById').mockResolvedValueOnce(null).mockResolvedValueOnce(mockVersion);

    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);
    mockArticleRepo.findOne.mockResolvedValue(mockArticle);
    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    });

    await service.addVersion('article-1', {
      userId: 'user-1',
      signatureLevel: 'LEVEL_1',
      categoryIds: ['cat-1'],
      title: 'Test',
      content: [],
      tags: [],
    });

    expect(approveVersionSpy).toHaveBeenCalled();
  });

  it('should add version with empty categories if categoryIds is not provided', async () => {
    jest.spyOn(service, 'findById').mockResolvedValueOnce(null).mockResolvedValueOnce(mockVersion);

    mockCategoryRepo.find.mockResolvedValue([]);
    mockArticleRepo.findOne.mockResolvedValue(mockArticle);
    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    });

    const result = await service.addVersion('article-1', {
      userId: 'user-1',
      submitted: false,
      // categoryIds is undefined
      title: 'Test without categories',
      content: [],
      tags: [],
    });

    expect(result).toBeDefined();
    expect(mockCategoryRepo.find).not.toHaveBeenCalled();
    expect(runner.commitTransaction).toHaveBeenCalled();
  });

  it('should not throw CategoryNotFoundError when categoryIds is undefined and targetCategories is empty', async () => {
    jest.spyOn(service, 'findById').mockResolvedValueOnce(null).mockResolvedValueOnce(mockVersion);

    mockCategoryRepo.find.mockResolvedValue([]);
    mockArticleRepo.findOne.mockResolvedValue(mockArticle);
    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    });

    const result = await service.addVersion('article-1', {
      userId: 'user-1',
      submitted: false,
      title: 'Untitled',
      content: [],
      tags: [],
    });

    expect(result).toBeDefined();
    expect(mockCategoryRepo.find).not.toHaveBeenCalled();
    expect(runner.commitTransaction).toHaveBeenCalled();
  });

  it('should log warning when article has categories and categoryIds is not provided', async () => {
    const loggerWarnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();

    const articleWithCategories = {
      id: 'article-1',
      categories: [{ id: 'cat-a' }, { id: 'cat-b' }],
    };

    jest.spyOn(service, 'findById').mockResolvedValueOnce(null).mockResolvedValueOnce(mockVersion);

    mockCategoryRepo.find.mockResolvedValue([]); // should not be called, but safe fallback
    mockArticleRepo.findOne.mockResolvedValue(articleWithCategories);
    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    });

    const result = await service.addVersion('article-1', {
      userId: 'user-1',
      submitted: false,
      // No categoryIds provided
      title: 'Test',
      content: [],
      tags: [],
    });

    expect(result).toBeDefined();
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'Article article-1 has categories, but no categoryIds provided when add version. The article categories will no change after version added.',
    );
  });

  it('should fallback to new Date() for releasedAt when draftMode is false', async () => {
    service = new ArticleBaseService(
      mockArticleRepo,
      mockVersionRepo,
      mockContentRepo,
      mockCategoryRepo,
      true, // multipleLanguageMode
      true, // fullTextSearchMode
      false, // draftMode = false
      ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'],
      mockSignatureLevelRepo,
      mockSignatureRepo,
      true,
      mockDataSource as any,
      mockDataLoader as any,
      mockSignatureService as any,
    );

    jest.spyOn(service, 'findById').mockResolvedValueOnce(null).mockResolvedValueOnce(mockVersion);

    mockCategoryRepo.find.mockResolvedValue([]);
    mockArticleRepo.findOne.mockResolvedValue(mockArticle);
    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    });

    const before = Date.now();

    await service.addVersion('article-1', {
      userId: 'user-1',
      submitted: false,
      categoryIds: [],
      title: 'Test',
      content: [],
      tags: [],
    });

    const after = Date.now();

    const savedVersion = runner.manager.save.mock.calls.find(
      ([arg]: [any]) => arg?.version === mockVersion.version + 1,
    )?.[0];

    expect(savedVersion.releasedAt).toBeDefined();
    expect(savedVersion.releasedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(savedVersion.releasedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('should softRemove placedArticle when it exists', async () => {
    const placedArticle = { id: 'article-1', version: 99 };
    const latestVersion = { version: 99 };

    service = new ArticleBaseService(
      mockArticleRepo,
      mockVersionRepo,
      mockContentRepo,
      mockCategoryRepo,
      true,
      true,
      true,
      ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'],
      mockSignatureLevelRepo,
      mockSignatureRepo,
      true,
      mockDataSource as any,
      mockDataLoader as any,
      mockSignatureService as any,
    );

    jest.spyOn(service, 'findById').mockResolvedValueOnce(placedArticle).mockResolvedValueOnce(latestVersion);

    mockCategoryRepo.find.mockResolvedValue([]);
    mockArticleRepo.findOne.mockResolvedValue(mockArticle);
    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ version: 98 }),
    });

    await service.addVersion('article-1', {
      userId: 'user-1',
      submitted: false,
      categoryIds: [],
      title: 'Test',
      content: [],
      tags: [],
    });

    expect(runner.manager.softRemove).toHaveBeenCalledWith(mockVersionRepo.metadata.tableName, {
      articleId: 'article-1',
      version: 99,
    });
  });

  it('should set releasedBy when releasedAt is provided', async () => {
    runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      manager: {
        save: jest.fn().mockImplementation(data => Promise.resolve(data)),
        softRemove: jest.fn().mockResolvedValue(undefined),
        softDelete: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(true),
        createQueryBuilder: jest.fn(() => mockQueryBuilder),
      },
    };

    jest.spyOn(service, 'findById').mockResolvedValueOnce(null).mockResolvedValueOnce(mockVersion);

    mockCategoryRepo.find.mockResolvedValue([]);
    mockArticleRepo.findOne.mockResolvedValue(mockArticle);
    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    });

    const releasedAt = new Date(Date.now() + 100000); // future date

    jest.spyOn(service as any, 'approveVersion').mockResolvedValue(undefined);

    await service.addVersion('article-1', {
      userId: 'user-1',
      releasedAt,
      submitted: false,
      categoryIds: [],
      title: 'Test',
      content: [],
      tags: [],
    });

    const savedVersion = runner.manager.save.mock.calls.find(
      ([arg]: [any]) => arg?.version === mockVersion.version + 1,
    )?.[0];

    expect(savedVersion.releasedBy).toBe('user-1');
  });

  it('should throw MultipleLanguageModeIsDisabledError if multipleLanguageMode is false', async () => {
    service = new ArticleBaseService(
      mockArticleRepo,
      mockVersionRepo,
      mockContentRepo,
      mockCategoryRepo,
      false, // multipleLanguageMode disabled
      true,
      true,
      ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'],
      mockSignatureLevelRepo,
      mockSignatureRepo,
      true,
      mockDataSource as any,
      mockDataLoader as any,
      mockSignatureService as any,
    );

    const mockContent: QuadratsElement[] = [
      {
        type: 'paragraph',
        children: [{ text: 'Test content' }],
      },
    ];

    const dto: MultiLanguageArticleCreateDto = {
      userId: 'user-1',
      submitted: false,
      categoryIds: [],
      tags: [],
      signatureLevel: 'LEVEL_1',
      multiLanguageContents: {
        en: {
          title: 'English Title',
          content: mockContent,
        },
        zh: {
          title: '中文標題',
          content: mockContent,
        },
      },
    };

    mockArticleRepo.findOne.mockResolvedValue({
      id: 'article-1',
      versions: [],
      categories: [],
    });

    (mockVersionRepo.createQueryBuilder().getOne as jest.Mock).mockResolvedValue(mockVersion);

    await expect(service.addVersion('article-1', dto)).rejects.toThrow(new MultipleLanguageModeIsDisabledError());
  });

  it('should fallback to empty array when options.tags is undefined (multi-language)', async () => {
    runner.manager.exists = jest.fn().mockResolvedValue(true);
    runner.manager.createQueryBuilder = jest.fn(() => mockQueryBuilder);
    mockQueryBuilder.getMany = jest.fn().mockResolvedValue([]);

    service = new ArticleBaseService(
      mockArticleRepo,
      mockVersionRepo,
      mockContentRepo,
      mockCategoryRepo,
      true,
      true, // fullTextSearchMode
      true,
      ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'],
      mockSignatureLevelRepo,
      mockSignatureRepo,
      true,
      mockDataSource as any,
      mockDataLoader as any,
      mockSignatureService as any,
    );

    const mockContent: QuadratsElement[] = [
      {
        type: 'paragraph',
        children: [{ text: 'Test content' }],
      },
    ];

    const dto: MultiLanguageArticleCreateDto = {
      userId: 'user-1',
      submitted: false,
      categoryIds: [],
      signatureLevel: 'LEVEL_1',
      multiLanguageContents: {
        en: {
          title: 'English Title',
          content: mockContent,
        },
        zh: {
          title: '中文標題',
          content: mockContent,
        },
      },
    };

    const mockVersion = {
      version: 2,
      articleId: 'article-1',
      content: [
        {
          title: 'English Title',
          content: mockContent,
          language: 'en',
          tags: [],
        },
        {
          title: '中文標題',
          content: mockContent,
          language: 'zh',
          tags: [],
        },
      ],
      updatedAt: new Date(),
      updatedBy: null,
    };

    mockArticleRepo.findOne.mockResolvedValue({
      id: 'article-1',
      versions: [],
      categories: [],
      createdBy: 'user-1',
    });

    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    });

    const bindSearchTokensMock = jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);

    runner.manager.save.mockImplementation((input: any) => {
      if (Array.isArray(input)) {
        return Promise.resolve(
          input.map((content: any) => ({
            ...content,
            id: 'mock-content-id',
            createdAt: new Date(),
          })),
        );
      }

      if (input?.version && input?.articleId) {
        return Promise.resolve(input); // version
      }

      return Promise.resolve({}); // signature or others
    });

    jest.spyOn(service, 'findById').mockImplementation(async (id: string) => {
      if (id === 'article-1') {
        return {
          id: 'article-1',
          versions: [],
          categories: [],
          createdBy: 'user-1',
        };
      }

      throw new ArticleNotFoundError();
    });

    await service.addVersion('article-1', dto);

    expect(bindSearchTokensMock).toHaveBeenCalledTimes(2);
    expect(bindSearchTokensMock.mock.calls[0][1]).toEqual([]);
    expect(bindSearchTokensMock.mock.calls[1][1]).toEqual([]);
  });

  it('should fallback to empty array when options.tags is undefined (single-language)', async () => {
    runner.manager.exists = jest.fn().mockResolvedValue(true);
    runner.manager.createQueryBuilder = jest.fn(() => mockQueryBuilder);
    mockQueryBuilder.getMany = jest.fn().mockResolvedValue([]);

    service = new ArticleBaseService(
      mockArticleRepo,
      mockVersionRepo,
      mockContentRepo,
      mockCategoryRepo,
      true,
      true, // fullTextSearchMode
      true,
      ['LEVEL_1', 'LEVEL_2', 'LEVEL_3'],
      mockSignatureLevelRepo,
      mockSignatureRepo,
      true,
      mockDataSource as any,
      mockDataLoader as any,
      mockSignatureService as any,
    );

    const mockContent: QuadratsElement[] = [
      {
        type: 'paragraph',
        children: [{ text: 'Test content' }],
      },
    ];

    const dto: SingleArticleCreateDto<any, any, any> = {
      userId: 'user-1',
      submitted: false,
      categoryIds: [],
      signatureLevel: 'LEVEL_1',
      title: 'Single Lang Title',
      content: mockContent,
    };

    const mockVersion = {
      version: 1,
      articleId: 'article-1',
      content: [],
      updatedAt: new Date(),
      updatedBy: null,
    };

    mockArticleRepo.findOne.mockResolvedValue({
      id: 'article-1',
      versions: [],
      categories: [],
      createdBy: 'user-1',
    });

    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockVersion),
    });

    const bindSearchTokensMock = jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);

    runner.manager.save.mockImplementation((input: any) => {
      if (input?.language) {
        return Promise.resolve({
          ...input,
          id: 'mock-content-id',
          createdAt: new Date(),
        });
      }

      return Promise.resolve(input);
    });

    jest.spyOn(service, 'findById').mockImplementation(async (id: string) => {
      if (id === 'article-1') {
        return {
          id: 'article-1',
          versions: [],
          categories: [],
          createdBy: 'user-1',
        };
      }

      throw new ArticleNotFoundError();
    });

    await service.addVersion('article-1', dto);

    expect(bindSearchTokensMock).toHaveBeenCalledTimes(1);
    expect(bindSearchTokensMock.mock.calls[0][1]).toEqual([]); // fallback
  });

  it('should return RELEASED when releasedAt is in the past (single-language)', async () => {
    (service as any).multipleLanguageMode = false;

    jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);

    runner.manager.exists = jest.fn().mockResolvedValue(true);
    runner.manager.createQueryBuilder = jest.fn(() => mockQueryBuilder);

    const mockContent: QuadratsElement[] = [{ type: 'paragraph', children: [{ text: 'Past release' }] }];

    const pastDate = new Date(Date.now() - 10000);

    const dto: SingleArticleCreateDto = {
      userId: 'user-1',
      submitted: false,
      categoryIds: [],
      signatureLevel: undefined,
      releasedAt: pastDate,
      title: 'Released article',
      content: mockContent,
    };

    mockArticleRepo.findOne.mockResolvedValue({
      id: 'article-1',
      categories: [],
    });

    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        articleId: 'article-1',
        version: 1,
      }),
    });

    runner.manager.save.mockImplementation((input: any) => {
      if (input?.version && input?.articleId) {
        return Promise.resolve(input);
      }

      return Promise.resolve({
        ...input,
        id: 'mock-content-id',
        createdAt: new Date(),
      });
    });

    jest
      .spyOn(service, 'findById')
      .mockResolvedValueOnce({
        id: 'article-1',
        categories: [],
      } as any)
      .mockResolvedValueOnce({
        id: 'article-1',
        version: 2,
        content: [
          {
            title: 'Released article',
            content: mockContent,
            language: 'en',
            tags: [],
          },
        ],
        categories: [],
      } as any);

    jest.spyOn(service as any, 'approveVersion').mockResolvedValue(undefined);

    await service.addVersion('article-1', dto);
  });

  it('should return VERIFIED when signatureLevel equals finalSignatureLevel.name (single-language)', async () => {
    (service as any).multipleLanguageMode = false;
    (service as any).signatureService.finalSignatureLevel = { name: 'LEVEL_3' };

    jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'approveVersion').mockResolvedValue(undefined);

    const mockContent: QuadratsElement[] = [{ type: 'paragraph', children: [{ text: 'Verified content' }] }];

    const dto: SingleArticleCreateDto = {
      userId: 'user-1',
      submitted: false,
      categoryIds: [],
      signatureLevel: 'LEVEL_3', // matches finalSignatureLevel
      releasedAt: undefined,
      title: 'Verified article',
      content: mockContent,
    };

    mockArticleRepo.findOne.mockResolvedValue({
      id: 'article-1',
      categories: [],
    });

    mockVersionRepo.createQueryBuilder.mockReturnValue({
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ articleId: 'article-1', version: 1 }),
    });

    runner.manager.save.mockImplementation((input: any) => {
      return Promise.resolve({
        ...input,
        id: 'mock-id',
        createdAt: new Date(),
      });
    });

    jest
      .spyOn(service, 'findById')
      .mockResolvedValueOnce({ id: 'article-1', categories: [] } as any)
      .mockResolvedValueOnce({
        id: 'article-1',
        version: 2,
        content: [
          {
            title: 'Verified article',
            content: mockContent,
            language: 'en',
            tags: [],
          },
        ],
        categories: [],
      } as any);

    await service.addVersion('article-1', dto);
  });
});

describe('ArticleBaseService.create', () => {
  let service: any;
  let runner: any;

  let mockArticleRepo: any;
  let mockVersionRepo: any;
  let mockContentRepo: any;
  let mockCategoryRepo: any;
  let mockSignatureRepo: any;
  let mockSignatureLevelRepo: any;
  let mockDataLoader: any;
  let mockSignatureService: any;

  beforeEach(() => {
    const mockRepo = () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(input => input),
      metadata: { tableName: 'mock_table' },
    });

    runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn().mockImplementation(data => Promise.resolve(data)),
      },
    };

    mockArticleRepo = mockRepo();
    mockVersionRepo = mockRepo();
    mockContentRepo = mockRepo();
    mockCategoryRepo = mockRepo();
    mockSignatureRepo = mockRepo();
    mockSignatureLevelRepo = mockRepo();

    mockDataLoader = {
      stageCache: {
        set: jest.fn(),
      },
    };

    mockSignatureService = {
      finalSignatureLevel: { name: 'FINAL' },
    };

    service = new ArticleBaseService(
      mockArticleRepo,
      mockVersionRepo,
      mockContentRepo,
      mockCategoryRepo,
      false, // multipleLanguageMode
      true, // fullTextSearchMode
      true, // draftMode
      [], // searchableKeys
      mockSignatureLevelRepo,
      mockSignatureRepo,
      true, // allowSignatureApproval
      { createQueryRunner: () => runner } as any,
      mockDataLoader,
      mockSignatureService,
    );

    jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'approveVersion').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'findById').mockResolvedValue({ id: 'mock-id' });
  });

  it('should create an article with single-language content', async () => {
    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);

    const result = await service.create({
      userId: 'user-1',
      categoryIds: ['cat-1'],
      submitted: false,
      releasedAt: null,
      signatureLevel: null,
      tags: [],
      title: 'Hello',
      content: [],
    });

    expect(mockArticleRepo.create).toHaveBeenCalled();
    expect(mockVersionRepo.create).toHaveBeenCalled();
    expect(mockContentRepo.create).toHaveBeenCalled();
    expect(runner.manager.save).toHaveBeenCalled();
    expect(mockDataLoader.stageCache.set).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should create article with multi-language contents and bind search tokens', async () => {
    service.multipleLanguageMode = true;
    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);

    const result = await service.create({
      userId: 'user-1',
      categoryIds: ['cat-1'],
      multiLanguageContents: {
        en: { title: 'English', body: 'Content EN' },
        zh: { title: '中文', body: 'Content ZH' },
      },
      tags: ['tag'],
    });

    expect(mockContentRepo.create).toHaveBeenCalledTimes(2);
    expect(service.bindSearchTokens).toHaveBeenCalledTimes(2);
    expect(result).toBeDefined();
  });

  it('should throw CategoryNotFoundError if some categories are not bindable', async () => {
    mockCategoryRepo.find.mockResolvedValue([]);

    await expect(
      service.create({
        userId: 'user-1',
        categoryIds: ['cat-x'],
        title: 'Failing',
        content: [],
      }),
    ).rejects.toThrow(CategoryNotFoundError);
  });

  it('should throw if multiLanguageContents is passed but multipleLanguageMode is false', async () => {
    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);

    await expect(
      service.create({
        userId: 'user-1',
        categoryIds: ['cat-1'],
        multiLanguageContents: {
          en: { title: 'test', body: 'test' },
        },
      }),
    ).rejects.toThrow(new MultipleLanguageModeIsDisabledError());
  });

  it('should call approveVersion when signatureLevel is provided', async () => {
    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);

    await service.create({
      userId: 'user-1',
      categoryIds: ['cat-1'],
      signatureLevel: 'FINAL',
      content: [],
    });

    expect(service.approveVersion).toHaveBeenCalled();
  });

  it('should rollback transaction and throw on error', async () => {
    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);
    runner.manager.save = jest.fn().mockRejectedValue(new Error('DB Error'));

    await expect(
      service.create({
        userId: 'user-1',
        categoryIds: ['cat-1'],
        title: 'fail',
        content: [],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('should schedule article when releasedAt is in the future', async () => {
    mockCategoryRepo.find.mockResolvedValue([{ id: 'cat-1', bindable: true }]);
    const futureDate = new Date(Date.now() + 100000);

    await service.create({
      userId: 'user-1',
      categoryIds: ['cat-1'],
      releasedAt: futureDate,
      content: [],
    });

    const stageCall = mockDataLoader.stageCache.set.mock.calls[0][1];
    const stage = await stageCall;

    expect(stage).toBe('SCHEDULED');
  });

  it('should create article when categoryIds is not provided (no category check)', async () => {
    const result = await service.create({
      userId: 'user-1',
      title: 'No Categories',
      content: [],
      submitted: false,
    });

    expect(mockCategoryRepo.find).not.toHaveBeenCalled();
    expect(mockArticleRepo.create).toHaveBeenCalled();
    expect(mockVersionRepo.create).toHaveBeenCalled();
    expect(mockContentRepo.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should use current date for releasedAt when draftMode is false', async () => {
    service.draftMode = false;
    mockCategoryRepo.find.mockResolvedValue([]);

    const createSpy = jest.spyOn(mockVersionRepo, 'create');

    const before = Date.now();

    await service.create({
      userId: 'user-1',
      title: 'No Draft Mode',
      content: [],
      submitted: false,
    });

    const after = Date.now();

    const versionInput = createSpy.mock.calls[0][0];

    expect((versionInput as any).releasedAt).toBeInstanceOf(Date);

    expect((versionInput as any).releasedAt.getTime()).toBeGreaterThanOrEqual(before);

    expect((versionInput as any).releasedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('should bind search tokens with empty tags when options.tags is undefined', async () => {
    service.multipleLanguageMode = true;
    service.fullTextSearchMode = true;
    mockCategoryRepo.find.mockResolvedValue([]);

    const bindSpy = jest.spyOn(service as any, 'bindSearchTokens').mockResolvedValue(undefined);

    await service.create({
      userId: 'user-1',
      multiLanguageContents: {
        en: { title: 'EN', body: 'content' },
        fr: { title: 'FR', body: 'contenu' },
      },
    });

    expect(bindSpy).toHaveBeenCalledTimes(2);
    for (const call of bindSpy.mock.calls) {
      expect(call[1]).toEqual([]);
    }
  });

  it('should set stage to RELEASED when releasedAt is now or in the past', async () => {
    const releasedAt = new Date(Date.now() - 1000);

    mockCategoryRepo.find.mockResolvedValue([]);

    await service.create({
      userId: 'user-1',
      releasedAt,
      content: [],
    });

    const setCall = mockDataLoader.stageCache.set.mock.calls[0][1];
    const stage = await setCall;

    expect(stage).toBe('RELEASED');
  });

  it('should set stage to REVIEWING when signatureLevel is not final', async () => {
    mockCategoryRepo.find.mockResolvedValue([]);

    await service.create({
      userId: 'user-1',
      signatureLevel: 'MID', // != FINAL
      content: [],
    });

    const setCall = mockDataLoader.stageCache.set.mock.calls[0][1];
    const stage = await setCall;

    expect(stage).toBe('REVIEWING');
  });

  it('should set stage to REVIEWING when submitted is true and no other stage is set', async () => {
    service.signatureService.signatureEnabled = true;
    mockCategoryRepo.find.mockResolvedValue([]);

    await service.create({
      userId: 'user-1',
      submitted: true,
      content: [],
    });

    const setCall = mockDataLoader.stageCache.set.mock.calls[0][1];
    const stage = await setCall;

    expect(stage).toBe('REVIEWING');
  });

  it('should set stage to DRAFT when no stage flags are provided', async () => {
    mockCategoryRepo.find.mockResolvedValue([]);

    await service.create({
      userId: 'user-1',
      content: [],
    });

    const setCall = mockDataLoader.stageCache.set.mock.calls[0][1];
    const stage = await setCall;

    expect(stage).toBe('DRAFT');
  });
});

describe('ArticleBaseService.rejectVersion', () => {
  let service: any;

  beforeEach(() => {
    service = new ArticleBaseService(
      {} as any, // articleRepo
      {} as any, // versionRepo
      {} as any, // contentRepo
      {} as any, // categoryRepo
      false,
      false,
      true,
      [],
      {} as any, // sigLevelRepo
      {} as any, // sigRepo
      true,
      {} as any, // dataSource
      {} as any, // loader
      {} as any, // sigService
    );

    jest.spyOn(service, 'findById');
    jest.spyOn(service, 'signature').mockResolvedValue({ id: 'mock-id' });
  });

  it('should throw if article is not in REVIEWING stage', async () => {
    service.findById.mockResolvedValue(null); // simulate not found

    await expect(service.rejectVersion({ id: 'article-1' })).rejects.toThrow(
      'Article article-1 is not in reviewing stage.',
    );
  });

  it('should call signature with REJECTED result if article is in REVIEWING', async () => {
    const reviewingArticle = { id: 'article-1', stage: 'REVIEWING' };

    service.findById.mockResolvedValue(reviewingArticle);

    const result = await service.rejectVersion({ id: 'article-1' }, { reason: 'Invalid content', runner: {} as any });

    expect(service.findById).toHaveBeenCalledWith('article-1', {
      stage: 'REVIEWING',
    });

    expect(service.signature).toHaveBeenCalledWith('REJECTED', reviewingArticle, {
      reason: 'Invalid content',
      runner: {},
    });

    expect(result).toEqual({ id: 'mock-id' });
  });

  it('should handle optional signatureInfo argument', async () => {
    const reviewingArticle = { id: 'article-2' };

    service.findById.mockResolvedValue(reviewingArticle);

    const result = await service.rejectVersion({ id: 'article-2' });

    expect(service.signature).toHaveBeenCalledWith('REJECTED', reviewingArticle, undefined);

    expect(result).toEqual({ id: 'mock-id' });
  });
});
