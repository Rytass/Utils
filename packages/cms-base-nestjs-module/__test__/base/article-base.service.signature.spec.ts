import { IsNull } from 'typeorm';
import { BaseSignatureLevelEntity } from '../../src/models/base-signature-level.entity';
import { ArticleBaseService } from '../../src/services/article-base.service';
import { SignatureService } from '../../src/services/signature.service';
import { ArticleStage } from '../../src/typings/article-stage.enum';
import { ArticleSignatureResult } from '../../src/typings/article-signature-result.enum';
import { MockQueryRunner, MockSignatureService } from '../typings/mock-repository.interface';
import {
  TestableArticleBaseService,
  MockRepositoryForService,
  MockServiceDataSource,
  MockServiceDataLoader,
} from '../typings/mock-types.interface';

describe('ArticleBaseService.signature', () => {
  let service: TestableArticleBaseService;
  let runner: MockQueryRunner;

  beforeEach(() => {
    jest.resetAllMocks();
    runner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        createQueryBuilder: jest.fn(() => ({
          andWhere: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        })),
        update: jest.fn(),
        softDelete: jest.fn(),
        save: jest.fn().mockImplementation(data => Promise.resolve(data)),
        exists: jest.fn().mockResolvedValue(true),
      },
    };

    const mockSignatureService = {
      signatureEnabled: true,
      finalSignatureLevel: {
        id: 'level-2',
        name: 'FINAL',
        sequence: 2,
        required: true,
        createdAt: new Date(),
        deletedAt: null,
        signatures: [],
      },
      signatureLevelsCache: [
        {
          id: 'level-1',
          name: 'REVIEW',
          sequence: 1,
          required: true,
          createdAt: new Date(),
          deletedAt: null,
          signatures: [],
        },
        {
          id: 'level-2',
          name: 'FINAL',
          sequence: 2,
          required: true,
          createdAt: new Date(),
          deletedAt: null,
          signatures: [],
        },
      ],
      signatureLevelRepo: {} as MockRepositoryForService,
      dataSource: {} as MockServiceDataSource,
      articleSignatureRepo: {} as MockRepositoryForService,
      onApplicationBootstrap: jest.fn(),
    } as unknown as SignatureService<BaseSignatureLevelEntity>;

    service = new ArticleBaseService(
      {} as MockRepositoryForService,
      {
        exists: jest.fn().mockResolvedValue(true),
        metadata: { tableName: 'version' },
      } as MockRepositoryForService,
      { metadata: { tableName: 'content' } } as MockRepositoryForService,
      {} as MockRepositoryForService,
      false,
      false,
      true,
      [],
      {} as MockRepositoryForService,
      {
        metadata: { tableName: 'signatures' },
        create: jest.fn(input => input),
      } as MockRepositoryForService,
      true,
      { createQueryRunner: () => runner } as MockServiceDataSource,
      {
        stageCache: {
          set: jest.fn(),
        },
      } as MockServiceDataLoader,
      mockSignatureService,
    );

    jest.spyOn(service, 'findById').mockResolvedValue({ id: 'article-id', version: 1 });

    jest.spyOn(service, 'updateSignaturedArticleStageCache').mockImplementation();
  });

  it('should throw if signature mode is disabled', async () => {
    service.signatureService.signatureEnabled = false;

    await expect(service['signature'](ArticleSignatureResult.APPROVED, { id: 'a1', version: 1 })).rejects.toThrow(
      'Signature is not enabled',
    );
  });

  it('should throw if article version does not exist', async () => {
    service.baseArticleVersionRepo.exists = jest.fn().mockResolvedValue(false);

    await expect(service['signature'](ArticleSignatureResult.REJECTED, { id: 'a1', version: 1 })).rejects.toThrow(
      'Invalid article version',
    );
  });

  it('should throw if signature level is required but not provided', async () => {
    await expect(service['signature'](ArticleSignatureResult.APPROVED, { id: 'a1', version: 1 }, {})).rejects.toThrow(
      'Signature level is required',
    );
  });

  it('should throw if signature level is invalid', async () => {
    await expect(
      service['signature'](ArticleSignatureResult.APPROVED, { id: 'a1', version: 1 }, { signatureLevel: 'INVALID' }),
    ).rejects.toThrow('Invalid signature level');
  });

  it('should throw if previous required signature is missing', async () => {
    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }));

    await expect(
      service['signature'](ArticleSignatureResult.APPROVED, { id: 'a1', version: 1 }, { signatureLevel: 'FINAL' }),
    ).rejects.toThrow('Previous valid signature not found');
  });

  it('should soft delete existing rejected signature and replace it', async () => {
    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([{ id: 'sig1', signatureLevelId: 'level-1', result: ArticleSignatureResult.REJECTED }]),
    }));

    await service['signature'](ArticleSignatureResult.REJECTED, { id: 'a1', version: 1 }, { signatureLevel: 'REVIEW' });

    expect(runner.manager.softDelete).toHaveBeenCalledWith('signatures', {
      id: 'sig1',
    });

    expect(runner.manager.save).toHaveBeenCalled();
  });

  it('should throw Already signed if signature exists and not rejected', async () => {
    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([{ id: 'sig1', signatureLevelId: 'level-1', result: ArticleSignatureResult.APPROVED }]),
    }));

    await expect(
      service['signature'](ArticleSignatureResult.APPROVED, { id: 'a1', version: 1 }, { signatureLevel: 'REVIEW' }),
    ).rejects.toThrow('Already signed');
  });

  it('should save new signature and update article if placedArticle exists', async () => {
    service.findById = jest.fn().mockResolvedValue({ id: 'a1', version: 1 });

    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }));

    const result = await service['signature'](
      ArticleSignatureResult.REJECTED,
      { id: 'a1', version: 1 },
      { signatureLevel: 'REVIEW', reason: 'bad', signerId: 'user1' },
    );

    expect(runner.manager.save).toHaveBeenCalled();
    expect(runner.manager.softDelete).toHaveBeenCalledWith('version', {
      articleId: 'a1',
      version: 1,
    });

    expect(result).toBeDefined();
  });

  it('should rollback transaction on error', async () => {
    runner.manager.save = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(
      service['signature'](ArticleSignatureResult.APPROVED, { id: 'a1', version: 1 }, { signatureLevel: 'REVIEW' }),
    ).rejects.toThrow('fail');

    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('should throw if runner exists but article version does not', async () => {
    const mockRunner = {
      manager: {
        exists: jest.fn().mockResolvedValue(false),
        createQueryBuilder: jest.fn(() => ({
          andWhere: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        })),
        save: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
      },
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };

    service.dataSource.createQueryRunner = (): MockQueryRunner => mockRunner;

    await expect(
      service['signature'](
        ArticleSignatureResult.REJECTED,
        { id: 'a1', version: 1 },
        {
          runner: mockRunner,
          signatureLevel: 'REVIEW',
          signerId: 'user-1',
        },
      ),
    ).rejects.toThrow('Invalid article version');

    expect(mockRunner.manager.exists).toHaveBeenCalled();
  });

  it('should resolve targetLevelIndex from signatureLevel entity instance', async () => {
    const levelEntity = new BaseSignatureLevelEntity();

    levelEntity.id = 'level-1';
    levelEntity.name = 'REVIEW';

    service.signatureService.signatureLevelsCache = [levelEntity];

    const result = await service['signature'](
      ArticleSignatureResult.APPROVED,
      { id: 'a1', version: 1 },
      { signatureLevel: levelEntity, signerId: 'user1' },
    );

    expect(result).toBeDefined();
  });

  it('should use default targetLevelIndex when no signatureLevel is given', async () => {
    service.signatureService.signatureLevelsCache = [
      {
        id: 'level-1',
        name: 'REVIEW',
        sequence: 1,
        required: true,
        createdAt: new Date(),
        deletedAt: null,
        signatures: [],
      },
    ];

    const result = await service['signature'](
      ArticleSignatureResult.REJECTED,
      { id: 'a1', version: 1 },
      { signerId: 'user1' },
    );

    expect(result).toBeDefined();
  });

  it('should throw if previous signature exists but is not approved', async () => {
    service.signatureService.signatureLevelsCache = [
      {
        id: 'level-1',
        name: 'REVIEW',
        sequence: 1,
        required: true,
        createdAt: new Date(),
        deletedAt: null,
        signatures: [],
      },
      {
        id: 'level-2',
        name: 'FINAL',
        sequence: 2,
        required: true,
        createdAt: new Date(),
        deletedAt: null,
        signatures: [],
      },
    ];

    const mockSignature = {
      id: 'sig-1',
      signatureLevelId: 'level-1',
      result: ArticleSignatureResult.REJECTED,
    };

    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockSignature]),
    }));

    await expect(
      service['signature'](
        ArticleSignatureResult.APPROVED,
        { id: 'a1', version: 1 },
        { signatureLevel: 'FINAL', signerId: 'user1' },
      ),
    ).rejects.toThrow('Previous valid signature not found');
  });

  it('should auto-release when signature is approved at final level and draftMode + autoReleaseAfterApproved are true', async () => {
    service.draftMode = true;
    service.autoReleaseAfterApproved = true;

    const finalLevel = {
      id: 'level-2',
      name: 'FINAL',
      sequence: 2,
      required: true,
      createdAt: new Date(),
      deletedAt: null,
      signatures: [],
    };

    const reviewLevel = {
      id: 'level-1',
      name: 'REVIEW',
      sequence: 1,
      required: true,
      createdAt: new Date(),
      deletedAt: null,
      signatures: [],
    };

    service.signatureService.signatureLevelsCache = [reviewLevel, finalLevel];
    service.signatureService.finalSignatureLevel = finalLevel;

    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          signatureLevelId: 'level-1',
          result: ArticleSignatureResult.APPROVED,
        },
      ]),
    }));

    service.articleSignatureRepo.create = jest.fn(data => data);

    const result = await service['signature'](
      ArticleSignatureResult.APPROVED,
      { id: 'a1', version: 1 },
      { signatureLevel: 'FINAL', signerId: 'user1' },
    );

    expect(runner.manager.update).toHaveBeenCalledWith(
      'version',
      {
        articleId: 'a1',
        version: 1,
        releasedAt: IsNull(),
      },
      expect.objectContaining({
        releasedAt: expect.any(Date),
      }),
    );

    expect(result).toBeDefined();
  });

  it('should throw Already signed if targetLevelIndex is NaN and signatures exist', async () => {
    service.findById = jest.fn().mockResolvedValueOnce(null);

    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'sig1', signatureLevelId: 'level-x' }]),
    }));

    service.signatureService.signatureLevelsCache = [
      {
        id: 'level-1',
        name: 'REVIEW',
        sequence: 1,
        required: true,
        createdAt: new Date(),
        deletedAt: null,
        signatures: [],
      },
    ];

    jest.spyOn(service.signatureService.signatureLevelsCache, 'findIndex').mockReturnValue(-1);

    await expect(
      service['signature'](ArticleSignatureResult.APPROVED, { id: 'a1', version: 1 }, { signatureLevel: 'INVALID' }),
    ).rejects.toThrow('Already signed');
  });

  it('should create a signature without level if targetLevelIndex is NaN and no signatures exist', async () => {
    service.findById = jest.fn().mockResolvedValueOnce(null);

    jest.spyOn(service.signatureService.signatureLevelsCache, 'findIndex').mockReturnValue(-1);

    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }));

    const mockCreate = jest.fn(data => data);

    service.articleSignatureRepo.create = mockCreate;

    await service['signature'](
      ArticleSignatureResult.REJECTED,
      { id: 'a1', version: 1 },
      { signerId: 'user-x', reason: 'not good', signatureLevel: 'SOME_LEVEL' },
    );

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: 'a1',
        version: 1,
        result: ArticleSignatureResult.REJECTED,
        signerId: 'user-x',
        rejectReason: 'not good',
      }),
    );
  });

  it('should set signerId to null if not provided (targetLevelIndex NaN)', async () => {
    service.findById = jest.fn().mockResolvedValueOnce(null);

    jest.spyOn(service.signatureService.signatureLevelsCache, 'findIndex').mockReturnValue(-1);

    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }));

    const mockCreate = jest.fn(data => {
      expect(data.signerId).toBeNull();

      return data;
    });

    service.articleSignatureRepo.create = mockCreate;

    await service['signature'](
      ArticleSignatureResult.REJECTED,
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'UNKNOWN_LEVEL',
        reason: 'valid reason', // no signerId
      },
    );
  });

  it('should set rejectReason to null if REJECTED but no reason given (targetLevelIndex NaN)', async () => {
    service.findById = jest.fn().mockResolvedValueOnce(null);

    jest.spyOn(service.signatureService.signatureLevelsCache, 'findIndex').mockReturnValue(-1);

    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }));

    const mockCreate = jest.fn(data => {
      expect(data.rejectReason).toBeNull();

      return data;
    });

    service.articleSignatureRepo.create = mockCreate;

    await service['signature'](
      ArticleSignatureResult.REJECTED,
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'UNKNOWN_LEVEL',
        signerId: 'user-1',
        // no reason
      },
    );
  });

  it('should ignore reason and set rejectReason to null if APPROVED (targetLevelIndex NaN)', async () => {
    service.findById = jest.fn().mockResolvedValueOnce(null);

    jest.spyOn(service.signatureService.signatureLevelsCache, 'findIndex').mockReturnValue(-1);

    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }));

    const mockCreate = jest.fn(data => {
      expect(data.rejectReason).toBeNull(); // reason is ignored

      return data;
    });

    service.articleSignatureRepo.create = mockCreate;

    await service['signature'](
      ArticleSignatureResult.APPROVED,
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'UNKNOWN_LEVEL',
        signerId: 'user-1',
        reason: 'this should be ignored',
      },
    );
  });

  it('should soft delete the version if placedArticle exists and targetLevelIndex is NaN', async () => {
    const mockPlacedArticle = { id: 'a1', version: 1 };

    service.findById = jest
      .fn()
      .mockResolvedValueOnce(mockPlacedArticle)
      .mockResolvedValueOnce({ id: 'a1', version: 1 });

    service.signatureService.signatureLevelsCache = [
      {
        id: 'level-1',
        name: 'REVIEW',
        sequence: 1,
        required: true,
        createdAt: new Date(),
        deletedAt: null,
        signatures: [],
      },
    ];

    jest.spyOn(service.signatureService.signatureLevelsCache, 'findIndex').mockReturnValue(-1);

    runner.manager.createQueryBuilder = jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }));

    const mockCreate = jest.fn(data => data);

    service.articleSignatureRepo.create = mockCreate;

    await service['signature'](
      ArticleSignatureResult.REJECTED,
      { id: 'a1', version: 1 },
      {
        signerId: 'user-x',
        reason: 'not good',
        signatureLevel: 'NON_EXISTENT',
      },
    );

    expect(runner.manager.softDelete).toHaveBeenCalledWith(service.baseArticleVersionRepo.metadata.tableName, {
      articleId: 'a1',
      version: 1,
    });
  });
});

describe('ArticleBaseService.updateSignaturedArticleStageCache', () => {
  let service: ArticleBaseService;
  const mockStageCacheSet = jest.fn();

  beforeEach(() => {
    const mockFinalLevel = {
      id: 'final-level',
      name: 'FINAL',
    };

    service = new ArticleBaseService(
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      false,
      false,
      false,
      [],
      {} as MockRepositoryForService,
      {} as MockRepositoryForService,
      false,
      {} as MockServiceDataSource,
      {
        stageCache: {
          set: mockStageCacheSet,
        },
      } as MockServiceDataLoader,
      {
        finalSignatureLevel: mockFinalLevel,
      } as MockSignatureService,
    );

    jest.clearAllMocks();
  });

  it('should set stage to DRAFT if result is REJECTED', () => {
    service['updateSignaturedArticleStageCache']('cache-key-1', 'any-level', ArticleSignatureResult.REJECTED);

    expect(mockStageCacheSet).toHaveBeenCalledWith('cache-key-1', Promise.resolve(ArticleStage.DRAFT));
  });

  it('should set stage to VERIFIED if level is final and result is APPROVED', () => {
    service['updateSignaturedArticleStageCache']('cache-key-2', 'final-level', ArticleSignatureResult.APPROVED);

    expect(mockStageCacheSet).toHaveBeenCalledWith('cache-key-2', Promise.resolve(ArticleStage.VERIFIED));
  });

  it('should set stage to REVIEWING for intermediate level and APPROVED result', () => {
    service['updateSignaturedArticleStageCache']('cache-key-3', 'intermediate-level', ArticleSignatureResult.APPROVED);

    expect(mockStageCacheSet).toHaveBeenCalledWith('cache-key-3', Promise.resolve(ArticleStage.REVIEWING));
  });

  it('should set stage to REVIEWING if signatureLevelId is null and result is APPROVED', () => {
    service['updateSignaturedArticleStageCache']('cache-key-4', null, ArticleSignatureResult.APPROVED);

    expect(mockStageCacheSet).toHaveBeenCalledWith('cache-key-4', Promise.resolve(ArticleStage.REVIEWING));
  });
});

describe('ArticleBaseService.refreshSignatureLevelsCache', () => {
  let service: ArticleBaseService;
  const mockFind = jest.fn();

  beforeEach(() => {
    const mockSignatureLevelRepo = {
      find: mockFind,
    };

    service = new ArticleBaseService(
      {} as MockRepositoryForService, // dataSource
      {} as MockRepositoryForService, // version repo
      {} as MockRepositoryForService, // content repo
      {} as MockRepositoryForService, // category repo
      false,
      false,
      false,
      [],
      {} as MockRepositoryForService, // article fulltext search
      {} as MockRepositoryForService, // article signature repo
      false,
      {} as MockServiceDataSource, // query runner
      {} as MockServiceDataLoader, // article data loader
      {
        signatureLevelsCache: [],
      } as MockSignatureService, // signature service
    );

    (service as TestableArticleBaseService).signatureLevelRepo = mockSignatureLevelRepo;
  });

  it('should update signatureLevelsCache with ordered results', async () => {
    const mockLevels: BaseSignatureLevelEntity[] = [
      { id: '1', name: 'REVIEW', sequence: 1 } as BaseSignatureLevelEntity,
      { id: '2', name: 'FINAL', sequence: 2 } as BaseSignatureLevelEntity,
    ];

    mockFind.mockResolvedValue(mockLevels);

    await service.refreshSignatureLevelsCache();

    expect(mockFind).toHaveBeenCalledWith({ order: { sequence: 'ASC' } });
    expect((service as TestableArticleBaseService).signatureService.signatureLevelsCache).toEqual(mockLevels);
  });

  it('should set empty array if no levels returned', async () => {
    mockFind.mockResolvedValue([]);

    await service.refreshSignatureLevelsCache();

    expect((service as TestableArticleBaseService).signatureService.signatureLevelsCache).toEqual([]);
  });
});
