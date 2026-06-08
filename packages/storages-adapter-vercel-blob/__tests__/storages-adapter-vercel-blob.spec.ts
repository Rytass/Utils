/**
 * @jest-environment node
 */

import { resolve } from 'path';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { createReadStream, readFileSync } from 'fs';

const TOKEN = 'test-blob-read-write-token';
const PATH_PREFIX = 'test-uploads';
const FAKE_BLOB_BASE = 'https://blob.vercel-storage.com';

const sampleFile = resolve(__dirname, '../__fixtures__/test-image.png');
const sampleFileBuffer = readFileSync(sampleFile);
const sampleFileSha256 = `${createHash('sha256').update(sampleFileBuffer).digest('hex')}.png`;

const fakeStorage = new Map<string, { buffer: Buffer; url: string; pathname: string; contentType?: string }>();

const mockPut = jest
  .fn()
  .mockImplementation(
    (
      pathname: string,
      body: Buffer,
      options: { contentType?: string },
    ): Promise<{ pathname: string; url: string; contentType: string; downloadUrl: string; etag: string }> => {
      const url = `${FAKE_BLOB_BASE}/${pathname}`;

      fakeStorage.set(pathname, {
        buffer: body,
        url,
        pathname,
        contentType: options?.contentType,
      });

      return Promise.resolve({
        pathname,
        url,
        contentType: options?.contentType ?? 'application/octet-stream',
        downloadUrl: url,
        etag: 'mock-etag',
      });
    },
  );

const mockDel = jest.fn().mockImplementation((urlOrPathname: string): Promise<void> => {
  for (const [key, value] of fakeStorage.entries()) {
    if (value.url === urlOrPathname || key === urlOrPathname) {
      fakeStorage.delete(key);
      break;
    }
  }

  return Promise.resolve();
});

const mockHead = jest
  .fn()
  .mockImplementation((urlOrPathname: string): Promise<{ size: number; contentType: string }> => {
    for (const [key, value] of fakeStorage.entries()) {
      if (value.url === urlOrPathname || key === urlOrPathname) {
        return Promise.resolve({
          size: value.buffer.length,
          contentType: value.contentType ?? 'application/octet-stream',
        });
      }
    }

    return Promise.reject(new Error('Not found'));
  });

const mockList = jest
  .fn()
  .mockImplementation((options: { prefix?: string }): Promise<{ blobs: Array<{ pathname: string; url: string }> }> => {
    const prefix = options?.prefix ?? '';

    const blobs = Array.from(fakeStorage.values())
      .filter(entry => entry.pathname.startsWith(prefix))
      .map(entry => ({ pathname: entry.pathname, url: entry.url }));

    return Promise.resolve({ blobs });
  });

const mockIssueSignedToken = jest.fn().mockImplementation(
  (options: {
    pathname: string;
    validUntil: number;
  }): Promise<{ delegationToken: string; clientSigningToken: string; validUntil: number }> =>
    Promise.resolve({
      delegationToken: `delegation-${options.pathname}`,
      clientSigningToken: `signing-${options.pathname}`,
      validUntil: options.validUntil,
    }),
);

const mockPresignUrl = jest.fn().mockImplementation(
  (_signedToken: unknown, options: { pathname: string }): Promise<{ presignedUrl: string }> =>
    Promise.resolve({
      presignedUrl: `${FAKE_BLOB_BASE}/${options.pathname}?signed=true`,
    }),
);

jest.mock('@vercel/blob', () => ({
  put: mockPut,
  del: mockDel,
  head: mockHead,
  list: mockList,
  issueSignedToken: mockIssueSignedToken,
  presignUrl: mockPresignUrl,
}));

describe('Vercel Blob storage adapter', () => {
  beforeEach(() => {
    fakeStorage.clear();
    mockPut.mockClear();
    mockDel.mockClear();
    mockHead.mockClear();
    mockList.mockClear();
    mockIssueSignedToken.mockClear();
    mockPresignUrl.mockClear();

    // Pre-load a saved file
    const savedPathname = `${PATH_PREFIX}/saved-file.png`;

    fakeStorage.set(savedPathname, {
      buffer: sampleFileBuffer,
      url: `${FAKE_BLOB_BASE}/${savedPathname}`,
      pathname: savedPathname,
      contentType: 'image/png',
    });
  });

  it('should write buffer file with auto-generated hash filename', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const { key } = await service.write(sampleFileBuffer);

    expect(key).toBe(sampleFileSha256);
    expect(mockPut).toHaveBeenCalledWith(
      `${PATH_PREFIX}/${sampleFileSha256}`,
      sampleFileBuffer,
      expect.objectContaining({
        access: 'public',
        token: TOKEN,
        addRandomSuffix: false,
      }),
    );
  });

  it('should use custom filename when write buffer file', async () => {
    const customFilename = 'custom-image.png';
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const { key } = await service.write(sampleFileBuffer, { filename: customFilename });

    expect(key).toBe(customFilename);
    expect(mockPut).toHaveBeenCalledWith(
      `${PATH_PREFIX}/${customFilename}`,
      sampleFileBuffer,
      expect.objectContaining({
        access: 'public',
        token: TOKEN,
        addRandomSuffix: false,
      }),
    );
  });

  it('should write buffer file with content type', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    await service.write(sampleFileBuffer, { contentType: 'image/png' });

    expect(mockPut).toHaveBeenCalledWith(
      expect.any(String),
      sampleFileBuffer,
      expect.objectContaining({
        contentType: 'image/png',
      }),
    );
  });

  it('should write stream file with auto-generated hash filename', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const stream = createReadStream(sampleFile);

    const { key } = await service.write(stream);

    expect(key).toBe(sampleFileSha256);
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it('should use custom filename when write stream file', async () => {
    const customFilename = 'stream-custom.png';
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const stream = createReadStream(sampleFile);

    const { key } = await service.write(stream, { filename: customFilename });

    expect(key).toBe(customFilename);
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it('should write stream file with content type', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const stream = createReadStream(sampleFile);

    await service.write(stream, { contentType: 'image/png' });

    expect(mockPut).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      expect.objectContaining({
        contentType: 'image/png',
      }),
    );
  });

  it('should batch write buffer files', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const buffer1 = Buffer.from([0x01]);
    const buffer2 = Buffer.from([0x02]);

    const [buffer1Hash] = await service.getBufferFilename(buffer1);
    const [buffer2Hash] = await service.getBufferFilename(buffer2);

    const [{ key: key1 }, { key: key2 }] = await service.batchWrite([buffer1, buffer2]);

    expect(key1).toBe(buffer1Hash);
    expect(key2).toBe(buffer2Hash);
    expect(mockPut).toHaveBeenCalledTimes(2);
  });

  it('should read file as buffer', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(sampleFileBuffer, { status: 200 }));

    const buffer = await service.read('saved-file.png', { format: 'buffer' });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);

    fetchSpy.mockRestore();
  });

  it('should read file as stream', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const mockBody = new ReadableStream({
      start(controller): void {
        controller.enqueue(sampleFileBuffer);
        controller.close();
      },
    });

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(mockBody, { status: 200 }));

    const stream = await service.read('saved-file.png');

    expect(stream).toBeInstanceOf(Readable);

    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }

    const resultBuffer = Buffer.concat(chunks);

    expect(Buffer.compare(resultBuffer, sampleFileBuffer)).toBe(0);

    fetchSpy.mockRestore();
  });

  it('should throw StorageError when read file not found', async () => {
    const { StorageVercelBlobService } = await import('../src');
    const { StorageError } = await import('@rytass/storages');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    await expect(service.read('nonexistent-file')).rejects.toThrow(StorageError);
  });

  it('should throw on fetch failure', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

    await expect(service.read('saved-file.png', { format: 'buffer' })).rejects.toThrow('Failed to read file');

    fetchSpy.mockRestore();
  });

  it('should throw on empty response body', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200, headers: { 'Content-Length': '0' } }));

    // Force body to be null by accessing stream mode
    await expect(service.read('saved-file.png')).rejects.toThrow('Empty response body');

    fetchSpy.mockRestore();
  });

  it('should get file url from list API', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const url = await service.url('saved-file.png');

    expect(url).toBe(`${FAKE_BLOB_BASE}/${PATH_PREFIX}/saved-file.png`);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({
        token: TOKEN,
        prefix: `${PATH_PREFIX}/`,
        limit: 1000,
      }),
    );
  });

  it('should return cached url on second call', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    await service.url('saved-file.png');
    const url = await service.url('saved-file.png');

    expect(url).toBe(`${FAKE_BLOB_BASE}/${PATH_PREFIX}/saved-file.png`);
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it('should throw StorageError when url file not found', async () => {
    const { StorageVercelBlobService } = await import('../src');
    const { StorageError } = await import('@rytass/storages');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    await expect(service.url('nonexistent')).rejects.toThrow(StorageError);
  });

  it('should remove file and clear cache', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    await service.remove('saved-file.png');

    expect(mockDel).toHaveBeenCalledWith(`${PATH_PREFIX}/saved-file.png`, { token: TOKEN });

    // Cache should be cleared — next url() call should query list() again
    await expect(service.url('saved-file.png')).rejects.toThrow();
  });

  it('should check file exists', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const exists = await service.isExists('saved-file.png');
    const notExists = await service.isExists('nonexistent-file');

    expect(exists).toBe(true);
    expect(notExists).toBe(false);
  });

  it('should skip upload when buffer file already exists (deduplication)', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    // First write — should upload
    const { key: key1 } = await service.write(sampleFileBuffer);

    expect(mockPut).toHaveBeenCalledTimes(1);

    // Second write with same content — should skip upload
    const { key: key2 } = await service.write(sampleFileBuffer);

    expect(key1).toBe(key2);
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it('should skip upload when stream file with existing filename', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
    });

    const stream = Readable.from([sampleFileBuffer]);

    const { key } = await service.write(stream, { filename: 'saved-file.png' });

    expect(key).toBe('saved-file.png');
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('should throw when no token is provided', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const originalEnv = process.env.BLOB_READ_WRITE_TOKEN;

    delete process.env.BLOB_READ_WRITE_TOKEN;

    expect(() => new StorageVercelBlobService({})).toThrow('Vercel Blob token is required');

    process.env.BLOB_READ_WRITE_TOKEN = originalEnv;
  });

  it('should use default path prefix when not specified', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({ token: TOKEN });

    // Pre-load a file with default prefix
    const defaultPathname = `uploads/${sampleFileSha256}`;

    fakeStorage.set(defaultPathname, {
      buffer: sampleFileBuffer,
      url: `${FAKE_BLOB_BASE}/${defaultPathname}`,
      pathname: defaultPathname,
      contentType: 'image/png',
    });

    await service.write(sampleFileBuffer);

    expect(mockPut).not.toHaveBeenCalled(); // File exists with default prefix, so dedup skips upload
  });
});

describe('Vercel Blob storage adapter (private access)', () => {
  beforeEach(() => {
    fakeStorage.clear();
    mockPut.mockClear();
    mockDel.mockClear();
    mockHead.mockClear();
    mockList.mockClear();
    mockIssueSignedToken.mockClear();
    mockPresignUrl.mockClear();

    const savedPathname = `${PATH_PREFIX}/saved-file.png`;

    fakeStorage.set(savedPathname, {
      buffer: sampleFileBuffer,
      url: `${FAKE_BLOB_BASE}/${savedPathname}`,
      pathname: savedPathname,
      contentType: 'image/png',
    });
  });

  it('should upload with private access', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
      access: 'private',
    });

    await service.write(sampleFileBuffer, { filename: 'private-file.png' });

    expect(mockPut).toHaveBeenCalledWith(
      `${PATH_PREFIX}/private-file.png`,
      sampleFileBuffer,
      expect.objectContaining({
        access: 'private',
        token: TOKEN,
        addRandomSuffix: false,
      }),
    );
  });

  it('should return a presigned url for private blobs', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
      access: 'private',
    });

    const url = await service.url('saved-file.png');

    expect(url).toBe(`${FAKE_BLOB_BASE}/${PATH_PREFIX}/saved-file.png?signed=true`);
    expect(mockList).not.toHaveBeenCalled();
    expect(mockIssueSignedToken).toHaveBeenCalledWith(
      expect.objectContaining({
        token: TOKEN,
        pathname: `${PATH_PREFIX}/saved-file.png`,
        operations: ['get'],
      }),
    );

    expect(mockPresignUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        access: 'private',
        operation: 'get',
        pathname: `${PATH_PREFIX}/saved-file.png`,
      }),
    );
  });

  it('should reuse a cached presigned url before it nears expiry', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
      access: 'private',
    });

    await service.url('saved-file.png');
    await service.url('saved-file.png');

    expect(mockIssueSignedToken).toHaveBeenCalledTimes(1);
    expect(mockPresignUrl).toHaveBeenCalledTimes(1);
  });

  it('should re-issue a presigned url once it is close to expiry', async () => {
    const { StorageVercelBlobService } = await import('../src');

    // 10s lifetime → 1s refresh threshold (10%). Advancing the clock past 90%
    // of the lifetime should drop the cached url below the threshold and trigger
    // a re-issue on the next url() call.
    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
      access: 'private',
      signedUrlExpiresIn: 10,
    });

    jest.useFakeTimers();

    try {
      await service.url('saved-file.png');

      expect(mockIssueSignedToken).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(9_500); // 0.5s remaining < 1s threshold

      await service.url('saved-file.png');

      expect(mockIssueSignedToken).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should respect a custom signed url lifetime', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
      access: 'private',
      signedUrlExpiresIn: 900,
    });

    const before = Date.now();

    await service.url('saved-file.png');

    const { validUntil } = mockIssueSignedToken.mock.calls[0][0] as { validUntil: number };

    expect(validUntil).toBeGreaterThanOrEqual(before + 900 * 1000);
    expect(validUntil).toBeLessThanOrEqual(Date.now() + 900 * 1000);
  });

  it('should read a private blob through its presigned url', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
      access: 'private',
    });

    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(sampleFileBuffer, { status: 200 }));

    const buffer = await service.read('saved-file.png', { format: 'buffer' });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(Buffer.compare(buffer, sampleFileBuffer)).toBe(0);
    expect(fetchSpy).toHaveBeenCalledWith(`${FAKE_BLOB_BASE}/${PATH_PREFIX}/saved-file.png?signed=true`);

    fetchSpy.mockRestore();
  });

  it('should check existence via pathname for private blobs', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
      access: 'private',
    });

    const exists = await service.isExists('saved-file.png');
    const notExists = await service.isExists('nonexistent-file');

    expect(exists).toBe(true);
    expect(notExists).toBe(false);
    expect(mockHead).toHaveBeenCalledWith(`${PATH_PREFIX}/saved-file.png`, { token: TOKEN });
  });

  it('should clear the presigned url cache on remove', async () => {
    const { StorageVercelBlobService } = await import('../src');

    const service = new StorageVercelBlobService({
      token: TOKEN,
      pathPrefix: PATH_PREFIX,
      access: 'private',
    });

    await service.url('saved-file.png');

    expect(mockIssueSignedToken).toHaveBeenCalledTimes(1);

    await service.remove('saved-file.png');

    expect(mockDel).toHaveBeenCalledWith(`${PATH_PREFIX}/saved-file.png`, { token: TOKEN });

    // Re-issuing after removal proves the cache entry was dropped.
    await service.url('saved-file.png');

    expect(mockIssueSignedToken).toHaveBeenCalledTimes(2);
  });
});
