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
import { DEFAULT_LANGUAGE } from '../../src/constants/default-language';
import { CircularCategoryNotAllowedError } from '../../src/constants/errors/category.errors';

describe('CategoryBaseService.getDefaultQueryBuilder', () => {
  let service: CategoryBaseService<any, any>;

  const innerJoinAndSelectMock = jest.fn().mockReturnThis();
  const leftJoinAndSelectMock = jest.fn().mockReturnThis();
  const andWhereMock = jest.fn().mockReturnThis();
  const addOrderByMock = jest.fn().mockReturnThis();
  const skipMock = jest.fn().mockReturnThis();
  const takeMock = jest.fn().mockReturnThis();
  const getManyMock = jest.fn().mockResolvedValue([]);

  const createQueryBuilderMock = jest.fn(() => ({
    innerJoinAndSelect: innerJoinAndSelectMock,
    leftJoinAndSelect: leftJoinAndSelectMock,
    andWhere: andWhereMock,
    addOrderBy: addOrderByMock,
    skip: skipMock,
    take: takeMock,
    getMany: getManyMock,
  }));

  const mockCategoryRepo = {
    createQueryBuilder: createQueryBuilderMock,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBaseService,
        {
          provide: RESOLVED_CATEGORY_REPO,
          useValue: mockCategoryRepo,
        },
        {
          provide: RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO,
          useValue: {},
        },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: MULTIPLE_CATEGORY_PARENT_MODE, useValue: true },
        { provide: CIRCULAR_CATEGORY_MODE, useValue: false },
        { provide: CATEGORY_DATA_LOADER, useValue: {} },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CategoryBaseService<any, any>>(CategoryBaseService);
  });

  it('should create base query builder with correct joins in findAll()', async () => {
    const result = await (service as any).getDefaultQueryBuilder();

    expect(mockCategoryRepo.createQueryBuilder).toHaveBeenCalledWith(
      'categories',
    );
    expect(innerJoinAndSelectMock).toHaveBeenCalledWith(
      'categories.multiLanguageNames',
      'multiLanguageNames',
    );
    expect(leftJoinAndSelectMock).toHaveBeenCalledWith(
      'categories.children',
      'children',
    );
    expect(leftJoinAndSelectMock).toHaveBeenCalledWith(
      'children.multiLanguageNames',
      'childrenMultiLanguageNames',
    );
    expect(result).toBeDefined();
  });
});

describe('CategoryBaseService.parseSingleLanguageCategory', () => {
  let service: CategoryBaseService<any, any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBaseService,
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
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

  it('should default to DEFAULT_LANGUAGE when language is not provided', () => {
    const mockCategory = {
      id: 'c1',
      bindable: true,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      deletedAt: null,
      multiLanguageNames: [
        { language: DEFAULT_LANGUAGE, name: 'Default Name' },
        { language: DEFAULT_LANGUAGE, name: 'English Name' },
      ],
      children: [],
    } as any;

    const parsed = (service as any).parseSingleLanguageCategory(mockCategory);

    expect(parsed.language).toBe(DEFAULT_LANGUAGE);
    expect(parsed.name).toBe('Default Name');
  });

  it('should return empty children array when category.children is undefined', () => {
    const mockCategory: any = {
      id: '1',
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      multiLanguageNames: [{ language: 'en', name: 'Test' }],
      children: undefined,
    };

    const result = (service as any).parseSingleLanguageCategory(
      mockCategory,
      'en',
    );

    expect(result.children).toEqual([]);
  });

  it('should recursively parse children categories', () => {
    const mockCategory: any = {
      id: '1',
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      multiLanguageNames: [{ language: DEFAULT_LANGUAGE, name: 'Parent' }],
      children: [
        {
          id: '2',
          bindable: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          multiLanguageNames: [{ language: DEFAULT_LANGUAGE, name: 'Child' }],
          children: [],
        },
      ],
    };

    const result = (service as any).parseSingleLanguageCategory(
      mockCategory,
      DEFAULT_LANGUAGE,
    );

    expect(result.children).toHaveLength(1);
    expect(result.children[0]).toMatchObject({
      id: '2',
      name: 'Child',
      language: DEFAULT_LANGUAGE,
      children: [],
    });
  });
});

describe('CategoryBaseService.getParentCategoryIdSet', () => {
  let service: CategoryBaseService<any, any>;
  const loadMock = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBaseService,
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: MULTIPLE_CATEGORY_PARENT_MODE, useValue: true },
        { provide: CIRCULAR_CATEGORY_MODE, useValue: false },
        {
          provide: CATEGORY_DATA_LOADER,
          useValue: {
            withParentsLoader: { load: loadMock },
          },
        },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<CategoryBaseService<any, any>>(CategoryBaseService);
    loadMock.mockReset();
  });

  it('should collect all parent category ids in a linear chain', async () => {
    loadMock.mockImplementationOnce(async (id: string) => ({
      id,
      parents: [{ id: 'p1', parents: [] }],
    }));
    loadMock.mockImplementationOnce(async (id: string) => ({
      id,
      parents: [],
    }));

    const result = await (service as any).getParentCategoryIdSet('c1');

    expect(result).toEqual(new Set(['c1', 'p1']));
    expect(loadMock).toHaveBeenCalledTimes(2);
    expect(loadMock).toHaveBeenCalledWith('c1');
    expect(loadMock).toHaveBeenCalledWith('p1');
  });

  it('should handle categories with no parents', async () => {
    loadMock.mockResolvedValueOnce({ id: 'c1', parents: [] });

    const result = await (service as any).getParentCategoryIdSet('c1');

    expect(result).toEqual(new Set(['c1']));
    expect(loadMock).toHaveBeenCalledWith('c1');
  });

  it('should support nested parent hierarchies', async () => {
    loadMock.mockImplementation(async (id: string) => {
      const data: Record<string, { id: string; parents: { id: string }[] }> = {
        c1: { id: 'c1', parents: [{ id: 'p1' }] },
        p1: { id: 'p1', parents: [{ id: 'p2' }] },
        p2: { id: 'p2', parents: [] },
      };

      return data[id];
    });

    const result = await (service as any).getParentCategoryIdSet('c1');

    expect(result).toEqual(new Set(['c1', 'p1', 'p2']));
    expect(loadMock).toHaveBeenCalledTimes(3);
  });
});

describe('CategoryBaseService.checkCircularCategories', () => {
  let service: CategoryBaseService<any, any>;

  const mockCategory = { id: 'c1' } as any;
  const mockParents = [{ id: 'p1' }, { id: 'p2' }] as any[];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBaseService,
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: MULTIPLE_CATEGORY_PARENT_MODE, useValue: true },
        { provide: CIRCULAR_CATEGORY_MODE, useValue: false },
        {
          provide: CATEGORY_DATA_LOADER,
          useValue: {
            withParentsLoader: {
              load: jest.fn((id: string) => {
                const mockData: Record<
                  string,
                  { id: string; parents: { id: string }[] }
                > = {
                  p1: { id: 'p1', parents: [{ id: 'c1' }] }, // introduces a circular ref
                  p2: { id: 'p2', parents: [] },
                  c1: { id: 'c1', parents: [] },
                };
                return Promise.resolve(mockData[id]);
              }),
            },
          },
        },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<CategoryBaseService<any, any>>(CategoryBaseService);
  });

  it('should throw CircularCategoryNotAllowedError if circular dependency is found', async () => {
    await expect(
      (service as any).checkCircularCategories(mockCategory, mockParents),
    ).rejects.toThrow(CircularCategoryNotAllowedError);
  });

  it('should not throw if no circular dependency is present', async () => {
    const cleanService = await Test.createTestingModule({
      providers: [
        CategoryBaseService,
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: MULTIPLE_CATEGORY_PARENT_MODE, useValue: true },
        { provide: CIRCULAR_CATEGORY_MODE, useValue: false },
        {
          provide: CATEGORY_DATA_LOADER,
          useValue: {
            withParentsLoader: {
              load: jest.fn((id: string) => {
                const mockData: Record<string, any> = {
                  p1: { id: 'p1', parents: [] },
                  p2: { id: 'p2', parents: [] },
                };
                return Promise.resolve(mockData[id]);
              }),
            },
          },
        },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    const s =
      cleanService.get<CategoryBaseService<any, any>>(CategoryBaseService);

    await expect(
      (s as any).checkCircularCategories(mockCategory, mockParents),
    ).resolves.not.toThrow();
  });
});
