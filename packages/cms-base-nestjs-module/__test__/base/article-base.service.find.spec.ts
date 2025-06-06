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
import { MultipleLanguageModeIsDisabledError } from '../../src/constants/errors/base.errors';
import { ArticleSorter } from '../../src/typings/article-sorter.enum';
import { ArticleSearchMode } from '../../src/typings/article-search-mode.enum';
import { DEFAULT_LANGUAGE } from '../../src/constants/default-language';

describe('ArticleBaseService (findById)', () => {
  let service: ArticleBaseService<any, any, any>;
  const getOneMock = jest.fn();

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    getOne: getOneMock,
  };

  const mockRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(async () => {
    getOneMock.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: mockRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: false },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: false },
        { provide: DataSource, useValue: {} },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);
    getOneMock.mockReset();
  });

  it('should return multi-language response when language is not provided', async () => {
    getOneMock.mockResolvedValue({
      id: 'article-id',
      versions: [
        {
          tags: ['tag1'],
          multiLanguageContents: [
            {
              language: 'en',
              title: 'English Title',
              description: 'English Desc',
            },
            { language: 'zh', title: '中文標題', description: '中文描述' },
          ],
        },
      ],
    });

    const result = await service.findById('article-id');

    expect(result).toEqual({
      id: 'article-id',
      tags: ['tag1'],
      multiLanguageContents: [
        { language: 'en', title: 'English Title', description: 'English Desc' },
        { language: 'zh', title: '中文標題', description: '中文描述' },
      ],
    });

    expect(getOneMock).toHaveBeenCalled();
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'articles.id = :id',
      { id: 'article-id' },
    );
  });

  it('should return single-language response when language is provided', async () => {
    getOneMock.mockResolvedValue({
      id: 'article-id',
      versions: [
        {
          version: 2,
          tags: ['tagX'],
          multiLanguageContents: [
            {
              language: 'zh',
              title: '中文標題',
              description: '中文描述',
            },
            {
              language: 'en',
              title: 'English Title',
              description: 'English Desc',
            },
          ],
        },
      ],
    });

    const result = await service.findById('article-id', { language: 'zh' });

    expect(result).toEqual({
      id: 'article-id',
      version: 2,
      tags: ['tagX'],
      language: 'zh',
      title: '中文標題',
      description: '中文描述',
    });

    expect(getOneMock).toHaveBeenCalled();
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'articles.id = :id',
      { id: 'article-id' },
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'multiLanguageContents.language = :language',
      { language: 'zh' },
    );
  });

  it('should throw ArticleNotFoundError when article is not found', async () => {
    getOneMock.mockResolvedValue(undefined);

    await expect(service.findById('nonexistent-id')).rejects.toThrow(
      ArticleNotFoundError,
    );

    expect(getOneMock).toHaveBeenCalled();
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'articles.id = :id',
      { id: 'nonexistent-id' },
    );
  });

  it('should throw MultipleLanguageModeIsDisabledError when language is provided and mode is disabled', async () => {
    (service as any).multipleLanguageMode = false;

    await expect(
      service.findById('some-id', { language: 'en' }),
    ).rejects.toThrow(MultipleLanguageModeIsDisabledError);
  });

  it('should fallback to RELEASED when draftMode is true and versionType is undefined', async () => {
    (service as any).draftMode = true;

    getOneMock.mockResolvedValue({
      id: 'article-id',
      versions: [
        {
          tags: ['tag1'],
          multiLanguageContents: [
            { language: 'en', title: 'Test Title', description: 'Test Desc' },
          ],
          version: 1,
        },
      ],
    });

    const result = await service.findById('article-id', {});

    expect(result).toEqual({
      id: 'article-id',
      tags: ['tag1'],
      version: 1,
      multiLanguageContents: [
        { language: 'en', title: 'Test Title', description: 'Test Desc' },
      ],
    });

    expect(getOneMock).toHaveBeenCalled();
  });

  it('should fallback to DEFAULT_LANGUAGE when language is not provided and multi-language mode is off', async () => {
    (service as any).multipleLanguageMode = false;

    getOneMock.mockResolvedValue({
      id: 'article-id',
      versions: [
        {
          version: 1,
          tags: ['tagX'],
          multiLanguageContents: [
            {
              language: DEFAULT_LANGUAGE,
              title: 'Default EN Title',
              description: 'Default EN Desc',
            },
          ],
        },
      ],
    });

    const result = await service.findById('article-id');

    expect(result).toEqual({
      id: 'article-id',
      version: 1,
      tags: ['tagX'],
      language: DEFAULT_LANGUAGE,
      title: 'Default EN Title',
      description: 'Default EN Desc',
      versions: undefined, //
    });

    expect(getOneMock).toHaveBeenCalled();
  });
});

describe('ArticleBaseService (getFindAllQueryBuilder)', () => {
  const getManyMock = jest.fn();
  const getManyAndCountMock = jest.fn();

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    andWhereExists: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    getMany: getManyMock,
    getManyAndCount: getManyAndCountMock,
  };

  let service: ArticleBaseService<any, any, any>;

  beforeEach(async () => {
    const mockArticleRepo = {
      metadata: {
        schema: 'public',
        tablePath: 'public.categories',
        manyToManyRelations: [
          {
            propertyPath: 'categories',
            junctionEntityMetadata: { tableName: 'article_categories' },
          },
        ],
      },
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const mockCategoryRepo = {
      metadata: {
        tablePath: 'public.categories',
      },
    };

    const mockArticleVersionContentRepo = {
      metadata: {
        schema: 'public',
        tableName: 'article_version_contents',
        targetName: 'ArticleVersionContent',
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: mockArticleRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: mockCategoryRepo },
        {
          provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO,
          useValue: mockArticleVersionContentRepo,
        },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: true },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: false },
        {
          provide: DataSource,
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);
  });

  it('should apply language, category, and sorting filters correctly', async () => {
    await service['getFindAllQueryBuilder']({
      language: 'en',
      categoryIds: ['cat1'],
      requiredCategoryIds: ['cat2'],
      ids: ['id1'],
      searchTerm: 'climate',
      sorter: ArticleSorter.CREATED_AT_DESC,
    });

    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'articles.id IN (:...ids)',
      { ids: ['id1'] },
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      'multiLanguageContents.language = :language',
      { language: 'en' },
    );
    expect(mockQueryBuilder.andWhereExists).toHaveBeenCalled();
    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      'articles.createdAt',
      'DESC',
    );
  });

  it('should return single-language mapped results in findAll', async () => {
    getManyMock.mockResolvedValue([
      {
        id: 'a1',
        versions: [
          {
            tags: ['t1'],
            multiLanguageContents: [
              { language: 'en', title: 'EN Title', description: 'EN Desc' },
              { language: 'zh', title: 'ZH 標題', description: 'ZH 描述' },
            ],
          },
        ],
      },
    ]);

    const result = await service.findAll({ language: 'en' });

    expect(result).toEqual([
      {
        id: 'a1',
        language: 'en',
        title: 'EN Title',
        description: 'EN Desc',
        tags: ['t1'],
      },
    ]);
    expect(getManyMock).toHaveBeenCalled();
  });

  it('should fallback to RELEASED versionType if draftMode=true and options.versionType is undefined', async () => {
    (service as any).draftMode = true;

    await service['getFindAllQueryBuilder']({});

    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      'articles.createdAt',
      'DESC',
    );
  });

  it('should apply FULL_TEXT search when searchTerm is provided and searchMode is FULL_TEXT', async () => {
    (service as any).fullTextSearchMode = true;

    jest.mock('@node-rs/jieba', () => ({
      cut: jest.fn(() => ['mocked', 'tokens']),
    }));

    const { cut } = await import('@node-rs/jieba');
    (cut as jest.Mock).mockReturnValue(['climate', 'change']);

    await service['getFindAllQueryBuilder']({
      searchTerm: 'climate change',
      searchMode: ArticleSearchMode.FULL_TEXT,
    });

    expect(mockQueryBuilder.andWhereExists).toHaveBeenCalled();
  });

  it('should throw if FULL_TEXT search is requested but fullTextSearchMode is disabled', async () => {
    (service as any).fullTextSearchMode = false;

    await expect(
      service['getFindAllQueryBuilder']({
        searchTerm: 'climate change',
        searchMode: ArticleSearchMode.FULL_TEXT,
      }),
    ).rejects.toThrow('Full text search is disabled.');
  });

  it('should apply TITLE_AND_TAG search when searchMode is TITLE_AND_TAG', async () => {
    await service['getFindAllQueryBuilder']({
      searchTerm: 'climate',
      searchMode: ArticleSearchMode.TITLE_AND_TAG,
    });

    expect(mockQueryBuilder.andWhereExists).toHaveBeenCalled();
    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      ':tagSearchTerm = ANY (SELECT LOWER(value) FROM jsonb_array_elements_text(versions.tags))',
      { tagSearchTerm: 'climate' },
    );
    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'contents.title ILIKE :searchTerm',
      { searchTerm: '%climate%' },
    );
    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'contents.description ILIKE :searchTerm',
      { searchTerm: '%climate%' },
    );
  });

  it('should apply ASC sorting when sorter is CREATED_AT_ASC', async () => {
    await service['getFindAllQueryBuilder']({
      sorter: ArticleSorter.CREATED_AT_ASC,
    });

    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
      'articles.createdAt',
      'ASC',
    );
  });
});

describe('ArticleBaseService (findCollection)', () => {
  let service: ArticleBaseService<any, any, any>;
  const getManyAndCountMock = jest.fn();

  const mockQueryBuilder = {
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: getManyAndCountMock,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: true },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: false },
        {
          provide: DataSource,
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);
  });

  it('should return single-language collection when language is provided', async () => {
    getManyAndCountMock.mockResolvedValue([
      [
        {
          id: 'a1',
          versions: [
            {
              tags: ['t1'],
              multiLanguageContents: [
                { language: 'en', title: 'EN Title', description: 'EN Desc' },
                { language: 'zh', title: 'ZH Title', description: 'ZH Desc' },
              ],
            },
          ],
        },
      ],
      1,
    ]);

    (service as any).getFindAllQueryBuilder = jest
      .fn()
      .mockResolvedValue(mockQueryBuilder);

    const result = await service.findCollection({
      language: 'en',
      offset: 0,
      limit: 10,
    });

    expect(result).toEqual({
      articles: [
        {
          id: 'a1',
          language: 'en',
          title: 'EN Title',
          description: 'EN Desc',
          tags: ['t1'],
        },
      ],
      total: 1,
      offset: 0,
      limit: 10,
    });
  });

  it('should return multi-language collection when language is not provided', async () => {
    getManyAndCountMock.mockResolvedValue([
      [
        {
          id: 'a1',
          versions: [
            {
              tags: ['t1'],
              version: 1,
              multiLanguageContents: [
                { language: 'en', title: 'EN Title', description: 'EN Desc' },
                { language: 'zh', title: 'ZH Title', description: 'ZH Desc' },
              ],
            },
          ],
        },
      ],
      1,
    ]);

    (service as any).getFindAllQueryBuilder = jest
      .fn()
      .mockResolvedValue(mockQueryBuilder);

    const result = await service.findCollection({});

    expect(result).toEqual({
      articles: [
        {
          id: 'a1',
          version: 1,
          tags: ['t1'],
          multiLanguageContents: [
            { language: 'en', title: 'EN Title', description: 'EN Desc' },
            { language: 'zh', title: 'ZH Title', description: 'ZH Desc' },
          ],
        },
      ],
      total: 1,
      offset: 0,
      limit: 20,
    });
  });

  it('should throw MultipleLanguageModeIsDisabledError if language is provided and multi-language mode is disabled', async () => {
    (service as any).multipleLanguageMode = false;

    await expect(service.findCollection({ language: 'en' })).rejects.toThrow(
      MultipleLanguageModeIsDisabledError,
    );
  });

  it('should fallback to DEFAULT_LANGUAGE when language is not provided and multi-language mode is disabled', async () => {
    (service as any).multipleLanguageMode = false;

    getManyAndCountMock.mockResolvedValue([
      [
        {
          id: 'article-id',
          versions: [
            {
              tags: ['tagX'],
              multiLanguageContents: [
                {
                  language: DEFAULT_LANGUAGE,
                  title: 'Default Title',
                  description: 'Default Desc',
                },
              ],
            },
          ],
        },
      ],
      1,
    ]);

    (service as any).getFindAllQueryBuilder = jest
      .fn()
      .mockResolvedValue(mockQueryBuilder);

    const result = await service.findCollection();

    expect(result).toEqual({
      articles: [
        {
          id: 'article-id',
          tags: ['tagX'],
          versions: undefined,
          language: DEFAULT_LANGUAGE,
          title: 'Default Title',
          description: 'Default Desc',
          version: undefined,
        },
      ],
      total: 1,
      offset: 0,
      limit: 20,
    });
  });
});

describe('ArticleBaseService (findAll)', () => {
  let service: ArticleBaseService<any, any, any>;
  const getManyMock = jest.fn();

  const mockQueryBuilder = {
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: getManyMock,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: true },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: true },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: false },
        {
          provide: DataSource,
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
          },
        },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    (service as any).getFindAllQueryBuilder = jest
      .fn()
      .mockResolvedValue(mockQueryBuilder);
  });

  it('should return single-language mapped results', async () => {
    getManyMock.mockResolvedValue([
      {
        id: 'a1',
        versions: [
          {
            tags: ['t1'],
            version: 1,
            multiLanguageContents: [
              { language: 'en', title: 'EN Title', description: 'EN Desc' },
              { language: 'zh', title: 'ZH Title', description: 'ZH Desc' },
            ],
          },
        ],
      },
    ]);

    const result = await service.findAll({ language: 'en' });

    expect(result).toEqual([
      {
        id: 'a1',
        language: 'en',
        title: 'EN Title',
        description: 'EN Desc',
        tags: ['t1'],
      },
    ]);
  });

  it('should return multi-language results when no language provided', async () => {
    getManyMock.mockResolvedValue([
      {
        id: 'a1',
        versions: [
          {
            tags: ['t1'],
            version: 1,
            multiLanguageContents: [
              { language: 'en', title: 'EN Title', description: 'EN Desc' },
              { language: 'zh', title: 'ZH Title', description: 'ZH Desc' },
            ],
          },
        ],
      },
    ]);

    const result = await service.findAll();

    expect(result).toEqual([
      {
        id: 'a1',
        version: 1,
        tags: ['t1'],
        multiLanguageContents: [
          { language: 'en', title: 'EN Title', description: 'EN Desc' },
          { language: 'zh', title: 'ZH Title', description: 'ZH Desc' },
        ],
      },
    ]);
  });

  it('should throw MultipleLanguageModeIsDisabledError if language is provided but mode is off', async () => {
    (service as any).multipleLanguageMode = false;

    await expect(service.findAll({ language: 'en' })).rejects.toThrow(
      MultipleLanguageModeIsDisabledError,
    );
  });

  it('should fallback to DEFAULT_LANGUAGE when language is not provided and multi-language mode is off', async () => {
    (service as any).multipleLanguageMode = false;

    getManyMock.mockResolvedValue([
      {
        id: 'a1',
        versions: [
          {
            version: 2,
            tags: ['t1'],
            multiLanguageContents: [
              {
                language: DEFAULT_LANGUAGE,
                title: 'Default Title',
                description: 'Default Desc',
              },
            ],
          },
        ],
      },
    ]);

    const result = await service.findAll(); // <-- language omitted

    expect(result).toEqual([
      {
        id: 'a1',
        tags: ['t1'],
        language: DEFAULT_LANGUAGE,
        title: 'Default Title',
        description: 'Default Desc',
        versions: undefined,
      },
    ]);
  });
});
