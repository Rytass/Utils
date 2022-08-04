import { Readable, PassThrough } from 'stream';
import { createHash } from 'crypto';
import { fromBuffer, fromStream } from 'file-type';
import { ConverterManager } from './converter-manager';
import { FilenameHashAlgorithm, InputFile, ReadBufferFileOptions, ReadStreamFileOptions, StorageFile, StorageOptions } from './typings';

export interface StorageInterface {
  write(file: InputFile): Promise<StorageFile>;
  batchWrite(files: InputFile[]): Promise<StorageFile[]>;

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;

  remove(key: string): Promise<void>;
}

export class Storage<O extends Record<string, any> = Record<string, any>> implements StorageInterface {
  readonly converterManager: ConverterManager;

  readonly hashAlgorithm: FilenameHashAlgorithm;

  constructor(options?: StorageOptions<O>) {
    this.converterManager = new ConverterManager(options?.converters ?? []);
    this.hashAlgorithm = options?.hashAlgorithm || 'sha256';
  }

  async getBufferFilename(buffer: Buffer): Promise<string> {
    const extension = await fromBuffer(buffer);

    return `${createHash(this.hashAlgorithm).update(buffer).digest('hex')}${extension?.ext ? `.${extension.ext}` : ''}`;
  }

  getStreamFilename(stream: Readable): Promise<string> {
    return new Promise((resolve) => {
      const hashStream = new PassThrough();
      const extensionStream = new PassThrough();

      const getStreamHash = new Promise((subResolve) => {
        const hash = createHash(this.hashAlgorithm);

        hashStream.on('data', (buffer: Buffer) => {
          hash.update(buffer);
        });

        hashStream.on('end', () => {
          subResolve(hash.digest('hex'));
        });
      });

      Promise.all([
        getStreamHash,
        fromStream(extensionStream),
      ]).then(([filename, extension]) => {
        resolve(`${filename}${extension?.ext ? `.${extension.ext}` : ''}`);
      });

      stream.pipe(hashStream).pipe(extensionStream);
    });
  }

  write(file: InputFile): Promise<StorageFile> {
    throw new Error('Method not implemented.');
  }

  batchWrite(files: InputFile[]): Promise<StorageFile[]> {
    throw new Error('Method not implemented.');
  }

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  read(key: string, options?: ReadBufferFileOptions | ReadStreamFileOptions): Promise<Readable> | Promise<Buffer> {
    throw new Error('Method not implemented.');
  }

  remove(key: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
