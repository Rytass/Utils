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
import { Credentials, S3 } from 'aws-sdk';
import { Readable, PassThrough } from 'stream';
import { v4 as uuid } from 'uuid';
import { PresignedURLOptions, StorageR2Options } from './typings';

export class StorageR2Service extends Storage<StorageR2Options> {
  private readonly bucket: string;

  private readonly s3: S3;

  private readonly parseSignedURL: ((url: string) => string) | undefined;

  constructor(options: StorageR2Options) {
    super(options);

    this.bucket = options.bucket;

    if (options.customDomain) {
      const re = new RegExp(
        `^https://${options.bucket}.${options.account}.r2.cloudflarestorage.com`,
      );

      this.parseSignedURL = (url: string) => {
        return url.replace(re, options.customDomain as string);
      };
    }

    this.s3 = new S3({
      endpoint: `https://${options.account}.r2.cloudflarestorage.com`,
      credentials: new Credentials({
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey,
      }),
      region: 'auto',
      signatureVersion: 'v4',
    });
  }

  async url(key: string, options?: PresignedURLOptions): Promise<string> {
    const signedURL = await this.s3.getSignedUrlPromise('getObject', {
      Bucket: this.bucket,
      Key: key,
      ...(options?.expires ? { Expires: options?.expires } : {}),
    });

    if (this.parseSignedURL) {
      return this.parseSignedURL(signedURL);
    }

    return signedURL;
  }

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  async read(
    key: string,
    options?: ReadBufferFileOptions | ReadStreamFileOptions,
  ): Promise<Buffer | Readable> {
    try {
      const response = await this.s3
        .getObject({
          Bucket: this.bucket,
          Key: key,
        })
        .promise();

      if (options?.format === 'buffer') {
        return response.Body as Buffer;
      }

      return Readable.from(response.Body as Buffer);
    } catch (ex: any) {
      if (ex.name === 'NoSuchKey') {
        throw new StorageError(ErrorCode.READ_FILE_ERROR, 'File not found');
      }

      throw ex;
    }
  }

  private async writeStreamFile(
    stream: Readable,
    options?: WriteFileOptions,
  ): Promise<StorageFile> {
    const givenFilename = options?.filename;

    if (givenFilename) {
      const uploadPromise = await this.s3
        .upload({
          Bucket: this.bucket,
          Key: givenFilename,
          Body: stream,
          ...(options?.contentType
            ? { ContentType: options?.contentType }
            : {}),
        })
        .promise();

      return { key: givenFilename };
    }

    const tempFilename = uuid();
    const uploadStream = new PassThrough();

    const getFilenamePromise = this.getStreamFilename(stream);

    const uploadPromise = this.s3
      .upload({
        Bucket: this.bucket,
        Key: tempFilename,
        Body: uploadStream,
        ...(options?.contentType ? { ContentType: options?.contentType } : {}),
      })
      .promise();

    stream.pipe(uploadStream);

    const [[filename, mime]] = await Promise.all([
      getFilenamePromise,
      uploadPromise,
    ]);

    await this.s3
      .copyObject({
        Bucket: this.bucket,
        CopySource: `/${this.bucket}/${tempFilename}`,
        Key: filename,
        ...(mime ? { ContentType: mime } : {}),
        ...(options?.contentType ? { ContentType: options?.contentType } : {}),
      })
      .promise();

    await this.s3
      .deleteObject({
        Bucket: this.bucket,
        Key: tempFilename,
      })
      .promise();

    return { key: filename };
  }

  async writeBufferFile(
    buffer: Buffer,
    options?: WriteFileOptions,
  ): Promise<StorageFile> {
    const fileInfo =
      options?.filename || (await this.getBufferFilename(buffer));

    const filename = Array.isArray(fileInfo) ? fileInfo[0] : fileInfo;

    await this.s3
      .upload({
        Key: filename,
        Bucket: this.bucket,
        Body: buffer,
        ...(Array.isArray(fileInfo) && fileInfo[1]
          ? { ContentType: fileInfo[1] }
          : {}),
        ...(options?.contentType ? { ContentType: options?.contentType } : {}),
      })
      .promise();

    return { key: filename };
  }

  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    if (file instanceof Buffer) {
      return this.writeBufferFile(file, options);
    }

    return this.writeStreamFile(file as Readable, options);
  }

  batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    return Promise.all(files.map((file) => this.write(file)));
  }

  async remove(key: string): Promise<void> {
    await this.s3
      .deleteObject({
        Bucket: this.bucket,
        Key: key,
      })
      .promise();
  }

  async isExists(key: string): Promise<boolean> {
    try {
      await this.s3
        .headObject({
          Bucket: this.bucket,
          Key: key,
        })
        .promise();

      return true;
    } catch (ex: any) {
      if (ex.name === 'NotFound') return false;

      throw ex;
    }
  }
}
