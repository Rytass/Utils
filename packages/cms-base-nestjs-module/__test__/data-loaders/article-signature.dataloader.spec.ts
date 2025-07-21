import { ArticleSignatureDataLoader } from '../../src/data-loaders/article-signature.dataloader';
import { RESOLVED_ARTICLE_VERSION_REPO } from '../../src/typings/cms-base-providers';
import { Repository } from 'typeorm';
import { BaseArticleVersionEntity } from '../../src/models/base-article-version.entity';
import { Test } from '@nestjs/testing';
import { ArticleSignatureEntity } from '../../src/models/article-signature.entity';

describe('ArticleSignatureDataLoader', () => {
  let loader: ArticleSignatureDataLoader;
  let articleVersionRepo: jest.Mocked<Repository<BaseArticleVersionEntity>>;

  beforeEach(async () => {
    jest.resetAllMocks();
    articleVersionRepo = {
      createQueryBuilder: jest.fn(),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ArticleSignatureDataLoader,
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: articleVersionRepo,
        },
      ],
    }).compile();

    loader = module.get(ArticleSignatureDataLoader);
  });

  it('should return signatures grouped by articleId and version', async () => {
    const mockSignatures = [
      { id: 's1' } as ArticleSignatureEntity,
      { id: 's2' } as ArticleSignatureEntity,
    ];

    const mockVersion = {
      articleId: 'a1',
      version: 1,
      signatures: mockSignatures,
    } as BaseArticleVersionEntity;

    const getMany = jest.fn().mockResolvedValue([mockVersion]);
    const orWhere = jest.fn().mockImplementation(() => qb);
    const andWhere = jest.fn().mockImplementation(() => subQb);
    const subQb = { andWhere };
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orWhere,
      getMany,
      addOrderBy: jest.fn().mockReturnThis(),
    };

    articleVersionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.versionSignaturesLoader.load({
      id: 'a1',
      version: 1,
    });

    expect(result).toEqual(mockSignatures);
    expect(articleVersionRepo.createQueryBuilder).toHaveBeenCalledWith(
      'articleVersions',
    );

    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      'articleVersions.signatures',
      'signatures',
    );

    expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
      'signatures.signatureLevel',
      'signatureLevel',
    );

    expect(getMany).toHaveBeenCalled();
  });

  it('should return empty array if no version matches', async () => {
    const getMany = jest.fn().mockResolvedValue([]);
    const orWhere = jest.fn().mockImplementation(() => qb);
    const andWhere = jest.fn().mockImplementation(() => subQb);
    const subQb = { andWhere };
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orWhere,
      getMany,
      addOrderBy: jest.fn().mockReturnThis(),
    };

    articleVersionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.versionSignaturesLoader.load({
      id: 'not-found',
      version: 99,
    });

    expect(result).toEqual([]);
  });

  it('should cache results using the LRU cache', async () => {
    const mockSignatures = [{ id: 'sig' }] as ArticleSignatureEntity[];

    const mockVersion = {
      articleId: 'a1',
      version: 1,
      signatures: mockSignatures,
    } as BaseArticleVersionEntity;

    const getMany = jest.fn().mockResolvedValue([mockVersion]);
    const orWhere = jest.fn().mockImplementation(() => qb);
    const andWhere = jest.fn().mockImplementation(() => subQb);
    const subQb = { andWhere };
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orWhere,
      getMany,
      addOrderBy: jest.fn().mockReturnThis(),
    };

    articleVersionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result1 = await loader.versionSignaturesLoader.load({
      id: 'a1',
      version: 1,
    });

    const result2 = await loader.versionSignaturesLoader.load({
      id: 'a1',
      version: 1,
    });

    expect(result1).toBe(result2);
    expect(getMany).toHaveBeenCalledTimes(1);
  });

  it('should call subQb.andWhere with articleId and version inside Brackets (index 0)', async () => {
    const mockAndWhere = jest.fn().mockReturnThis();
    const mockSubQb = { andWhere: mockAndWhere };
    const mockGetMany = jest.fn().mockResolvedValue([]);

    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockImplementation((brackets: any) => {
        brackets.whereFactory(mockSubQb as any);

        return mockQueryBuilder;
      }),
      getMany: mockGetMany,
      addOrderBy: jest.fn().mockReturnThis(),
    };

    articleVersionRepo.createQueryBuilder.mockReturnValue(
      mockQueryBuilder as any,
    );

    await loader.versionSignaturesLoader.load({ id: 'a1', version: 1 });

    expect(mockAndWhere).toHaveBeenCalledWith(
      'articleVersions.articleId = :id_0',
      { id_0: 'a1' },
    );

    expect(mockAndWhere).toHaveBeenCalledWith(
      'articleVersions.version = :version_0',
      { version_0: 1 },
    );
  });

  it('should return empty array if args is empty', async () => {
    const getMany = jest.fn().mockResolvedValue([]);

    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      getMany,
      addOrderBy: jest.fn().mockReturnThis(),
    };

    articleVersionRepo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await loader.versionSignaturesLoader.loadMany([]);

    expect(result).toEqual([]);
  });
});
