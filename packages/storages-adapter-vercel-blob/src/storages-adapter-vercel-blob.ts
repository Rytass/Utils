import {
  ErrorCode,
  InputFile,
  ReadBufferFileOptions,
  ReadStreamFileOptions,
  Storage,
  StorageError,
  StorageFile,
  WriteFileOptions,
} from '@rytass/storages';
import { BlobAccessType, put, del, head, list, issueSignedToken, presignUrl } from '@vercel/blob';
import { Readable, PassThrough } from 'stream';
import { StorageVercelBlobOptions } from './typings';

const DEFAULT_SIGNED_URL_EXPIRES_IN = 3600;

// Re-issue a presigned URL once its remaining lifetime drops below this fraction
// of the configured lifetime, so callers never receive an almost-expired URL.
const SIGNED_URL_REFRESH_THRESHOLD = 0.1;

interface CachedSignedUrl {
  url: string;
  expiresAt: number;
}

export class StorageVercelBlobService extends Storage<StorageVercelBlobOptions> {
  private readonly token: string;

  private readonly pathPrefix: string;

  private readonly access: BlobAccessType;

  private readonly signedUrlExpiresIn: number;

  // Permanent public URLs — safe to cache for the lifetime of the service.
  private readonly keyUrlCache = new Map<string, string>();

  // Presigned private URLs — expire, so cached together with their expiry timestamp.
  private readonly signedUrlCache = new Map<string, CachedSignedUrl>();

  constructor(options: StorageVercelBlobOptions) {
    super(options);

    const token = options.token ?? process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
      throw new StorageError(
        ErrorCode.UNRECOGNIZED_ERROR,
        'Vercel Blob token is required. Provide it via options.token or BLOB_READ_WRITE_TOKEN environment variable.',
      );
    }

    this.token = token;
    this.pathPrefix = options.pathPrefix ?? 'uploads';
    this.access = options.access ?? 'public';
    this.signedUrlExpiresIn = options.signedUrlExpiresIn ?? DEFAULT_SIGNED_URL_EXPIRES_IN;
  }

  private pathnameOf(key: string): string {
    return `${this.pathPrefix}/${key}`;
  }

  async url(key: string): Promise<string> {
    if (this.access === 'private') {
      return this.privateUrl(key);
    }

    return this.publicUrl(key);
  }

  private async publicUrl(key: string): Promise<string> {
    const cached = this.keyUrlCache.get(key);

    if (cached) {
      return cached;
    }

    const result = await list({
      token: this.token,
      prefix: `${this.pathPrefix}/`,
      limit: 1000,
    });

    const blob = result.blobs.find(b => b.pathname.endsWith(key));

    if (!blob) {
      throw new StorageError(ErrorCode.FILE_NOT_FOUND, `File not found: ${key}`);
    }

    this.keyUrlCache.set(key, blob.url);

    return blob.url;
  }

  private async issuePresignedUrl(key: string): Promise<CachedSignedUrl> {
    const pathname = this.pathnameOf(key);
    const validUntil = Date.now() + this.signedUrlExpiresIn * 1000;

    const signedToken = await issueSignedToken({
      token: this.token,
      pathname,
      operations: ['get'],
      validUntil,
    });

    const { presignedUrl } = await presignUrl(signedToken, {
      access: 'private',
      operation: 'get',
      pathname,
    });

    return { url: presignedUrl, expiresAt: signedToken.validUntil };
  }

  private async privateUrl(key: string): Promise<string> {
    const cached = this.signedUrlCache.get(key);
    const refreshBefore = this.signedUrlExpiresIn * 1000 * SIGNED_URL_REFRESH_THRESHOLD;

    if (cached && cached.expiresAt - Date.now() > refreshBefore) {
      return cached.url;
    }

    const fresh = await this.issuePresignedUrl(key);

    this.signedUrlCache.set(key, fresh);

    return fresh.url;
  }

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;

  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  async read(key: string, options?: ReadBufferFileOptions | ReadStreamFileOptions): Promise<Buffer | Readable> {
    const fileUrl = await this.url(key);

    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new StorageError(ErrorCode.READ_FILE_ERROR, `Failed to read file: ${key}`);
    }

    if (options?.format === 'buffer') {
      const arrayBuffer = await response.arrayBuffer();

      return Buffer.from(arrayBuffer);
    }

    const webStream = response.body;

    if (!webStream) {
      throw new StorageError(ErrorCode.READ_FILE_ERROR, `Empty response body for file: ${key}`);
    }

    return Readable.fromWeb(webStream as Parameters<typeof Readable.fromWeb>[0]);
  }

  private async writeBufferFile(buffer: Buffer, options?: WriteFileOptions): Promise<StorageFile> {
    const fileInfo = options?.filename ?? (await this.getBufferFilename(buffer));
    const filename = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;
    const mime = Array.isArray(fileInfo) ? fileInfo[1] : undefined;

    if (await this.isExists(filename)) {
      return { key: filename };
    }

    const pathname = this.pathnameOf(filename);

    const result = await put(pathname, buffer, {
      access: this.access,
      token: this.token,
      contentType: options?.contentType ?? mime,
      addRandomSuffix: false,
    });

    this.cacheWrittenUrl(filename, result.url);

    return { key: filename };
  }

  private async writeStreamFile(stream: Readable, options?: WriteFileOptions): Promise<StorageFile> {
    const givenFilename = options?.filename;

    if (givenFilename) {
      if (await this.isExists(givenFilename)) {
        for await (const _ of stream) {
          // drain stream to prevent memory leak
        }

        return { key: givenFilename };
      }

      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
      }

      const buffer = Buffer.concat(chunks);
      const pathname = this.pathnameOf(givenFilename);

      const result = await put(pathname, buffer, {
        access: this.access,
        token: this.token,
        contentType: options.contentType,
        addRandomSuffix: false,
      });

      this.cacheWrittenUrl(givenFilename, result.url);

      return { key: givenFilename };
    }

    const uploadStream = new PassThrough();
    const chunks: Buffer[] = [];

    uploadStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    const getFilenamePromise = this.getStreamFilename(stream);

    stream.pipe(uploadStream);

    const [filenameResult] = await Promise.all([
      getFilenamePromise,
      new Promise<void>(resolve => {
        uploadStream.on('end', resolve);
      }),
    ]);

    const [filename, mime] = filenameResult;

    if (await this.isExists(filename)) {
      return { key: filename };
    }

    const buffer = Buffer.concat(chunks);
    const pathname = this.pathnameOf(filename);

    const result = await put(pathname, buffer, {
      access: this.access,
      token: this.token,
      contentType: options?.contentType ?? mime,
      addRandomSuffix: false,
    });

    this.cacheWrittenUrl(filename, result.url);

    return { key: filename };
  }

  // The URL returned by `put` is only directly usable for public blobs. Private
  // blobs must be served through a freshly presigned URL, so we never cache the
  // raw private URL.
  private cacheWrittenUrl(key: string, url: string): void {
    if (this.access === 'public') {
      this.keyUrlCache.set(key, url);
    }
  }

  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    if (file instanceof Buffer) {
      return this.writeBufferFile(file, options);
    }

    return this.writeStreamFile(file as Readable, options);
  }

  batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    return Promise.all(files.map(file => this.write(file)));
  }

  async remove(key: string): Promise<void> {
    await del(this.pathnameOf(key), { token: this.token });

    this.keyUrlCache.delete(key);
    this.signedUrlCache.delete(key);
  }

  async isExists(key: string): Promise<boolean> {
    try {
      await head(this.pathnameOf(key), { token: this.token });

      return true;
    } catch {
      return false;
    }
  }
}
