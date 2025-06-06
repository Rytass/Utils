import { Test, TestingModule } from '@nestjs/testing';
import { CategoryBaseService } from '../../src/services/category-base.service';
import { DataSource, In } from 'typeorm';
import {
  CATEGORY_DATA_LOADER,
  CIRCULAR_CATEGORY_MODE,
  MULTIPLE_CATEGORY_PARENT_MODE,
  MULTIPLE_LANGUAGE_MODE,
  RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO,
  RESOLVED_CATEGORY_REPO,
} from '../../src/typings/cms-base-providers';
import {
  CategoryNotFoundError,
  MultipleParentCategoryNotAllowedError,
  ParentCategoryNotFoundError,
} from '../../src/constants/errors/category.errors';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DEFAULT_LANGUAGE } from '../../src/constants/default-language';

describe('CategoryBaseService.archive', () => {
  let service: CategoryBaseService<any, any>;
  let findOneMock: jest.Mock;
  let softDeleteMock: jest.Mock;

  beforeEach(async () => {
    findOneMock = jest.fn();
    softDeleteMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBaseService,
        {
          provide: RESOLVED_CATEGORY_REPO,
          useValue: {
            findOne: findOneMock,
            softDelete: softDeleteMock,
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

    service = module.get(CategoryBaseService);
  });

  it('should soft delete the category if it exists', async () => {
    const mockId = '123';
    findOneMock.mockResolvedValue({ id: mockId });

    await service.archive(mockId);

    expect(findOneMock).toHaveBeenCalledWith({ where: { id: mockId } });
    expect(softDeleteMock).toHaveBeenCalledWith(mockId);
  });

  it('should throw CategoryNotFoundError if category does not exist', async () => {
    findOneMock.mockResolvedValue(null);

    await expect(service.archive('non-existent')).rejects.toThrow(
      CategoryNotFoundError,
    );
  });
});

describe('CategoryBaseService.update', () => {
  let service: CategoryBaseService<any, any>;
  let mockRepo: any;
  let mockRunner: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      }),
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    mockRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
        remove: jest.fn(),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBaseService,
        { provide: RESOLVED_CATEGORY_REPO, useValue: mockRepo },
        {
          provide: RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO,
          useValue: mockRepo,
        },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: MULTIPLE_CATEGORY_PARENT_MODE, useValue: true },
        { provide: CIRCULAR_CATEGORY_MODE, useValue: false },
        {
          provide: CATEGORY_DATA_LOADER,
          useValue: {
            withParentsLoader: {
              load: jest.fn().mockResolvedValue({ id: 'c1', parents: [] }),
            },
          },
        },

        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(CategoryBaseService);
  });

  it('should update category with multi-language names', async () => {
    const category = {
      id: 'c1',
      multiLanguageNames: [{ language: 'en', name: 'Old' }],
      parents: [],
    };
    const updateDto = {
      multiLanguageNames: { en: 'Updated EN', zh: '更新的名稱' },
    };

    mockRepo.createQueryBuilder().getOne.mockResolvedValue(category);
    mockRepo.find.mockResolvedValue([]);
    mockRepo.create.mockImplementation((val: any) => val);

    const result = await service.update('c1', updateDto);

    expect(mockRunner.manager.save).toHaveBeenCalled();
    expect(result).toEqual(category);
  });

  it('should throw CategoryNotFoundError if category does not exist', async () => {
    mockRepo.createQueryBuilder().getOne.mockResolvedValue(undefined);

    await expect(
      service.update('unknown', { multiLanguageNames: { en: 'Test' } }),
    ).rejects.toThrow(CategoryNotFoundError);
  });

  it('should throw ParentCategoryNotFoundError if parent not found', async () => {
    const category = {
      id: 'c1',
      multiLanguageNames: [],
      parents: [],
    };

    mockRepo.createQueryBuilder().getOne.mockResolvedValue(category);
    mockRepo.find.mockResolvedValue([]);

    await expect(
      service.update('c1', {
        multiLanguageNames: { en: 'Test' },
        parentIds: ['p1'],
      }),
    ).rejects.toThrow(ParentCategoryNotFoundError);
  });

  it('should rollback and rethrow on DB failure', async () => {
    const category = {
      id: 'c1',
      multiLanguageNames: [],
      parents: [],
    };

    mockRepo.createQueryBuilder().getOne.mockResolvedValue(category);
    mockRepo.find.mockResolvedValue([]);
    mockRunner.manager.save.mockRejectedValue(new Error('fail'));

    await expect(
      service.update('c1', {
        multiLanguageNames: { en: 'Test' },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('should throw MultipleParentCategoryNotAllowedError if parentIds are provided and allowMultipleParentCategories is false', async () => {
    (service as any).allowMultipleParentCategories = false;

    const dto = {
      parentIds: ['p1', 'p2'],
      name: 'Test',
    };

    await expect(service.update('c1', dto as any)).rejects.toThrow(
      MultipleParentCategoryNotAllowedError,
    );
  });

  it('should resolve parent by parentId when parentIds is undefined and allowMultipleParentCategories is true', async () => {
    (service as any).allowMultipleParentCategories = true;

    const mockCategory = {
      id: 'c1',
      multiLanguageNames: [],
      parents: [],
    };

    const mockParentCategory = {
      id: 'p1',
      parents: [],
    };

    mockRepo.createQueryBuilder().getOne.mockResolvedValue(mockCategory);
    mockRepo.find.mockResolvedValue([mockParentCategory]);

    mockRunner.manager.save.mockResolvedValue(mockCategory);
    mockRunner.manager.remove.mockResolvedValue(undefined);

    const dto = {
      parentId: 'p1',
      multiLanguageNames: { en: 'Name' },
    };

    const result = await service.update('c1', dto);

    expect(mockRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: expect.any(Object),
        },
        relations: ['parents'],
      }),
    );

    expect(result).toEqual(mockCategory);
  });

  it('should resolve parent by parentId when allowMultipleParentCategories is false', async () => {
    (service as any).allowMultipleParentCategories = false;

    const mockCategory = { id: 'c1', multiLanguageNames: [], parents: [] };
    const mockParentCategory = { id: 'p1', parents: [] };

    mockRepo.createQueryBuilder().getOne.mockResolvedValue(mockCategory);
    mockRepo.findOne.mockResolvedValue(mockParentCategory);
    mockRunner.manager.save.mockResolvedValue(mockCategory);
    mockRunner.manager.remove.mockResolvedValue(undefined);

    const dto = {
      parentId: 'p1',
      multiLanguageNames: { en: 'Test Name' },
    };

    const result = await service.update('c1', dto);

    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'p1' },
      relations: ['parents'],
    });

    expect(result).toEqual(mockCategory);
  });

  it('should throw ParentCategoryNotFoundError if parentId is used but category not found (single-parent mode)', async () => {
    (service as any).allowMultipleParentCategories = false;

    const mockCategory = { id: 'c1', multiLanguageNames: [], parents: [] };

    mockRepo.createQueryBuilder().getOne.mockResolvedValue(mockCategory);
    mockRepo.findOne.mockResolvedValue(undefined);

    await expect(
      service.update('c1', {
        parentId: 'nonexistent',
        multiLanguageNames: { en: 'Missing Parent' },
      }),
    ).rejects.toThrow(ParentCategoryNotFoundError);
  });

  it('should throw if multiple language mode is disabled but multiLanguageNames are passed in update()', async () => {
    (service as any).multipleLanguageMode = false;

    const mockCategory = {
      id: 'c1',
      multiLanguageNames: [],
      parents: [],
    };

    mockRepo.createQueryBuilder().getOne.mockResolvedValue(mockCategory);
    mockRepo.find.mockResolvedValue([]);

    const dto = {
      multiLanguageNames: { en: 'Name' },
    };

    await expect(service.update('c1', dto)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should fallback to default language when multiLanguageNames is null', async () => {
    const mockCategory = {
      id: 'c1',
      multiLanguageNames: [
        { language: 'en', name: 'Old' },
        { language: 'zh', name: '舊名' },
      ],
      parents: [],
    };

    const expectedCreated = {
      categoryId: 'c1',
      language: 'en',
      name: 'StillOld',
    };

    mockRepo.createQueryBuilder().getOne.mockResolvedValue(mockCategory);
    mockRepo.find.mockResolvedValue([]);
    mockRunner.manager.save.mockResolvedValue(mockCategory);
    mockRunner.manager.remove.mockResolvedValue(undefined);
    mockRepo.create.mockReturnValue(expectedCreated);

    const dto = {
      name: 'StillOld',
      multiLanguageNames: null,
    };

    const result = await service.update('c1', dto as any);

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining(expectedCreated),
    );
    expect(result).toEqual(mockCategory);
  });

  it('should use existing defaultLanguage to create fallback when multiLanguageNames not provided', async () => {
    (service as any).multipleLanguageMode = true;

    const mockCategory = {
      id: 'c1',
      multiLanguageNames: [{ language: DEFAULT_LANGUAGE, name: 'Old Default' }],
      parents: [],
    };

    mockRepo.createQueryBuilder().getOne.mockResolvedValue(mockCategory);
    mockRepo.find.mockResolvedValue([]);
    mockRunner.manager.save.mockResolvedValue(mockCategory);
    mockRunner.manager.remove.mockResolvedValue(undefined);

    mockRepo.create.mockImplementation((val: any) => val);

    const dto = { name: 'Updated Name' };

    const result = await service.update('c1', dto);

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          language: DEFAULT_LANGUAGE,
          name: 'Updated Name',
        }),
      ]),
    );

    expect(result).toEqual(mockCategory);
  });

  it('should create default language entry from scratch when no defaultLanguage exists', async () => {
    (service as any).multipleLanguageMode = true;

    const mockCategory = {
      id: 'c1',
      multiLanguageNames: [],
      parents: [],
    };

    mockRepo.createQueryBuilder().getOne.mockResolvedValue(mockCategory);
    mockRepo.find.mockResolvedValue([]);
    mockRunner.manager.save.mockResolvedValue(mockCategory);
    mockRunner.manager.remove.mockResolvedValue(undefined);

    mockRepo.create.mockImplementation((val: any) => val);

    const dto = { name: 'Brand New Default Name' };

    const result = await service.update('c1', dto);

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          categoryId: 'c1',
          language: DEFAULT_LANGUAGE,
          name: 'Brand New Default Name',
        }),
      ]),
    );

    expect(result).toEqual(mockCategory);
  });
});

describe('CategoryBaseService.create', () => {
  let service: CategoryBaseService<any, any>;
  let mockRepo: any;
  let mockRunner: any;
  let mockDataSource: any;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
        getMany: jest.fn(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
      }),
    };

    mockRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
        remove: jest.fn(),
      },
    };

    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryBaseService,
        { provide: RESOLVED_CATEGORY_REPO, useValue: mockRepo },
        {
          provide: RESOLVED_CATEGORY_MULTI_LANGUAGE_NAME_REPO,
          useValue: mockRepo,
        },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: MULTIPLE_CATEGORY_PARENT_MODE, useValue: true },
        { provide: CIRCULAR_CATEGORY_MODE, useValue: false },
        { provide: CATEGORY_DATA_LOADER, useValue: {} },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(CategoryBaseService);
  });

  it('should create a category with multiple language names', async () => {
    const dto = {
      multiLanguageNames: { en: 'Test EN', zh: '測試' },
    };

    const createdCategory = { id: '1', ...dto };

    mockRepo.create.mockReturnValue(createdCategory);
    mockRunner.manager.save.mockResolvedValue(createdCategory);

    const result = await service.create(dto);

    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockRunner.manager.save).toHaveBeenCalled();
    expect(result).toEqual(createdCategory);
  });

  it('should throw if multiple parents provided when not allowed', async () => {
    (service as any).allowMultipleParentCategories = false;

    await expect(
      service.create({
        parentIds: ['p1', 'p2'],
        multiLanguageNames: { en: 'Test' },
      }),
    ).rejects.toThrow(MultipleParentCategoryNotAllowedError);
  });

  it('should throw if a specified parent category is not found', async () => {
    mockRepo.find.mockResolvedValue([]); // simulate no match
    await expect(
      service.create({ parentIds: ['p1'], multiLanguageNames: { en: 'Test' } }),
    ).rejects.toThrow(ParentCategoryNotFoundError);
  });

  it('should throw BadRequestException if multiple language mode is disabled but names are passed', async () => {
    (service as any).multipleLanguageMode = false;

    const dto = {
      multiLanguageNames: { en: 'Test' },
    };

    mockRepo.create.mockReturnValue({ id: 'c1', ...dto });

    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    await expect(service.create(dto)).rejects.toThrow(
      'Multiple language mode is not enabled',
    );
  });

  it('should rollback and rethrow on DB error', async () => {
    const dto = {
      multiLanguageNames: { en: 'Test' },
    };

    mockRepo.create.mockReturnValue({ id: 'c1', ...dto });
    mockRunner.manager.save.mockRejectedValue(new Error('fail'));

    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    expect(mockRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('should resolve parent by parentId when parentIds is undefined and allowMultipleParentCategories is true', async () => {
    (service as any).allowMultipleParentCategories = true;

    const mockParentCategory = { id: 'p1' };
    mockRepo.find.mockResolvedValue([mockParentCategory]);
    mockRepo.create.mockImplementation((val: any) => val);

    const dto = {
      parentId: 'p1',
      name: 'Test',
    };

    const result = await service.create(dto);

    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { id: In(['p1']) },
    });

    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        parents: [mockParentCategory],
      }),
    );

    expect(result.parents).toEqual([mockParentCategory]);
  });

  it('should throw ParentCategoryNotFoundError if parentId is given but parent not found (via parentIds fallback)', async () => {
    (service as any).allowMultipleParentCategories = true;

    mockRepo.find.mockResolvedValue([]); // Not found

    const dto = {
      parentId: 'missing-id',
      name: 'Test',
    };

    await expect(service.create(dto)).rejects.toThrow(
      ParentCategoryNotFoundError,
    );

    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { id: In(['missing-id']) },
    });
  });

  it('should throw ParentCategoryNotFoundError when parentId is not found and multiple parent not allowed', async () => {
    (service as any).allowMultipleParentCategories = false;

    const mockCategory = {
      id: 'c1',
      multiLanguageNames: [],
      parents: [],
    };

    mockRepo.createQueryBuilder().getOne.mockResolvedValue(mockCategory);
    mockRepo.findOne.mockResolvedValue(undefined);

    const dto = {
      parentId: 'nonexistent',
      multiLanguageNames: { en: 'Test Name' },
    };

    await expect(service.update('c1', dto)).rejects.toThrow(
      ParentCategoryNotFoundError,
    );
  });

  it('should set parentCategories from parentId when allowMultipleParentCategories is false', async () => {
    (service as any).allowMultipleParentCategories = false;

    const mockCategory = {
      id: 'c1',
      multiLanguageNames: [],
      parents: [],
    };

    const mockParent = {
      id: 'p1',
      parents: [],
    };

    mockRepo.findOne.mockResolvedValue(mockParent);
    mockRepo.create.mockImplementation((val: any) => val);
    mockRunner.manager.save.mockResolvedValue(mockCategory);

    const dto = {
      parentId: 'p1',
      name: 'Test Category',
    };

    const result = await service.create(dto);

    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'p1' },
    });

    expect(result.parents).toEqual([mockParent]);
  });

  it('should throw ParentCategoryNotFoundError when parentId is not found and multiple parent not allowed', async () => {
    (service as any).allowMultipleParentCategories = false;

    mockRepo.findOne.mockResolvedValue(undefined); // simulate not found

    const dto = {
      parentId: 'missing-id',
      name: 'Test Category',
    };

    await expect(service.create(dto)).rejects.toThrow(
      ParentCategoryNotFoundError,
    );

    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'missing-id' },
    });
  });

  it('should not fail if multiLanguageNames is null', async () => {
    const dto = {
      name: 'Test Fallback',
      multiLanguageNames: null,
    };

    const createdCategory = {
      id: 'cat-123',
      ...dto,
    };

    mockRepo.create.mockReturnValue(createdCategory);
    mockRunner.manager.save.mockResolvedValue(createdCategory);

    const result = await service.create(dto);

    // First call: save the category itself
    expect(mockRunner.manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cat-123' }),
    );

    // Second call: empty multiLanguageNames should trigger save([])
    expect(mockRunner.manager.save.mock.calls[1][0]).toEqual([]);

    expect(result).toEqual(createdCategory);
  });
});
