/**
 * @jest-environment node
 */

import { resolve } from 'path';
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

// Mock for @aws-sdk/lib-storage Upload
const mockUploadDone = jest.fn();

class MockUpload {
  private readonly params: { Key: string; Body: Buffer | PassThrough; ContentType?: string };

  constructor(options: { client: unknown; params: { Key: string; Body: Buffer | PassThrough; ContentType?: string } }) {
    this.params = options.params;
  }

  async done(): Promise<{ Location: string; ETag: string; Bucket: string; Key: string }> {
    const { Key, Body, ContentType } = this.params;

    if (Body instanceof Buffer) {
      fakeStorage.set(Key, Body);
      mockUploadDone({ Key, ContentType });

      return {
        Location: FAKE_URL,
        ETag: 'etag',
        Bucket: BUCKET,
        Key,
      };
    }

    // Handle stream
    return new Promise(pResolve => {
      let buffer = Buffer.from([]);

      (Body as PassThrough).on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
      });

      (Body as PassThrough).on('end', () => {
        fakeStorage.set(Key, buffer);
        mockUploadDone({ Key, ContentType });

        pResolve({
          Location: FAKE_URL,
          ETag: 'etag',
          Bucket: BUCKET,
          Key,
        });
      });
    });
  }
}

// Mock for @aws-sdk/s3-request-presigner
const mockGetSignedUrl = jest.fn().mockResolvedValue(FAKE_URL);

// Mock S3Client send method
const mockSend = jest
  .fn()
  .mockImplementation((command: { constructor: { name: string }; input: Record<string, unknown> }) => {
    const commandName = command.constructor.name;

    switch (commandName) {
      case 'GetObjectCommand': {
        const key = command.input.Key as string;

        if (key === GENERAL_ERROR_FILE) {
          throw new Error('Unknown Error');
        }

        if (key === NOT_FOUND_FILE || !fakeStorage.has(key)) {
          const noSuchKeyError = new Error();

          noSuchKeyError.name = 'NoSuchKey';
          throw noSuchKeyError;
        }

        const data = fakeStorage.get(key);

        return Promise.resolve({
          Body: Readable.from(data as Buffer),
        });
      }

      case 'DeleteObjectCommand': {
        const key = command.input.Key as string;

        fakeStorage.delete(key);

        return Promise.resolve({});
      }

      case 'HeadObjectCommand': {
        const key = command.input.Key as string;

        if (key === GENERAL_ERROR_FILE) {
          return Promise.reject(new Error('Unknown Error'));
        }

        if (!fakeStorage.has(key)) {
          const notExistsError = new Error();

          notExistsError.name = 'NotFound';

          return Promise.reject(notExistsError);
        }

        return Promise.resolve({});
      }

      case 'CopyObjectCommand': {
        const copySource = command.input.CopySource as string;
        const newKey = command.input.Key as string;

        const match = /\/([^/]+)$/.exec(copySource);

        if (match) {
          const oldKey = match[1];

          fakeStorage.set(newKey, fakeStorage.get(oldKey) as Buffer);
        }

        return Promise.resolve({});
      }

      default:
        return Promise.resolve({});
    }
  });

// Mock S3Client class
class MockS3Client {
  send = mockSend;
}

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: MockS3Client,
  GetObjectCommand: class GetObjectCommand {
    readonly input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
  DeleteObjectCommand: class DeleteObjectCommand {
    readonly input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
  HeadObjectCommand: class HeadObjectCommand {
    readonly input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
  CopyObjectCommand: class CopyObjectCommand {
    readonly input: Record<string, unknown>;

    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
}));

jest.mock('@aws-sdk/lib-storage', () => ({
  Upload: MockUpload,
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

describe('AWS S3 storage adapter (SDK v3)', () => {
  beforeEach(() => {
    mockSend.mockClear();
    mockUploadDone.mockClear();
    mockGetSignedUrl.mockClear();
    fakeStorage.clear();
    fakeStorage.set('saved-file', sampleFileBuffer);
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
    expect(mockUploadDone).toHaveBeenCalledTimes(1);

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

      readStream.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
      });

      readStream.on('end', async () => {
        expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);

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
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
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

      stream.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
      });

      stream.on('end', () => {
        expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);

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
    expect(mockUploadDone).toHaveBeenCalledTimes(1);
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
    expect(mockUploadDone).toHaveBeenCalledTimes(1);
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
    expect(mockUploadDone).toHaveBeenCalledTimes(2);
  });

  it('should write buffer file with content type', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    await service.write(sampleFileBuffer, { contentType: 'image/png' });

    expect(mockUploadDone).toHaveBeenCalledTimes(1);
    expect(mockUploadDone).toHaveBeenCalledWith(
      expect.objectContaining({
        ContentType: 'image/png',
      }),
    );
  });

  it('should write unknown stream with content type', async () => {
    const { StorageS3Service } = await import('../src');

    const service = new StorageS3Service({
      accessKey: ACCESS_KEY,
      secretKey: SECRET_KEY,
      region: REGION,
      bucket: BUCKET,
    });

    const stream = new Readable({
      read(): void {},
    });

    setImmediate(() => {
      stream.push(
        Buffer.from([0x00, 0x01, 0x04, 0x00, 0x00, 0x01, 0x04, 0x00, 0x00, 0x01, 0x04, 0x00, 0x00, 0x01, 0x04, 0x00]),
      );

      stream.push(null);
    });

    await service.write(stream, { contentType: 'image/png' });

    expect(mockUploadDone).toHaveBeenCalledTimes(1);
  });

  it('should write stream file with content type', async () => {
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

    expect(mockUploadDone).toHaveBeenCalledTimes(2);
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

    await expect(service.isExists(GENERAL_ERROR_FILE)).rejects.toThrow();
  });
});
