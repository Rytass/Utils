import { DataSource, QueryRunner } from 'typeorm';
import { ArticleBaseService } from '../../src/services/article-base.service';
import { BaseArticleVersionContentEntity } from '../../src/models/base-article-version-content.entity';
import { FULL_TEXT_SEARCH_TOKEN_VERSION } from '../../src/constants/full-text-search-token-version';

// Mock the jieba module more simply by skipping its functionality in tests
jest.mock('@node-rs/jieba', () => ({
  __esModule: true,
  default: {
    Jieba: class MockJieba {
      cut() {
        return ['token1', 'token2'];
      }
    },
  },
}));

describe('ArticleBaseService - bindSearchTokens', () => {
  let service: ArticleBaseService;
  let mockQuery: jest.Mock;
  const mockTableName = 'article_version_contents';

  beforeEach(() => {
    mockQuery = jest.fn();

    const mockDataSource = {
      query: mockQuery,
    } as unknown as DataSource;

    const mockBaseArticleVersionContentRepo = {
      metadata: {
        tableName: mockTableName,
      },
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
      mockDataSource,
      mockBaseArticleVersionContentRepo as any,
      {} as any,
    );

    Object.defineProperty(service, 'baseArticleVersionContentRepo', {
      value: mockBaseArticleVersionContentRepo,
      writable: false,
    });
  });

  it('should generate search tokens and execute update query using dataSource by default', async () => {
    const articleContent = {
      articleId: 'article-1',
      version: 2,
      language: 'en',
      title: 'Test Title',
      description: 'Test Desc',
      content: [
        {
          type: 'p',
          children: [{ text: 'Hello' }, { text: 'World' }],
        },
        {
          type: 'div',
          children: [{ text: 'Ignore this' }],
        },
      ],
    } as unknown as BaseArticleVersionContentEntity;

    await service['bindSearchTokens'](articleContent, ['tag1', 'tag2']);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining(`UPDATE "${mockTableName}" SET`),
      [
        'Test Title',
        'tag1 tag2',
        'Test Desc',
        'token1 token2',
        'article-1',
        2,
        'en',
      ],
    );
  });

  it('should use provided QueryRunner if passed', async () => {
    const mockRunner: Partial<QueryRunner> = {
      query: jest.fn(),
    };

    const articleContent = {
      articleId: 'a2',
      version: 5,
      language: 'zh',
      title: '標題',
      description: '描述',
      content: [
        {
          type: 'p',
          children: [{ text: '這是內容' }],
        },
      ],
    } as unknown as BaseArticleVersionContentEntity;

    await service['bindSearchTokens'](
      articleContent,
      undefined,
      mockRunner as QueryRunner,
    );

    expect(mockRunner.query).toHaveBeenCalledWith(
      expect.stringContaining(`UPDATE "${mockTableName}" SET`),
      ['標題', '', '描述', 'token1 token2', 'a2', 5, 'zh'],
    );
  });
});

describe('ArticleBaseService - onApplicationBootstrap', () => {
  let service: ArticleBaseService;
  let mockQueryBuilder: any;
  let mockDataSource: any;
  let mockLogger: any;
  let mockBindSearchTokens: jest.SpyInstance;

  beforeEach(() => {
    mockQueryBuilder = {
      orWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn(),
    };

    mockLogger = {
      log: jest.fn(),
    };

    service = new ArticleBaseService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      true, // multipleLanguageMode
      true, // allowMultipleParentCategories
      true, // allowCircularCategories
      [], // articleStageQueryFeatures
      {} as any,
      {} as any,
      true, // fullTextSearchMode
      mockDataSource,
      { metadata: { tableName: 'article_version_contents' } } as any,
      {} as any,
    );

    Object.defineProperty(service, 'logger', {
      value: mockLogger,
    });

    Object.defineProperty(service, 'baseArticleVersionContentRepo', {
      value: {
        metadata: {
          tableName: 'article_version_contents',
        },
      },
    });

    jest
      .spyOn(service as any, 'getDefaultQueryBuilder')
      .mockReturnValue(mockQueryBuilder);

    mockBindSearchTokens = jest
      .spyOn(service as any, 'bindSearchTokens')
      .mockResolvedValue(undefined);
  });

  it('should index articles with missing or outdated search tokens', async () => {
    const mockArticle = {
      versions: [
        {
          multiLanguageContents: [{}],
          tags: ['tag'],
        },
      ],
    };

    mockQueryBuilder.getMany.mockResolvedValue([mockArticle]);

    await service.onApplicationBootstrap();

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'multiLanguageContents.searchTokens IS NULL',
    );

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'multiLanguageContents.searchTokenVersion != :searchTokenVersion',
      { searchTokenVersion: FULL_TEXT_SEARCH_TOKEN_VERSION },
    );

    expect(mockBindSearchTokens).toHaveBeenCalledWith(
      mockArticle.versions[0].multiLanguageContents[0],
      ['tag'],
    );

    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('CREATE INDEX IF NOT EXISTS'),
    );

    expect(mockLogger.log).toHaveBeenCalledWith('Start indexing articles...');
    expect(mockLogger.log).toHaveBeenCalledWith('Indexing articles done.');
  });

  it('should not index anything if no outdated articles found', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);

    await service.onApplicationBootstrap();

    expect(mockBindSearchTokens).not.toHaveBeenCalled();
    expect(mockLogger.log).not.toHaveBeenCalledWith(
      'Start indexing articles...',
    );

    expect(mockLogger.log).not.toHaveBeenCalledWith('Indexing articles done.');
    expect(mockDataSource.query).toHaveBeenCalled();
  });
});
