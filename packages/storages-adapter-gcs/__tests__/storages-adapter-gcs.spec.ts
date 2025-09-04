/**
 * @jest-environment node
 */

import { resolve } from 'path';
import { Readable, Writable } from 'stream';
import { readFileSync, createReadStream, createWriteStream } from 'fs';
import { createHash } from 'crypto';
import { FileMetadata } from '@google-cloud/storage';

const sampleFile = resolve(__dirname, '../__fixtures__/test-image.png');
const sampleFileBuffer = readFileSync(sampleFile);
const sampleFileSha256 = `${createHash('sha256').update(sampleFileBuffer).digest('hex')}.png`;

const PROJECT_ID = 'develop-server';
const CLIENT_EMAIL = 'rytass-utils-develop@develop-server.iam.gserviceaccount.com';
const CLIENT_SECRET =
  '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCoIei1D28Kyxum\nFzMOW5ZIPZ4myY17Q2jUX9Xsnh5RLn3JtbRNonBOgzTVSrLn1wYaWDAO8EnlmfnX\nj6tpMLPpZITvhvk4BBFhFfiPwmBRnfhR/Y24b09CNerV/EJzaFzpW5NozxPUT7o9\nNLXF5SZ4x17MUENLxJioyWGXs4/9X8JeakWI+tkaH2ik+HesTjUIS4DjnQ2zp8OY\nEWme1A2w+9G+WjWfg+BhNLA2O7s2G5yr7D4A6ZQ7RgM+UIwGXcZGzGKXY+DxB261\nqUyH4ubcZsLjqzMO8dDZ6Sr9ijpRqNfgIiEz0r/HP8lprem6x6vL+d+PuHORl+RE\nwyu+8w8vAgMBAAECggEALxV35qSQ0zP35TZf/OhXGJnw3Snabid9huPjs6TAFrnv\nTfqNqKQR0VrbA9Qsb9J+iggiRTyzZRIOrng0Z3vVFkopFC73QeGZwFd3yUKE2LZl\nYQihlIHPb1pMDmrbbRhP1KXpjRNYmT9Oh29obCf08yPZ/1uGzQQcQEBNDT+i1jBz\nuXkvN5YpxFURwW6U9p/xngCxkkbRQ19402C5c4vP4LCP6UiHfmmgbiaqUsoufNA1\nQuvec+l23kouUXN5otpgmSKQ0R7ooOkeEmDL6xMkSU7kiINFpJ/0FWybslt7ly86\nFPHs8TLr/kCZQ/cabelq9toj+dHGB67gkX8ziFmpwQKBgQDQ3KxzNXRqLJOFJMq3\n+oG+qnIvgyLbDmcOjqUsoEvL/hFFsFZXl0GwErYXLnZpWPJMAtlXgl/RBqWyNO2l\nQB50t80WHsg+SgkInF1P4nVdtUbKV+ziDso17jJIeXa1E7DiggwCphl5qGvNT9ZH\nIHQb0pJB/7dWHrpaQOS07O7KIQKBgQDOFAXCW7UrnmBFG0Twn6OImSeBkefwP0cX\nyBRdLxyfbU5iII+J2lLqVEgp1tFeGNL4xJ7iUA/zqqxU8oqR/WLhpCe1bOGFjtMB\nNxCsSikupca+UYY9leKpMu06J+o0iiimSkPmhSIcBVl69M2vK54whQsfzUU6f1Y4\nM2/rpZLPTwKBgQCeOl+G1DtCaEzF9E6DPItoV5YzumQAkhOu6o/lk/Z4Lx0Er4dp\nyhQggLxkKXXZb2H4BbyD2CggoamLrR9QLpgkEk6TcHSBA/N+C3+Bkm0ZtchQaHXz\n+AJnAvIjB6nPmoBJyP2yUAVCrj4lB1OtBMARh9/3kfNhkdvZngnlqw1oIQKBgAY3\ncmkHjTKQp4TOKsk7d5pyTE/LT/zeW82q2nppJmrkyD2Lj+jvrhqlijvA4DX/d7XL\ncKORGLoYBvTVEDsRMr9tzUjazP7TbSgXOiiIYC+pDpLFMNCAygKip6deduE43bsO\neHfmwj2oJ6fe5KmJHk+GY+yEq7b1CmvNmW25Y/FfAoGAAKl79D0dMCY8znEodFa8\nVP+C6mXvfp0khs+p2nB+mlwS+dtX7LBt9+xnfEsptE2JQYY1D4n/J/gBdkwcdeBb\nhuTmqQE3UcOFNN/cMWdCGV13fepd9+yfmymAcPr5OWquPAi84J9KQ7lYpivFlfDz\nwWjEn4gs/0fdu+OOHMW2bVs=\n-----END PRIVATE KEY-----\n';
const BUCKET = 'brief.rytass.com';
const FAKE_URL = 'https://fake.rytass.com';
const NOT_FOUND_FILE = 'NOT_EXIST';
const GENERAL_ERROR_FILE = 'GENERAL_ERROR_FILE';

const fakeStorage = new Map<string, Buffer>();

let saveMock = jest.fn((filename: string) => (buffer: Buffer, options: Record<string, string>) => {
  return fakeStorage.set(filename, buffer);
});

const getSignedUrlMock = jest.fn((filename: string) => (options: Record<string, string>) => {
  return [FAKE_URL];
});

const downloadMock = jest.fn((filename: string) => () => {
  if (filename === GENERAL_ERROR_FILE) {
    throw new Error('Unknown Error');
  }

  const buffer = fakeStorage.get(filename);

  if (!buffer) throw new Error(`No such object: ${BUCKET}/${filename}`);

  return [buffer];
});

const readStreamMock = jest.fn((filename: string) => () => {
  if (filename === GENERAL_ERROR_FILE) {
    throw new Error('Unknown Error');
  }

  const buffer = fakeStorage.get(filename);

  if (!buffer) throw new Error(`No such object: ${BUCKET}/${filename}`);

  return Readable.from(buffer);
});

let writeStreamMock = jest.fn((filename: string) => (options: Record<string, string>) => {
  const stream = new Writable();

  let buffer = Buffer.from([]);

  stream._write = (chunk: Buffer, encoding, done) => {
    buffer = Buffer.concat([buffer, chunk]);

    done();
  };

  stream.on('finish', () => {
    fakeStorage.set(filename, buffer);
  });

  return stream;
});

const deleteMock = jest.fn((filename: string) => () => {
  fakeStorage.delete(filename);
});

const existsMock = jest.fn((filename: string) => () => {
  return [fakeStorage.has(filename)];
});

const moveMock = jest.fn((filename: string) => (newFilename: string) => {
  const buffer = fakeStorage.get(filename);

  if (!buffer) throw new Error(`No such object: ${BUCKET}/${filename}`);

  fakeStorage.set(newFilename, buffer);

  fakeStorage.delete(filename);
});

const setMetadataMock = jest.fn((filename: string) => (metadata: FileMetadata) => {});

const fileMock = jest.fn(filename => ({
  save: (buffer: Buffer, options: Record<string, string>) => saveMock(filename)(buffer, options),
  download: () => downloadMock(filename)(),
  delete: () => deleteMock(filename)(),
  move: (newFilename: string) => moveMock(filename)(newFilename),
  createReadStream: () => readStreamMock(filename)(),
  createWriteStream: (options: Record<string, string>) => writeStreamMock(filename)(options),
  getSignedUrl: (options: Record<string, string>) => getSignedUrlMock(filename)(options),
  exists: () => existsMock(filename)(),
  setMetadata: (metadata: FileMetadata) => setMetadataMock(filename)(metadata),
}));

describe('GCS adapter', () => {
  beforeAll(() => {
    jest.mock('@google-cloud/storage', () => ({
      Storage: jest.fn(() => ({
        bucket: jest.fn(() => ({
          file: fileMock,
        })),
      })),
    }));
  });

  beforeEach(() => {
    fileMock.mockClear();
    saveMock.mockClear();
    downloadMock.mockClear();
    deleteMock.mockClear();
    readStreamMock.mockClear();
    writeStreamMock.mockClear();
    getSignedUrlMock.mockClear();

    fakeStorage.set('saved-file', sampleFileBuffer);
  });

  afterEach(() => {
    fakeStorage.clear();
  });

  it('should use custom filename when write buffer file', async () => {
    const customFilename = 'aaa.png';

    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    const { key } = await storage.write(sampleFileBuffer, {
      filename: customFilename,
    });

    expect(key).toBe(customFilename);

    const uploadedFile = await storage.read(customFilename, {
      format: 'buffer',
    });

    await storage.remove(customFilename);

    expect(Buffer.compare(uploadedFile, sampleFileBuffer)).toBe(0);
    expect(fileMock).toHaveBeenCalledTimes(3);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(downloadMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('should use custom filename when write stream file', async () => {
    const customFilename = 'aaa.png';

    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    const stream = createReadStream(sampleFile);

    const { key } = await storage.write(stream, { filename: customFilename });

    expect(key).toBe(customFilename);

    const readStream = await storage.read(customFilename);

    return new Promise<void>(done => {
      let buffer = Buffer.from([]);

      readStream.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
      });

      readStream.on('end', async () => {
        await storage.remove(customFilename);

        expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);
        expect(readStreamMock).toHaveBeenCalledTimes(1);
        expect(deleteMock).toHaveBeenCalledTimes(1);

        done();
      });
    });
  });

  it('should catch gcs error', async () => {
    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    expect(() => storage.read(GENERAL_ERROR_FILE, { format: 'buffer' })).rejects.toThrow();
  });

  it('should throw on file not found', async () => {
    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    await expect(storage.read(NOT_FOUND_FILE, { format: 'buffer' })).rejects.toThrow();

    expect(downloadMock).toHaveBeenCalledTimes(1);
  });

  it('should get read url', async () => {
    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    const url = await storage.url('saved-file');

    expect(url).toBe(FAKE_URL);
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
  });

  it('should remove file', async () => {
    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    const { key } = await storage.write(sampleFileBuffer);

    expect(fakeStorage.get(sampleFileSha256)).toBe(sampleFileBuffer);

    await storage.remove(key);

    expect(fakeStorage.has(sampleFileSha256)).toBeFalsy();
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('should read file in buffer', async () => {
    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    const buffer = await storage.read('saved-file', { format: 'buffer' });

    expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);
    expect(downloadMock).toHaveBeenCalledTimes(1);
  });

  it('should read file in stream', async () => {
    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    const stream = await storage.read('saved-file');

    return new Promise<void>(done => {
      let buffer = Buffer.from([]);

      stream.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
      });

      stream.on('end', () => {
        expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);
        expect(readStreamMock).toHaveBeenCalledTimes(1);

        done();
      });
    });
  });

  it('should write stream file', async () => {
    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    const stream = createReadStream(sampleFile);

    const { key } = await storage.write(stream);

    const uploadedFile = await storage.read(key, { format: 'buffer' });

    expect(Buffer.compare(uploadedFile, sampleFileBuffer)).toBe(0);
    expect(writeStreamMock).toHaveBeenCalledTimes(1);
    expect(downloadMock).toHaveBeenCalledTimes(1);
    expect(moveMock).toHaveBeenCalledTimes(1);
  });

  it('should write buffer file', async () => {
    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    const { key } = await storage.write(sampleFileBuffer);
    const uploadedFile = await storage.read(key, { format: 'buffer' });

    expect(Buffer.compare(uploadedFile, sampleFileBuffer)).toBe(0);
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(downloadMock).toHaveBeenCalledTimes(1);
  });

  it('should batch write buffer file', async () => {
    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    const buffer1 = Buffer.from([0x01]);
    const buffer2 = Buffer.from([0x02]);

    const [buffer1Hash] = await storage.getBufferFilename(buffer1);
    const [buffer2Hash] = await storage.getBufferFilename(buffer2);

    const [{ key: key1 }, { key: key2 }] = await storage.batchWrite([buffer1, buffer2]);

    expect(key1).toBe(buffer1Hash);
    expect(key2).toBe(buffer2Hash);
    expect(saveMock).toHaveBeenCalledTimes(2);
  });

  it('should write buffer file with content type', async () => {
    const originSaveMock = saveMock;

    saveMock = jest.fn((filename: string) => (buffer: Buffer, options: Record<string, string>) => {
      expect(options.contentType).toBe('image/png');

      return fakeStorage.set(filename, buffer);
    });

    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    await storage.write(sampleFileBuffer, { contentType: 'image/png' });

    expect(saveMock).toHaveBeenCalledTimes(1);

    saveMock = originSaveMock;
  });

  it('should write stream file with content type', async () => {
    const originWriteStreamMock = writeStreamMock;

    writeStreamMock = jest.fn((filename: string) => (options: Record<string, string>) => {
      expect(options.contentType).toBe('image/png');

      const stream = new Writable();

      let buffer = Buffer.from([]);

      stream._write = (chunk: Buffer, encoding, done) => {
        buffer = Buffer.concat([buffer, chunk]);

        done();
      };

      stream.on('finish', () => {
        fakeStorage.set(filename, buffer);
      });

      return stream;
    });

    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    const stream = createReadStream(sampleFile);

    await storage.write(stream, { contentType: 'image/png' });

    const stream2 = createReadStream(sampleFile);

    await storage.write(stream2, {
      filename: 'target.png',
      contentType: 'image/png',
    });

    expect(writeStreamMock).toHaveBeenCalledTimes(2);

    writeStreamMock = originWriteStreamMock;
  });

  it('should check file exists', async () => {
    const { StorageGCSService } = await import('../src');

    const storage = new StorageGCSService({
      projectId: PROJECT_ID,
      credentials: {
        client_email: CLIENT_EMAIL,
        private_key: CLIENT_SECRET,
      },
      bucket: BUCKET,
    });

    const notFound = await storage.isExists(NOT_FOUND_FILE);
    const exists = await storage.isExists('saved-file');

    expect(notFound).toBeFalsy();
    expect(exists).toBeTruthy();
  });
});
