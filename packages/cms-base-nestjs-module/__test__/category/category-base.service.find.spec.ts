import { Test, TestingModule } from '@nestjs/testing';
import { CategoryBaseService } from '../../src/services/category-base.service';
import { DataSource } from 'typeorm';
import {
  CATEGORY_DATA_LOADER,
  CIRCULAR_CATEGORY_MODE,
  MULTIPLE_CATEGORY_PARENT_MODE,
  MULTIPLE_LANGUAGE_MODE,
  RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO,
  RESOLVED_CATEGORY_REPO,
} from '../../src/typings/cms-base-providers';
import { CategorySorter } from '../../src/typings/category-sorter.enum';
import { CategoryNotFoundError } from '../../src/constants/errors/category.errors';
import { DEFAULT_LANGUAGE } from '../../src/constants/default-language';

describe('CategoryBaseService.findAll', () => {
  let service: CategoryBaseService<any, any>;
  const mockQueryBuilder = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBaseService,
        {
          provide: RESOLVED_CATEGORY_REPO,
          useValue: { createQueryBuilder: () => mockQueryBuilder },
        },
        { provide: RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: MULTIPLE_CATEGORY_PARENT_MODE, useValue: true },
        { provide: CIRCULAR_CATEGORY_MODE, useValue: false },
        { provide: CATEGORY_DATA_LOADER, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<CategoryBaseService<any, any>>(CategoryBaseService);
    jest.clearAllMocks();
  });

  it('should call getMany and return single-language categories when language is provided', async () => {
    const mockCategories = [
      {
        id: '1',
        multiLanguageNames: [{ language: 'en', name: 'Test' }],
        children: [],
      },
    ];

    mockQueryBuilder.getMany.mockResolvedValue(mockCategories);

    const result = await service.findAll({ language: 'en' });

    expect(mockQueryBuilder.getMany).toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({ id: '1', name: 'Test', language: 'en' }),
    ]);
  });

  it('should filter by ids', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);
    await service.findAll({ ids: ['1', '2'] });
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'categories.id IN (:...ids)',
      { ids: ['1', '2'] },
    );
  });

  it('should filter by fromTop', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);
    await service.findAll({ fromTop: true });
    expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith(
      'categories.parents',
      'fromTopParents',
    );

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'fromTopParents.id IS NULL',
    );
  });

  it('should filter by parentIds', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);
    await service.findAll({ parentIds: ['p1'] });
    expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
      'categories.parents',
      'parentForFilters',
    );

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'parentForFilters.id IN (:...parentIds)',
      { parentIds: ['p1'] },
    );
  });

  it('should apply sorting and pagination when language is not provided and multipleLanguageMode is true', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);
    await service.findAll({
      sorter: CategorySorter.CREATED_AT_ASC,
      offset: 10,
      limit: 5,
    });

    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      'articles.createdAt',
      'ASC',
    );

    expect(mockQueryBuilder.skip).toHaveBeenCalledWith(10);
    expect(mockQueryBuilder.take).toHaveBeenCalledWith(5);
  });

  it('should fallback to CREATED_AT_DESC if sorter is undefined', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);
    await service.findAll();
    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      'articles.createdAt',
      'DESC',
    );
  });

  it('should limit max results to 100 even if larger limit is provided', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);
    await service.findAll({ limit: 1000 });
    expect(mockQueryBuilder.take).toHaveBeenCalledWith(100);
  });

  it('should apply CREATED_AT_DESC sorting explicitly when provided', async () => {
    const mockCategories = [
      {
        id: '1',
        bindable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        multiLanguageNames: [{ language: DEFAULT_LANGUAGE, name: 'Test' }],
        children: [],
      },
    ];

    mockQueryBuilder.getMany.mockResolvedValue(mockCategories);
    (service as any).multipleLanguageMode = true;

    await service.findAll({
      sorter: CategorySorter.CREATED_AT_DESC,
    });

    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      'articles.createdAt',
      'DESC',
    );
  });

  it('should return parsed categories with undefined language when language is not provided and multipleLanguageMode is false', async () => {
    const mockCategories = [
      {
        id: '1',
        multiLanguageNames: [],
        children: [],
      },
      {
        id: '2',
        multiLanguageNames: [],
        children: [],
      },
    ];

    mockQueryBuilder.getMany.mockResolvedValue(mockCategories);

    (service as any).multipleLanguageMode = false;

    const mockParsed = mockCategories.map((c) => ({
      ...c,
      name: undefined,
      language: undefined,
    }));

    const parseSpy = jest
      .spyOn(service as any, 'parseSingleLanguageCategory')
      .mockImplementation((...args: unknown[]) => {
        const [cat, lang] = args as [Record<string, any>, any];

        return {
          ...cat,
          name: undefined,
          language: lang,
        };
      });

    const result = await service.findAll({});

    expect(parseSpy).toHaveBeenCalledTimes(2);
    expect(parseSpy).toHaveBeenNthCalledWith(1, mockCategories[0], undefined);
    expect(parseSpy).toHaveBeenNthCalledWith(2, mockCategories[1], undefined);
    expect(result).toEqual(mockParsed);
  });
});

describe('CategoryBaseService.findById', () => {
  let service: CategoryBaseService<any, any>;
  let mockQueryBuilder: any;

  beforeEach(async () => {
    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CategoryBaseService,
        {
          provide: RESOLVED_CATEGORY_REPO,
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
        { provide: RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: MULTIPLE_CATEGORY_PARENT_MODE, useValue: true },
        { provide: CIRCULAR_CATEGORY_MODE, useValue: false },
        { provide: CATEGORY_DATA_LOADER, useValue: {} },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<CategoryBaseService<any, any>>(CategoryBaseService);
  });

  it('should return parsed single-language category when language is provided', async () => {
    const mockCategory = {
      id: '1',
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      multiLanguageNames: [{ language: DEFAULT_LANGUAGE, name: 'Test' }],
      children: [],
    };

    mockQueryBuilder.getOne.mockResolvedValue(mockCategory);

    const result = await service.findById('1', DEFAULT_LANGUAGE);

    expect(result).toEqual(
      expect.objectContaining({
        id: '1',
        name: 'Test',
        language: DEFAULT_LANGUAGE,
        children: [],
      }),
    );
  });

  it('should return parsed category when language is not provided and multipleLanguageMode is false', async () => {
    (service as any).multipleLanguageMode = false;

    const mockCategory = {
      id: '1',
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      multiLanguageNames: [{ language: DEFAULT_LANGUAGE, name: 'Test' }],
      children: [],
    };

    mockQueryBuilder.getOne.mockResolvedValue(mockCategory);

    const result = await service.findById('1');

    expect(result).toEqual(
      expect.objectContaining({
        id: '1',
        name: 'Test',
        language: DEFAULT_LANGUAGE,
        children: [],
      }),
    );
  });

  it('should return full category if no language is provided and multipleLanguageMode is true', async () => {
    const mockCategory = {
      id: '1',
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      multiLanguageNames: [{ language: DEFAULT_LANGUAGE, name: 'Test' }],
      children: [],
      parents: [],
    };

    mockQueryBuilder.getOne.mockResolvedValue(mockCategory);

    const result = await service.findById('1');

    expect(result).toEqual(mockCategory);
  });

  it('should throw CategoryNotFoundError when category does not exist', async () => {
    mockQueryBuilder.getOne.mockResolvedValue(undefined);
    await expect(service.findById('invalid-id')).rejects.toThrow(
      CategoryNotFoundError,
    );
  });
});
