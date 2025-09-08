/**
 * @jest-environment node
 */

import { resolve } from 'path';
import { Readable } from 'stream';
import { readFileSync, createReadStream } from 'fs';
import { createHash } from 'crypto';
import { BlockBlobUploadOptions, BlockBlobUploadStreamOptions, StorageSharedKeyCredential } from '@azure/storage-blob';

interface AzureBlobDownloadResponse {
  blobBody: Promise<{
    arrayBuffer: () => Promise<ArrayBuffer>;
  }>;
  readableStreamBody?: Readable;
}

interface MockBlobServiceClient {
  getContainerClient: (containerName: string) => unknown;
}


interface MockSASQueryParameters {
  toString: () => string;
}

const sampleFile = resolve(__dirname, '../__fixtures__/test-image.png');
const sampleFileBuffer = readFileSync(sampleFile);
const sampleFileSha256 = `${createHash('sha256').update(sampleFileBuffer).digest('hex')}.png`;

const CONNECTION_STRING =
  'DefaultEndpointsProtocol=https;AccountName=rytass;AccountKey=KubDKwt3J3WHFu1e6QsCy1QjX/wCLWnMj02L/hhspuMIv+ifqR52xNB5mcKbsa4CD5H57AkPhdSjXWe5x+Vygg==;EndpointSuffix=core.windows.net';

const CONTAINER_NAME = 'files';
const FAKE_URL = 'https://fake.rytass.com';
const NOT_FOUND_FILE = 'NOT_EXIST';
const GENERAL_ERROR_FILE = 'GENERAL_ERROR_FILE';

const fakeStorage = new Map<string, Buffer>();

const getBlobClientMock = jest.fn((_filename: string) => ({
  url: FAKE_URL,
  credential: {} as StorageSharedKeyCredential,
}));

const downloadMock = jest.fn(
  (filename: string) => (): Promise<AzureBlobDownloadResponse> =>
    Promise.resolve({
      blobBody: Promise.resolve({
        arrayBuffer: () =>
          new Promise(resolve => {
            if (filename === GENERAL_ERROR_FILE) {
              throw new Error('Unknown Error');
            }

            if (filename === NOT_FOUND_FILE) {
              throw new Error('The specified blob does not exist');
            }

            const arrayBuffer = new ArrayBuffer(sampleFileBuffer.length);
            const view = new Uint8Array(arrayBuffer);

            Array.from(Array(sampleFileBuffer.length)).forEach((_, index) => {
              view[index] = sampleFileBuffer[index];
            });

            resolve(view as Buffer);
          }),
      }),
      readableStreamBody: createReadStream(sampleFile),
    }),
);

let uploadStreamMock = jest.fn(
  (filename: string) =>
    (
      stream: Readable,
      _bufferSize?: number,
      _maxConcurrency?: number,
      _options?: BlockBlobUploadStreamOptions,
    ): Promise<void> =>
      new Promise<void>(resolve => {
        let buffer = Buffer.from([]);

        stream.on('data', chunk => {
          buffer = Buffer.concat([buffer, chunk]);
        });

        stream.on('end', () => {
          fakeStorage.set(filename, buffer);

          resolve();
        });
      }),
);

const setHTTPHeadersMock = jest.fn(() => Promise.resolve());
const beginCopyFromURLMock = jest.fn(() => Promise.resolve());
const deleteMock = jest.fn(() => Promise.resolve());

let uploadMock = jest.fn((buffer: Buffer, _length: number, _options: BlockBlobUploadOptions) => {
  fakeStorage.set(`${createHash('sha256').update(buffer).digest('hex')}.png`, buffer);

  return Promise.resolve();
});

const deleteBlobMock = jest.fn(filename => {
  fakeStorage.delete(filename);

  return Promise.resolve();
});

const existsMock = jest.fn((filename: string) => (): Promise<boolean> => Promise.resolve(filename !== NOT_FOUND_FILE));

const getBlockBlobClientMock = jest.fn((filename: string) => ({
  download: downloadMock(filename),
  uploadStream: uploadStreamMock(filename),
  setHTTPHeaders: setHTTPHeadersMock,
  beginCopyFromURL: beginCopyFromURLMock,
  delete: deleteMock,
  upload: uploadMock,
  exists: existsMock(filename),
}));

const containerClientMock = jest.fn((_container: string) => ({
  getBlobClient: getBlobClientMock,
  getBlockBlobClient: getBlockBlobClientMock,
  deleteBlob: deleteBlobMock,
}));

class MockBlobSASPermissions {
  public read = false;
}

describe('Azure Blob adapter', () => {
  beforeAll(() => {
    jest.mock('@azure/storage-blob', () => ({
      BlobSASPermissions: MockBlobSASPermissions,
      BlobServiceClient: {
        fromConnectionString: (_connectionString: string): MockBlobServiceClient => ({
          getContainerClient: containerClientMock,
        }),
      },
      generateBlobSASQueryParameters: (): MockSASQueryParameters => ({
        toString: (): string => 'a=1',
      }),
    }));
  });

  beforeEach(() => {
    fakeStorage.set('saved-file', sampleFileBuffer);
  });

  afterEach(() => {
    containerClientMock.mockClear();
    downloadMock.mockClear();
    deleteMock.mockClear();
    getBlockBlobClientMock.mockClear();
    uploadStreamMock.mockClear();
    setHTTPHeadersMock.mockClear();
    beginCopyFromURLMock.mockClear();
    uploadMock.mockClear();
    deleteBlobMock.mockClear();
    existsMock.mockClear();
    getBlobClientMock.mockClear();

    fakeStorage.clear();
  });

  it('should use custom filename when write buffer file', async () => {
    const customFilename = 'aaa.png';

    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
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
    expect(containerClientMock).toHaveBeenCalledTimes(1);
    expect(downloadMock).toHaveBeenCalledTimes(2);
    expect(deleteBlobMock).toHaveBeenCalledTimes(1);
  });

  it('should use custom filename when write stream file', async () => {
    const customFilename = 'bbb.png';

    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
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
        expect(downloadMock).toHaveBeenCalledTimes(2);
        expect(deleteBlobMock).toHaveBeenCalledTimes(1);

        done();
      });
    });
  });

  it('should catch gcs error', async () => {
    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    expect(() => storage.read(GENERAL_ERROR_FILE, { format: 'buffer' })).rejects.toThrow();
  });

  it('should throw on file not found', async () => {
    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    await expect(storage.read(NOT_FOUND_FILE, { format: 'buffer' })).rejects.toThrow();

    expect(downloadMock).toHaveBeenCalledTimes(1);
  });

  it('should get read url', async () => {
    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    const url = await storage.url('saved-file');

    expect(url).toBe(`${FAKE_URL}?a=1`);
    expect(getBlobClientMock).toHaveBeenCalledTimes(1);
  });

  it('should remove file', async () => {
    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    const { key } = await storage.write(sampleFileBuffer);

    expect(fakeStorage.get(sampleFileSha256)).toBe(sampleFileBuffer);

    await storage.remove(key);

    expect(fakeStorage.has(sampleFileSha256)).toBeFalsy();
    expect(deleteBlobMock).toHaveBeenCalledTimes(1);
  });

  it('should read file in buffer', async () => {
    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    const buffer = await storage.read('saved-file', { format: 'buffer' });

    expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);
    expect(downloadMock).toHaveBeenCalledTimes(1);
  });

  it('should read file in stream', async () => {
    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    const stream = await storage.read('saved-file');

    return new Promise<void>(done => {
      let buffer = Buffer.from([]);

      stream.on('data', chunk => {
        buffer = Buffer.concat([buffer, chunk]);
      });

      stream.on('end', () => {
        expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);
        expect(downloadMock).toHaveBeenCalledTimes(1);

        done();
      });
    });
  });

  it('should write stream file', async () => {
    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    const stream = createReadStream(sampleFile);

    const { key } = await storage.write(stream);

    const uploadedFile = await storage.read(key, { format: 'buffer' });

    expect(Buffer.compare(uploadedFile, sampleFileBuffer)).toBe(0);
    expect(getBlockBlobClientMock).toHaveBeenCalledTimes(3);
    expect(downloadMock).toHaveBeenCalledTimes(3);
    expect(uploadStreamMock).toHaveBeenCalledTimes(3);
  });

  it('should write buffer file', async () => {
    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    const { key } = await storage.write(sampleFileBuffer);
    const uploadedFile = await storage.read(key, { format: 'buffer' });

    expect(Buffer.compare(uploadedFile, sampleFileBuffer)).toBe(0);
    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(downloadMock).toHaveBeenCalledTimes(2);
  });

  it('should batch write buffer file', async () => {
    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    const buffer1 = Buffer.from([0x01]);
    const buffer2 = Buffer.from([0x02]);

    const [buffer1Hash] = await storage.getBufferFilename(buffer1);
    const [buffer2Hash] = await storage.getBufferFilename(buffer2);

    const [{ key: key1 }, { key: key2 }] = await storage.batchWrite([buffer1, buffer2]);

    expect(key1).toBe(buffer1Hash);
    expect(key2).toBe(buffer2Hash);
    expect(uploadMock).toHaveBeenCalledTimes(2);
  });

  it('should write buffer file with content type', async () => {
    const originUploadMock = uploadMock;

    uploadMock = jest.fn((buffer: Buffer, _length: number, options: BlockBlobUploadOptions) => {
      expect(options?.blobHTTPHeaders?.blobContentType).toBe('image/png');

      fakeStorage.set(
        options?.blobHTTPHeaders?.blobContentType ?? `${createHash('sha256').update(buffer).digest('hex')}.png`,
        buffer,
      );

      return Promise.resolve();
    });

    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    await storage.write(sampleFileBuffer, { contentType: 'image/png' });

    expect(uploadMock).toHaveBeenCalledTimes(1);

    uploadMock = originUploadMock;
  });

  it('should write stream file with content type', async () => {
    const originUploadStreamMock = uploadStreamMock;

    uploadStreamMock = jest.fn(
      (filename: string) =>
        (
          stream: Readable,
          _bufferSize?: number,
          _maxConcurrency?: number,
          options?: BlockBlobUploadStreamOptions,
        ): Promise<void> =>
          new Promise<void>(resolve => {
            expect(options?.blobHTTPHeaders?.blobContentType).toBe('image/png');

            let buffer = Buffer.from([]);

            stream.on('data', chunk => {
              buffer = Buffer.concat([buffer, chunk]);
            });

            stream.on('end', () => {
              fakeStorage.set(filename, buffer);

              resolve();
            });
          }),
    );

    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    const stream = createReadStream(sampleFile);

    await storage.write(stream, { contentType: 'image/png' });

    const stream2 = createReadStream(sampleFile);

    await storage.write(stream2, {
      filename: 'target.png',
      contentType: 'image/png',
    });

    expect(uploadStreamMock).toHaveBeenCalledTimes(3);

    uploadStreamMock = originUploadStreamMock;
  });

  it('should check file exists', async () => {
    const { StorageAzureBlobService } = await import('../src/storages-adapter-azure-blob');

    const storage = new StorageAzureBlobService({
      connectionString: CONNECTION_STRING,
      container: CONTAINER_NAME,
    });

    const notFound = await storage.isExists(NOT_FOUND_FILE);
    const exists = await storage.isExists('saved-file');

    expect(notFound).toBeFalsy();
    expect(exists).toBeTruthy();
  });
});
