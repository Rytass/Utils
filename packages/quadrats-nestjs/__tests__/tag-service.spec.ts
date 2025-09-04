import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { QuadratsModule } from '../src/module';
import { QuadratsArticleTagService } from '../src/services/tag.service';

const HOST = 'https://custom-url.com';
const ACCESS_KEY = '1111111111111';
const SECRET = '398h50w49g8042380f3e4irj4if3';

describe('Quadrats Nestjs Module - Tag Service', () => {
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

  it('should get all tags in account', async () => {
    const tagService = await moduleRef.resolve(QuadratsArticleTagService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async config => {
      expect(config.url).toBe(`${HOST}/graphql`);

      const data = JSON.parse(config.data as string) as {
        query: string;
        variables: {
          auth: {
            accessKey: string;
            secret: string;
          };
        };
      };

      expect(data.variables.auth.accessKey).toBe(ACCESS_KEY);
      expect(data.variables.auth.secret).toBe(SECRET);

      return { data: { data: { tags: ['a', 'b', 'c'] } } };
    });

    const tags = await tagService.getAll();

    expect(tags[0]).toBe('a');
    expect(tags[2]).toBe('c');
    expect(tags[3]).toBe(undefined);
  });
});
