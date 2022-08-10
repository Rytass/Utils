import { StorageError, ErrorCode, Storage, ReadBufferFileOptions, ReadStreamFileOptions, InputFile, StorageFile } from '@rytass/storages';
import { Credentials, S3 } from 'aws-sdk';
import { Readable, PassThrough } from 'stream';
import { v4 as uuid } from 'uuid';
import { StorageR2Options } from './typings';

export class StorageR2Service extends Storage<StorageR2Options> {
  private readonly bucket: string;

  private readonly s3: S3;

  constructor(options: StorageR2Options) {
    super(options);

    this.bucket = options.bucket;

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

  private async writeStreamFile(stream: Readable, givenFilename?: string): Promise<StorageFile> {
    if (givenFilename) {
      const uploadPromise = await this.s3.upload({
        Bucket: this.bucket,
        Key: givenFilename,
        Body: stream,
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
    }).promise();

    await this.s3.deleteObject({
      Bucket: this.bucket,
      Key: tempFilename,
    }).promise();

    return { key: filename };
  }

  async writeBufferFile(buffer: Buffer, givenFilename?: string): Promise<StorageFile> {
    const filename = givenFilename || await this.getBufferFilename(buffer);

    await this.s3.upload({
      Key: filename,
      Bucket: this.bucket,
      Body: buffer,
    }).promise();

    return { key: filename };
  }

  write(file: InputFile, filename?: string): Promise<StorageFile> {
    if (file instanceof Buffer) {
      return this.writeBufferFile(file, filename);
    }

    return this.writeStreamFile(file, filename);
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
}