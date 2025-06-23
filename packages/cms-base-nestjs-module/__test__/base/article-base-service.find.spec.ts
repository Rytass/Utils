import { DEFAULT_LANGUAGE } from '../../src/constants/default-language';
import { ArticleNotFoundError } from '../../src/constants/errors/article.errors';
import { MultipleLanguageModeIsDisabledError } from '../../src/constants/errors/base.errors';
import { ArticleBaseService } from '../../src/services/article-base.service';

jest.mock('../../src/utils/remove-invalid-fields', () => ({
  removeArticleInvalidFields: jest.fn((x) => x),
  removeArticleVersionInvalidFields: jest.fn((x) => x),
  removeArticleVersionContentInvalidFields: jest.fn((x) => x),
  removeMultipleLanguageArticleVersionInvalidFields: jest.fn((x) => x),
}));

describe('findById', () => {
  let service: ArticleBaseService;

  const mockQb = {
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    removeArticleInvalidFields: jest.fn((x) => x),
    removeArticleVersionInvalidFields: jest.fn((x) => x),
    removeArticleVersionContentInvalidFields: jest.fn((x) => x),
    removeMultipleLanguageArticleVersionInvalidFields: jest.fn((x) => x),
  };

  beforeEach(() => {
    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      false, // fullTextSearchMode
      true, // multilingualMode
      true, // versionMode
      [],
      {} as any,
      {} as any,
      true,
      {} as any,
    );

    (service as any).getDefaultQueryBuilder = jest.fn(() => mockQb);
  });

  it('should throw error if language option is used while multilingualMode is false', async () => {
    (service as any).multipleLanguageMode = false;

    await expect(service.findById('123', { language: 'en' })).rejects.toThrow(
      MultipleLanguageModeIsDisabledError,
    );
  });

  it('should throw error if no article is found', async () => {
    mockQb.getOne.mockResolvedValue(null);

    await expect(service.findById('not-found-id')).rejects.toThrow(
      ArticleNotFoundError,
    );
  });

  it('should return SingleArticleBaseDto when language is specified', async () => {
    (service as any).multipleLanguageMode = true; // <-- ADD THIS

    const mockArticle = {
      id: '1',
      versions: [
        {
          version: 1,
          multiLanguageContents: [
            {
              language: 'en',
              title: 'Title',
              content: [],
            },
          ],
        },
      ],
    };

    mockQb.getOne.mockResolvedValue(mockArticle);

    const result = await service.findById('1', { language: 'en' });

    expect(result).toMatchObject({
      title: 'Title',
      version: 1,
    });
  });

  it('should return SingleArticleBaseDto when multilingualMode is false', async () => {
    (service as any).multipleLanguageMode = false;

    const mockArticle = {
      id: '1',
      versions: [
        {
          version: 1,
          multiLanguageContents: [
            {
              language: DEFAULT_LANGUAGE,
              title: 'NoLangOption',
              content: [],
            },
          ],
        },
      ],
    };

    mockQb.getOne.mockResolvedValue(mockArticle);

    const result = await service.findById('1');

    expect(result).toMatchObject({
      title: 'NoLangOption',
      version: 1,
    });
  });

  it('should return MultiLanguageArticleBaseDto when no language and multilingualMode is true', async () => {
    const mockArticle = {
      id: '1',
      versions: [
        {
          version: 1,
          multiLanguageContents: [
            {
              language: DEFAULT_LANGUAGE,
              title: 'Multilingual Title',
              content: [],
            },
          ],
        },
      ],
    };

    mockQb.getOne.mockResolvedValue(mockArticle);

    const result = await service.findById('1');

    expect(result).toMatchObject({
      version: 1,
      id: '1',
    });
  });

  it('should return MultiLanguageArticleBaseDto when no language provided and multilingualMode is true', async () => {
    (service as any).multipleLanguageMode = true;

    const mockArticle = {
      id: '1',
      title: 'ML Article',
      versions: [
        {
          version: 1,
          multiLanguageContents: [
            {
              language: 'en',
              title: 'ML Title',
              content: [],
            },
          ],
        },
      ],
    };

    mockQb.getOne.mockResolvedValue(mockArticle);

    const result = await service.findById('1');

    expect(result).toMatchObject({
      id: '1',
      version: 1,
    });
  });
});

describe('findCollection', () => {
  let service: ArticleBaseService;
  let mockQb: any;

  beforeEach(() => {
    mockQb = {
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    service = new ArticleBaseService(
      {} as any, // repo
      {} as any, // repo
      {} as any,
      {} as any,
      true, // fullText
      true, // version
      true, // multiLang
      [],
      {} as any,
      {} as any,
      true,
      {} as any,
    );

    (service as any).getFindAllQueryBuilder = jest.fn(() => mockQb);
  });

  it('should throw if language is provided but multipleLanguageMode is off', async () => {
    (service as any).multipleLanguageMode = false;

    await expect(
      service.findCollection({ language: DEFAULT_LANGUAGE } as any),
    ).rejects.toThrow(MultipleLanguageModeIsDisabledError);
  });

  it('should call skip and take with defaults when no offset/limit given', async () => {
    mockQb.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findCollection();

    expect(mockQb.skip).toHaveBeenCalledWith(0);
    expect(mockQb.take).toHaveBeenCalledWith(20);
  });

  it('should cap limit to 100 when a large limit is passed', async () => {
    mockQb.getManyAndCount.mockResolvedValue([[], 0]);

    await service.findCollection({ limit: 999 } as any);

    expect(mockQb.take).toHaveBeenCalledWith(100);
  });

  it('should return SingleArticleCollectionDto when language is given', async () => {
    mockQb.getManyAndCount.mockResolvedValue([
      [
        {
          versions: [
            {
              multiLanguageContents: [
                { language: 'en', title: 'English Title', content: 'Hello' },
              ],
            },
          ],
        },
      ],
      1,
    ]);

    const result = await service.findCollection({
      language: 'en',
    } as any);

    expect(result.total).toBe(1);
    expect(result.articles[0].title).toBe('English Title');
  });

  it('should return SingleArticleCollectionDto when multiLang mode is off', async () => {
    (service as any).multipleLanguageMode = false;

    mockQb.getManyAndCount.mockResolvedValue([
      [
        {
          versions: [
            {
              multiLanguageContents: [
                {
                  language: DEFAULT_LANGUAGE,
                  title: 'English Title',
                  content: 'Hello',
                },
              ],
            },
          ],
        },
      ],
      1,
    ]);

    const result = await service.findCollection({} as any);

    expect(result.articles[0].title).toBe('English Title');
  });

  it('should return MultiLanguageArticleBaseDto when no language is passed and multiLang mode is on', async () => {
    (service as any).multipleLanguageMode = true;

    mockQb.getManyAndCount.mockResolvedValue([
      [
        {
          versions: [{}],
        },
      ],
      1,
    ]);

    const result = await service.findCollection({} as any);

    expect(result.articles.length).toBe(1);
  });
});

describe('ArticleBaseService - findAll', () => {
  let service: ArticleBaseService;
  let mockQb: any;

  beforeEach(() => {
    mockQb = {
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      true,
      true,
      true,
      [],
      {} as any,
      {} as any,
      true,
      {} as any,
    );

    (service as any).getFindAllQueryBuilder = jest.fn(() => mockQb);
  });

  it('should throw if language is provided but multipleLanguageMode is off', async () => {
    (service as any).multipleLanguageMode = false;

    await expect(
      service.findAll({ language: DEFAULT_LANGUAGE } as any),
    ).rejects.toThrow(MultipleLanguageModeIsDisabledError);
  });

  it('should return single-language base articles if language is provided', async () => {
    (service as any).multipleLanguageMode = true;

    const mockArticles = [
      {
        id: 'article1',
        title: 'test',
        versions: [
          {
            id: 'v1',
            multiLanguageContents: [
              { language: DEFAULT_LANGUAGE, content: 'localized' },
            ],
          },
        ],
      },
    ];

    mockQb.getMany.mockResolvedValue(mockArticles);

    const result = await service.findAll({ language: DEFAULT_LANGUAGE } as any);

    expect(result).toEqual([
      {
        id: 'article1',
        title: 'test',
        content: 'localized',
        language: DEFAULT_LANGUAGE,
        multiLanguageContents: [
          {
            language: DEFAULT_LANGUAGE,
            content: 'localized',
          },
        ],
        versions: [
          {
            id: 'v1',
            multiLanguageContents: [
              {
                language: DEFAULT_LANGUAGE,
                content: 'localized',
              },
            ],
          },
        ],
      },
    ]);
  });

  it('should return single-language base articles if multipleLanguageMode is off', async () => {
    (service as any).multipleLanguageMode = false;

    const mockArticles = [
      {
        id: 'article2',
        title: 'off-mode',
        versions: [
          {
            id: 'v2',
            multiLanguageContents: [
              { language: DEFAULT_LANGUAGE, content: 'forced' },
            ],
          },
        ],
      },
    ];

    mockQb.getMany.mockResolvedValue(mockArticles);

    const result = await service.findAll();

    expect(result[0].id).toBe('article2');
    expect(result[0].title).toBe('off-mode');
    expect(result[0].content).toBe('forced');
  });

  it('should return multi-language base articles when no language and multipleLanguageMode is enabled', async () => {
    (service as any).multipleLanguageMode = true;

    const mockArticles = [
      {
        id: 'article3',
        title: 'ml',
        versions: [
          {
            id: 'v3',
          },
        ],
      },
    ];

    mockQb.getMany.mockResolvedValue(mockArticles);

    const result = await service.findAll();

    expect(result[0].id).toBe('article3');
    expect(result[0].title).toBe('ml');
  });

  it('should apply skip and take based on options', async () => {
    (service as any).multipleLanguageMode = true;

    mockQb.getMany.mockResolvedValue([
      {
        id: 'dummy',
        title: 'test',
        versions: [
          {
            id: 'ver1',
          },
        ],
      },
    ]);

    const result = await service.findAll({ offset: 10, limit: 50 });

    expect(mockQb.skip).toHaveBeenCalledWith(10);
    expect(mockQb.take).toHaveBeenCalledWith(50);
  });
});
