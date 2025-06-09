import { Test } from '@nestjs/testing';
import { ArticleSignatureDataLoader } from '../../src/data-loaders/article-signature.dataloader';
import { Repository } from 'typeorm';
import { BaseArticleVersionEntity } from '../../src/models/base-article-version.entity';
import { RESOLVED_ARTICLE_VERSION_REPO } from '../../src/typings/cms-base-providers';
import { ArticleSignatureEntity } from '../../src/models/base-article-signature.entity';

describe('ArticleSignatureDataLoader', () => {
  let dataLoader: ArticleSignatureDataLoader;
  let repo: jest.Mocked<Repository<BaseArticleVersionEntity>>;

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

    dataLoader = moduleRef.get(ArticleSignatureDataLoader);
    repo = moduleRef.get(RESOLVED_ARTICLE_VERSION_REPO);
  });

  it('should return signatures for valid id|version pairs', async () => {
    const mockQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          articleId: 'a1',
          version: 1,
          signatures: [{ id: 's1' }] as ArticleSignatureEntity[],
        },
        {
          articleId: 'a2',
          version: 2,
          signatures: [{ id: 's2' }] as ArticleSignatureEntity[],
        },
      ]),
    };

    repo.createQueryBuilder.mockReturnValue(mockQb);

    const result = await dataLoader.versionSignaturesLoader.loadMany([
      'a1|1',
      'a2|2',
    ]);

    expect(result).toEqual([[{ id: 's1' }], [{ id: 's2' }]]);

    expect(repo.createQueryBuilder).toHaveBeenCalled();
  });

  it('should return empty array for missing versions', async () => {
    const mockQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    repo.createQueryBuilder.mockReturnValue(mockQb);

    const result = await dataLoader.versionSignaturesLoader.loadMany([
      'notfound|999',
    ]);

    expect(result).toEqual([[]]);
  });

  it('should throw error on invalid format', async () => {
    await expect(
      dataLoader.versionSignaturesLoader.load('invalid-format'),
    ).rejects.toThrow(
      'Invalid id: invalid-format, please use format: id|version',
    );
  });

  it('should throw error on NaN version', async () => {
    await expect(
      dataLoader.versionSignaturesLoader.load('a1|NaN'),
    ).rejects.toThrow('Invalid id: a1|NaN, please use format: id|version');
  });

  it('should throw error on negative version', async () => {
    await expect(
      dataLoader.versionSignaturesLoader.load('a1|-1'),
    ).rejects.toThrow('Invalid id: a1|-1, please use format: id|version');
  });

  it('should call orWhere with correct Brackets for multiple id|version pairs', async () => {
    const subQbMock = {
      andWhere: jest.fn().mockReturnThis(),
    };

    const bracketFns: any[] = [];

    const mockOrWhere = jest.fn((brackets) => {
      bracketFns.push(brackets); // Store Brackets object

      return mockQb;
    });

    const mockQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orWhere: mockOrWhere,
      getMany: jest.fn().mockResolvedValue([
        { articleId: 'a1', version: 1, signatures: [] },
        { articleId: 'a2', version: 2, signatures: [] },
      ]),
    };

    repo.createQueryBuilder.mockReturnValue(mockQb);

    await dataLoader.versionSignaturesLoader.loadMany(['a1|1', 'a2|2']);

    expect(mockOrWhere).toHaveBeenCalledTimes(2);

    bracketFns.forEach((bracketsObj, index) => {
      if (
        typeof bracketsObj === 'object' &&
        typeof bracketsObj.whereFactory === 'function'
      ) {
        // Simulate what TypeORM does internally
        bracketsObj.whereFactory(subQbMock);

        expect(subQbMock.andWhere).toHaveBeenCalledWith(
          `articleVersions.articleId = :id_${index}`,
          { [`id_${index}`]: `a${index + 1}` },
        );

        expect(subQbMock.andWhere).toHaveBeenCalledWith(
          `articleVersions.version = :version_${index}`,
          { [`version_${index}`]: index + 1 },
        );
      } else {
        throw new Error(
          `Expected Brackets object with .whereFactory in bracketFns[${index}], but got: ${typeof bracketsObj}`,
        );
      }
    });
  });
});
