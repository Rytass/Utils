import {
  StorageError,
  ErrorCode,
  Storage,
  ReadBufferFileOptions,
  ReadStreamFileOptions,
  InputFile,
  StorageFile,
  WriteFileOptions,
} from '@rytass/storages';
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
      ...(options.credentials ? { credentials: options.credentials } : {}),
    });

    this.bucket = this.storage.bucket(options.bucket);
  }

  async url(key: string, expires = Date.now() + 1000 * 60 * 60 * 24): Promise<string> {
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
    } catch (ex: unknown) {
      if (
        ex &&
        typeof ex === 'object' &&
        'message' in ex &&
        /No such object/.test((ex as { message: string }).message)
      ) {
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

      return new Promise(resolve => {
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

    const [[filename, mime]] = await Promise.all([
      getFilenamePromise,
      new Promise(resolve => {
        writeStream.on('finish', resolve);
      }),
    ]);

    if (!options?.contentType && mime) {
      await tempFile.setMetadata({ contentType: mime });
    }

    await tempFile.move(filename);

    return { key: filename };
  }

  private async writeBufferFile(buffer: Buffer, options?: WriteFileOptions): Promise<StorageFile> {
    const fileInfo = options?.filename || (await this.getBufferFilename(buffer));

    const filename = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;

    const file = this.bucket.file(filename);

    await file.save(buffer, {
      gzip: 'auto',
      ...(Array.isArray(fileInfo) && fileInfo[1] ? { contentType: fileInfo[1] } : {}),
      ...(options?.contentType ? { contentType: options?.contentType } : {}),
    });

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
    await this.bucket.file(key).delete();
  }

  async isExists(filename: string): Promise<boolean> {
    const file = this.bucket.file(filename);

    const [exists] = await file.exists();

    return exists;
  }
}
