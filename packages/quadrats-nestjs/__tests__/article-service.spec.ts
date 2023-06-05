import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { QuadratsModule } from '../src/module';
import { QuadratsArticleService } from '../src/services/article.service';
import type { QuadratsElement, QuadratsText } from '@quadrats/core';

const HOST = 'https://custom-url.com';
const ACCESS_KEY = '1111111111111';
const SECRET = '398h50w49g8042380feirjif3';

describe('Quadrats Nestjs Module - Article Service', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        QuadratsModule.forRoot({
          host: HOST,
          accessKey: ACCESS_KEY,
          secret: SECRET,
        }),
      ],
    }).compile();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should get article return article data', async () => {
    const articleService = await moduleRef.resolve(QuadratsArticleService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementation(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          id: string;
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      if (data.variables.id !== '02500000031430000000') {
        return {
          data: {
            data: {
              article: null,
            },
          },
        };
      }

      return {
        data: {
          data: {
            article: {
              id: '02500000031430000000',
              versionId: '02500000031430000001',
              title: 'Test Article',
              categories: [],
              contents: [{
                language: 'DEFAULT',
                elements: [{
                  type: 'p',
                  children: [{ text: 'Test Content' }],
                }],
              }],
              tags: [],
            },
          },
        },
      };
    });

    const article = await articleService.get('02500000031430000000');

    expect(article?.id).toBe('02500000031430000000');

    const articleNotFound = await articleService.get('02500000031430000999');

    expect(articleNotFound).toBeNull();
  });

  it('should get article ids return array of article id', async () => {
    const articleService = await moduleRef.resolve(QuadratsArticleService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementation(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          limit?: number;
          offset?: number;
          categoryIds?: string[];
          tags?: string[];
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      return {
        data: {
          data: {
            articleIds: [
              '02500000031430000000',
              '02500000031430000002',
            ].slice(data.variables.offset || 0, (data.variables.limit || 20) + (data.variables.offset || 0)),
          },
        },
      };
    });

    const articleIds = await articleService.getIds();

    expect(Array.isArray(articleIds)).toBeTruthy();

    articleIds.forEach((articleId) => {
      expect(typeof articleId).toBe('string');
    });

    const [firstId] = await articleService.getIds({
      limit: 1,
    });

    expect(firstId).toBe('02500000031430000000');

    const [secondId] = await articleService.getIds({
      limit: 1,
      offset: 1,
    });

    expect(secondId).toBe('02500000031430000002');
  });

  it('should create article service can create article', async () => {
    const articleService = await moduleRef.resolve(QuadratsArticleService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          title: string;
          contents: {
            language: 'DEFAULT';
            elements: QuadratsElement[];
          }[];
          categoryIds: string[];
          tags: string[];
          releasedAt: string | null;
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      expect(data.variables.title).toBe('Test Article Rytass');
      expect(data.variables.releasedAt).toBeNull();

      return {
        data: {
          data: {
            createArticle: {
              id: '02500000031430000000',
              versionId: '02500000031430000001',
              title: 'Test Article Rytass',
              categories: [],
              contents: [{
                language: 'DEFAULT',
                elements: [{
                  type: 'p',
                  children: [{ text: 'Test Content' }],
                }],
              }],
              tags: [],
            },
          },
        },
      };
    });

    const article = await articleService.create({
      title: 'Test Article Rytass',
      categoryIds: [],
      tags: [],
      contents: [{
        type: 'p',
        children: [{ text: 'Test Content' }],
      }],
    });

    expect(article.id).toBeDefined();
    expect(article.title).toBe('Test Article Rytass');
    expect(article.contents[0].language).toBe('DEFAULT');
    expect((article.contents[0].elements[0].children[0] as QuadratsText).text).toBe('Test Content');
  });

  it('should remove article can remove the article', async () => {
    const articleService = await moduleRef.resolve(QuadratsArticleService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          id: string;
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      expect(data.variables.id).toBe('02500000031430000002');

      return {
        data: {
          data: {
            removeArticle: data.variables.id,
          },
        },
      };
    });

    const removedArticleId = await articleService.remove('02500000031430000002');

    expect(removedArticleId).toBe('02500000031430000002');
  });

  it('should add version method can add article version', async () => {
    const articleService = await moduleRef.resolve(QuadratsArticleService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementation(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          id: string;
          title?: string;
          contents?: {
            language: 'DEFAULT';
            elements: QuadratsElement[];
          }[];
          categoryIds?: string[];
          tags?: string[];
          releasedAt?: string | null;
          auth: {
            accessKey: string;
            secret: string;
          }
        };
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      if (/query Article/.test(data.query)) {
        return {
          data: {
            data: {
              article: {
                id: '02500000031430000000',
                versionId: '02500000031430000001',
                title: 'Version 1 Title',
                categories: [],
                contents: [{
                  language: 'DEFAULT',
                  elements: [{
                    type: 'p',
                    children: [{ text: 'Test Content' }],
                  }],
                }],
                tags: [],
              },
            },
          },
        };
      }

      return {
        data: {
          data: {
            addArticleVersion: {
              id: '02500000031430000000',
              versionId: '02500000031430000002',
              title: 'Version 2 Title',
              categories: [],
              contents: [{
                language: 'DEFAULT',
                elements: [{
                  type: 'p',
                  children: [{ text: 'Test Content' }],
                }, {
                  type: 'p',
                  children: [{ text: 'Test Content, L2v4' }],
                }],
              }],
              tags: ['Rytass'],
            },
          },
        },
      };
    });

    const originArticle = await articleService.get('02500000031430000000');

    expect(originArticle?.title).toBe('Version 1 Title');
    expect(originArticle?.tags.length).toBe(0);

    const newVersionArticle = await articleService.addVersion({
      id: '02500000031430000000',
      title: 'Version 2 Title',
      contents: [{
        type: 'p',
        children: [{ text: 'Test Content' }],
      }, {
        type: 'p',
        children: [{ text: 'Test Content, L2v4' }],
      }],
      categoryIds: [],
      tags: ['Rytass'],
    });

    expect(newVersionArticle?.title).toBe('Version 2 Title');
    expect(newVersionArticle?.tags.length).toBe(1);
    expect(originArticle?.versionId).not.toBe(newVersionArticle?.versionId);
  });
});
