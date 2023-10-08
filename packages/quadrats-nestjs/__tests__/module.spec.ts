import { Test } from '@nestjs/testing';
import axios from 'axios';
import { QuadratsModule } from '../src/module';
import { QuadratsArticleTagService } from '../src/services/tag.service';

const HOST = 'https://custom-url.com';
const ACCESS_KEY = '1111111111111';
const SECRET = '398h50w49g8042380f3e4irj4if3';

describe('Quadrats Nestjs Module', () => {
  it('should provide host', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        QuadratsModule.forRoot({
          host: HOST,
          accessKey: ACCESS_KEY,
          secret: SECRET,
        }),
      ],
    }).compile();

    const tagService = await moduleRef.resolve(QuadratsArticleTagService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      return { data: { data: { tags: ['a', 'b', 'c'] } } };
    });

    await tagService.getAll();
  });

  it('should inject access key and secret', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        QuadratsModule.forRoot({
          accessKey: ACCESS_KEY,
          secret: SECRET,
        }),
      ],
    }).compile();

    const tagService = await moduleRef.resolve(QuadratsArticleTagService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${QuadratsModule.DEFAULT_HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      return { data: { data: { tags: ['a', 'b', 'c'] } } };
    });

    await tagService.getAll();
  });

  // test forAsync

  it('should provide host', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        QuadratsModule.forRootAsync({
          useFactory: () => ({
            host: HOST,
            accessKey: ACCESS_KEY,
            secret: SECRET,
          }),
        }),
      ],
    }).compile();

    const tagService = await moduleRef.resolve(QuadratsArticleTagService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      return { data: { data: { tags: ['a', 'b', 'c'] } } };
    });

    await tagService.getAll();
  });

  it('should provide host(use default)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        QuadratsModule.forRootAsync({
          useFactory: () => ({
            host: undefined,
            accessKey: ACCESS_KEY,
            secret: SECRET,
          }),
        }),
      ],
    }).compile();

    const tagService = await moduleRef.resolve(QuadratsArticleTagService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${QuadratsModule.DEFAULT_HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      return { data: { data: { tags: ['a', 'b', 'c'] } } };
    });

    await tagService.getAll();
  });

  it('should inject access key and secret', async () => {

    const moduleRef = await Test.createTestingModule({
      imports: [
        QuadratsModule.forRootAsync({
          useFactory: () => ({
            accessKey: ACCESS_KEY,
            secret: SECRET,
          }),
        }),
      ],
    }).compile();

    const tagService = await moduleRef.resolve(QuadratsArticleTagService);
    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${QuadratsModule.DEFAULT_HOST}/graphql`);
      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          auth: {
            accessKey: string;
            secret: string;
          }
        }
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      return { data: { data: { tags: ['a', 'b', 'c'] } } };
    });

    await tagService.getAll();
  });
});
