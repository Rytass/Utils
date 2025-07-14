import { Test } from '@nestjs/testing';
import { ArticleDataLoader } from '../../src/data-loaders/article.dataloader';
import { SignatureService } from '../../src/services/signature.service';
import {
  RESOLVED_ARTICLE_REPO,
  RESOLVED_ARTICLE_VERSION_REPO,
} from '../../src/typings/cms-base-providers';
import { Repository } from 'typeorm';
import { ArticleSignatureResult } from '../../src/typings/article-signature-result.enum';
import { ArticleStage } from '../../src/typings/article-stage.enum';
import { BaseSignatureLevelEntity } from '../../src/models/base-signature-level.entity';

describe('ArticleDataLoader', () => {
  let dataLoader: ArticleDataLoader;
  let articleRepo: jest.Mocked<Repository<any>>;
  let versionRepo: jest.Mocked<Repository<any>>;
  let signatureService: Partial<SignatureService>;

  beforeEach(async () => {
    articleRepo = { createQueryBuilder: jest.fn() } as any;
    versionRepo = { createQueryBuilder: jest.fn() } as any;
    signatureService = {
      finalSignatureLevel: {
        id: 'final',
        name: 'Final Level',
        sequence: 1,
        required: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        signatures: [],
        deletedAt: null,
      } as BaseSignatureLevelEntity,
    };

    const module = await Test.createTestingModule({
      providers: [
        ArticleDataLoader,
        { provide: RESOLVED_ARTICLE_REPO, useValue: articleRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: versionRepo },
        { provide: SignatureService, useValue: signatureService },
      ],
    }).compile();

    dataLoader = module.get(ArticleDataLoader);
  });

  it('should return RELEASED if releasedAt is in the past', async () => {
    const version = {
      articleId: 'a1',
      version: 1,
      releasedAt: new Date(Date.now() - 1000),
      signatures: [],
    };

    const qb = {
      withDeleted: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([version]),
    };

    versionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await dataLoader.stageLoader.load({ id: 'a1', version: 1 });

    expect(result).toBe(ArticleStage.RELEASED);
  });

  it('should return SCHEDULED if releasedAt is in the future', async () => {
    const version = {
      articleId: 'a1',
      version: 1,
      releasedAt: new Date(Date.now() + 10000),
      signatures: [],
    };

    const qb = {
      withDeleted: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([version]),
    };

    versionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await dataLoader.stageLoader.load({ id: 'a1', version: 1 });

    expect(result).toBe(ArticleStage.SCHEDULED);
  });

  it('should return VERIFIED if final level signature is approved', async () => {
    const version = {
      articleId: 'a1',
      version: 1,
      releasedAt: null,
      submittedAt: null,
      deletedAt: null,
      signatures: [
        {
          result: ArticleSignatureResult.APPROVED,
          deletedAt: null,
          signatureLevelId: 'final',
        },
      ],
    };

    const qb = {
      withDeleted: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([version]),
    };

    versionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await dataLoader.stageLoader.load({ id: 'a1', version: 1 });

    expect(result).toBe(ArticleStage.VERIFIED);
  });

  it('should return REVIEWING if submittedAt is set but not signed', async () => {
    const version = {
      articleId: 'a1',
      version: 1,
      releasedAt: null,
      submittedAt: new Date(),
      deletedAt: null,
      signatures: [],
    };

    const qb = {
      withDeleted: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([version]),
    };

    versionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await dataLoader.stageLoader.load({ id: 'a1', version: 1 });

    expect(result).toBe(ArticleStage.REVIEWING);
  });

  it('should return DELETED if deletedAt is set', async () => {
    const version = {
      articleId: 'a1',
      version: 1,
      deletedAt: new Date(),
      signatures: [],
    };

    const qb = {
      withDeleted: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([version]),
    };

    versionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await dataLoader.stageLoader.load({ id: 'a1', version: 1 });

    expect(result).toBe(ArticleStage.DELETED);
  });

  it('should return DRAFT if no condition is met', async () => {
    const version = {
      articleId: 'a1',
      version: 1,
      deletedAt: null,
      releasedAt: null,
      submittedAt: null,
      signatures: [],
    };

    const qb = {
      withDeleted: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([version]),
    };

    versionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await dataLoader.stageLoader.load({ id: 'a1', version: 1 });

    expect(result).toBe(ArticleStage.DRAFT);
  });

  it('should return UNKNOWN if version is not found', async () => {
    const qb = {
      withDeleted: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    versionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await dataLoader.stageLoader.load({
      id: 'unknown',
      version: 99,
    });

    expect(result).toBe(ArticleStage.UNKNOWN);
  });

  it('should return categories for matched article', async () => {
    const articles = [{ id: 'a1', categories: [{ id: 'c1' }, { id: 'c2' }] }];

    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(articles),
    };

    articleRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await dataLoader.categoriesLoader.load('a1');

    expect(result.length).toBe(2);
    expect(result[0].id).toBe('c1');
  });

  it('should return empty array if no categories found', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    articleRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await dataLoader.categoriesLoader.load('a1');

    expect(result).toEqual([]);
  });

  it('should call orWhere for each query argument', async () => {
    const args = [
      { id: 'a1', version: 1 },
      { id: 'a2', version: 2 },
      { id: 'a3', version: 3 },
    ];

    const orWhereMock = jest.fn();

    const andWhereSpy: any = jest.fn((brackets) => {
      brackets({ orWhere: orWhereMock });

      return qb;
    });

    const qb = {
      withDeleted: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: andWhereSpy,
      getMany: jest.fn().mockResolvedValue([]),
    };

    versionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const bracketsSpy = jest
      .spyOn(require('typeorm'), 'Brackets')
      .mockImplementation((callback: any) => {
        callback({ orWhere: orWhereMock });

        return { __mocked: true } as any;
      });

    await dataLoader.stageLoader.loadMany(args);

    expect(bracketsSpy).toHaveBeenCalled();
    expect(orWhereMock).toHaveBeenCalledTimes(3);

    args.forEach((arg, index) => {
      expect(orWhereMock).toHaveBeenCalledWith(
        `versions.articleId = :id_${index} AND versions.version = :version_${index}`,
        {
          [`id_${index}`]: arg.id,
          [`version_${index}`]: arg.version,
        },
      );
    });

    bracketsSpy.mockRestore();
  });
});
