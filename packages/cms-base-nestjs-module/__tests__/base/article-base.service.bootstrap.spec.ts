import { DataSource, QueryRunner } from 'typeorm';
import { ArticleBaseService } from '../../src/services/article-base.service';
import { BaseArticleVersionContentEntity } from '../../src/models/base-article-version-content.entity';
import { FULL_TEXT_SEARCH_TOKEN_VERSION } from '../../src/constants/full-text-search-token-version';
import {
  createMockRepositoryPartial,
  createMockDataSourcePartial,
  createMockSignatureServicePartial,
  createMockQueryBuilder,
  createMockLogger,
} from '../typings/mock-types.interface';

// Mock the jieba module more simply by skipping its functionality in tests
jest.mock('@node-rs/jieba', () => ({
  __esModule: true,
  default: {
    Jieba: class MockJieba {
      cut(): string[] {
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
      createMockRepositoryPartial('articles'),
      createMockRepositoryPartial('versions'),
      createMockRepositoryPartial('version_contents'),
      createMockRepositoryPartial('categories'),
      true,
      true,
      true,
      [],
      createMockRepositoryPartial('signature_levels'),
      createMockRepositoryPartial('article_signatures'),
      true,
      mockDataSource,
      mockBaseArticleVersionContentRepo,
      createMockSignatureServicePartial(false),
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

    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining(`UPDATE "${mockTableName}" SET`), [
      'Test Title',
      'tag1 tag2',
      'Test Desc',
      'token1 token2',
      'article-1',
      2,
      'en',
    ]);
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

    await service['bindSearchTokens'](articleContent, undefined, mockRunner as QueryRunner);

    expect(mockRunner.query).toHaveBeenCalledWith(expect.stringContaining(`UPDATE "${mockTableName}" SET`), [
      '標題',
      '',
      '描述',
      'token1 token2',
      'a2',
      5,
      'zh',
    ]);
  });
});

describe('ArticleBaseService - onApplicationBootstrap', () => {
  let service: ArticleBaseService;
  let mockQueryBuilder: ReturnType<typeof createMockQueryBuilder>;
  let mockDataSource: ReturnType<typeof createMockDataSourcePartial>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockBindSearchTokens: jest.SpyInstance;

  beforeEach(() => {
    mockQueryBuilder = createMockQueryBuilder();
    mockQueryBuilder.orWhere = jest.fn().mockReturnThis();
    mockQueryBuilder.getMany = jest.fn();

    mockDataSource = createMockDataSourcePartial();
    mockDataSource.query = jest.fn();

    mockLogger = createMockLogger();

    service = new ArticleBaseService(
      createMockRepositoryPartial('articles'),
      createMockRepositoryPartial('versions'),
      createMockRepositoryPartial('version_contents'),
      createMockRepositoryPartial('categories'),
      true, // multipleLanguageMode
      true, // allowMultipleParentCategories
      true, // allowCircularCategories
      [], // articleStageQueryFeatures
      createMockRepositoryPartial('signature_levels'),
      createMockRepositoryPartial('article_signatures'),
      true, // fullTextSearchMode
      mockDataSource,
      { metadata: { tableName: 'article_version_contents' } },
      createMockSignatureServicePartial(false),
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

    jest.spyOn(service, 'getDefaultQueryBuilder' as keyof ArticleBaseService).mockReturnValue(mockQueryBuilder);

    mockBindSearchTokens = jest
      .spyOn(service, 'bindSearchTokens' as keyof ArticleBaseService)
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

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith('multiLanguageContents.searchTokens IS NULL');

    expect(mockQueryBuilder.orWhere).toHaveBeenCalledWith(
      'multiLanguageContents.searchTokenVersion != :searchTokenVersion',
      { searchTokenVersion: FULL_TEXT_SEARCH_TOKEN_VERSION },
    );

    expect(mockBindSearchTokens).toHaveBeenCalledWith(mockArticle.versions[0].multiLanguageContents[0], ['tag']);

    expect(mockDataSource.query).toHaveBeenCalledWith(expect.stringContaining('CREATE INDEX IF NOT EXISTS'));

    expect(mockLogger.log).toHaveBeenCalledWith('Start indexing articles...');
    expect(mockLogger.log).toHaveBeenCalledWith('Indexing articles done.');
  });

  it('should not index anything if no outdated articles found', async () => {
    mockQueryBuilder.getMany.mockResolvedValue([]);

    await service.onApplicationBootstrap();

    expect(mockBindSearchTokens).not.toHaveBeenCalled();
    expect(mockLogger.log).not.toHaveBeenCalledWith('Start indexing articles...');

    expect(mockLogger.log).not.toHaveBeenCalledWith('Indexing articles done.');
    expect(mockDataSource.query).toHaveBeenCalled();
  });
});
