import { Test, TestingModule } from '@nestjs/testing';
import { ArticleSignatureService } from '../../src/services/article-signature.service';
import {
  AUTO_RELEASE_AFTER_APPROVED,
  DRAFT_MODE,
  ENABLE_SIGNATURE_MODE,
  RESOLVED_ARTICLE_VERSION_REPO,
  RESOLVED_SIGNATURE_LEVEL_REPO,
  SIGNATURE_LEVELS,
} from '../../src/typings/cms-base-providers';
import { ArticleSignatureRepo } from '../../src/models/article-signature.entity';
import { DataSource } from 'typeorm';
import { ArticleSignatureResult } from '../../src/typings/article-signature-result.enum';
import { BaseSignatureLevelEntity } from '../../src/models/base-signature-level.entity';

describe('ArticleSignatureService.finalSignatureLevel', () => {
  let service: ArticleSignatureService<any>;
  const existsMock = jest.fn();
  const saveMock = jest.fn();
  const updateMock = jest.fn();
  const getManyMock = jest.fn();
  const softDeleteMock = jest.fn();

  const createQueryBuilderMock = {
    andWhere: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getMany: getManyMock,
  };

  const runner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilderMock),
      save: saveMock,
      update: updateMock,
      softDelete: softDeleteMock,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleSignatureService,
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: { exists: existsMock, target: 'ArticleVersion' },
        },
        {
          provide: ArticleSignatureRepo,
          useValue: { create: jest.fn((data) => data) },
        },
        {
          provide: RESOLVED_SIGNATURE_LEVEL_REPO,
          useValue: {},
        },
        { provide: ENABLE_SIGNATURE_MODE, useValue: true },
        { provide: DRAFT_MODE, useValue: true },
        { provide: AUTO_RELEASE_AFTER_APPROVED, useValue: true },
        { provide: SIGNATURE_LEVELS, useValue: ['LV1', 'LV2'] },
        { provide: DataSource, useValue: { createQueryRunner: () => runner } },
      ],
    }).compile();

    service = module.get<ArticleSignatureService<any>>(ArticleSignatureService);

    // Manually inject signature level cache
    (service as any).signatureLevelsCache = [
      { id: '1', name: 'LV1', required: true },
      { id: '2', name: 'LV2', required: true },
    ];

    jest.clearAllMocks();
  });

  it('should return the last item from signatureLevelsCache as finalSignatureLevel', () => {
    const finalLevel = service.finalSignatureLevel;

    expect(finalLevel).toEqual({
      id: '2',
      name: 'LV2',
      required: true,
    });
  });

  it('should return null if signatureLevelsCache is empty', () => {
    (service as any).signatureLevelsCache = [];

    const finalLevel = service.finalSignatureLevel;

    expect(finalLevel).toBeNull();
  });
});

describe('ArticleSignatureService.rejectVersion', () => {
  let service: ArticleSignatureService<any>;
  const existsMock = jest.fn();
  const saveMock = jest.fn();
  const updateMock = jest.fn();
  const getManyMock = jest.fn();
  const softDeleteMock = jest.fn();

  const createQueryBuilderMock = {
    andWhere: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getMany: getManyMock,
  };

  const runner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilderMock),
      save: saveMock,
      update: updateMock,
      softDelete: softDeleteMock,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleSignatureService,
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: { exists: existsMock, target: 'ArticleVersion' },
        },
        {
          provide: ArticleSignatureRepo,
          useValue: { create: jest.fn((data) => data) },
        },
        {
          provide: RESOLVED_SIGNATURE_LEVEL_REPO,
          useValue: {},
        },
        { provide: ENABLE_SIGNATURE_MODE, useValue: true },
        { provide: DRAFT_MODE, useValue: true },
        { provide: AUTO_RELEASE_AFTER_APPROVED, useValue: true },
        { provide: SIGNATURE_LEVELS, useValue: ['LV1', 'LV2'] },
        { provide: DataSource, useValue: { createQueryRunner: () => runner } },
      ],
    }).compile();

    service = module.get<ArticleSignatureService<any>>(ArticleSignatureService);

    // Manually inject signature level cache
    (service as any).signatureLevelsCache = [
      { id: '1', name: 'LV1', required: true },
      { id: '2', name: 'LV2', required: true },
    ];

    jest.clearAllMocks();
  });

  it('should call signature() with REJECTED result in rejectVersion()', async () => {
    const signatureSpy = jest
      .spyOn(service as any, 'signature')
      .mockResolvedValue('mocked-signature' as any);

    const version = { id: 'a1', version: 1 };
    const info = {
      signatureLevel: 'LV1',
      signerId: 'u1',
      reason: 'Not acceptable',
    };

    const result = await service.rejectVersion(version, info);

    expect(signatureSpy).toHaveBeenCalledWith(
      ArticleSignatureResult.REJECTED,
      version,
      info,
    );

    expect(result).toBe('mocked-signature');
  });
});

describe('ArticleSignatureService.approveVersion', () => {
  let service: ArticleSignatureService<any>;
  const existsMock = jest.fn();
  const saveMock = jest.fn();
  const updateMock = jest.fn();
  const getManyMock = jest.fn();
  const softDeleteMock = jest.fn();

  const createQueryBuilderMock = {
    andWhere: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getMany: getManyMock,
  };

  const runner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilderMock),
      save: saveMock,
      update: updateMock,
      softDelete: softDeleteMock,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleSignatureService,
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: { exists: existsMock, target: 'ArticleVersion' },
        },
        {
          provide: ArticleSignatureRepo,
          useValue: { create: jest.fn((data) => data) },
        },
        {
          provide: RESOLVED_SIGNATURE_LEVEL_REPO,
          useValue: {},
        },
        { provide: ENABLE_SIGNATURE_MODE, useValue: true },
        { provide: DRAFT_MODE, useValue: true },
        { provide: AUTO_RELEASE_AFTER_APPROVED, useValue: true },
        { provide: SIGNATURE_LEVELS, useValue: ['LV1', 'LV2'] },
        { provide: DataSource, useValue: { createQueryRunner: () => runner } },
      ],
    }).compile();

    service = module.get<ArticleSignatureService<any>>(ArticleSignatureService);

    // Manually inject signature level cache
    (service as any).signatureLevelsCache = [
      { id: '1', name: 'LV1', required: true },
      { id: '2', name: 'LV2', required: true },
    ];

    jest.clearAllMocks();
  });

  it('should call signature() with APPROVED result in approveVersion()', async () => {
    const signatureSpy = jest
      .spyOn(service as any, 'signature')
      .mockResolvedValue('mocked-signature' as any);

    const version = { id: 'a1', version: 1 };
    const info = {
      signatureLevel: 'LV2',
      signerId: 'user123',
    };

    const result = await service.approveVersion(version, info);

    expect(signatureSpy).toHaveBeenCalledWith(
      ArticleSignatureResult.APPROVED,
      version,
      info,
    );

    expect(result).toBe('mocked-signature');
  });
});

describe('ArticleSignatureService.signature', () => {
  let service: ArticleSignatureService<any>;
  const existsMock = jest.fn();
  const saveMock = jest.fn();
  const updateMock = jest.fn();
  const getManyMock = jest.fn();
  const softDeleteMock = jest.fn();

  const createQueryBuilderMock = {
    andWhere: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getMany: getManyMock,
  };

  const runner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn().mockReturnValue(createQueryBuilderMock),
      save: saveMock,
      update: updateMock,
      softDelete: softDeleteMock,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleSignatureService,
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: { exists: existsMock, target: 'ArticleVersion' },
        },
        {
          provide: ArticleSignatureRepo,
          useValue: { create: jest.fn((data) => data) },
        },
        {
          provide: RESOLVED_SIGNATURE_LEVEL_REPO,
          useValue: {},
        },
        { provide: ENABLE_SIGNATURE_MODE, useValue: true },
        { provide: DRAFT_MODE, useValue: true },
        { provide: AUTO_RELEASE_AFTER_APPROVED, useValue: true },
        { provide: SIGNATURE_LEVELS, useValue: ['LV1', 'LV2'] },
        { provide: DataSource, useValue: { createQueryRunner: () => runner } },
      ],
    }).compile();

    service = module.get<ArticleSignatureService<any>>(ArticleSignatureService);

    // Manually inject signature level cache
    (service as any).signatureLevelsCache = [
      { id: '1', name: 'LV1', required: true },
      { id: '2', name: 'LV2', required: true },
    ];

    jest.clearAllMocks();
  });

  it('should throw if article version does not exist', async () => {
    existsMock.mockResolvedValue(false);

    await expect(
      service['signature'](ArticleSignatureResult.APPROVED, {
        id: 'a1',
        version: 1,
      }),
    ).rejects.toThrow('Invalid article version');
  });

  it('should match signatureLevel using instance of BaseSignatureLevelEntity', async () => {
    existsMock.mockResolvedValue(true);

    const levelInstance = new BaseSignatureLevelEntity();

    levelInstance.id = '2';
    levelInstance.name = 'LV2';
    levelInstance.required = true;

    getManyMock.mockResolvedValue([
      {
        id: 'sig1',
        signatureLevelId: '1',
        result: ArticleSignatureResult.APPROVED,
      },
      {
        id: 'sig2',
        signatureLevelId: '2',
        result: ArticleSignatureResult.REJECTED,
      },
    ]);

    const result = await service['signature'](
      ArticleSignatureResult.APPROVED,
      { id: 'a1', version: 1 },
      {
        signatureLevel: levelInstance,
        signerId: 'user1',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        articleId: 'a1',
        version: 1,
        signatureLevelId: '2',
        result: ArticleSignatureResult.APPROVED,
      }),
    );

    expect(softDeleteMock).toHaveBeenCalledWith(expect.anything(), {
      id: 'sig2',
    });
  });

  it('should throw on invalid signature level', async () => {
    existsMock.mockResolvedValue(true);

    await expect(
      service['signature'](
        ArticleSignatureResult.APPROVED,
        { id: 'a1', version: 1 },
        { signatureLevel: 'INVALID', signerId: 'u1' },
      ),
    ).rejects.toThrow('Invalid signature level');
  });

  it('should throw if signatureLevel is missing when signatureLevelsCache is not empty', async () => {
    existsMock.mockResolvedValue(true);

    // Ensure levels exist so that level is expected
    (service as any).signatureLevelsCache = [
      { id: '1', name: 'LV1', required: true },
    ];

    await expect(
      service['signature'](
        ArticleSignatureResult.APPROVED,
        { id: 'a1', version: 1 },
        {
          signerId: 'user1',
        },
      ),
    ).rejects.toThrow('Signature level is required');
  });

  it('should throw "Already signed" if signature already exists and is not rejected', async () => {
    existsMock.mockResolvedValue(true);

    getManyMock.mockResolvedValue([
      {
        id: 'sig1',
        signatureLevelId: '1',
        result: ArticleSignatureResult.APPROVED,
      },
      {
        id: 'sig2',
        signatureLevelId: '2',
        result: null,
      },
    ]);

    await expect(
      service['signature'](
        ArticleSignatureResult.APPROVED,
        { id: 'a1', version: 1 },
        { signatureLevel: 'LV1', signerId: 'user1' },
      ),
    ).rejects.toThrow('Already signed');
  });

  it('should match signatureLevel using instance of BaseSignatureLevelEntity', async () => {
    existsMock.mockResolvedValue(true);

    const levelInstance = new BaseSignatureLevelEntity();

    levelInstance.id = '2';
    levelInstance.name = 'LV2';
    levelInstance.required = true;

    getManyMock.mockResolvedValue([
      {
        id: 'sig1',
        signatureLevelId: '1',
        result: ArticleSignatureResult.APPROVED,
      },
      {
        id: 'sig2',
        signatureLevelId: '2',
        result: ArticleSignatureResult.REJECTED,
      },
    ]);

    const result = await service['signature'](
      ArticleSignatureResult.APPROVED,
      { id: 'a1', version: 1 },
      {
        signatureLevel: levelInstance,
        signerId: 'user1',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        articleId: 'a1',
        version: 1,
        signatureLevelId: '2',
        result: ArticleSignatureResult.APPROVED,
      }),
    );

    expect(softDeleteMock).toHaveBeenCalledWith(expect.anything(), {
      id: 'sig2',
    });
  });

  it('should throw if previous required signature is missing from signatureMap', async () => {
    existsMock.mockResolvedValue(true);

    getManyMock.mockResolvedValue([
      {
        id: 'sig2',
        signatureLevelId: '2',
        result: ArticleSignatureResult.REJECTED, // gets soft-deleted
      },
    ]);

    (service as any).signatureLevelsCache = [
      { id: '1', name: 'LV1', required: true },
      { id: '2', name: 'LV2', required: true },
    ];

    await expect(
      service['signature'](
        ArticleSignatureResult.APPROVED,
        { id: 'a1', version: 1 },
        { signatureLevel: 'LV2', signerId: 'u123' },
      ),
    ).rejects.toThrow('Previous valid signature not found');
  });

  it('should soft-delete rejected signature and create new one', async () => {
    existsMock.mockResolvedValue(true);

    getManyMock.mockResolvedValue([
      {
        id: 'sig1',
        signatureLevelId: '1',
        result: ArticleSignatureResult.APPROVED,
      },
      {
        id: 'sig2',
        signatureLevelId: '2',
        result: ArticleSignatureResult.REJECTED,
      },
    ]);

    const result = await service['signature'](
      ArticleSignatureResult.APPROVED,
      { id: 'a1', version: 1 },
      { signatureLevel: 'LV2', signerId: 'u1' },
    );

    expect(softDeleteMock).toHaveBeenCalledWith(expect.anything(), {
      id: 'sig2',
    });

    expect(result.result).toBe(ArticleSignatureResult.APPROVED);
  });

  it('should throw if previous required signature is not approved', async () => {
    existsMock.mockResolvedValue(true);

    getManyMock.mockResolvedValue([
      {
        id: 'sig1',
        signatureLevelId: '1',
        result: ArticleSignatureResult.REJECTED,
      },
    ]);

    await expect(
      service['signature'](
        ArticleSignatureResult.APPROVED,
        { id: 'a1', version: 1 },
        { signatureLevel: 'LV2', signerId: 'u1' },
      ),
    ).rejects.toThrow('Previous valid signature not found');
  });

  it('should update releasedAt if final signature level is approved and auto-release is enabled', async () => {
    existsMock.mockResolvedValue(true);

    getManyMock.mockResolvedValue([
      { signatureLevelId: '1', result: ArticleSignatureResult.APPROVED },
    ]);

    const now = new Date();

    jest.useFakeTimers().setSystemTime(now);

    const result = await service['signature'](
      ArticleSignatureResult.APPROVED,
      { id: 'a1', version: 1 },
      { signatureLevel: 'LV2', signerId: 'u1' },
    );

    expect(updateMock).toHaveBeenCalledWith(
      'ArticleVersion',
      { id: 'a1', version: 1, releasedAt: expect.anything() },
      { releasedAt: now },
    );
  });

  it('should enter Number.NaN path if signatureLevel is explicitly undefined', async () => {
    existsMock.mockResolvedValue(true);
    getManyMock.mockResolvedValue([]); // simulate no prior signatures

    // Remove all signature levels to avoid early throw
    (service as any).signatureLevelsCache = [];

    const result = await service['signature'](
      ArticleSignatureResult.APPROVED,
      { id: 'a1', version: 1 },
      {
        signatureLevel: undefined, // 👈 explicitly triggers `Number.NaN` path
        signerId: 'user123',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        articleId: 'a1',
        version: 1,
        result: ArticleSignatureResult.APPROVED,
        signerId: 'user123',
      }),
    );
  });

  it('should set signerId to null when it is not provided in signatureInfo', async () => {
    existsMock.mockResolvedValue(true);

    getManyMock.mockResolvedValue([]); // no prior signatures

    const result = await service['signature'](
      ArticleSignatureResult.APPROVED,
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'LV1',
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        articleId: 'a1',
        version: 1,
        signatureLevelId: '1',
        result: ArticleSignatureResult.APPROVED,
        signerId: null,
      }),
    );
  });

  it('should assign rejectReason from signatureInfo when result is REJECTED', async () => {
    existsMock.mockResolvedValue(true);
    getManyMock.mockResolvedValue([]);

    const result = await service['signature'](
      ArticleSignatureResult.REJECTED,
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'LV1',
        signerId: 'user1',
        reason: 'Invalid content',
      },
    );

    expect(result.rejectReason).toBe('Invalid content');
  });

  it('should fallback to null rejectReason when result is REJECTED but reason not provided', async () => {
    existsMock.mockResolvedValue(true);
    getManyMock.mockResolvedValue([]);

    const result = await service['signature'](
      ArticleSignatureResult.REJECTED,
      { id: 'a1', version: 1 },
      {
        signatureLevel: 'LV1',
        signerId: 'user1',
        // no reason field
      },
    );

    expect(result.rejectReason).toBeNull();
  });

  it('should throw "Already signed" when no targetLevelIndex but signatures exist', async () => {
    existsMock.mockResolvedValue(true);

    // simulate no matching signatureLevel, so targetLevelIndex becomes NaN
    (service as any).signatureLevelsCache = [];

    // simulate signatures already exist
    getManyMock.mockResolvedValue([
      {
        id: 'sig-any',
        signatureLevelId: 'x',
        result: ArticleSignatureResult.APPROVED,
      },
    ]);

    await expect(
      service['signature'](
        ArticleSignatureResult.APPROVED,
        { id: 'a1', version: 1 },
        { signatureLevel: undefined, signerId: 'user1' },
      ),
    ).rejects.toThrow('Already signed');
  });

  it('should fallback to null when signerId is not provided', async () => {
    existsMock.mockResolvedValue(true);
    getManyMock.mockResolvedValue([]);

    (service as any).signatureLevelsCache = [];

    const result = await service['signature'](
      ArticleSignatureResult.APPROVED,
      { id: 'a1', version: 1 },
      {
        signatureLevel: undefined,
      },
    );

    expect(result.signerId).toBeNull();
  });

  it('should fallback to null when rejectReason is not provided for REJECTED result', async () => {
    existsMock.mockResolvedValue(true);
    getManyMock.mockResolvedValue([]);

    (service as any).signatureLevelsCache = [];

    const result = await service['signature'](
      ArticleSignatureResult.REJECTED,
      { id: 'a1', version: 1 },
      {
        signerId: 'user1',
        signatureLevel: undefined,
      },
    );

    expect(result.rejectReason).toBeNull();
  });
});

describe('ArticleSignatureService.refreshSignatureLevelsCache', () => {
  let service: ArticleSignatureService<any>;
  const existsMock = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleSignatureService,
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: { exists: existsMock, target: 'ArticleVersion' },
        },
        {
          provide: ArticleSignatureRepo,
          useValue: { create: jest.fn((data) => data) },
        },
        {
          provide: RESOLVED_SIGNATURE_LEVEL_REPO,
          useValue: {}, // Will be overridden in the test
        },
        { provide: ENABLE_SIGNATURE_MODE, useValue: true },
        { provide: DRAFT_MODE, useValue: true },
        { provide: AUTO_RELEASE_AFTER_APPROVED, useValue: true },
        { provide: SIGNATURE_LEVELS, useValue: ['LV1', 'LV2'] },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleSignatureService<any>>(ArticleSignatureService);
  });

  it('should fetch and store signature levels ordered by sequence', async () => {
    const mockSignatureLevels = [
      { id: '1', name: 'LV1', required: true, sequence: 1 },
      { id: '2', name: 'LV2', required: false, sequence: 2 },
    ];

    const findMock = jest.fn().mockResolvedValue(mockSignatureLevels);

    // Inject mocked signatureLevelRepo
    (service as any).signatureLevelRepo = {
      find: findMock,
    };

    await service.refreshSignatureLevelsCache();

    expect(findMock).toHaveBeenCalledWith({ order: { sequence: 'ASC' } });
    expect((service as any).signatureLevelsCache).toEqual(mockSignatureLevels);
  });

  it('should map signatureLevels correctly when containing entity instances and strings', async () => {
    // Arrange
    const levelInstance = new BaseSignatureLevelEntity();

    levelInstance.id = '1';
    levelInstance.name = 'EntityLevel';

    const levelString = 'StringLevel';

    (service as any).signatureLevels = [levelInstance, levelString];

    const findMock = jest.fn().mockResolvedValue([
      { id: '1', name: 'EntityLevel', required: true, sequence: 0 },
      { id: '2', name: 'OLD_LEVEL', required: true, sequence: 1 },
    ]);

    (service as any).signatureLevelRepo = {
      find: findMock,
      create: jest.fn((data) => data),
    };

    const saveMock = jest.fn();
    const deleteMock = jest.fn();
    const softDeleteMock = jest.fn();

    const runnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: saveMock,
        delete: deleteMock,
        softDelete: softDeleteMock,
      },
    };

    (service as any).dataSource = {
      createQueryRunner: () => runnerMock,
    };

    // Act
    await service.onApplicationBootstrap();

    // Assert
    expect(findMock).toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalled();
    expect(softDeleteMock).toHaveBeenCalled();
  });
});

describe('ArticleSignatureService.onApplicationBootstrap', () => {
  const mockSignatureLevels = [
    { id: '1', name: 'LV1', required: true, sequence: 0 },
    { id: '2', name: 'LV2', required: true, sequence: 1 },
  ];

  let service: ArticleSignatureService<any>;
  const findMock = jest.fn();
  const saveMock = jest.fn();
  const deleteMock = jest.fn();
  const softDeleteMock = jest.fn();

  const runnerMock = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: saveMock,
      delete: deleteMock,
      softDelete: softDeleteMock,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleSignatureService,
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: { exists: jest.fn(), target: 'ArticleVersion' },
        },
        {
          provide: ArticleSignatureRepo,
          useValue: { create: jest.fn((data) => data) },
        },
        {
          provide: RESOLVED_SIGNATURE_LEVEL_REPO,
          useValue: {
            find: findMock,
            create: jest.fn((data) => data),
          },
        },
        { provide: ENABLE_SIGNATURE_MODE, useValue: true },
        { provide: DRAFT_MODE, useValue: true },
        { provide: AUTO_RELEASE_AFTER_APPROVED, useValue: true },
        { provide: SIGNATURE_LEVELS, useValue: ['LV1', 'LV2'] },
        {
          provide: DataSource,
          useValue: { createQueryRunner: () => runnerMock },
        },
      ],
    }).compile();

    service = module.get<ArticleSignatureService<any>>(ArticleSignatureService);
    jest.clearAllMocks();
  });

  it('should initialize and sync signatureLevelsCache correctly on bootstrap', async () => {
    // Arrange
    findMock.mockResolvedValue([
      ...mockSignatureLevels,
      { id: '3', name: 'OLD', required: true, sequence: 2 },
    ]);

    const createdLevels: BaseSignatureLevelEntity[] = [];

    saveMock.mockImplementation(async (level: BaseSignatureLevelEntity) => {
      createdLevels.push(level);

      return level;
    });

    // Act
    await service.onApplicationBootstrap();

    // Assert
    expect(findMock).toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith(expect.anything(), {
      signatureLevelId: '3',
    });

    expect(softDeleteMock).toHaveBeenCalledWith(BaseSignatureLevelEntity, {
      id: '3',
    });

    expect(service.finalSignatureLevel?.name).toBe('LV2');
  });

  it('should rollback transaction and throw if an error occurs during bootstrap', async () => {
    // Arrange: existing level that should NOT match target list and cause failure
    findMock.mockResolvedValue([
      { id: '3', name: 'OLD_LEVEL', required: true, sequence: 0 },
    ]);

    // Inject valid signature levels (to be inserted)
    (service as any).signatureLevels = ['LV1'];

    // Force save to fail during runner.manager.save()
    saveMock.mockImplementationOnce(() => {
      throw new Error('Simulated failure');
    });

    // Act + Assert
    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      'Simulated failure',
    );

    expect(runnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(runnerMock.release).toHaveBeenCalled();
  });
});
