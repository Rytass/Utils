import { StorageError, ErrorCode, Storage, ReadBufferFileOptions, ReadStreamFileOptions, InputFile, StorageFile, WriteFileOptions } from '@rytass/storages';
import { Readable, PassThrough } from 'stream';
import { v4 as uuid } from 'uuid';
import { Bucket, Storage as GCSStorage } from '@google-cloud/storage';
import { GCSOptions } from './typings';

export class StorageGCSService extends Storage<GCSOptions> {
  private readonly storage: GCSStorage;

  private readonly bucket: Bucket;

  constructor(options: GCSOptions) {
    super(options);

    this.storage = new GCSStorage({
      projectId: options.projectId,
      credentials: options.credentials,
    });

    this.bucket = this.storage.bucket(options.bucket);
  }

  async url(key: string, expires = 1000 * 60 * 60 * 24): Promise<string> {
    const file = this.bucket.file(key);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires,
    });

    return url;
  }

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  async read(key: string, options?: ReadBufferFileOptions | ReadStreamFileOptions): Promise<Buffer | Readable> {
    const file = this.bucket.file(key);

    try {
      if (options?.format === 'buffer') {
        const [buffer] = await file.download();

        return buffer;
      }

      return file.createReadStream();
    } catch (ex: any) {
      if (/No such object/.test(ex.message)) {
        throw new StorageError(ErrorCode.READ_FILE_ERROR, 'File not found');
      }

      throw ex;
    }
  }

  private async writeStreamFile(stream: Readable, options?: WriteFileOptions): Promise<StorageFile> {
    const givenFilename = options?.filename;

    if (givenFilename) {
      const file = this.bucket.file(givenFilename);

      const writeStream = file.createWriteStream({
        gzip: 'auto',
        ...(options?.contentType ? { contentType: options?.contentType } : {}),
      });

      stream.pipe(writeStream);

      return new Promise((resolve) => {
        writeStream.on('finish', () => {
          resolve({ key: givenFilename });
        });
      });
    }

    const tempFilename = uuid();
    const uploadStream = new PassThrough();

    const getFilenamePromise = this.getStreamFilename(stream);

    const tempFile = this.bucket.file(tempFilename);

    const writeStream = tempFile.createWriteStream({
      gzip: 'auto',
      ...(options?.contentType ? { contentType: options?.contentType } : {}),
    });

    stream.pipe(uploadStream).pipe(writeStream);

    const [filename] = await Promise.all([
      getFilenamePromise,
      new Promise((resolve) => {
        writeStream.on('finish', resolve);
      }),
    ]);

    await tempFile.move(filename);

    return { key: filename };
  }

  private async writeBufferFile(buffer: Buffer, options?: WriteFileOptions): Promise<StorageFile> {
    const filename = options?.filename || await this.getBufferFilename(buffer);

    const file = this.bucket.file(filename);

    await file.save(buffer, {
      gzip: 'auto',
      ...(options?.contentType ? { contentType: options?.contentType } : {}),
    });

    return { key: filename };
  }

  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    if (file instanceof Buffer) {
      return this.writeBufferFile(file, options);
    }

    return this.writeStreamFile(file, options);
  }

  batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    return Promise.all(files.map(file => this.write(file)));
  }

  async remove(key: string): Promise<void> {
    await this.bucket.file(key).delete();
  }
}
