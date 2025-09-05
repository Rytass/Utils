/**
 * @jest-environment node
 */

import { resolve } from 'path';
import { Credentials, S3 } from 'aws-sdk';
import { createHash } from 'crypto';
import { Readable, PassThrough } from 'stream';
import { createReadStream, readFileSync } from 'fs';

const ACCESS_KEY = 'aaaa';
const SECRET_KEY = 'bbbb';
const REGION = 'ap-northeast-1';
const BUCKET = 'utils';

const sampleFile = resolve(__dirname, '../__fixtures__/test-image.png');
const sampleFileBuffer = readFileSync(sampleFile);
const sampleFileSha256 = `${createHash('sha256').update(sampleFileBuffer).digest('hex')}.png`;
const FAKE_URL = 'https://fake.rytass.com';
const NOT_FOUND_FILE = 'NOT_EXIST';
const GENERAL_ERROR_FILE = 'GENERAL_ERROR_FILE';

const fakeStorage = new Map<string, Buffer>();

fakeStorage.set('saved-file', sampleFileBuffer);

describe('AWS S3 storage adapter', () => {
  const uploadPromiseMocked = jest.fn(
    () =>
      new Promise(pResolve => {
        pResolve({ key: sampleFileSha256 });
      }),
  );

  const defaultUploadMocked = jest.fn(
    (params: S3.Types.PutObjectRequest, _options?: S3.ManagedUpload.ManagedUploadOptions) => {
      if (params.Body instanceof Buffer) {
        fakeStorage.set(params.Key, params.Body);

        return {
          promise: () => uploadPromiseMocked,
        };
      }

      return {
        promise: () =>
          new Promise(pResolve => {
            let buffer = Buffer.from([]);

            (params.Body as PassThrough).on('data', chunk => {
              buffer = Buffer.concat([buffer, chunk]);
            });

            (params.Body as PassThrough).on('end', () => {
              fakeStorage.set(params.Key, buffer);

              pResolve(uploadPromiseMocked);
            });
          }),
      };
    },
  );

  let uploadMocked = defaultUploadMocked;

  const deleteMocked = jest.fn((params: S3.Types.DeleteObjectRequest) => {
    fakeStorage.delete(params.Key);

    return {
      promise: () => Promise.resolve(),
    };
  });

  const headMocked = jest.fn((params: S3.Types.HeadObjectRequest) => {
    if (!fakeStorage.has(params.Key)) {
      if (params.Key === GENERAL_ERROR_FILE) {
        return {
          promise: () => Promise.reject(new Error('Unknown Error')),
        };
      }

      const notExistsError = new Error();

      notExistsError.name = 'NotFound';

      return {
        promise: () => Promise.reject(notExistsError),
      };
    }

    return {
      promise: () => Promise.resolve(),
    };
  });

  const getMocked = jest.fn((params: S3.Types.GetObjectRequest) => {
    if (params.Key === GENERAL_ERROR_FILE) {
      throw new Error('Unknown Error');
    }

    if (params.Key === NOT_FOUND_FILE || !fakeStorage.has(params.Key)) {
      const noSuchKeyError = new Error();

      noSuchKeyError.name = 'NoSuchKey';

      throw noSuchKeyError;
    }

    return {
      promise: () =>
        Promise.resolve({
          Body: fakeStorage.get(params.Key),
        }),
    };
  });

  const copyMocked = jest.fn((params: S3.Types.CopyObjectRequest) => {
    /\/([^/]+)$/.test(params.CopySource);

    const oldKey = RegExp.$1;

    fakeStorage.set(params.Key, fakeStorage.get(oldKey) as Buffer);

    return {
      promise: () => Promise.resolve(),
    };
  });

  const urlMocked = jest.fn((_operation: string, _params: { Bucket: string; Key: string }) => {
    return FAKE_URL;
  });

  beforeAll(() => {
    jest.mock('aws-sdk', () => ({
      S3: jest.fn(() => ({
        upload: (params: S3.Types.PutObjectRequest, options?: S3.ManagedUpload.ManagedUploadOptions) =>
          uploadMocked(params, options),
        getObject: getMocked,
        headObject: headMocked,
        copyObject: copyMocked,
        deleteObject: deleteMocked,
        getSignedUrlPromise: urlMocked,
      })),
      Credentials,
    }));
  });

  beforeEach(() => {
    uploadMocked.mockClear();
    getMocked.mockClear();
    copyMocked.mockClear();
    deleteMocked.mockClear();
    urlMocked.mockClear();
  });

  it('should use custom filename when write buffer file', async () => {
    const customFilename = 'aaa.png';
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const { key } = await service.write(sampleFileBuffer, {
      filename: customFilename,
    });

    expect(key).toBe(customFilename);

    const uploadedFile = await service.read(customFilename, {
      format: 'buffer',
    });

    expect(Buffer.compare(uploadedFile, sampleFileBuffer)).toBe(0);
    expect(uploadMocked).toHaveBeenCalledTimes(1);
    expect(getMocked).toHaveBeenCalledTimes(1);

    await service.remove(customFilename);
  });

  it('should use custom filename when write stream file', async () => {
    const customFilename = 'aaa.png';
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const stream = createReadStream(sampleFile);

    const { key } = await service.write(stream, { filename: customFilename });

    expect(key).toBe(customFilename);

    const readStream = await service.read(customFilename);

    return new Promise<void>(done => {
      let buffer = Buffer.from([]);

      readStream.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
      });

      readStream.on('end', async () => {
        expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);
        expect(getMocked).toHaveBeenCalledTimes(1);

        await service.remove(customFilename);

        done();
      });
    });
  });

  it('should catch s3 error no specfic', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    await expect(service.read(GENERAL_ERROR_FILE)).rejects.toThrow();

    expect(getMocked).toHaveBeenCalledTimes(1);
  });

  it('should throw on file not found', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    await expect(service.read(NOT_FOUND_FILE)).rejects.toThrow();

    expect(getMocked).toHaveBeenCalledTimes(1);
  });

  it('should get read url', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const url = await service.url('saved-file');

    expect(url).toBe(FAKE_URL);
    expect(urlMocked).toHaveBeenCalledTimes(1);
  });

  it('should remove file', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const { key } = await service.write(sampleFileBuffer);

    expect(fakeStorage.get(sampleFileSha256)).toBe(sampleFileBuffer);

    await service.remove(key);

    expect(fakeStorage.has(sampleFileSha256)).toBeFalsy();
    expect(deleteMocked).toHaveBeenCalledTimes(1);
  });

  it('should read file in buffer', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const buffer = await service.read('saved-file', { format: 'buffer' });

    expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);
    expect(getMocked).toHaveBeenCalledTimes(1);
  });

  it('should read file in stream', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const stream = await service.read('saved-file');

    return new Promise<void>(done => {
      let buffer = Buffer.from([]);

      stream.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
      });

      stream.on('end', () => {
        expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);
        expect(getMocked).toHaveBeenCalledTimes(1);

        done();
      });
    });
  });

  it('should write stream file', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const stream = createReadStream(sampleFile);

    const { key } = await service.write(stream);

    const uploadedFile = await service.read(key, { format: 'buffer' });

    expect(Buffer.compare(uploadedFile, sampleFileBuffer)).toBe(0);
    expect(uploadMocked).toHaveBeenCalledTimes(1);
    expect(getMocked).toHaveBeenCalledTimes(1);
    expect(copyMocked).toHaveBeenCalledTimes(1);
    expect(deleteMocked).toHaveBeenCalledTimes(1);
  });

  it('should write buffer file', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const { key } = await service.write(sampleFileBuffer);
    const uploadedFile = await service.read(key, { format: 'buffer' });

    expect(Buffer.compare(uploadedFile, sampleFileBuffer)).toBe(0);
    expect(uploadMocked).toHaveBeenCalledTimes(1);
    expect(getMocked).toHaveBeenCalledTimes(1);
  });

  it('should batch write buffer file', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const buffer1 = Buffer.from([0x01]);
    const buffer3 = Buffer.from([0x02]);

    const [buffer1Hash] = await service.getBufferFilename(buffer1);
    const [buffer3Hash] = await service.getBufferFilename(buffer3);

    const [{ key: key1 }, { key: key2 }] = await service.batchWrite([buffer1, buffer3]);

    expect(key1).toBe(buffer1Hash);
    expect(key2).toBe(buffer3Hash);
    expect(uploadMocked).toHaveBeenCalledTimes(2);
  });

  it('should write buffer file with content type', async () => {
    uploadMocked = jest.fn((params: S3.Types.PutObjectRequest, _options?: S3.ManagedUpload.ManagedUploadOptions) => {
      expect(params.ContentType).toBe('image/png');

      fakeStorage.set(params.Key, params.Body as Buffer);

      return {
        promise: () => uploadPromiseMocked,
      };
    });

    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    await service.write(sampleFileBuffer, { contentType: 'image/png' });

    expect(uploadMocked).toHaveBeenCalledTimes(1);
  });

  it('should write unknown stream with content type', async () => {
    uploadMocked = jest.fn((params: S3.Types.PutObjectRequest, _options?: S3.ManagedUpload.ManagedUploadOptions) => {
      expect(params.ContentType).toBe('image/png');

      fakeStorage.set(params.Key, params.Body as Buffer);

      return {
        promise: () => uploadPromiseMocked,
      };
    });

    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const stream = new Readable({
      read() {},
    });

    setImmediate(() => {
      stream.push(
        Buffer.from([0x00, 0x01, 0x04, 0x00, 0x00, 0x01, 0x04, 0x00, 0x00, 0x01, 0x04, 0x00, 0x00, 0x01, 0x04, 0x00]),
      );

      stream.push(null);
    });

    await service.write(stream, { contentType: 'image/png' });

    expect(uploadMocked).toHaveBeenCalledTimes(1);
  });

  it('should write stream file with content type', async () => {
    uploadMocked = jest.fn((params: S3.Types.PutObjectRequest, _options?: S3.ManagedUpload.ManagedUploadOptions) => {
      expect(params.ContentType).toBe('image/png');

      return {
        promise: () =>
          new Promise(pResolve => {
            let buffer = Buffer.from([]);

            (params.Body as PassThrough).on('data', chunk => {
              buffer = Buffer.concat([buffer, chunk]);
            });

            (params.Body as PassThrough).on('end', () => {
              fakeStorage.set(params.Key, buffer);

              pResolve(uploadPromiseMocked);
            });
          }),
      };
    });

    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const stream = createReadStream(sampleFile);

    await service.write(stream, { contentType: 'image/png' });

    const stream2 = createReadStream(sampleFile);

    await service.write(stream2, {
      filename: 'target.png',
      contentType: 'image/png',
    });

    expect(uploadMocked).toHaveBeenCalledTimes(2);
  });

  it('should check file exists', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const notFound = await service.isExists(NOT_FOUND_FILE);
    const exists = await service.isExists('saved-file');

    expect(notFound).toBeFalsy();
    expect(exists).toBeTruthy();

    expect(headMocked).toHaveBeenCalledTimes(2);

    expect(() => service.isExists(GENERAL_ERROR_FILE)).rejects.toThrow();
  });

  afterEach(() => {
    uploadMocked = defaultUploadMocked;
  });
});
