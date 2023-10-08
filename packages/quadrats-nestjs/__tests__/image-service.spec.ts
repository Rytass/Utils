import { TestingModule, Test } from '@nestjs/testing';
import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { QuadratsModule } from '../src/module';
import { QuadratsArticleImageService } from '../src/services/image.service';
import axios from 'axios';
import { Readable } from 'node:stream';

const HOST = 'https://custom-url.com';
const ACCESS_KEY = '1111111111111';
const SECRET = '398h50w49g8042380f3e4irj4if3';

describe('Quadrats Nestjs Module - Image Service', () => {
  let moduleRef: TestingModule;
  let imageBuffer: Buffer;

  beforeAll(async () => {
    imageBuffer = await readFile(resolve(__dirname, '../__fixtures__/test-image.png'));

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

  it('should upload image with stream', async () => {
    const imageService = await moduleRef.resolve(QuadratsArticleImageService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/images`);

      return { data: [randomUUID()] };
    });

    const readable = createReadStream(resolve(__dirname, '../__fixtures__/test-image.png'));
    const imageId = await imageService.uploadImage(readable as Readable);

    expect(typeof imageId).toBe('string');
  });

  it('should upload image', async () => {
    const imageService = await moduleRef.resolve(QuadratsArticleImageService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/images`);

      return { data: [randomUUID()] };
    });

    const imageId = await imageService.uploadImage(imageBuffer);

    expect(typeof imageId).toBe('string');
  });

  it('should upload image and get image full url', async () => {
    const imageService = await moduleRef.resolve(QuadratsArticleImageService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/images`);

      const id = randomUUID();

      return {
        data: [{
          id,
          preload: `${HOST}/${id}/preload`,
          thumbnails: `${HOST}/${id}/thumbnails`,
          public: `${HOST}/${id}/public`,
          full: `${HOST}/${id}/full`,
        }],
      };
    });

    const imageDetail = await imageService.uploadImage(imageBuffer, true);

    expect(typeof imageDetail.id).toBe('string');
    expect(typeof imageDetail.preload).toBe('string');
    expect(typeof imageDetail.thumbnails).toBe('string');
    expect(typeof imageDetail.public).toBe('string');
    expect(typeof imageDetail.full).toBe('string');
  });

  it('should upload image and get image full url with read stream', async () => {
    const imageService = await moduleRef.resolve(QuadratsArticleImageService);

    const request = jest.spyOn(axios, 'request');

    request.mockImplementationOnce(async (config) => {
      expect(config.url).toBe(`${HOST}/images`);

      const id = randomUUID();

      return {
        data: [{
          id,
          preload: `${HOST}/${id}/preload`,
          thumbnails: `${HOST}/${id}/thumbnails`,
          public: `${HOST}/${id}/public`,
          full: `${HOST}/${id}/full`,
        }],
      };
    });

    const readable = createReadStream(resolve(__dirname, '../__fixtures__/test-image.png'));
    const imageDetail = await imageService.uploadImage(readable, true);

    expect(typeof imageDetail.id).toBe('string');
    expect(typeof imageDetail.preload).toBe('string');
    expect(typeof imageDetail.thumbnails).toBe('string');
    expect(typeof imageDetail.public).toBe('string');
    expect(typeof imageDetail.full).toBe('string');
  });
});
