import { StorageError, ErrorCode, Storage, ReadBufferFileOptions, ReadStreamFileOptions, InputFile, StorageFile, WriteFileOptions } from '@rytass/storages';
import { Credentials, S3 } from 'aws-sdk';
import { Readable, PassThrough } from 'stream';
import { v4 as uuid } from 'uuid';
import { StorageS3Options } from './typings';

export class StorageS3Service extends Storage<StorageS3Options> {
  private readonly bucket: string;

  private readonly s3: S3;

  constructor(options: StorageS3Options) {
    super(options);

    this.bucket = options.bucket;

    this.s3 = new S3({
      credentials: new Credentials({
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey,
      }),
      region: options.region,
    });
  }

  async url(key: string): Promise<string> {
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: this.bucket,
      Key: key,
    });
  }

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  async read(key: string, options?: ReadBufferFileOptions | ReadStreamFileOptions): Promise<Buffer | Readable> {
    try {
      const response = await this.s3.getObject({
        Bucket: this.bucket,
        Key: key,
      }).promise();

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

  private async writeStreamFile(stream: Readable, options?: WriteFileOptions): Promise<StorageFile> {
    const givenFilename = options?.filename;

    if (givenFilename) {
      const uploadPromise = await this.s3.upload({
        Bucket: this.bucket,
        Key: givenFilename,
        Body: stream,
        ...(options?.contentType ? { ContentType: options?.contentType } : {}),
      }).promise();

      return { key: givenFilename };
    }

    const tempFilename = uuid();
    const uploadStream = new PassThrough();

    const getFilenamePromise = this.getStreamFilename(stream);

    const uploadPromise = this.s3.upload({
      Bucket: this.bucket,
      Key: tempFilename,
      Body: uploadStream,
      ...(options?.contentType ? { ContentType: options?.contentType } : {}),
    }).promise();

    stream.pipe(uploadStream);

    const [filename] = await Promise.all([
      getFilenamePromise,
      uploadPromise,
    ]);

    await this.s3.copyObject({
      Bucket: this.bucket,
      CopySource: `/${this.bucket}/${tempFilename}`,
      Key: filename,
      ...(options?.contentType ? { ContentType: options?.contentType } : {}),
    }).promise();

    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key: tempFilename,
    }).promise();

    return { key: filename };
  }

  async writeBufferFile(buffer: Buffer, options?: WriteFileOptions): Promise<StorageFile> {
    const filename = options?.filename || await this.getBufferFilename(buffer);

    await this.s3.upload({
      Key: filename,
      Bucket: this.bucket,
      Body: buffer,
      ...(options?.contentType ? { ContentType: options?.contentType } : {}),
    }).promise();

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
    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key: key,
    }).promise();
  }

  async isExists(key: string): Promise<boolean> {
    try {
      await this.s3.headObject({
        Bucket: this.bucket,
        Key: key,
      }).promise();

      return true;
    } catch (ex: any) {
      if (ex.name === 'NotFound') return false;

      throw ex;
    }
  }
}
