import { Test, TestingModule } from '@nestjs/testing';
import axios from 'axios';
import { QuadratsModule } from '../src/module';
import { QuadratsArticleService } from '../src/services/article.service';
import type { QuadratsElement, QuadratsText } from '@quadrats/core';

const HOST = 'https://custom-url.com';
const ACCESS_KEY = '1111111111111';
const SECRET = '398h50w49g8042380f3e4irj4if3';

describe('Quadrats Nestjs Module - Content Empty', () => {
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

  it('should throw when contents not provided', async () => {
    const articleService = await moduleRef.resolve(QuadratsArticleService);

    expect(() =>
      articleService.create({
        title: 'Test Article Rytass',
        categoryIds: [],
        tags: [],
      }),
    ).rejects.toThrow();

    expect(() =>
      articleService.addVersion({
        id: 'test-id',
        title: 'Test Article Rytass',
        categoryIds: [],
        tags: [],
      }),
    ).rejects.toThrow();
  });
});
