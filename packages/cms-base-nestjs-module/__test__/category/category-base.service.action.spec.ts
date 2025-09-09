import { DataSource, EntityManager, In, QueryRunner, Repository } from 'typeorm';
import { CategoryBaseService } from '../../src/services/category-base.service';
import { BaseCategoryEntity } from '../../src/models/base-category.entity';
import {
  CategoryNotFoundError,
  CircularCategoryNotAllowedError,
  MultipleParentCategoryNotAllowedError,
  ParentCategoryNotFoundError,
} from '../../src/constants/errors/category.errors';
import { BaseCategoryMultiLanguageNameEntity } from '../../src/models/base-category-multi-language-name.entity';
import { CategoryDataLoader } from '../../src/data-loaders/category.dataloader';
import { DEFAULT_LANGUAGE } from '@rytass/cms-base-nestjs-module';
import { MockServiceDataSource } from '../typings/mock-types.interface';

describe('CategoryBaseService - archive', () => {
  let service: CategoryBaseService;
  let baseCategoryRepo: jest.Mocked<Repository<BaseCategoryEntity>>;

  beforeEach(() => {
    baseCategoryRepo = jest.mocked({
      findOne: jest.fn(),
      softDelete: jest.fn(),
    } as Partial<Repository<BaseCategoryEntity>>);

    service = new CategoryBaseService(
      {} as Repository<BaseCategoryMultiLanguageNameEntity>, // baseCategoryMultiLanguageNameRepo
      baseCategoryRepo, // baseCategoryRepo
      false, // multipleLanguageMode
      false, // allowMultipleParentCategories
      false, // allowCircularCategories
      { createQueryRunner: jest.fn() } as MockServiceDataSource, // dataSource
      {} as CategoryDataLoader, // categoryDataLoader
    );
  });

  it('should throw CategoryNotFoundError if category does not exist', async () => {
    baseCategoryRepo.findOne!.mockResolvedValue(null); // not found

    await expect(service.archive('nonexistent-id')).rejects.toThrow(CategoryNotFoundError);
  });

  it('should soft delete the category if found', async () => {
    baseCategoryRepo.findOne!.mockResolvedValue({
      id: '123',
    } as BaseCategoryEntity);

    await service.archive('123');

    expect(baseCategoryRepo.softDelete).toHaveBeenCalledWith('123');
  });
});

describe('CategoryBaseService - update', () => {
  let service: CategoryBaseService;
  let baseCategoryRepo: jest.Mocked<Repository<BaseCategoryEntity>>;
  let queryRunner: jest.Mocked<Partial<QueryRunner>>;

  beforeEach(() => {
    baseCategoryRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    } as unknown as jest.Mocked<Repository<BaseCategoryEntity>>;

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
      } as unknown as EntityManager,
    };

    const dataSource = {
      createQueryRunner: () => queryRunner,
    } as unknown as DataSource;

    service = new CategoryBaseService(
      {
        create: jest.fn(input => input),
      } as unknown as Repository<BaseCategoryMultiLanguageNameEntity>,
      baseCategoryRepo,
      true,
      false,
      false,
      dataSource,
      {
        withParentsLoader: {
          load: jest.fn().mockResolvedValue({ parents: [] }),
        },
      } as unknown as CategoryDataLoader,
    );
  });

  it('should throw MultipleParentCategoryNotAllowedError if multiple parents but not allowed', async () => {
    await expect(() =>
      service.update('cat-id', {
        parentIds: ['p1', 'p2'],
        multiLanguageNames: {},
      }),
    ).rejects.toThrow(MultipleParentCategoryNotAllowedError);
  });

  it('should throw CategoryNotFoundError if category not found', async () => {
    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    await expect(() =>
      service.update('cat-id', {
        multiLanguageNames: {},
      }),
    ).rejects.toThrow(CategoryNotFoundError);
  });

  it('should throw ParentCategoryNotFoundError if single parent not found', async () => {
    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'cat-id',
        multiLanguageNames: [],
        bindable: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        parents: [],
        children: [],
        articles: [],
      } as BaseCategoryEntity),
    });

    baseCategoryRepo.findOne!.mockResolvedValueOnce(null);

    await expect(() =>
      service.update('cat-id', {
        parentId: 'p1',
        multiLanguageNames: {},
      }),
    ).rejects.toThrow(ParentCategoryNotFoundError);
  });

  it('should throw CircularCategoryNotAllowedError', async () => {
    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [],
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      parents: [],
      children: [],
      articles: [],
    } as BaseCategoryEntity;

    const mockParent = {
      ...mockCategory,
      id: 'p1',
    } as BaseCategoryEntity;

    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
    });

    baseCategoryRepo.findOne = jest.fn().mockImplementation(({ where }) => {
      if (where?.id === 'p1') return Promise.resolve(mockParent);

      return Promise.resolve(null);
    });

    service['checkCircularCategories'] = jest.fn().mockRejectedValue(new CircularCategoryNotAllowedError());

    await expect(() =>
      service.update('cat-id', {
        parentId: 'p1',
        multiLanguageNames: {},
      }),
    ).rejects.toThrow(CircularCategoryNotAllowedError);
  });

  it('should throw if multiLanguageNames is present but mode is disabled', async () => {
    service = new CategoryBaseService(
      {
        create: jest.fn(x => x),
      } as Repository<BaseCategoryMultiLanguageNameEntity>,
      baseCategoryRepo,
      false,
      false,
      false,
      {
        createQueryRunner: () => queryRunner,
      } as Repository<BaseCategoryMultiLanguageNameEntity>,
      {} as CategoryDataLoader,
    );

    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [],
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      parents: [],
      children: [],
      articles: [],
    } as BaseCategoryEntity;

    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
    });

    await expect(() =>
      service.update('cat-id', {
        multiLanguageNames: { en: 'Test' },
      }),
    ).rejects.toThrow('Multiple language mode is not enabled');
  });

  it('should rollback transaction on failure', async () => {
    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [],
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      parents: [],
      children: [],
      articles: [],
    } as BaseCategoryEntity;

    const mockParent = {
      ...mockCategory,
      id: 'p1',
    };

    baseCategoryRepo.findOne = jest.fn().mockImplementation(({ where }) => {
      if (where?.id === 'cat-id') return Promise.resolve(mockCategory);

      if (where?.id === 'p1') return Promise.resolve(mockParent);

      return Promise.resolve(null);
    });

    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
    });

    queryRunner.manager!.save = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(() =>
      service.update('cat-id', {
        name: 'fail',
        parentId: 'p1',
        multiLanguageNames: {},
      }),
    ).rejects.toThrow();

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('should update successfully without multiLanguageNames', async () => {
    const mockMultiLang = {
      language: 'zh',
      name: '舊名稱',
      categoryId: 'cat-id',
      createdAt: new Date(),
      updatedAt: new Date(),
      category: {} as BaseCategoryEntity,
    } as BaseCategoryMultiLanguageNameEntity;

    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [mockMultiLang],
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      parents: [],
      children: [],
      articles: [],
    } as BaseCategoryEntity;

    const mockParent = {
      ...mockCategory,
      id: 'p1',
    };

    baseCategoryRepo.findOne = jest.fn().mockImplementation(({ where }) => {
      if (where?.id === 'cat-id') return Promise.resolve(mockCategory);

      if (where?.id === 'p1') return Promise.resolve(mockParent);

      return Promise.resolve(null);
    });

    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
    });

    queryRunner.manager!.save = jest.fn().mockResolvedValue(undefined);
    queryRunner.manager!.remove = jest.fn().mockResolvedValue(undefined);

    service.findById = jest.fn().mockResolvedValue({
      id: 'cat-id',
      name: '新名稱',
    });

    const result = await service.update('cat-id', {
      name: '新名稱',
      parentId: 'p1',
      multiLanguageNames: {},
    });

    expect(queryRunner.startTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result).toEqual({ id: 'cat-id', name: '新名稱' });
  });

  it('should update successfully with multiLanguageNames', async () => {
    const existingMultiLang = [
      {
        language: 'en',
        name: 'Old',
        categoryId: 'cat-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {} as BaseCategoryEntity,
      },
      {
        language: 'zh',
        name: '舊名稱',
        categoryId: 'cat-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        category: {} as BaseCategoryEntity,
      },
    ] as BaseCategoryMultiLanguageNameEntity[];

    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: existingMultiLang,
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      parents: [],
      children: [],
      articles: [],
    } as BaseCategoryEntity;

    const mockParent = {
      ...mockCategory,
      id: 'p1',
    };

    baseCategoryRepo.findOne = jest.fn().mockImplementation(({ where }) => {
      if (where?.id === 'cat-id') return Promise.resolve(mockCategory);

      if (where?.id === 'p1') return Promise.resolve(mockParent);

      return Promise.resolve(null);
    });

    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
    });

    (queryRunner.manager as EntityManager).save = jest.fn().mockResolvedValue(undefined);

    (queryRunner.manager as EntityManager).remove = jest.fn().mockResolvedValue(undefined);

    service.findById = jest.fn().mockResolvedValue({ id: 'cat-id' });

    const result = await service.update(
      'cat-id',
      {
        parentId: 'p1',
        multiLanguageNames: {
          en: 'New',
        },
      },
      {},
    );

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result).toEqual({ id: 'cat-id' });
  });

  it('should handle parentIds in multiple parent mode', async () => {
    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [],
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      parents: [],
      children: [],
      articles: [],
    } as BaseCategoryEntity;

    const mockParent = {
      ...mockCategory,
      id: 'p1',
    };

    baseCategoryRepo.find = jest.fn().mockResolvedValue([mockParent]);

    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
    });

    (queryRunner.manager as EntityManager).save = jest.fn().mockResolvedValue(undefined);

    (queryRunner.manager as EntityManager).remove = jest.fn().mockResolvedValue(undefined);

    service = new CategoryBaseService(
      {
        create: jest.fn(x => x),
      } as Repository<BaseCategoryMultiLanguageNameEntity>,
      baseCategoryRepo,
      true,
      true,
      true,
      {
        createQueryRunner: () => queryRunner,
      } as Repository<BaseCategoryMultiLanguageNameEntity>,
      {} as CategoryDataLoader,
    );

    service.findById = jest.fn().mockResolvedValue({ id: 'cat-id' });

    const result = await service.update('cat-id', {
      name: 'NewName',
      parentIds: ['p1'],
      multiLanguageNames: {},
    });

    expect(baseCategoryRepo.find).toHaveBeenCalledWith({
      where: { id: In(['p1']) },
      relations: ['parents'],
    });

    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result).toEqual({ id: 'cat-id' });
  });

  it('should handle parentId with allowMultipleParentCategories enabled (single parentId path)', async () => {
    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [],
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      parents: [],
      children: [],
      articles: [],
    } as BaseCategoryEntity;

    const mockParent = {
      ...mockCategory,
      id: 'p1',
    };

    baseCategoryRepo.find = jest.fn().mockResolvedValue([mockParent]);

    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
    });

    (queryRunner.manager as EntityManager).save = jest.fn().mockResolvedValue(undefined);

    (queryRunner.manager as EntityManager).remove = jest.fn().mockResolvedValue(undefined);

    service = new CategoryBaseService(
      { create: jest.fn(x => x) } as Repository<BaseCategoryMultiLanguageNameEntity>,
      baseCategoryRepo,
      true,
      true,
      false,
      {
        createQueryRunner: () => queryRunner,
      } as Repository<BaseCategoryMultiLanguageNameEntity>,
      {
        withParentsLoader: {
          load: jest.fn().mockResolvedValue(mockCategory),
        },
      } as Repository<BaseCategoryMultiLanguageNameEntity>,
    );

    service.findById = jest.fn().mockResolvedValue({ id: 'cat-id' });

    const result = await service.update('cat-id', {
      name: 'Updated Name',
      parentId: 'p1',
      multiLanguageNames: {},
    });

    expect(baseCategoryRepo.find).toHaveBeenCalledWith({
      where: { id: In(['p1']) },
      relations: ['parents'],
    });

    expect(result).toEqual({ id: 'cat-id' });
  });

  it('should throw ParentCategoryNotFoundError if some parentIds are not found', async () => {
    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [],
    } as unknown as BaseCategoryEntity;

    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
    });

    baseCategoryRepo.find = jest.fn().mockResolvedValue([]); // simulate missing parents

    service = new CategoryBaseService(
      { create: jest.fn() } as Repository<BaseCategoryMultiLanguageNameEntity>,
      baseCategoryRepo,
      true, // multipleLanguageMode
      true, // allowMultipleParentCategories
      false, // allowCircularCategories
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {} as CategoryDataLoader,
    );

    await expect(() =>
      service.update('cat-id', {
        parentIds: ['p1', 'p2'],
        multiLanguageNames: {},
      }),
    ).rejects.toThrow(ParentCategoryNotFoundError);
  });

  it('should create a new multi-language name if it does not exist', async () => {
    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [],
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      parents: [],
      children: [],
      articles: [],
    } as BaseCategoryEntity;

    const mockParent = {
      ...mockCategory,
      id: 'p1',
    };

    baseCategoryRepo.findOne = jest.fn().mockResolvedValue(mockParent);
    baseCategoryRepo.find = jest.fn().mockResolvedValue([mockParent]);
    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
    });

    const createSpy = jest.fn(input => input);

    service = new CategoryBaseService(
      { create: createSpy } as Repository<BaseCategoryMultiLanguageNameEntity>,
      baseCategoryRepo,
      true, // multiLanguageMode
      true, // allowMultipleParents
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {
        load: jest.fn().mockResolvedValue({ parents: [] }),
        withParentsLoader: {
          load: jest.fn().mockResolvedValue({ parents: [] }),
        },
      } as Repository<BaseCategoryMultiLanguageNameEntity>,
    );

    service.findById = jest.fn().mockResolvedValue({ id: 'cat-id' });

    const result = await service.update(
      'cat-id',
      {
        parentIds: ['p1'],
        multiLanguageNames: {
          fr: 'Nouveau',
        },
      },
      { createdAt: new Date() },
    );

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'cat-id',
        language: 'fr',
        name: 'Nouveau',
      }),
    );

    expect(result).toEqual({ id: 'cat-id' });
  });

  it('should not throw when multiLanguageNames is undefined', async () => {
    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [],
      bindable: true,
      parents: [],
      children: [],
      articles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as BaseCategoryEntity;

    baseCategoryRepo.findOne = jest.fn().mockResolvedValue(mockCategory);
    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
    });

    queryRunner.manager!.save = jest.fn().mockResolvedValue(undefined);
    queryRunner.manager!.remove = jest.fn().mockResolvedValue(undefined);

    service.findById = jest.fn().mockResolvedValue({ id: 'cat-id' });

    const result = await service.update('cat-id', {
      name: 'Updated Name',
      multiLanguageNames: undefined,
    });

    expect(result).toEqual({ id: 'cat-id' });
  });

  it('should fallback to empty object when multiLanguageOptions is undefined and language does not exist', async () => {
    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [],
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      parents: [],
      children: [],
      articles: [],
    } as BaseCategoryEntity;

    baseCategoryRepo.findOne = jest.fn().mockResolvedValue(mockCategory);
    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
    });

    queryRunner.manager!.save = jest.fn().mockResolvedValue(undefined);
    queryRunner.manager!.remove = jest.fn().mockResolvedValue(undefined);

    const createSpy = jest.fn(input => input);

    service = new CategoryBaseService(
      { create: createSpy } as Repository<BaseCategoryMultiLanguageNameEntity>,
      baseCategoryRepo,
      true, // multiLanguageMode
      false,
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {
        withParentsLoader: {
          load: jest.fn().mockResolvedValue({ parents: [] }),
        },
      } as Repository<BaseCategoryMultiLanguageNameEntity>,
    );

    service.findById = jest.fn().mockResolvedValue({ id: 'cat-id' });

    await service.update(
      'cat-id',
      {
        multiLanguageNames: {
          en: 'Hello',
        },
      },
      undefined,
    );

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'cat-id',
        language: 'en',
        name: 'Hello',
      }),
    );
  });

  it('should create a new default language name when multiLanguageNames is missing and no default language exists', async () => {
    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [], // No languages at all
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      parents: [],
      children: [],
      articles: [],
    } as BaseCategoryEntity;

    baseCategoryRepo.findOne = jest.fn().mockResolvedValue(undefined);
    baseCategoryRepo.find = jest.fn().mockResolvedValue([]);
    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
    });

    queryRunner.manager!.save = jest.fn().mockResolvedValue(undefined);
    queryRunner.manager!.remove = jest.fn().mockResolvedValue(undefined);

    const createSpy = jest.fn(input => input);

    service = new CategoryBaseService(
      { create: createSpy } as Repository<BaseCategoryMultiLanguageNameEntity>,
      baseCategoryRepo,
      true, // multipleLanguageMode
      false,
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {
        withParentsLoader: {
          load: jest.fn().mockResolvedValue({ parents: [] }),
        },
      } as Repository<BaseCategoryMultiLanguageNameEntity>,
    );

    service.findById = jest.fn().mockResolvedValue({ id: 'cat-id' });

    const options = {
      name: 'Default Fallback Name',
    };

    const result = await service.update('cat-id', options, undefined);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'cat-id',
        language: DEFAULT_LANGUAGE,
        name: 'Default Fallback Name',
      }),
    );

    expect(result).toEqual({ id: 'cat-id' });
  });

  it('should update existing default language name if present and multiLanguageNames is not provided', async () => {
    const mockCategory = {
      id: 'cat-id',
      multiLanguageNames: [
        {
          categoryId: 'cat-id',
          language: DEFAULT_LANGUAGE,
          name: 'Old Name',
        },
      ],
      bindable: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      parents: [],
      children: [],
      articles: [],
    } as unknown as BaseCategoryEntity;

    baseCategoryRepo.findOne = jest.fn().mockResolvedValue(undefined);
    baseCategoryRepo.find = jest.fn().mockResolvedValue([]);
    baseCategoryRepo.createQueryBuilder = jest.fn().mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockCategory),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
    });

    queryRunner.manager!.save = jest.fn().mockResolvedValue(undefined);
    queryRunner.manager!.remove = jest.fn().mockResolvedValue(undefined);

    const createSpy = jest.fn(input => input);

    service = new CategoryBaseService(
      { create: createSpy } as Repository<BaseCategoryMultiLanguageNameEntity>,
      baseCategoryRepo,
      true,
      false,
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {
        withParentsLoader: {
          load: jest.fn().mockResolvedValue({ parents: [] }),
        },
      } as Repository<BaseCategoryMultiLanguageNameEntity>,
    );

    service.findById = jest.fn().mockResolvedValue({ id: 'cat-id' });

    const result = await service.update(
      'cat-id',
      {
        name: 'Updated Default Name',
      },
      undefined,
    );

    // ✅ Verifies that the default language path was used
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'cat-id',
        language: DEFAULT_LANGUAGE,
        name: 'Updated Default Name',
      }),
    );

    expect(result).toEqual({ id: 'cat-id' });
  });
});

describe('CategoryBaseService - create', () => {
  let service: CategoryBaseService;
  let baseCategoryRepo: jest.Mocked<Repository<BaseCategoryEntity>>;
  let multiLangRepo: jest.Mocked<Repository<BaseCategoryMultiLanguageNameEntity>>;

  let queryRunner: QueryRunner;
  let manager: {
    save: jest.MockedFunction<EntityManager['save']>;
    remove: jest.MockedFunction<EntityManager['remove']>;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    baseCategoryRepo = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<BaseCategoryEntity>>;

    multiLangRepo = {
      create: jest.fn(),
    } as unknown as jest.Mocked<Repository<BaseCategoryMultiLanguageNameEntity>>;

    manager = {
      save: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager,
    } as unknown as jest.Mocked<QueryRunner>;

    service = new CategoryBaseService(
      multiLangRepo,
      baseCategoryRepo,
      true,
      true,
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {} as CategoryDataLoader,
    );
  });

  it('should create a category with multiple language names', async () => {
    const categoryInput = {
      name: 'ignore',
      parentIds: [],
      multiLanguageNames: {
        en: 'English Name',
        fr: 'Nom Francais',
      },
    };

    const createdCategory = {
      id: 'cat-1',
      multiLanguageNames: [],
      parents: [],
    } as unknown as BaseCategoryEntity;

    baseCategoryRepo.create.mockReturnValue(createdCategory);
    multiLangRepo.create.mockImplementation(
      input =>
        ({
          ...input,
          categoryId: input.categoryId || 'cat-1',
        }) as BaseCategoryEntity,
    );

    jest.spyOn(service, 'findById').mockResolvedValue(createdCategory as BaseCategoryEntity);

    const result = await service.create(categoryInput);

    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(multiLangRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en', name: 'English Name' }),
    );

    expect(multiLangRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'fr', name: 'Nom Francais' }),
    );

    expect(result).toEqual(createdCategory);
  });

  it('should create a category with default language if multiLanguageNames is not present', async () => {
    const categoryInput = {
      name: 'Default Name',
      parentIds: [],
    };

    const createdCategory = {
      id: 'cat-2',
      multiLanguageNames: [],
      parents: [],
    } as unknown as BaseCategoryEntity;

    baseCategoryRepo.create.mockReturnValue(createdCategory);
    multiLangRepo.create.mockImplementation(
      input =>
        ({
          ...input,
          categoryId: input.categoryId || 'cat-2',
        }) as BaseCategoryEntity,
    );

    jest.spyOn(service, 'findById').mockResolvedValue(createdCategory as BaseCategoryEntity);

    const result = await service.create(categoryInput);

    expect(multiLangRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: 'cat-2',
        language: DEFAULT_LANGUAGE,
        name: 'Default Name',
      }),
    );

    expect(result).toEqual(createdCategory);
  });

  it('should throw error if multipleLanguageMode is false and multiLanguageNames is provided', async () => {
    service = new CategoryBaseService(
      multiLangRepo,
      baseCategoryRepo,
      false,
      true,
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {} as CategoryDataLoader,
    );

    const input = {
      name: 'Should Fail',
      multiLanguageNames: {
        en: 'English Name',
      },
    };

    await expect(service.create(input)).rejects.toThrow('Multiple language mode is not enabled');
  });

  it('should throw ParentCategoryNotFoundError if parentId not found', async () => {
    service = new CategoryBaseService(
      multiLangRepo,
      baseCategoryRepo,
      true,
      false,
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {} as CategoryDataLoader,
    );

    baseCategoryRepo.findOne.mockResolvedValue(null);

    await expect(service.create({ name: 'x', parentId: 'nonexistent' })).rejects.toThrow(ParentCategoryNotFoundError);
  });

  it('should throw MultipleParentCategoryNotAllowedError if parentIds is provided but allowMultipleParentCategories is false', async () => {
    service = new CategoryBaseService(
      multiLangRepo,
      baseCategoryRepo,
      true,
      false,
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {} as CategoryDataLoader,
    );

    const input = {
      name: 'Test',
      parentIds: ['p1', 'p2'],
    };

    await expect(service.create(input)).rejects.toThrow(MultipleParentCategoryNotAllowedError);
  });

  it('should find parent categories when parentIds are provided and allowMultipleParentCategories is true', async () => {
    service = new CategoryBaseService(
      multiLangRepo,
      baseCategoryRepo,
      true,
      true,
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {} as CategoryDataLoader,
    );

    const input = {
      name: 'With Parents',
      parentIds: ['p1', 'p2'],
    };

    const mockParents = [{ id: 'p1' }, { id: 'p2' }] as BaseCategoryEntity[];

    baseCategoryRepo.find.mockResolvedValue(mockParents);
    baseCategoryRepo.create.mockReturnValue({ id: 'cat-3' } as BaseCategoryEntity);
    jest.spyOn(service, 'findById').mockResolvedValue({ id: 'cat-3' } as BaseCategoryEntity);

    const result = await service.create(input);

    expect(baseCategoryRepo.find).toHaveBeenCalledWith({
      where: {
        id: expect.anything(),
      },
    });

    expect(result).toEqual({ id: 'cat-3' });
  });

  it('should use parentId when parentIds is undefined and allowMultipleParentCategories is true', async () => {
    service = new CategoryBaseService(
      multiLangRepo,
      baseCategoryRepo,
      true, // multipleLanguageMode
      true, // allowMultipleParentCategories
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {} as CategoryDataLoader,
    );

    const input = {
      name: 'Fallback to parentId',
      parentId: 'parent-1',
      // parentIds is intentionally undefined
    };

    const mockParent = { id: 'parent-1' } as BaseCategoryEntity;

    // Mock `find` to return 1 parent (length matches expected)
    baseCategoryRepo.find.mockResolvedValue([mockParent]);

    // Mock category creation
    const createdCategory = {
      id: 'cat-4',
      multiLanguageNames: [],
      parents: [mockParent],
    } as unknown as BaseCategoryEntity;

    baseCategoryRepo.create.mockReturnValue(createdCategory);
    jest.spyOn(service, 'findById').mockResolvedValue(createdCategory as BaseCategoryEntity);

    const result = await service.create(input);

    expect(baseCategoryRepo.find).toHaveBeenCalledWith({
      where: {
        id: In(['parent-1']),
      },
    });

    expect(result).toEqual(createdCategory);
  });

  it('should throw ParentCategoryNotFoundError if one of parentIds not found', async () => {
    service = new CategoryBaseService(
      multiLangRepo,
      baseCategoryRepo,
      true,
      true, // allowMultipleParentCategories = true
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {} as CategoryDataLoader,
    );

    const input = {
      name: 'Mismatch parents',
      parentIds: ['p1', 'p2'],
    };

    baseCategoryRepo.find.mockResolvedValue([{ id: 'p1' } as BaseCategoryEntity]); // only 1 found instead of 2

    await expect(service.create(input)).rejects.toThrow(ParentCategoryNotFoundError);
  });

  it('should use parentId if allowMultipleParentCategories is false and parent exists', async () => {
    service = new CategoryBaseService(
      multiLangRepo,
      baseCategoryRepo,
      true,
      false, // allowMultipleParentCategories = false
      false,
      { createQueryRunner: () => queryRunner } as MockServiceDataSource,
      {} as CategoryDataLoader,
    );

    const input = {
      name: 'Single parent',
      parentId: 'single-parent-id',
    };

    const mockParent = { id: 'single-parent-id' } as BaseCategoryEntity;

    baseCategoryRepo.findOne.mockResolvedValue(mockParent);
    baseCategoryRepo.create.mockReturnValue({
      id: 'cat-single',
      parents: [mockParent],
      multiLanguageNames: [],
    } as unknown as BaseCategoryEntity);

    jest.spyOn(service, 'findById').mockResolvedValue({
      id: 'cat-single',
      parents: [mockParent],
      multiLanguageNames: [],
    } as BaseCategoryEntity);

    const result = await service.create(input);

    expect(baseCategoryRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'single-parent-id' },
    });

    expect(result).toEqual(expect.objectContaining({ id: 'cat-single' }));
  });

  it('should handle case when multiLanguageNames is undefined (no entries)', async () => {
    const categoryInput = {
      name: 'No languages',
      parentIds: [],
      multiLanguageNames: undefined, // force the nullish fallback
    };

    const createdCategory = {
      id: 'cat-undef',
      multiLanguageNames: [],
      parents: [],
    } as unknown as BaseCategoryEntity;

    baseCategoryRepo.create.mockReturnValue(createdCategory);
    jest.spyOn(service, 'findById').mockResolvedValue(createdCategory as BaseCategoryEntity);

    const saveSpy = jest.spyOn(queryRunner.manager, 'save');

    const result = await service.create(categoryInput);

    expect(saveSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(multiLangRepo.create).not.toHaveBeenCalled();

    expect(result).toEqual(createdCategory);
  });
});
