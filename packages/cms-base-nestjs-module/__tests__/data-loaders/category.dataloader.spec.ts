import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { CategoryDataLoader } from '../../src/data-loaders/category.dataloader';
import { RESOLVED_CATEGORY_REPO } from '../../src/typings/cms-base-providers';
import { BaseCategoryEntity } from '../../src/models/base-category.entity';
import { MockDataLoaderQueryBuilder } from '../typings/mock-types.interface';

describe('CategoryDataLoader', () => {
  let dataLoader: CategoryDataLoader;
  let repo: jest.Mocked<Repository<BaseCategoryEntity>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CategoryDataLoader,
        {
          provide: RESOLVED_CATEGORY_REPO,
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    dataLoader = moduleRef.get(CategoryDataLoader);
    repo = moduleRef.get(RESOLVED_CATEGORY_REPO);
  });

  it('should return correct category entities for given IDs', async () => {
    const mockQb: MockDataLoaderQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'c1',
          name: 'Category 1',
        },
        {
          id: 'c2',
          name: 'Category 2',
        },
      ]),
    };

    repo.createQueryBuilder.mockReturnValue(mockQb);

    const result = await dataLoader.withParentsLoader.loadMany(['c1', 'c2']);

    expect(result).toEqual([
      { id: 'c1', name: 'Category 1' },
      { id: 'c2', name: 'Category 2' },
    ]);

    expect(mockQb.andWhere).toHaveBeenCalledWith('categories.id IN (:...ids)', {
      ids: ['c1', 'c2'],
    });

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('categories');
  });

  it('should return null for missing categories', async () => {
    const mockQb: MockDataLoaderQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    repo.createQueryBuilder.mockReturnValue(mockQb);

    const result = await dataLoader.withParentsLoader.loadMany(['notfound']);

    expect(result).toEqual([null]);
  });

  it('should cache results for repeated calls', async () => {
    const mockQb: MockDataLoaderQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'c1',
          name: 'Category 1',
        },
      ]),
    };

    repo.createQueryBuilder.mockReturnValue(mockQb);

    const first = await dataLoader.withParentsLoader.load('c1');
    const second = await dataLoader.withParentsLoader.load('c1');

    expect(first).toEqual({ id: 'c1', name: 'Category 1' });
    expect(second).toEqual({ id: 'c1', name: 'Category 1' });
    expect(mockQb.getMany).toHaveBeenCalledTimes(1); // only the first one triggers DB call
  });
});
