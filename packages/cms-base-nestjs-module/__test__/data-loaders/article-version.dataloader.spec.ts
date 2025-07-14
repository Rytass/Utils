import { BaseArticleEntity } from '../../src/models/base-article.entity';
import { BaseArticleVersionEntity } from '../../src/models/base-article-version.entity';
import { BaseArticleVersionContentEntity } from '../../src/models/base-article-version-content.entity';
import {
  RESOLVED_ARTICLE_REPO,
  MULTIPLE_LANGUAGE_MODE,
} from '../../src/typings/cms-base-providers';
import { SignatureService } from '../../src/services/signature.service';
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ArticleStage } from '../../src/typings/article-stage.enum';
import { ArticleSignatureResult } from '../../src/typings/article-signature-result.enum';
import { ArticleVersionDataLoader } from '../../src/data-loaders/article-version.dataloader';

jest.mock('../../src/utils/remove-invalid-fields', () => ({
  removeArticleVersionContentInvalidFields: jest
    .fn()
    .mockImplementation((x) => ({
      version: x?.version ?? 0,
      createdAt: x?.createdAt ?? new Date(),
      createdBy: x?.createdBy ?? 'mock',
    })),
  removeArticleVersionInvalidFields: jest.fn().mockImplementation((x) => ({
    version: x?.version ?? 0,
    createdAt: x?.createdAt ?? new Date(),
    createdBy: x?.createdBy ?? 'mock',
  })),
  removeArticleInvalidFields: jest.fn().mockImplementation((x) => ({
    id: x?.id ?? 'id',
    createdAt: x?.createdAt ?? new Date(),
    deletedAt: x?.deletedAt ?? null,
  })),
  removeMultipleLanguageArticleVersionInvalidFields: jest
    .fn()
    .mockImplementation((x) => ({
      version: x?.version ?? 0,
      createdAt: x?.createdAt ?? new Date(),
      createdBy: x?.createdBy ?? 'mock',
    })),
}));

describe('ArticleVersionDataLoader', () => {
  let loader: ArticleVersionDataLoader;
  let articleRepo: jest.Mocked<Repository<BaseArticleEntity>>;
  let signatureService: Partial<SignatureService>;

  const mockFinalSignatureLevel = {
    id: 'level-final',
    name: 'Final Level',
    sequence: 2,
    required: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    articleRepo = {
      createQueryBuilder: jest.fn(),
    } as any;

    signatureService = {
      finalSignatureLevel: mockFinalSignatureLevel as any,
    };

    const module = await Test.createTestingModule({
      providers: [
        {
          provide: RESOLVED_ARTICLE_REPO,
          useValue: articleRepo,
        },
        {
          provide: MULTIPLE_LANGUAGE_MODE,
          useValue: false,
        },
        {
          provide: SignatureService,
          useValue: signatureService,
        },
        ArticleVersionDataLoader,
      ],
    }).compile();

    loader = module.get(ArticleVersionDataLoader);
  });

  const baseContent = {
    language: 'en',
    title: 'Title',
    summary: 'Summary',
    content: 'Content',
  };

  it('should map version to RELEASED if releasedAt is in the past', async () => {
    const version = {
      articleId: 'a1',
      version: 1,
      releasedAt: new Date(Date.now() - 1000),
      signatures: [],
      multiLanguageContents: [baseContent],
      createdAt: new Date(),
      createdBy: 'user',
    };

    const article = {
      id: 'a1',
      versions: [version],
      createdAt: new Date(),
      deletedAt: null,
    };

    const getMany = jest.fn().mockResolvedValue([article]);
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
    };

    articleRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.stageVersionsLoader.load('a1');

    expect(result[ArticleStage.RELEASED]).toBeTruthy();
    expect(result[ArticleStage.REVIEWING]).toBeNull();
    expect(result[ArticleStage.DRAFT]).toBeNull();
  });

  it('should map version to VERIFIED if signature is approved at final level', async () => {
    const version = {
      articleId: 'a1',
      version: 1,
      releasedAt: null,
      submittedAt: null,
      createdAt: new Date(),
      createdBy: 'user',
      signatures: [
        {
          result: ArticleSignatureResult.APPROVED,
          signatureLevelId: 'level-final',
          deletedAt: null,
        },
      ],
      multiLanguageContents: [baseContent],
    };

    const article = {
      id: 'a1',
      versions: [version],
      createdAt: new Date(),
      deletedAt: null,
    };

    const getMany = jest.fn().mockResolvedValue([article]);
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
    };

    articleRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.stageVersionsLoader.load('a1');

    expect(result[ArticleStage.VERIFIED]).toBeTruthy();
  });

  it('should map version to REVIEWING if it has submittedAt and no final signature', async () => {
    const version = {
      articleId: 'a1',
      version: 1,
      releasedAt: null,
      submittedAt: new Date(),
      createdAt: new Date(),
      createdBy: 'user',
      signatures: [],
      multiLanguageContents: [baseContent],
    };

    const article = {
      id: 'a1',
      versions: [version],
      createdAt: new Date(),
      deletedAt: null,
    };

    const getMany = jest.fn().mockResolvedValue([article]);
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
    };

    articleRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.stageVersionsLoader.load('a1');

    expect(result[ArticleStage.REVIEWING]).toBeTruthy();
  });

  it('should default version to DRAFT if no other stage is matched', async () => {
    const version = {
      articleId: 'a1',
      version: 1,
      releasedAt: null,
      submittedAt: null,
      createdAt: new Date(),
      createdBy: 'user',
      signatures: [],
      multiLanguageContents: [baseContent],
    };

    const article = {
      id: 'a1',
      versions: [version],
      createdAt: new Date(),
      deletedAt: null,
    };

    const getMany = jest.fn().mockResolvedValue([article]);
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
    };

    articleRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.stageVersionsLoader.load('a1');

    expect(result[ArticleStage.DRAFT]).toBeTruthy();
  });

  it('should return multiple versions sorted by version ASC in versionsLoader', async () => {
    const version1 = {
      articleId: 'a1',
      version: 1,
      createdAt: new Date('2024-01-01'),
      createdBy: 'user',
      signatures: [],
      multiLanguageContents: [baseContent],
    };

    const version2 = {
      articleId: 'a1',
      version: 2,
      createdAt: new Date('2024-02-01'),
      createdBy: 'user',
      signatures: [],
      multiLanguageContents: [baseContent],
    };

    const article = {
      id: 'a1',
      versions: [version1, version2],
      createdAt: new Date(),
      deletedAt: null,
    };

    const getMany = jest.fn().mockResolvedValue([article]);
    const qb = {
      withDeleted: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany,
    };

    articleRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.versionsLoader.load('a1');

    expect(result.length).toBe(2);
    expect(result[0].version).toBe(1);
    expect(result[1].version).toBe(2);
  });

  it('should return sanitized version using multiple language fields when multipleLanguageMode is true', async () => {
    const module = await Test.createTestingModule({
      providers: [
        {
          provide: RESOLVED_ARTICLE_REPO,
          useValue: articleRepo,
        },
        {
          provide: MULTIPLE_LANGUAGE_MODE,
          useValue: true,
        },
        {
          provide: SignatureService,
          useValue: signatureService,
        },
        ArticleVersionDataLoader,
      ],
    }).compile();

    loader = module.get(ArticleVersionDataLoader);

    const version = {
      articleId: 'a1',
      version: 3,
      createdAt: new Date(),
      createdBy: 'user',
      multiLanguageContents: [baseContent],
      signatures: [],
    };

    const article = {
      id: 'a1',
      versions: [version],
      createdAt: new Date('2024-01-01'),
      deletedAt: null,
    };

    const getMany = jest.fn().mockResolvedValue([article]);
    const qb = {
      withDeleted: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany,
    };

    articleRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.versionsLoader.load('a1');

    expect(result).toHaveLength(1);
    expect(result[0].version).toBe(3);
  });

  it('should map version to SCHEDULED if releasedAt is in the future', async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60);

    const version = {
      articleId: 'a1',
      version: 1,
      releasedAt: futureDate,
      signatures: [],
      multiLanguageContents: [baseContent],
      createdAt: new Date(),
      createdBy: 'user',
    };

    const article = {
      id: 'a1',
      versions: [version],
      createdAt: new Date(),
      deletedAt: null,
    };

    const getMany = jest.fn().mockResolvedValue([article]);
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
    };

    articleRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.stageVersionsLoader.load('a1');

    expect(result[ArticleStage.SCHEDULED]).toBeTruthy();
    expect(result[ArticleStage.RELEASED]).toBeNull();
    expect(result[ArticleStage.REVIEWING]).toBeNull();
    expect(result[ArticleStage.DRAFT]).toBeNull();
  });

  it('should use removeMultipleLanguageArticleVersionInvalidFields when multipleLanguageMode is true', async () => {
    const module = await Test.createTestingModule({
      providers: [
        {
          provide: RESOLVED_ARTICLE_REPO,
          useValue: articleRepo,
        },
        {
          provide: MULTIPLE_LANGUAGE_MODE,
          useValue: true,
        },
        {
          provide: SignatureService,
          useValue: signatureService,
        },
        ArticleVersionDataLoader,
      ],
    }).compile();

    loader = module.get(ArticleVersionDataLoader);

    const version = {
      articleId: 'a1',
      version: 1,
      releasedAt: new Date(Date.now() - 1000),
      signatures: [],
      multiLanguageContents: [baseContent],
      createdAt: new Date(),
      createdBy: 'user',
    };

    const article = {
      id: 'a1',
      versions: [version],
      createdAt: new Date(),
      deletedAt: null,
    };

    const getMany = jest.fn().mockResolvedValue([article]);
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
    };

    articleRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.stageVersionsLoader.load('a1');

    expect(result[ArticleStage.RELEASED]).toEqual(
      expect.objectContaining({
        version: 1,
        createdAt: version.createdAt,
        createdBy: version.createdBy,
        id: article.id,
        updatedBy: version.createdBy,
      }),
    );
  });

  it('should return empty array if article id is not found in map', async () => {
    const getMany = jest.fn().mockResolvedValue([]);
    const qb = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
      withDeleted: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
    };

    articleRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.versionsLoader.load('nonexistent-id');

    expect(result).toEqual([]);
  });
});
