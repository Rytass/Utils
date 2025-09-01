import { ArticleStage } from '../../src/typings/article-stage.enum';
import { DEFAULT_LANGUAGE } from '../../src/constants/default-language';
import { ArticleNotFoundError } from '../../src/constants/errors/article.errors';
import { MultipleLanguageModeIsDisabledError } from '../../src/constants/errors/base.errors';
import { ArticleBaseService } from '../../src/services/article-base.service';

describe('ArticleBaseService - findById', () => {
  let service: ArticleBaseService;
  let mockQueryBuilder: any;
  const mockStageCacheSet = jest.fn();

  beforeEach(() => {
    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
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
      {} as any,
      {} as any, // placeholder
    );

    Object.defineProperty(service, 'articleDataLoader', {
      value: {
        stageCache: {
          set: mockStageCacheSet,
        },
      },
    });

    jest
      .spyOn(service as any, 'getDefaultQueryBuilder')
      .mockReturnValue(mockQueryBuilder);
  });

  it('should throw if language is provided but multipleLanguageMode is false', async () => {
    service = Object.assign(service, { multipleLanguageMode: false });

    await expect(
      service.findById('article-1', { language: 'en' }),
    ).rejects.toThrow(MultipleLanguageModeIsDisabledError);
  });

  it('should throw ArticleNotFoundError if article is not found', async () => {
    mockQueryBuilder.getOne.mockResolvedValue(null);

    await expect(service.findById('not-found-id')).rejects.toThrow(
      ArticleNotFoundError,
    );
  });

  it('should return SingleArticleBaseDto when language is provided', async () => {
    const mockArticle = {
      id: 'a1',
      createdAt: new Date('2023-01-01'),
      deletedAt: null,
      versions: [
        {
          createdAt: new Date('2023-01-02'),
          createdBy: 'user-1',
          multiLanguageContents: [
            {
              language: 'en',
              title: 'Test Title',
              description: 'Desc',
              content: [],
            },
          ],
        },
      ],
    };

    mockQueryBuilder.getOne.mockResolvedValue(mockArticle);

    const result = await service.findById('a1', { language: 'en' });

    expect(result).toMatchObject({
      title: 'Test Title',
      id: 'a1',
      updatedBy: 'user-1',
    });
  });

  it('should return MultiLanguageArticleBaseDto when no language provided and multipleLanguageMode is true', async () => {
    const mockArticle = {
      id: 'a2',
      createdAt: new Date('2023-01-01'),
      deletedAt: null,
      versions: [
        {
          createdAt: new Date('2023-01-02'),
          createdBy: 'user-2',
          multiLanguageContents: [
            { language: 'en', content: [] },
            { language: 'zh', content: [] },
          ],
        },
      ],
    };

    mockQueryBuilder.getOne.mockResolvedValue(mockArticle);

    const result = await service.findById('a2');

    expect(result.id).toBe('a2');
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedBy).toBe('user-2');
    expect((result as any).multiLanguageContents).toHaveLength(2);
  });

  it('should set stage cache if stage is provided', async () => {
    const mockArticle = {
      id: 'a3',
      createdAt: new Date(),
      deletedAt: null,
      versions: [
        {
          version: 1,
          createdAt: new Date(),
          createdBy: 'user-3',
          multiLanguageContents: [{ language: DEFAULT_LANGUAGE }],
        },
      ],
    };

    mockQueryBuilder.getOne.mockResolvedValue(mockArticle);

    await service.findById('a3', { stage: ArticleStage.REVIEWING });

    expect(mockStageCacheSet).toHaveBeenCalledWith('a3:1', expect.any(Promise));
  });

  it('should use DEFAULT_LANGUAGE when multipleLanguageMode is false', async () => {
    service = Object.assign(service, { multipleLanguageMode: false });

    const mockArticle = {
      id: 'a5',
      createdAt: new Date(),
      deletedAt: null,
      versions: [
        {
          createdAt: new Date(),
          createdBy: 'user-5',
          multiLanguageContents: [
            { language: DEFAULT_LANGUAGE, title: 'Default Language Title' },
          ],
        },
      ],
    };

    mockQueryBuilder.getOne.mockResolvedValue(mockArticle);

    const result = await service.findById('a5');

    expect(result).toMatchObject({
      title: 'Default Language Title',
      id: 'a5',
      updatedBy: 'user-5',
    });
  });
});

describe('ArticleBaseService - findCollection', () => {
  let service: ArticleBaseService;
  let getFindAllQueryBuilderMock: jest.SpyInstance;

  beforeEach(() => {
    service = new ArticleBaseService(
      { metadata: { schema: 'public', manyToManyRelations: [] } } as any,
      {} as any,
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as any,
      { metadata: { tablePath: 'public.categories' } } as any,
      true, // multipleLanguageMode
      true,
      true,
      [],
      {} as any,
      {} as any,
      true, // fullTextSearchMode
      { createQueryBuilder: jest.fn() } as any,
      { stageCache: { set: jest.fn() } } as any,
      {} as any,
    );

    getFindAllQueryBuilderMock = jest.spyOn(
      service as any,
      'getFindAllQueryBuilder',
    );
  });

  it('should throw if language is provided but multipleLanguageMode is false', async () => {
    (service as any).multipleLanguageMode = false;

    await expect(
      service.findCollection({ language: DEFAULT_LANGUAGE } as any),
    ).rejects.toThrow(MultipleLanguageModeIsDisabledError);
  });

  it('should return SingleArticleCollectionDto when language is provided', async () => {
    getFindAllQueryBuilderMock.mockResolvedValue({
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'a1',
            createdAt: new Date('2023-01-01'),
            deletedAt: null,
            versions: [
              {
                version: 1,
                createdAt: new Date('2023-01-02'),
                createdBy: 'user1',
                multiLanguageContents: [
                  { language: 'en', title: 'Hello', body: 'World' },
                ],
              },
            ],
          },
        ],
        1,
      ]),
    });

    const result = await service.findCollection({ language: 'en' } as any);

    expect(result.total).toBe(1);
    expect(result.articles[0].title).toBe('Hello');
  });

  it('should return MultiLanguageArticleBaseDto when language is not provided', async () => {
    (service as any).multipleLanguageMode = true;

    getFindAllQueryBuilderMock.mockResolvedValue({
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'a1',
            createdAt: new Date('2023-01-01'),
            deletedAt: null,
            versions: [
              {
                version: 1,
                createdAt: new Date('2023-01-02'),
                createdBy: 'user1',
              },
            ],
          },
        ],
        1,
      ]),
    });

    const result = await service.findCollection({} as any);

    expect(result.total).toBe(1);
    expect(result.articles[0].id).toBe('a1');
  });

  it('should call stageCache.set if stage is provided', async () => {
    const setMock = jest.fn();

    (service as any).articleDataLoader.stageCache.set = setMock;

    getFindAllQueryBuilderMock.mockResolvedValue({
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          {
            id: 'a1',
            versions: [{ version: 1 }],
          },
        ],
        1,
      ]),
    });

    await service.findCollection({ stage: 'RELEASED' } as any);

    expect(setMock).toHaveBeenCalledWith('a1:1', Promise.resolve('RELEASED'));
  });

  it('should use DEFAULT_LANGUAGE when options.language is not provided', async () => {
    (service as any).multipleLanguageMode = false;

    const mockArticle = {
      id: 'a1',
      createdAt: new Date(),
      deletedAt: null,
      versions: [
        {
          version: 1,
          createdAt: new Date(),
          createdBy: 'admin',
          multiLanguageContents: [
            { language: DEFAULT_LANGUAGE, contentField: 'expected' },
          ],
        },
      ],
    };

    jest.spyOn(service as any, 'getFindAllQueryBuilder').mockResolvedValue({
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockArticle], 1]),
    });

    const result = await service.findCollection({ language: null } as any);

    const article = result.articles[0] as any;

    expect(article.contentField).toBe('expected');
  });
});

describe('ArticleBaseService - findAll', () => {
  let service: ArticleBaseService;
  let getFindAllQueryBuilderMock: jest.SpyInstance;

  beforeEach(() => {
    service = new ArticleBaseService(
      { metadata: { schema: 'public', manyToManyRelations: [] } } as any,
      {} as any,
      {
        metadata: {
          schema: 'public',
          tableName: 'contents',
          targetName: 'ArticleVersionContent',
        },
      } as any,
      { metadata: { tablePath: 'public.categories' } } as any,
      true, // multipleLanguageMode
      true,
      true,
      [],
      {} as any,
      {} as any,
      true, // fullTextSearchMode
      { createQueryBuilder: jest.fn() } as any,
      { stageCache: { set: jest.fn() } } as any,
      {} as any,
    );

    getFindAllQueryBuilderMock = jest.spyOn(
      service as any,
      'getFindAllQueryBuilder',
    );
  });

  it('should throw if language is provided but multipleLanguageMode is false', async () => {
    (service as any).multipleLanguageMode = false;

    await expect(
      service.findAll({ language: DEFAULT_LANGUAGE } as any),
    ).rejects.toThrow(MultipleLanguageModeIsDisabledError);
  });

  it('should return SingleArticleBaseDto when language is provided', async () => {
    getFindAllQueryBuilderMock.mockResolvedValue({
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'a1',
          createdAt: new Date('2023-01-01'),
          deletedAt: null,
          versions: [
            {
              version: 1,
              createdAt: new Date('2023-01-02'),
              createdBy: 'user1',
              multiLanguageContents: [
                { language: 'en', title: 'Hello', body: 'World' },
              ],
            },
          ],
        },
      ]),
    });

    const result = await service.findAll({ language: 'en' } as any);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Hello');
  });

  it('should return MultiLanguageArticleBaseDto when language is not provided', async () => {
    (service as any).multipleLanguageMode = true;

    getFindAllQueryBuilderMock.mockResolvedValue({
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'a1',
          createdAt: new Date('2023-01-01'),
          deletedAt: null,
          versions: [
            {
              version: 1,
              createdAt: new Date('2023-01-02'),
              createdBy: 'user1',
            },
          ],
        },
      ]),
    });

    const result = await service.findAll({} as any);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('should call stageCache.set for each article if stage is provided', async () => {
    const setMock = jest.fn();

    (service as any).articleDataLoader.stageCache.set = setMock;

    getFindAllQueryBuilderMock.mockResolvedValue({
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'a1',
          versions: [{ version: 1 }],
        },
      ]),
    });

    await service.findAll({ stage: ArticleStage.RELEASED } as any);

    expect(setMock).toHaveBeenCalledWith(
      'a1:1',
      Promise.resolve(ArticleStage.RELEASED),
    );
  });

  it('should use DEFAULT_LANGUAGE if language is not provided and multipleLanguageMode is false', async () => {
    (service as any).multipleLanguageMode = false;

    getFindAllQueryBuilderMock.mockResolvedValue({
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'a1',
          createdAt: new Date(),
          deletedAt: null,
          versions: [
            {
              version: 1,
              createdAt: new Date(),
              createdBy: 'admin',
              multiLanguageContents: [
                { language: DEFAULT_LANGUAGE, contentField: 'expected' },
              ],
            },
          ],
        },
      ]),
    });

    const result = await service.findAll({} as any);
    const article = result[0] as any;

    expect(article.contentField).toBe('expected');
  });
});
