import { Test } from '@nestjs/testing';
import { RESOLVED_ARTICLE_VERSION_REPO } from '../src/typings/cms-base-providers';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { BaseArticleVersionEntity } from '../src/models/base-article-version.entity';
import { ArticleSignatureDataLoader } from '../src/data-loaders/article-signature.dataloader';

describe('ArticleSignatureDataLoader', () => {
  let service: ArticleSignatureDataLoader;
  let repo: jest.Mocked<Repository<BaseArticleVersionEntity>>;

  const mockVersionWithSignatures = (
    id: string,
    version: number,
    signatures: any[] = [],
  ): BaseArticleVersionEntity => {
    return {
      articleId: id,
      version,
      signatures,
    } as any;
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArticleSignatureDataLoader,
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ArticleSignatureDataLoader);
    repo = moduleRef.get(RESOLVED_ARTICLE_VERSION_REPO);
  });

  it('should load article version signatures correctly for each key', async () => {
    const qbMock: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([
          mockVersionWithSignatures('a1', 1, [{ id: 's1' }]),
          mockVersionWithSignatures('a2', 2, [{ id: 's2' }, { id: 's3' }]),
        ]),
    };

    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qbMock);

    const results = await service.versionSignaturesLoader.loadMany([
      { id: 'a1', version: 1 },
      { id: 'a2', version: 2 },
      { id: 'a3', version: 3 },
    ]);

    expect(results).toEqual([
      [{ id: 's1' }],
      [{ id: 's2' }, { id: 's3' }],
      [], // a3|3 not found, so fallback to empty array
    ]);

    expect(qbMock.leftJoinAndSelect).toHaveBeenCalledWith(
      'articleVersions.signatures',
      'signatures',
    );

    expect(qbMock.leftJoinAndSelect).toHaveBeenCalledWith(
      'signatures.signatureLevel',
      'signatureLevel',
    );
  });

  it('should cache results with correct cache key', async () => {
    const qbMock: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      getMany: jest
        .fn()
        .mockResolvedValue([
          mockVersionWithSignatures('x1', 99, [{ id: 'sx1' }]),
        ]),
    };

    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qbMock);

    const key = { id: 'x1', version: 99 };

    // First load should call getMany
    const first = await service.versionSignaturesLoader.load(key);

    expect(first).toEqual([{ id: 'sx1' }]);
    expect(qbMock.getMany).toHaveBeenCalledTimes(1);

    // Second load should use cache (no new call)
    const second = await service.versionSignaturesLoader.load(key);

    expect(second).toEqual([{ id: 'sx1' }]);
    expect(qbMock.getMany).toHaveBeenCalledTimes(1);
  });

  it('should call orWhere with Brackets for each input argument', async () => {
    const orWhereSpy = jest.fn().mockReturnThis();
    const qbMock: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orWhere: orWhereSpy,
      getMany: jest.fn().mockResolvedValue([]),
    };

    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qbMock);

    const inputs = [
      { id: 'art1', version: 1 },
      { id: 'art2', version: 2 },
    ];

    await service.versionSignaturesLoader.loadMany(inputs);

    expect(orWhereSpy).toHaveBeenCalledTimes(inputs.length);

    inputs.forEach(({ id, version }, index) => {
      const bracketsArg = orWhereSpy.mock.calls[index][0];

      expect(bracketsArg).toBeInstanceOf(Brackets);

      // Simulate Brackets execution to validate the subQb receives correct .andWhere calls
      const subQb = {
        andWhere: jest.fn().mockReturnThis(),
      };

      bracketsArg.whereFactory(subQb as any); // Manually run Brackets callback

      expect(subQb.andWhere).toHaveBeenCalledWith(
        `articleVersions.articleId = :id_${index}`,
        { [`id_${index}`]: id },
      );

      expect(subQb.andWhere).toHaveBeenCalledWith(
        `articleVersions.version = :version_${index}`,
        { [`version_${index}`]: version },
      );
    });
  });
});
