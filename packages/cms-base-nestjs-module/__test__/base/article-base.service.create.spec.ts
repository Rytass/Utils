import { Test, TestingModule } from '@nestjs/testing';
import { ArticleBaseService } from '../../src/services/article-base.service';
import {
  ARTICLE_SIGNATURE_SERVICE,
  DRAFT_MODE,
  ENABLE_SIGNATURE_MODE,
  FULL_TEXT_SEARCH_MODE,
  MULTIPLE_LANGUAGE_MODE,
  RESOLVED_ARTICLE_REPO,
  RESOLVED_ARTICLE_VERSION_CONTENT_REPO,
  RESOLVED_ARTICLE_VERSION_REPO,
  RESOLVED_CATEGORY_REPO,
} from '../../src/typings/cms-base-providers';
import { DataSource } from 'typeorm';
import { ArticleNotFoundError } from '../../src/constants/errors/article.errors';
import { CategoryNotFoundError } from '../../src/constants/errors/category.errors';

describe('ArticleBaseService (addVersion)', () => {
  let service: ArticleBaseService<any, any, any>;
  const findMock = jest.fn();
  const findOneMock = jest.fn();
  const createQueryRunnerMock = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
    },
  };

  const createMock = jest.fn().mockImplementation((data) => data);
  const getOneMock = jest.fn().mockResolvedValue({ version: 1 });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        {
          provide: RESOLVED_ARTICLE_REPO,
          useValue: {
            findOne: findOneMock,
            create: createMock,
          },
        },
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: {
            create: createMock,
            createQueryBuilder: () => ({
              andWhere: jest.fn().mockReturnThis(),
              addOrderBy: jest.fn().mockReturnThis(),
              getOne: getOneMock,
            }),
          },
        },
        {
          provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO,
          useValue: {
            create: createMock,
          },
        },
        {
          provide: RESOLVED_CATEGORY_REPO,
          useValue: {
            find: findMock,
          },
        },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: false },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: true },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: () => createQueryRunnerMock,
          },
        },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    jest.clearAllMocks();
  });

  it('should throw ArticleNotFoundError if article does not exist', async () => {
    findOneMock.mockResolvedValue(undefined);

    await expect(
      service.addVersion('invalid-id', {
        title: 'New Title',
        content: [],
      } as any),
    ).rejects.toThrow(ArticleNotFoundError);
  });

  it('should throw CategoryNotFoundError if categories invalid', async () => {
    findOneMock.mockResolvedValue({ id: 'a1', categories: [] });
    findMock.mockResolvedValue([]);

    await expect(
      service.addVersion('a1', {
        title: 'New Title',
        content: [],
        categoryIds: ['catX'],
      } as any),
    ).rejects.toThrowError(CategoryNotFoundError);
  });

  it('should add new version (single language)', async () => {
    findOneMock.mockResolvedValue({ id: 'a1', categories: [] });
    findMock.mockResolvedValue([]);
    createQueryRunnerMock.manager.save.mockResolvedValue({ id: 'saved' });

    const result = await service.addVersion('a1', {
      title: 'New Title',
      content: [],
    } as any);

    expect(result.id).toBe('a1');
    expect(createQueryRunnerMock.startTransaction).toHaveBeenCalled();
    expect(createQueryRunnerMock.commitTransaction).toHaveBeenCalled();
  });

  it('should add new version (multi-language)', async () => {
    (service as any).multipleLanguageMode = true;

    findOneMock.mockResolvedValue({ id: 'a1', categories: [] });
    findMock.mockResolvedValue([]);
    createQueryRunnerMock.manager.save.mockResolvedValue({ id: 'saved' });

    const result = await service.addVersion('a1', {
      multiLanguageContents: {
        en: { title: 'EN Title', content: [] },
        zh: { title: 'ZH 標題', content: [] },
      },
      tags: ['tech'],
    } as any);

    expect(result.id).toBe('a1');
    expect(createQueryRunnerMock.startTransaction).toHaveBeenCalled();
    expect(createQueryRunnerMock.commitTransaction).toHaveBeenCalled();
    expect(createQueryRunnerMock.manager.save).toHaveBeenCalled();
  });
});

describe('ArticleBaseService (create)', () => {
  let service: ArticleBaseService<any, any, any>;

  const findMock = jest.fn();
  const createMock = jest
    .fn()
    .mockImplementation((data) => ({ ...data, id: 'a1' }));

  const saveMock = jest.fn().mockResolvedValue({ id: 'a1' });

  const createQueryRunnerMock = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: saveMock,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        {
          provide: RESOLVED_ARTICLE_REPO,
          useValue: { create: createMock },
        },
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: { create: createMock },
        },
        {
          provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO,
          useValue: { create: createMock },
        },
        {
          provide: RESOLVED_CATEGORY_REPO,
          useValue: { find: findMock },
        },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: true },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: () => createQueryRunnerMock,
          },
        },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);
    jest.clearAllMocks();
  });

  it('should throw CategoryNotFoundError if category check fails', async () => {
    findMock.mockResolvedValue([]);

    await expect(
      service.create({
        title: 'Some Title',
        content: [],
        categoryIds: ['catX'],
      } as any),
    ).rejects.toThrowError();
  });

  it('should create single-language article', async () => {
    findMock.mockResolvedValue([]);

    const result = await service.create({
      title: 'Single Lang',
      content: [],
    } as any);

    expect(result.id).toBe('a1');
    expect(saveMock).toHaveBeenCalled();
    expect(createQueryRunnerMock.commitTransaction).toHaveBeenCalled();
  });

  it('should create multi-language article', async () => {
    findMock.mockResolvedValue([]);

    const result = await service.create({
      multiLanguageContents: {
        en: { title: 'EN Title', content: [] },
        zh: { title: 'ZH Title', content: [] },
      },
      tags: ['x'],
    } as any);

    expect(result.id).toBe('a1');
    expect(saveMock).toHaveBeenCalled();
    expect(createQueryRunnerMock.commitTransaction).toHaveBeenCalled();
  });
});
