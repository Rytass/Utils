/**
 * @jest-environment node
 */

import { resolve } from 'path';
import { Credentials, S3 } from 'aws-sdk';
import { createHash } from 'crypto';
import { PassThrough } from 'stream';
import { createReadStream, readFileSync } from 'fs';

const ACCESS_KEY = 'aaaa';
const SECRET_KEY = 'bbbb';
const ACCOUNT = 'cccc';
const BUCKET = 'utils';

describe('Cloudflare R2 storage adapter', () => {
  const sampleFile = resolve(__dirname, '../__fixtures__/test-image.png');
  const sampleFileBuffer = readFileSync(sampleFile);
  const sampleFileSha256 = `${createHash('sha256').update(sampleFileBuffer).digest('hex')}.png`;
  const FAKE_URL = 'https://fake.rytass.com';
  const NOT_FOUND_FILE = 'NOT_EXIST';
  const GENERAL_ERROR_FILE = 'GENERAL_ERROR_FILE';

  const fakeStorage = new Map<string, Buffer>();

  fakeStorage.set('saved-file', sampleFileBuffer);

  const uploadPromiseMocked = jest.fn(() => new Promise((pResolve) => {
    pResolve({ key: sampleFileSha256 });
  }));

  const uploadMocked = jest.fn((params: S3.Types.PutObjectRequest, options?: S3.ManagedUpload.ManagedUploadOptions) => {
    if (params.Body instanceof Buffer) {
      fakeStorage.set(params.Key, params.Body);

      return {
        promise: () => uploadPromiseMocked,
      };
    }

    return {
      promise: () => new Promise((pResolve) => {
        let buffer = Buffer.from([]);

        (params.Body as PassThrough).on('data', (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
        });

        (params.Body as PassThrough).on('end', () => {
          fakeStorage.set(params.Key, buffer);

          pResolve(uploadPromiseMocked);
        });
      }),
    };
  });

  const deleteMocked = jest.fn((params: S3.Types.DeleteObjectRequest) => {
    fakeStorage.delete(params.Key);

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
      promise: () => Promise.resolve({
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

  const urlMocked = jest.fn((operation: string, params: { Bucket: string; Key: string; }) => {
    return FAKE_URL;
  });

  const mockedS3 = {
    upload: uploadMocked,
    getObject: getMocked,
    copyObject: copyMocked,
    deleteObject: deleteMocked,
    getSignedUrlPromise: urlMocked,
  };

  jest.mock('aws-sdk', () => ({
    S3: jest.fn(() => mockedS3),
    Credentials,
  }));

  beforeEach(() => {
    uploadMocked.mockClear();
    getMocked.mockClear();
    copyMocked.mockClear();
    deleteMocked.mockClear();
    urlMocked.mockClear();
  });

  it('should catch r2 error no specfic', async () => {
    const { StorageR2Service } = await import('../src');

    const service = new StorageR2Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      account: ACCOUNT,
      bucket: BUCKET,
    });

    await expect(service.read(GENERAL_ERROR_FILE)).rejects.toThrow();

    expect(getMocked).toBeCalledTimes(1);
  });

  it('should throw on file not found', async () => {
    const { StorageR2Service } = await import('../src');

    const service = new StorageR2Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      account: ACCOUNT,
      bucket: BUCKET,
    });

    await expect(service.read(NOT_FOUND_FILE)).rejects.toThrow();

    expect(getMocked).toBeCalledTimes(1);
  });

  it('should get read url', async () => {
    const { StorageR2Service } = await import('../src');

    const service = new StorageR2Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      account: ACCOUNT,
      bucket: BUCKET,
    });

    const url = await service.url('saved-file');

    expect(url).toBe(FAKE_URL);
    expect(urlMocked).toBeCalledTimes(1);
  });

  it('should remove file', async () => {
    const { StorageR2Service } = await import('../src');

    const service = new StorageR2Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      account: ACCOUNT,
      bucket: BUCKET,
    });

    const { key } = await service.write(sampleFileBuffer);

    expect(fakeStorage.get(sampleFileSha256)).toBe(sampleFileBuffer);

    await service.remove(key);

    expect(fakeStorage.has(sampleFileSha256)).toBeFalsy();
    expect(deleteMocked).toBeCalledTimes(1);
  });

  it('should read file in buffer', async () => {
    const { StorageR2Service } = await import('../src');

    const service = new StorageR2Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      account: ACCOUNT,
      bucket: BUCKET,
    });

    const buffer = await service.read('saved-file', { format: 'buffer' });

    expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);
    expect(getMocked).toBeCalledTimes(1);
  });

  it('should read file in stream', async () => {
    const { StorageR2Service } = await import('../src');

    const service = new StorageR2Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      account: ACCOUNT,
      bucket: BUCKET,
    });

    const stream = await service.read('saved-file');

    return new Promise<void>((done) => {
      let buffer = Buffer.from([]);

      stream.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
      });

      stream.on('end', () => {
        expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);
        expect(getMocked).toBeCalledTimes(1);

        done();
      });
    });
  });

  it('should write stream file', async () => {
    const { StorageR2Service } = await import('../src');

    const service = new StorageR2Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      account: ACCOUNT,
      bucket: BUCKET,
    });

    const stream = createReadStream(sampleFile);

    const { key } = await service.write(stream);

    const uploadedFile = await service.read(key, { format: 'buffer' });

    expect(Buffer.compare(uploadedFile, sampleFileBuffer)).toBe(0);
    expect(uploadMocked).toBeCalledTimes(1);
    expect(getMocked).toBeCalledTimes(1);
    expect(copyMocked).toBeCalledTimes(1);
    expect(deleteMocked).toBeCalledTimes(1);
  });

  it('should write buffer file', async () => {
    const { StorageR2Service } = await import('../src');

    const service = new StorageR2Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      account: ACCOUNT,
      bucket: BUCKET,
    });

    const { key } = await service.write(sampleFileBuffer);
    const uploadedFile = await service.read(key, { format: 'buffer' });

    expect(Buffer.compare(uploadedFile, sampleFileBuffer)).toBe(0);
    expect(uploadMocked).toBeCalledTimes(1);
    expect(getMocked).toBeCalledTimes(1);
  });

  it('should batch write buffer file', async () => {
    const { StorageR2Service } = await import('../src');

    const service = new StorageR2Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      account: ACCOUNT,
      bucket: BUCKET,
    });

    const buffer1 = Buffer.from([0x01]);
    const buffer2 = Buffer.from([0x02]);

    const buffer1Hash = await service.getBufferFilename(buffer1);
    const buffer2Hash = await service.getBufferFilename(buffer2);

    const [{ key: key1 }, { key: key2 }] = await service.batchWrite([buffer1, buffer2]);

    expect(key1).toBe(buffer1Hash);
    expect(key2).toBe(buffer2Hash);
    expect(uploadMocked).toBeCalledTimes(2);
  });
});