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
import { put, del, head, list } from '@vercel/blob';
import { Readable, PassThrough } from 'stream';
import { StorageVercelBlobOptions } from './typings';

export class StorageVercelBlobService extends Storage<StorageVercelBlobOptions> {
  private readonly token: string;

  private readonly pathPrefix: string;

  private readonly access: 'public';

  private readonly keyUrlCache = new Map<string, string>();

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
  }

  async url(key: string): Promise<string> {
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

    const pathname = `${this.pathPrefix}/${filename}`;

    const result = await put(pathname, buffer, {
      access: this.access,
      token: this.token,
      contentType: options?.contentType ?? mime,
      addRandomSuffix: false,
    });

    this.keyUrlCache.set(filename, result.url);

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
      const pathname = `${this.pathPrefix}/${givenFilename}`;

      const result = await put(pathname, buffer, {
        access: this.access,
        token: this.token,
        contentType: options.contentType,
        addRandomSuffix: false,
      });

      this.keyUrlCache.set(givenFilename, result.url);

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
    const pathname = `${this.pathPrefix}/${filename}`;

    const result = await put(pathname, buffer, {
      access: this.access,
      token: this.token,
      contentType: options?.contentType ?? mime,
      addRandomSuffix: false,
    });

    this.keyUrlCache.set(filename, result.url);

    return { key: filename };
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
    const fileUrl = await this.url(key);

    await del(fileUrl, { token: this.token });

    this.keyUrlCache.delete(key);
  }

  async isExists(key: string): Promise<boolean> {
    try {
      const fileUrl = await this.url(key);

      await head(fileUrl, { token: this.token });

      return true;
    } catch {
      return false;
    }
  }
}
