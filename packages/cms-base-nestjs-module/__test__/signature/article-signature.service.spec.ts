import { BaseSignatureLevelEntity } from '../../src/models/base-signature-level.entity';
import { SignatureService } from '../../src/services/signature.service';
import { MockQueryRunner } from '../typings/mock-repository.interface';
import { createMockRepositoryPartial, createMockDataSourcePartial } from '../typings/mock-types.interface';

describe('SignatureService.signatureEnabled', () => {
  it('returns true when signatureLevels has items', () => {
    const service = new SignatureService(
      ['REVIEW'],
      createMockRepositoryPartial('signature_levels'),
      createMockDataSourcePartial(),
      createMockRepositoryPartial('article_signatures'),
    );

    expect(service.signatureEnabled).toBe(true);
  });
});

describe('SignatureService.finalSignatureLevel', () => {
  it('returns the last item in signatureLevelsCache if present', () => {
    const level1 = Object.assign(new BaseSignatureLevelEntity(), {
      name: 'REVIEW',
    });

    const level2 = Object.assign(new BaseSignatureLevelEntity(), {
      name: 'FINAL',
    });

    const service = new SignatureService(
      [],
      createMockRepositoryPartial('signature_levels'),
      createMockDataSourcePartial(),
      createMockRepositoryPartial('article_signatures'),
    );

    service.signatureLevelsCache = [level1, level2];

    expect(service.finalSignatureLevel).toBe(level2);
  });

  it('should return null if signatureLevelsCache is empty', () => {
    const service = new SignatureService(
      [],
      createMockRepositoryPartial('signature_levels'),
      createMockDataSourcePartial(),
      createMockRepositoryPartial('article_signatures'),
    );

    service.signatureLevelsCache = [];

    expect(service.finalSignatureLevel).toBeNull();
  });
});

describe('SignatureService.onApplicationBootstrap', () => {
  let service: SignatureService;
  let mockRunner: any;
  let mockDataSource: any;
  let mockSignatureRepo: any;
  let mockSignatureLevelRepo: any;

  const existingLevels = [
    { id: '1', name: 'OLD', sequence: 0, required: false },
    { id: '2', name: 'REVIEW', sequence: 1, required: false },
  ];

  const newLevels = ['REVIEW', 'FINAL'];

  beforeEach(() => {
    mockRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        delete: jest.fn().mockResolvedValue(undefined),
        softDelete: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
      },
    };

    mockDataSource = {
      createQueryRunner: (): MockQueryRunner => mockRunner,
    };

    mockSignatureLevelRepo = {
      find: jest.fn().mockResolvedValue(existingLevels),
      metadata: { tableName: 'signature_level' },
      create: jest.fn(data => ({ id: 'new-id', ...data })),
    };

    mockSignatureRepo = {
      metadata: { tableName: 'article_signature' },
    };

    service = new SignatureService(newLevels, mockSignatureLevelRepo, mockDataSource, mockSignatureRepo);
  });

  it('should do nothing if signature is not enabled', async () => {
    service = new SignatureService([], mockSignatureLevelRepo, mockDataSource, mockSignatureRepo);

    const result = await service.onApplicationBootstrap();

    expect(result).toBeUndefined();
  });

  it('should soft delete unused levels and save the provided levels', async () => {
    await service.onApplicationBootstrap();

    expect(mockRunner.manager.delete).toHaveBeenCalledWith(
      'article_signature',
      expect.objectContaining({ signatureLevelId: '1' }),
    );

    expect(mockRunner.manager.softDelete).toHaveBeenCalledWith('signature_level', expect.objectContaining({ id: '1' }));

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'REVIEW',
        sequence: 0,
        required: true,
      }),
    );

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'FINAL',
        sequence: 1,
        required: true,
      }),
    );

    expect(service.signatureLevelsCache).toHaveLength(1);
    expect(service.signatureLevelsCache[0].name).toBe('REVIEW');

    expect(mockRunner.commitTransaction).toHaveBeenCalled();
  });

  it('should rollback and rethrow if any error occurs', async () => {
    mockRunner.manager.save = jest.fn().mockRejectedValue(new Error('DB Error'));

    await expect(service.onApplicationBootstrap()).rejects.toThrow('DB Error');
    expect(mockRunner.rollbackTransaction).toHaveBeenCalled();
    expect(mockRunner.release).toHaveBeenCalled();
  });

  it('should update and save signature level if provided as entity instance', async () => {
    const levelInstance = Object.assign(new BaseSignatureLevelEntity(), {
      name: 'ENTITY_LEVEL',
      id: 'entity-id',
      sequence: 0,
      required: false,
    });

    const mockRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        delete: jest.fn(),
        softDelete: jest.fn(),
        save: jest.fn().mockImplementation(e => Promise.resolve(e)),
      },
    };

    const mockDataSource = {
      createQueryRunner: (): MockQueryRunner => mockRunner,
    };

    const mockSignatureLevelRepo = {
      find: jest.fn().mockResolvedValue([]),
      metadata: { tableName: 'signature_level' },
      create: jest.fn(),
    };

    const mockSignatureRepo = {
      metadata: { tableName: 'article_signature' },
    };

    const service = new SignatureService([levelInstance], mockSignatureLevelRepo, mockDataSource, mockSignatureRepo);

    await service.onApplicationBootstrap();

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ENTITY_LEVEL',
        sequence: 0,
        required: true,
      }),
    );

    expect(service.signatureLevelsCache).toHaveLength(1);
    expect(service.signatureLevelsCache[0].name).toBe('ENTITY_LEVEL');
  });
});
