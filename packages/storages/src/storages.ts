import { Readable, PassThrough } from 'stream';
import { createHash } from 'crypto';
import { FileTypeResult, fromBuffer, fromStream } from 'file-type';
import { ConverterManager } from '@rytass/file-converter';
import {
  FilenameHashAlgorithm,
  InputFile,
  ReadBufferFileOptions,
  ReadStreamFileOptions,
  StorageFile,
  StorageOptions,
  WriteFileOptions,
} from './typings';

export interface StorageInterface {
  write(file: InputFile): Promise<StorageFile>;
  batchWrite(files: InputFile[]): Promise<StorageFile[]>;

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;

  remove(key: string): Promise<void>;
}

const MIN_BUFFER_LENGTH = 16;

export class Storage<O extends Record<string, any> = Record<string, any>>
  implements StorageInterface
{
  readonly converterManager: ConverterManager;

  readonly hashAlgorithm: FilenameHashAlgorithm;

  constructor(options?: StorageOptions<O>) {
    this.converterManager = new ConverterManager(options?.converters ?? []);
    this.hashAlgorithm = options?.hashAlgorithm || 'sha256';
  }

  public getExtension(file: InputFile): Promise<FileTypeResult | undefined> {
    if (file instanceof Buffer) {
      return fromBuffer(file);
    }

    const extensionStream = new PassThrough();

    (file as Readable).pipe(extensionStream);

    return fromStream(extensionStream);
  }

  async getBufferFilename(
    buffer: Buffer,
  ): Promise<[string, string | undefined]> {
    const extension = await fromBuffer(buffer);

    return [
      `${createHash(this.hashAlgorithm).update(buffer).digest('hex')}${extension?.ext ? `.${extension.ext}` : ''}`,
      extension?.mime ?? undefined,
    ];
  }

  getStreamFilename(stream: Readable): Promise<[string, string | undefined]> {
    return new Promise((resolve, reject) => {
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

      const getStreamFileType = new Promise<FileTypeResult | undefined>(
        (subResolve) => {
          let resolved = false;
          let isEnd = false;

          const bufferStorage: Buffer[] = [];
          const waitingTasks: boolean[] = [];

          extensionStream.on('data', (buffer: Buffer) => {
            if (resolved) return;

            bufferStorage.push(buffer);

            const targetBuffer = Buffer.concat(bufferStorage);

            if (targetBuffer.length >= MIN_BUFFER_LENGTH) {
              const taskIndex = waitingTasks.length;

              waitingTasks.push(true);

              fromBuffer(targetBuffer).then((result) => {
                waitingTasks[taskIndex] = false;

                if (!result && !isEnd) return;

                resolved = true;

                subResolve(result);
              });
            } else {
              waitingTasks.push(false);
            }
          });

          extensionStream.on('end', () => {
            isEnd = true;

            if (waitingTasks.every((task) => !task) && !resolved) {
              resolved = true;

              subResolve(undefined);
            }
          });
        },
      );

      Promise.all([getStreamHash, getStreamFileType])
        .then(([filename, extension]) => {
          resolve([
            `${filename}${extension?.ext ? `.${extension.ext}` : ''}`,
            extension?.mime ?? undefined,
          ]);
        })
        .catch(reject);

      stream.pipe(hashStream).pipe(extensionStream);
    });
  }

  write(file: InputFile, options?: WriteFileOptions): Promise<StorageFile> {
    throw new Error('Method not implemented.');
  }

  batchWrite(
    files: InputFile[],
    options?: WriteFileOptions[],
  ): Promise<StorageFile[]> {
    throw new Error('Method not implemented.');
  }

  read(key: string): Promise<Readable>;
  read(key: string, options: ReadBufferFileOptions): Promise<Buffer>;
  read(key: string, options: ReadStreamFileOptions): Promise<Readable>;
  read(
    key: string,
    options?: ReadBufferFileOptions | ReadStreamFileOptions,
  ): Promise<Readable> | Promise<Buffer> {
    throw new Error('Method not implemented.');
  }

  remove(key: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  isExists(key: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
}
