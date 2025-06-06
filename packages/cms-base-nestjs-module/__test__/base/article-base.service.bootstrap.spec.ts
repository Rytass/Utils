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

jest.mock('@node-rs/jieba', () => ({
  cut: jest.fn(() => ['mocked', 'tokens']),
}));

describe('ArticleBaseService (onApplicationBootstrap)', () => {
  let service: ArticleBaseService<any, any, any>;
  const queryMock = jest.fn();
  const getManyMock = jest.fn();

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    getMany: getManyMock,
  };

  beforeEach(async () => {
    mockQueryBuilder.orWhere.mockClear();

    const mockRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleBaseService,
        { provide: RESOLVED_ARTICLE_REPO, useValue: mockRepo },
        { provide: RESOLVED_ARTICLE_VERSION_REPO, useValue: {} },
        { provide: RESOLVED_ARTICLE_VERSION_CONTENT_REPO, useValue: {} },
        { provide: RESOLVED_CATEGORY_REPO, useValue: {} },
        { provide: MULTIPLE_LANGUAGE_MODE, useValue: false },
        { provide: FULL_TEXT_SEARCH_MODE, useValue: true },
        { provide: ENABLE_SIGNATURE_MODE, useValue: false },
        { provide: ARTICLE_SIGNATURE_SERVICE, useValue: {} },
        { provide: DRAFT_MODE, useValue: false },
        { provide: DataSource, useValue: { query: queryMock } },
      ],
    }).compile();

    service = module.get<ArticleBaseService<any, any, any>>(ArticleBaseService);

    (service as any).baseArticleVersionContentRepo = {
      metadata: { tableName: 'article_version_contents' },
    };

    getManyMock.mockReset();
    queryMock.mockReset();
  });

  it('should index articles and create GIN index when fullTextSearchMode is enabled', async () => {
    const loggerMock = { log: jest.fn() };

    getManyMock.mockResolvedValue([
      {
        versions: [
          {
            tags: ['tag1'],
            multiLanguageContents: [
              {
                title: 'Index Me',
                description: 'Desc',
                language: 'en',
                articleId: 'a1',
                version: 1,
                content: [{ type: 'p', children: [{ text: 'Token test' }] }],
              },
            ],
          },
        ],
      },
    ]);

    (service as any).logger = loggerMock;

    await (service as any).onApplicationBootstrap();

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'multiLanguageContents.searchTokens IS NULL',
    );
    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'multiLanguageContents.searchTokenVersion != :searchTokenVersion',
      { searchTokenVersion: '0.0.1' },
    );

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('CREATE INDEX'),
    );
    expect(loggerMock.log).toHaveBeenCalledWith('Start indexing articles...');
    expect(loggerMock.log).toHaveBeenCalledWith('Indexing articles done.');
  });

  it('should not index or create tokens if no articles are returned', async () => {
    const loggerMock = { log: jest.fn() };

    getManyMock.mockResolvedValue([]);

    (service as any).logger = loggerMock;

    await service.onApplicationBootstrap();

    expect(getManyMock).toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('CREATE INDEX'),
    );
    expect(loggerMock.log).not.toHaveBeenCalledWith(
      'Start indexing articles...',
    );
  });

  it('should fallback to empty string when description is undefined', async () => {
    const { cut } = await import('@node-rs/jieba');
    (cut as jest.Mock).mockReturnValue([]);

    const articleContent = {
      title: 'No Description',
      description: undefined,
      articleId: 'x1',
      version: 5,
      language: 'en',
      content: [
        {
          type: 'p',
          children: [{ text: 'Paragraph text' }],
        },
      ],
    };

    (service as any).dataSource = { query: queryMock };

    await (service as any).bindSearchTokens(articleContent);

    expect(queryMock).toHaveBeenCalled();
    const params = queryMock.mock.calls[0][1];
    expect(params[2]).toBe('');
  });

  it('should fallback to empty string for tokens when content has no <p>', async () => {
    const { cut } = await import('@node-rs/jieba');
    (cut as jest.Mock).mockReturnValue([]);

    const articleContent = {
      title: 'No Paragraphs',
      description: 'Some description',
      articleId: 'x2',
      version: 6,
      language: 'en',
      content: [
        {
          type: 'h1',
          children: [{ text: 'Heading text' }],
        },
      ],
    };

    (service as any).dataSource = { query: queryMock };

    await (service as any).bindSearchTokens(articleContent);

    expect(queryMock).toHaveBeenCalled();
    const params = queryMock.mock.calls[0][1];
    expect(params[3]).toBe('');
  });
});
