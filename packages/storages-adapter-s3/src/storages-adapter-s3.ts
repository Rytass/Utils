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
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PassThrough, Readable } from 'stream';
import { v4 as uuid } from 'uuid';
import { StorageS3Options } from './typings';

export class StorageS3Service extends Storage<StorageS3Options> {
  private readonly bucket: string;

  private readonly client: S3Client;

  constructor(options: StorageS3Options) {
    super(options);

    this.bucket = options.bucket;

    this.client = new S3Client({
      endpoint: options.endpoint,
      credentials: {
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey,
      },
      region: options.region,
      forcePathStyle: true,
    });
  }

  async url(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command);
  }

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  async read(key: string, options?: ReadBufferFileOptions | ReadStreamFileOptions): Promise<Buffer | Readable> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new StorageError(ErrorCode.READ_FILE_ERROR, 'Empty response body');
      }

      // AWS SDK v3 returns a ReadableStream (web) or Readable (node)
      const bodyStream = response.Body as Readable;

      if (options?.format === 'buffer') {
        const chunks: Buffer[] = [];

        for await (const chunk of bodyStream) {
          chunks.push(Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
      }

      return bodyStream;
    } catch (ex: unknown) {
      if (ex && typeof ex === 'object' && 'name' in ex && (ex as { name: string }).name === 'NoSuchKey') {
        throw new StorageError(ErrorCode.READ_FILE_ERROR, 'File not found');
      }

      throw ex;
    }
  }

  private async writeStreamFile(stream: Readable, options?: WriteFileOptions): Promise<StorageFile> {
    const givenFilename = options?.filename;

    if (givenFilename) {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: givenFilename,
          Body: stream,
          ...(options?.contentType ? { ContentType: options?.contentType } : {}),
        },
      });

      await upload.done();

      return { key: givenFilename };
    }

    const tempFilename = uuid();
    const uploadStream = new PassThrough();

    const getFilenamePromise = this.getStreamFilename(stream);

    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: tempFilename,
        Body: uploadStream,
        ...(options?.contentType ? { ContentType: options?.contentType } : {}),
      },
    });

    stream.pipe(uploadStream);

    const [[filename, mime]] = await Promise.all([getFilenamePromise, upload.done()]);

    const copyCommand = new CopyObjectCommand({
      Bucket: this.bucket,
      CopySource: `/${this.bucket}/${tempFilename}`,
      Key: filename,
      ...(mime ? { ContentType: mime } : {}),
      ...(options?.contentType ? { ContentType: options?.contentType } : {}),
    });

    await this.client.send(copyCommand);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: tempFilename,
    });

    await this.client.send(deleteCommand);

    return { key: filename };
  }

  async writeBufferFile(buffer: Buffer, options?: WriteFileOptions): Promise<StorageFile> {
    const fileInfo = options?.filename || (await this.getBufferFilename(buffer));

    const filename = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;

    const upload = new Upload({
      client: this.client,
      params: {
        Key: filename,
        Bucket: this.bucket,
        Body: buffer,
        ...(Array.isArray(fileInfo) && fileInfo[1] ? { ContentType: fileInfo[1] } : {}),
        ...(options?.contentType ? { ContentType: options?.contentType } : {}),
      },
    });

    await upload.done();

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
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  async isExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);

      return true;
    } catch (ex: unknown) {
      if (ex && typeof ex === 'object' && 'name' in ex && (ex as { name: string }).name === 'NotFound') return false;

      throw ex;
    }
  }
}
