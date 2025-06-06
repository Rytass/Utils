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

describe('ArticleBaseService (bindSearchTokens)', () => {
  jest.mock('@node-rs/jieba', () => ({
    cut: jest.fn().mockReturnValue(['token1', 'token2']),
  }));

  let service: ArticleBaseService<any, any, any>;
  const queryMock = jest.fn();

  beforeEach(async () => {
    const mockRepo = { createQueryBuilder: jest.fn() };

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

    (service as any).dataSource = {
      query: queryMock,
    };

    queryMock.mockClear();
  });

  it('should use runner.query and joined tags string when both tags and runner are provided', async () => {
    const articleContent = {
      title: 'Runner + Tags',
      description: 'Dual input test',
      articleId: 'combo-1',
      version: 7,
      language: 'en',
      content: [
        {
          type: 'p',
          children: [
            { text: 'First test sentence.' },
            { text: 'Second test sentence.' },
          ],
        },
      ],
    };

    const tags = ['alpha', 'beta'];
    const runnerQueryMock = jest.fn();
    const runner = { query: runnerQueryMock };

    await (service as any).bindSearchTokens(articleContent, tags, runner);

    const expectedText = 'First test sentence.\nSecond test sentence.';

    expect(runnerQueryMock).toHaveBeenCalledTimes(1);
    expect(queryMock).not.toHaveBeenCalled();

    const [sql, params] = runnerQueryMock.mock.calls[0];

    expect(sql).toContain('UPDATE "article_version_contents" SET');
    expect(params).toEqual([
      'Runner + Tags',
      'alpha beta',
      'Dual input test',
      'token1 token2',
      'combo-1',
      7,
      'en',
    ]);

    const { cut } = await import('@node-rs/jieba');
    expect(cut).toHaveBeenCalledWith(expectedText);
  });

  it('should fallback to dataSource and empty tag string when no tags and no runner are provided', async () => {
    const articleContent = {
      title: 'No Tag Title',
      description: 'No Tag Desc',
      articleId: '456',
      version: 2,
      language: 'zh',
      content: [
        {
          type: 'p',
          children: [{ text: '第一段' }, { text: '第二段' }],
        },
      ],
    };

    await (service as any).bindSearchTokens(articleContent);

    const expectedText = '第一段\n第二段';

    expect(queryMock).toHaveBeenCalledTimes(1);

    const [sql, params] = queryMock.mock.calls[0];

    expect(sql).toContain('UPDATE "article_version_contents" SET');
    expect(params).toEqual([
      'No Tag Title',
      '',
      'No Tag Desc',
      'token1 token2',
      '456',
      2,
      'zh',
    ]);

    const { cut } = await import('@node-rs/jieba');
    expect(cut).toHaveBeenCalledWith(expectedText);
  });

  it('should use dataSource and apply tag string when tags are provided but no runner is passed', async () => {
    const articleContent = {
      title: 'With Tags Title',
      description: 'With Tags Description',
      articleId: '789',
      version: 3,
      language: 'en',
      content: [
        {
          type: 'p',
          children: [{ text: 'First line' }, { text: 'Second line' }],
        },
      ],
    };

    const tags = ['tagA', 'tagB'];

    await (service as any).bindSearchTokens(articleContent, tags);

    const expectedText = 'First line\nSecond line';

    expect(queryMock).toHaveBeenCalledTimes(1);

    const [sql, params] = queryMock.mock.calls[0];

    expect(sql).toContain('UPDATE "article_version_contents" SET');
    expect(params).toEqual([
      'With Tags Title',
      'tagA tagB',
      'With Tags Description',
      'token1 token2',
      '789',
      3,
      'en',
    ]);

    const { cut } = await import('@node-rs/jieba');
    expect(cut).toHaveBeenCalledWith(expectedText);
  });

  it('should use runner.query and fallback to empty tag string when tags are not provided but runner is', async () => {
    const articleContent = {
      title: 'Runner Title',
      description: 'Runner Desc',
      articleId: '999',
      version: 4,
      language: 'en',
      content: [
        {
          type: 'p',
          children: [{ text: 'Runner one' }, { text: 'Runner two' }],
        },
      ],
    };

    const runnerQueryMock = jest.fn();

    const runner = {
      query: runnerQueryMock,
    };

    await (service as any).bindSearchTokens(articleContent, undefined, runner);

    const expectedText = 'Runner one\nRunner two';

    expect(runnerQueryMock).toHaveBeenCalledTimes(1);
    expect(queryMock).not.toHaveBeenCalled();

    const [sql, params] = runnerQueryMock.mock.calls[0];

    expect(sql).toContain('UPDATE "article_version_contents" SET');
    expect(params).toEqual([
      'Runner Title',
      '',
      'Runner Desc',
      'token1 token2',
      '999',
      4,
      'en',
    ]);

    const { cut } = await import('@node-rs/jieba');
    expect(cut).toHaveBeenCalledWith(expectedText);
  });

  it('should handle children without text field gracefully', async () => {
    const { cut } = await import('@node-rs/jieba');
    (cut as jest.Mock).mockReturnValue([]);
    const articleContent = {
      title: 'No Text Children',
      description: 'Some desc',
      articleId: 'z1',
      version: 10,
      language: 'en',
      content: [
        {
          type: 'p',
          children: [{ foo: 'bar' }],
        },
      ],
    };
    (service as any).dataSource = { query: queryMock };

    await (service as any).bindSearchTokens(articleContent);

    const params = queryMock.mock.calls[0][1];
    expect(params[3]).toBe('');
  });
});
