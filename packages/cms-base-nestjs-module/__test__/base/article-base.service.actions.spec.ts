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
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import {
  ArticleNotFoundError,
  ArticleVersionNotFoundError,
} from '../../src/constants/errors/article.errors';
import { CategoryNotFoundError } from '../../src/constants/errors/category.errors';
import { BadRequestException } from '@nestjs/common';
import { DEFAULT_LANGUAGE } from '../../src/constants/default-language';

describe('ArticleBaseService (archive)', () => {
  let service: ArticleBaseService<any, any, any>;
  const findOneMock = jest.fn();
  const softDeleteMock = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        {
          provide: RESOLVED_ARTICLE_REPO,
          useValue: {
            findOne: findOneMock,
            softDelete: softDeleteMock,
          },
        },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: false },
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);
  });

  it('should soft delete the article when it exists', async () => {
    findOneMock.mockResolvedValue({ id: 'a1' });

    await service.archive('a1');

    expect(findOneMock).toHaveBeenCalledWith({ where: { id: 'a1' } });
    expect(softDeleteMock).toHaveBeenCalledWith('a1');
  });

  it('should throw ArticleNotFoundError if article does not exist', async () => {
    findOneMock.mockResolvedValue(undefined);

    await expect(service.archive('missing-id')).rejects.toThrow(
      ArticleNotFoundError,
    );
  });
});

describe('ArticleBaseService (release)', () => {
  let service: ArticleBaseService<any, any, any>;
  const updateMock = jest.fn();

  const mockFindById = jest.fn();
  const now = new Date();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        {
          provide: RESOLVED_ARTICLE_REPO,
          useValue: {},
        },
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: { update: updateMock },
        },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: true },
        {
          provide: DataSource,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    service.findById = mockFindById;
  });

  it('should throw error if draftMode is disabled', async () => {
    (service as any).draftMode = false;

    await expect(service.release('a1')).rejects.toThrow(
      'Draft mode is disabled.',
    );
  });

  it('should do nothing if article is already released', async () => {
    const releasedAt = new Date('2024-01-01');

    mockFindById.mockResolvedValue({
      id: 'a1',
      version: 2,
      releasedAt,
    });

    const result = await service.release('a1');

    expect(result.releasedAt).toEqual(releasedAt);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('should update releasedAt and return updated article', async () => {
    const unreleasedArticle = {
      id: 'a1',
      version: 2,
      releasedAt: undefined,
    };

    mockFindById.mockResolvedValue(unreleasedArticle);

    const result = await service.release('a1', now);

    expect(updateMock).toHaveBeenCalledWith(
      { articleId: 'a1', version: 2 },
      { releasedAt: now },
    );

    expect(result.releasedAt).toEqual(now);
  });

  it('should use current date if releasedAt is not provided', async () => {
    const unreleasedArticle = {
      id: 'a1',
      version: 2,
      releasedAt: undefined,
    };

    mockFindById.mockResolvedValue(unreleasedArticle);

    const before = new Date();
    const result = await service.release('a1');
    const after = new Date();

    expect(result.releasedAt).toBeInstanceOf(Date);
    expect(result.releasedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
    expect(result.releasedAt.getTime()).toBeLessThanOrEqual(after.getTime());

    expect(updateMock).toHaveBeenCalledWith(
      { articleId: 'a1', version: 2 },
      { releasedAt: expect.any(Date) },
    );
  });
});

describe('ArticleBaseService (addVersion)', () => {
  let service: ArticleBaseService<any, any, any>;
  const findMock = jest.fn();
  const findOneMock = jest.fn();
  const createQueryBuilderMock = {
    andWhere: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const runnerMock: Partial<QueryRunner> = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
    } as unknown as EntityManager,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        {
          provide: RESOLVED_ARTICLE_REPO,
          useValue: {
            findOne: findOneMock,
          },
        },
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: {
            createQueryBuilder: () => createQueryBuilderMock,
          },
        },
        {
          provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO,
          useValue: {
            create: jest.fn((x) => x),
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
            createQueryRunner: () => runnerMock,
          },
        },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);
  });

  it('should throw CategoryNotFoundError when categoryIds are not valid or bindable', async () => {
    findMock.mockResolvedValue([]); // Simulate no valid categories found

    const options = {
      categoryIds: ['cat1', 'cat2'],
      title: 'Test Title',
      description: 'Test Description',
      tags: ['news'],
      content: [{ type: 'p', children: [{ text: 'Hello world' }] }],
    };

    await expect(service.addVersion('a1', options)).rejects.toThrow(
      CategoryNotFoundError,
    );
    expect(findMock).toHaveBeenCalledWith({
      where: { id: expect.any(Object), bindable: true },
    });
  });

  it('should throw ArticleNotFoundError when article is not found', async () => {
    // Prepare category lookup to pass validation
    findMock.mockResolvedValue([{ id: 'cat1', bindable: true }]);

    // Simulate article not found
    findOneMock.mockResolvedValue(undefined);

    const options = {
      categoryIds: ['cat1'],
      title: 'New Title',
      description: 'New Desc',
      tags: ['tech'],
      content: [{ type: 'p', children: [{ text: 'Hello' }] }],
    };

    await expect(service.addVersion('nonexistent-id', options)).rejects.toThrow(
      ArticleNotFoundError,
    );

    expect(findMock).toHaveBeenCalled();
    expect(findOneMock).toHaveBeenCalledWith({
      where: { id: 'nonexistent-id' },
      relations: ['categories'],
    });
  });

  it('should throw ArticleVersionNotFoundError if no previous version found', async () => {
    // Valid categories
    findMock.mockResolvedValue([]);
    // Valid article exists
    findOneMock.mockResolvedValue({
      id: 'a1',
      categories: [],
    });
    // No previous version found
    createQueryBuilderMock.getOne.mockResolvedValue(undefined);

    const options = {
      title: 'New Version',
      description: 'Desc',
      tags: ['new'],
      content: [{ type: 'p', children: [{ text: 'v1' }] }],
    };

    await expect(service.addVersion('a1', options)).rejects.toThrow(
      ArticleVersionNotFoundError,
    );
  });

  it('should include categories when categoryIds are provided and save is successful', async () => {
    const targetCategories = [{ id: 'cat1', bindable: true }];
    findMock.mockResolvedValue(targetCategories);
    findOneMock.mockResolvedValue({
      id: 'a1',
      categories: [],
    });
    createQueryBuilderMock.getOne.mockResolvedValue({ version: 3 });

    // Setup mock .create and .save
    const createSpy = jest.fn((x) => x);
    const saveSpy = jest.spyOn(runnerMock.manager!, 'save');

    (service as any).baseArticleRepo = {
      create: createSpy,
      findOne: findOneMock,
    };
    (service as any).baseArticleVersionRepo = {
      create: createSpy,
      findOne: findOneMock,
      createQueryBuilder: () => createQueryBuilderMock,
    };
    (service as any).baseArticleVersionContentRepo = {
      create: createSpy,
      findOne: findOneMock,
    };

    const options = {
      categoryIds: ['cat1'],
      title: 'New Ver',
      description: 'Desc',
      tags: ['tag1'],
      content: [{ type: 'p', children: [{ text: 'Hello' }] }],
    };

    await service.addVersion('a1', options);

    const savedArticle = saveSpy.mock.calls[0][0] as any;
    expect(savedArticle.categories).toEqual(targetCategories);
  });

  it('should warn when article has categories but no categoryIds are provided', async () => {
    findOneMock.mockResolvedValue({
      id: 'a1',
      categories: [{ id: 'cat1' }],
    });

    const options = {
      title: 'Title',
      description: 'Desc',
      tags: ['t'],
      content: [{ type: 'p', children: [{ text: 'Test' }] }],
    };

    createQueryBuilderMock.getOne.mockResolvedValue({ version: 1 });

    const warnSpy = jest.fn();
    (service as any).logger = { warn: warnSpy };

    (service as any).baseArticleRepo = {
      create: jest.fn((x) => x),
      findOne: findOneMock,
    };
    (service as any).baseArticleVersionRepo = {
      create: jest.fn((x) => x),
      createQueryBuilder: () => createQueryBuilderMock,
    };
    (service as any).baseArticleVersionContentRepo = {
      create: jest.fn((x) => x),
    };

    const saveSpy = jest
      .spyOn(runnerMock.manager!, 'save')
      .mockResolvedValue({});

    await service.addVersion('a1', options);

    expect(warnSpy).toHaveBeenCalledWith(
      'Article a1 has categories, but no categoryIds provided when add version. The article categories will no change after version added.',
    );
  });

  it('should call bindSearchTokens when fullTextSearchMode is enabled', async () => {
    const bindSearchTokensSpy = jest.fn();
    (service as any).bindSearchTokens = bindSearchTokensSpy;
    (service as any).multipleLanguageMode = true;
    (service as any).fullTextSearchMode = true;

    findMock.mockResolvedValue([]);
    findOneMock.mockResolvedValue({ id: 'a1', categories: [] });
    createQueryBuilderMock.getOne.mockResolvedValue({ version: 1 });

    const createSpy = jest.fn((x) => x);
    (service as any).baseArticleRepo = {
      create: createSpy,
      findOne: findOneMock,
    };
    (service as any).baseArticleVersionRepo = {
      create: createSpy,
      findOne: findOneMock,
      createQueryBuilder: () => createQueryBuilderMock,
    };
    (service as any).baseArticleVersionContentRepo = {
      create: createSpy,
      findOne: findOneMock,
    };

    jest.spyOn(runnerMock.manager!, 'save').mockResolvedValue([
      {
        articleId: 'a1',
        version: 2,
        language: 'en',
        title: 'EN Title',
        description: 'EN Desc',
        content: [],
      },
    ]);

    const options = {
      multiLanguageContents: {
        en: { title: 'EN Title', description: 'EN Desc', content: [] },
      },
      tags: ['fulltext'],
    };

    await service.addVersion('a1', options);

    expect(bindSearchTokensSpy).toHaveBeenCalledTimes(1);
    expect(bindSearchTokensSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
      ['fulltext'],
      runnerMock,
    );
  });

  it('should set releasedAt to current date when draftMode is false and no releasedAt is provided', async () => {
    findMock.mockResolvedValue([]);
    findOneMock.mockResolvedValue({ id: 'a1', categories: [] });
    createQueryBuilderMock.getOne.mockResolvedValue({ version: 1 });

    const createSpy = jest.fn((x) => x);

    const versionEntityHolder: any[] = [];

    const saveSpy = jest
      .spyOn(runnerMock.manager!, 'save')
      .mockImplementation(async (input) => {
        if ((input as any).version === 2) {
          versionEntityHolder.push(input); // Capture the saved version entity
        }
        return input;
      });

    (service as any).baseArticleRepo = {
      create: createSpy,
      findOne: findOneMock,
    };
    (service as any).baseArticleVersionRepo = {
      create: createSpy,
      findOne: findOneMock,
      createQueryBuilder: () => createQueryBuilderMock,
    };
    (service as any).baseArticleVersionContentRepo = {
      create: createSpy,
      findOne: findOneMock,
    };

    (service as any).draftMode = false;

    const options = {
      title: 'Auto Released',
      description: 'No release date provided',
      tags: ['auto'],
      content: [{ type: 'p', children: [{ text: 'Text' }] }],
    };

    const before = Date.now();
    await service.addVersion('a1', options);
    const after = Date.now();

    expect(versionEntityHolder[0]).toBeDefined(); // ⛳️ Ensure it was captured
    expect(versionEntityHolder[0].releasedAt).toBeDefined();
    expect(
      new Date(versionEntityHolder[0].releasedAt).getTime(),
    ).toBeGreaterThanOrEqual(before);
    expect(
      new Date(versionEntityHolder[0].releasedAt).getTime(),
    ).toBeLessThanOrEqual(after);
  });

  it('should call bindSearchTokens with empty array when tags are not provided and fullTextSearchMode is true', async () => {
    // Enable modes
    (service as any).multipleLanguageMode = true;
    (service as any).fullTextSearchMode = true;

    // Setup mocks
    findMock.mockResolvedValue([]);
    findOneMock.mockResolvedValue({ id: 'a1', categories: [] });
    createQueryBuilderMock.getOne.mockResolvedValue({ version: 1 });

    const createSpy = jest.fn((x) => x);
    (service as any).baseArticleRepo = {
      create: createSpy,
      findOne: findOneMock,
    };
    (service as any).baseArticleVersionRepo = {
      create: createSpy,
      createQueryBuilder: () => createQueryBuilderMock,
    };
    (service as any).baseArticleVersionContentRepo = {
      create: createSpy,
    };

    // Spy on bindSearchTokens
    const bindSearchTokensSpy = jest.fn();
    (service as any).bindSearchTokens = bindSearchTokensSpy;

    // Stub save() to simulate saving multiLanguageContents
    jest.spyOn(runnerMock.manager!, 'save').mockResolvedValue([
      {
        articleId: 'a1',
        version: 2,
        language: 'en',
        title: 'Test',
        description: 'Test',
        content: [],
      },
    ]);

    const options = {
      multiLanguageContents: {
        en: { title: 'EN', description: 'EN Desc', content: [] },
      },
      // 👇 omit tags entirely
    };

    await service.addVersion('a1', options);

    expect(bindSearchTokensSpy).toHaveBeenCalledTimes(1);
    expect(bindSearchTokensSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
      [], // ✅ Expect fallback to empty array
      runnerMock,
    );
  });

  it('should call bindSearchTokens with [] in single-language path when tags are missing', async () => {
    // Enable fullTextSearchMode and disable multi-language mode
    (service as any).multipleLanguageMode = false;
    (service as any).fullTextSearchMode = true;

    // Setup mocks for repositories and query builder
    findMock.mockResolvedValue([]);
    findOneMock.mockResolvedValue({ id: 'a1', categories: [] });
    createQueryBuilderMock.getOne.mockResolvedValue({ version: 1 });

    // Prepare spy and .create overrides
    const createSpy = jest.fn((x) => x);
    (service as any).baseArticleRepo = {
      create: createSpy,
      findOne: findOneMock,
    };
    (service as any).baseArticleVersionRepo = {
      create: createSpy,
      createQueryBuilder: () => createQueryBuilderMock,
    };
    (service as any).baseArticleVersionContentRepo = {
      create: createSpy,
    };

    // Spy on bindSearchTokens
    const bindSearchTokensSpy = jest.fn();
    (service as any).bindSearchTokens = bindSearchTokensSpy;

    // Stub runner.manager.save to simulate single-language content save
    jest.spyOn(runnerMock.manager!, 'save').mockResolvedValue({
      articleId: 'a1',
      version: 2,
      language: 'en',
      title: 'Single-Language No Tags',
      description: 'Desc',
      content: [],
    });

    // No tags provided
    const options = {
      title: 'No Tags Title',
      description: 'No tags provided',
      content: [{ type: 'p', children: [{ text: 'Only Content' }] }],
      // 👇 tags omitted intentionally
    };

    // Act
    await service.addVersion('a1', options);

    // Assert: bindSearchTokens must be called with [] as fallback
    expect(bindSearchTokensSpy).toHaveBeenCalledTimes(1);
    expect(bindSearchTokensSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
      [], // ✅ fallback triggered
      runnerMock,
    );
  });
  //   findMock.mockResolvedValue([]); // valid categories
  //   findOneMock.mockResolvedValue({ id: 'a1', categories: [] }); // valid article
  //   createQueryBuilderMock.getOne.mockResolvedValue({ version: 1 }); // valid latest version

  //   (service as any).baseArticleRepo = {
  //     create: jest.fn((x) => x),
  //     findOne: findOneMock,
  //   };
  //   (service as any).baseArticleVersionRepo = {
  //     create: jest.fn((x) => x),
  //     createQueryBuilder: () => createQueryBuilderMock,
  //   };
  //   (service as any).baseArticleVersionContentRepo = {
  //     create: jest.fn((x) => x),
  //   };

  //   (service as any).multipleLanguageMode = false; // ✅ force the condition

  //   const options = {
  //     multiLanguageContents: {
  //       en: {
  //         title: 'English Title',
  //         description: 'English Desc',
  //         content: [],
  //       },
  //     },
  //     tags: ['test'],
  //   };

  //   // Act & Assert
  //   await expect(service.addVersion('a1', options)).rejects.toThrow(
  //     MultipleLanguageModeIsDisabledError,
  //   );
  // });

  it('should rollback transaction and throw BadRequestException if unexpected error occurs during version save', async () => {
    findMock.mockResolvedValue([]);
    findOneMock.mockResolvedValue({ id: 'a1', categories: [] });
    createQueryBuilderMock.getOne.mockResolvedValue({ version: 1 });

    const createSpy = jest.fn((x) => x);

    const error = new Error('Mock save failure');
    jest
      .spyOn(runnerMock.manager!, 'save')
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () => {
        throw error;
      });

    const rollbackSpy = jest.spyOn(runnerMock, 'rollbackTransaction');

    (service as any).baseArticleRepo = {
      create: createSpy,
      findOne: findOneMock,
    };
    (service as any).baseArticleVersionRepo = {
      create: createSpy,
      createQueryBuilder: () => createQueryBuilderMock,
    };
    (service as any).baseArticleVersionContentRepo = {
      create: createSpy,
    };

    const options = {
      title: 'Should Fail',
      description: 'Force error during save(version)',
      tags: ['err'],
      content: [{ type: 'p', children: [{ text: 'Boom' }] }],
    };

    // Assert
    await expect(service.addVersion('a1', options)).rejects.toThrow(
      BadRequestException,
    );

    // Verify rollback was called
    expect(rollbackSpy).toHaveBeenCalled();
  });

  it('should throw MultipleLanguageModeIsDisabledError if multiLanguageContents is used while disabled', async () => {
    // Arrange
    (service as any).multipleLanguageMode = false; // force path
    (service as any).fullTextSearchMode = true; // irrelevant but matches context

    findMock.mockResolvedValue([]); // valid categories
    findOneMock.mockResolvedValue({ id: 'a1', categories: [] }); // valid article
    createQueryBuilderMock.getOne.mockResolvedValue({ version: 1 }); // valid latest version

    (service as any).baseArticleRepo = {
      create: jest.fn((x) => x),
      findOne: findOneMock,
    };
    (service as any).baseArticleVersionRepo = {
      create: jest.fn((x) => x),
      createQueryBuilder: () => createQueryBuilderMock,
    };
    (service as any).baseArticleVersionContentRepo = {
      create: jest.fn((x) => x),
    };

    const options = {
      multiLanguageContents: {
        en: {
          title: 'English Title',
          description: 'English Desc',
          content: [],
        },
      },
      tags: ['test'],
    };

    // Act & Assert
    await expect(service.addVersion('a1', options)).rejects.toThrowError(
      expect.objectContaining({
        message: expect.stringContaining('Multiple language mode is disabled'),
      }),
    );
  });
});

describe('ArticleBaseService (create)', () => {
  let service: ArticleBaseService<any, any, any>;
  const findMock = jest.fn();
  const createSpy = jest.fn((x) => x);
  const runnerMock: Partial<QueryRunner> = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
    } as unknown as EntityManager,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        {
          provide: RESOLVED_ARTICLE_REPO,
          useValue: { create: createSpy },
        },
        {
          provide: RESOLVED_ARTICLE_VERSION_REPO,
          useValue: { create: createSpy },
        },
        {
          provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO,
          useValue: { create: createSpy },
        },
        {
          provide: RESOLVED_CATEGORY_REPO,
          useValue: { find: findMock },
        },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: false },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: true },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: () => runnerMock,
          },
        },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);
  });

  it('should set releasedAt to current date when draftMode is false and no releasedAt is provided', async () => {
    findMock.mockResolvedValue([]);

    const createSpy = jest.fn((x) => x);
    const savedEntities: any[] = [];

    jest
      .spyOn(runnerMock.manager!, 'save')
      .mockImplementation(async (entity) => {
        savedEntities.push(entity);
        return entity;
      });

    (service as any).baseArticleRepo = { create: createSpy };
    (service as any).baseArticleVersionRepo = { create: createSpy };
    (service as any).baseArticleVersionContentRepo = { create: createSpy };
    (service as any).draftMode = false;

    const options = {
      title: 'Draft off',
      description: 'Testing new Date fallback',
      tags: ['t'],
      content: [{ type: 'p', children: [{ text: 'test' }] }],
    };

    const before = Date.now();
    await service.create(options);
    const after = Date.now();

    // 🔍 Filter for the version entity (has articleId, tags, releasedAt)
    const savedVersion = savedEntities.find(
      (e) => 'releasedAt' in e && 'tags' in e && 'articleId' in e,
    );

    expect(savedVersion?.releasedAt).toBeDefined();
    expect(new Date(savedVersion.releasedAt).getTime()).toBeGreaterThanOrEqual(
      before,
    );
    expect(new Date(savedVersion.releasedAt).getTime()).toBeLessThanOrEqual(
      after,
    );
  });

  it('should bind search tokens for multi-language contents when fullTextSearchMode is true', async () => {
    // Arrange
    findMock.mockResolvedValue([]);

    const createSpy = jest.fn((x) => x);
    const bindSearchTokensSpy = jest.fn();

    (service as any).baseArticleRepo = { create: createSpy };
    (service as any).baseArticleVersionRepo = { create: createSpy };
    (service as any).baseArticleVersionContentRepo = { create: createSpy };

    (service as any).multipleLanguageMode = true;
    (service as any).fullTextSearchMode = true;
    (service as any).bindSearchTokens = bindSearchTokensSpy;

    jest.spyOn(runnerMock.manager!, 'save').mockResolvedValue([
      {
        articleId: 'a1',
        version: 1,
        language: 'en',
        title: 'EN',
        description: 'Desc',
        content: [],
      },
      {
        articleId: 'a1',
        version: 1,
        language: 'zh',
        title: 'ZH',
        description: '說明',
        content: [],
      },
    ]);

    const options = {
      multiLanguageContents: {
        en: { title: 'EN', description: 'Desc', content: [] },
        zh: { title: 'ZH', description: '說明', content: [] },
      },
      tags: ['search'],
    };

    // Act
    await service.create(options);

    // Assert
    expect(bindSearchTokensSpy).toHaveBeenCalledTimes(2);
    expect(bindSearchTokensSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
      ['search'],
      runnerMock,
    );
    expect(bindSearchTokensSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'zh' }),
      ['search'],
      runnerMock,
    );
  });

  it('should bind search tokens for each multi-language content with fallback [] when tags are undefined', async () => {
    // Arrange
    findMock.mockResolvedValue([]);

    const createSpy = jest.fn((x) => x);
    const bindSearchTokensSpy = jest.fn();

    (service as any).baseArticleRepo = { create: createSpy };
    (service as any).baseArticleVersionRepo = { create: createSpy };
    (service as any).baseArticleVersionContentRepo = { create: createSpy };

    (service as any).multipleLanguageMode = true;
    (service as any).fullTextSearchMode = true;
    (service as any).bindSearchTokens = bindSearchTokensSpy;

    // ✅ Simulate saving multi-language contents returning an array
    jest.spyOn(runnerMock.manager!, 'save').mockResolvedValue([
      {
        articleId: 'a1',
        version: 1,
        language: 'en',
        title: 'EN',
        description: 'Desc',
        content: [],
      },
      {
        articleId: 'a1',
        version: 1,
        language: 'zh',
        title: 'ZH',
        description: '說明',
        content: [],
      },
    ]);

    const options = {
      multiLanguageContents: {
        en: { title: 'EN', description: 'Desc', content: [] },
        zh: { title: 'ZH', description: '說明', content: [] },
      },
      // 👇 tags intentionally omitted
    };

    // Act
    await service.create(options);

    // Assert
    expect(bindSearchTokensSpy).toHaveBeenCalledTimes(2);
    expect(bindSearchTokensSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'en' }),
      [], // ✅ fallback
      runnerMock,
    );
    expect(bindSearchTokensSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: 'zh' }),
      [], // ✅ fallback
      runnerMock,
    );
  });

  it('should bind search tokens for single-language content when fullTextSearchMode is true', async () => {
    // Arrange
    findMock.mockResolvedValue([]); // No category filtering errors

    const createSpy = jest.fn((x) => x);
    const bindSearchTokensSpy = jest.fn();

    (service as any).baseArticleRepo = { create: createSpy };
    (service as any).baseArticleVersionRepo = { create: createSpy };
    (service as any).baseArticleVersionContentRepo = { create: createSpy };

    (service as any).multipleLanguageMode = false;
    (service as any).fullTextSearchMode = true;
    (service as any).bindSearchTokens = bindSearchTokensSpy;

    jest
      .spyOn(runnerMock.manager!, 'save')
      .mockImplementation(async (entity) => entity);

    const options = {
      title: 'Single Lang',
      description: 'Basic',
      content: [{ type: 'p', children: [{ text: 'Hello' }] }],
    };

    // Act
    await service.create(options);

    // Assert
    expect(bindSearchTokensSpy).toHaveBeenCalledTimes(1);
    expect(bindSearchTokensSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: DEFAULT_LANGUAGE }),
      [],
      runnerMock,
    );
  });

  it('should rollback transaction and throw BadRequestException if save fails', async () => {
    // Arrange
    findMock.mockResolvedValue([]);

    const createSpy = jest.fn((x) => x);
    (service as any).baseArticleRepo = { create: createSpy };
    (service as any).baseArticleVersionRepo = { create: createSpy };
    (service as any).baseArticleVersionContentRepo = { create: createSpy };

    const rollbackSpy = jest.spyOn(runnerMock, 'rollbackTransaction');
    const releaseSpy = jest.spyOn(runnerMock, 'release');

    const saveMock = jest.spyOn(runnerMock.manager!, 'save');
    saveMock
      .mockImplementationOnce(async () => ({ id: 'a1' })) // First save: article
      .mockImplementationOnce(() => {
        throw new Error('Version save failed'); // Second save: version (simulate failure)
      });

    const options = {
      title: 'Trigger Error',
      description: 'Catch block coverage',
      content: [{ type: 'p', children: [{ text: 'Oops' }] }],
    };

    // Act + Assert
    await expect(service.create(options)).rejects.toThrow(BadRequestException);

    // Assert rollback and release were called
    expect(rollbackSpy).toHaveBeenCalledTimes(1);
    expect(releaseSpy).toHaveBeenCalledTimes(1);

    // Ensure commit was not called
    expect(runnerMock.commitTransaction).not.toHaveBeenCalled();

    // Ensure only two saves were attempted before failure
    expect(saveMock).toHaveBeenCalledTimes(2);
  });

  it('should wrap MultipleLanguageModeIsDisabledError in BadRequestException', async () => {
    const options = {
      multiLanguageContents: {
        en: {
          title: 'EN Title',
          description: 'EN Desc',
          content: [],
        },
      },
      tags: ['test'],
    };

    await expect(service.create(options)).rejects.toThrow(BadRequestException);
    await expect(service.create(options)).rejects.toThrow(
      'Multiple language mode is disabled',
    );
  });
});
