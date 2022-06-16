import { ConvertableStatus, Converter, ConverterManagerInterface } from './converter/typings';

export type WriteFileInput = string | Buffer;
export type FileName = string | ((data: FileType) => string | string);
export type ErrorCallback = (error: StorageErrorInterface) => void;

export interface FileType<T extends string = any> {
  readonly buffer: Buffer;
  readonly size: number;
  extension?: string;
  mime?: string;
  to: (extension: T, error?: ErrorCallback) => Buffer | undefined | Promise<Buffer | undefined>;
}

export interface FileStats extends Required<Pick<FileType, 'extension' | 'buffer'>> {}

export interface StorageErrorInterface {
  code: string;
  message?: string;
}

export interface StorageWriteOptions {
  maxSize?: number;
  fileName?: FileName;
  directory?: string;
  autoMkdir?: boolean;
}

export interface StorageReadOptions {
  directory?: string;
}

export interface StorageAsyncCallback {
  callback?: (error?: StorageErrorInterface, data?: FileType) => void;
}

export interface StorageOptions {
  converters?: Converter[];
}

export interface StorageService<T extends StorageOptions, K = T['converters']> {
  converterManager?: ConverterManagerInterface<
    K extends Converter[] ? K : never
  >;
  write(
    input: Required<FileType>,
    options: StorageWriteOptions & StorageAsyncCallback
  ): void;
  read(
    input: string,
    options: StorageReadOptions
  ): Promise<
    FileType<ConvertableStatus<T['converters']>>
  >;
  writeSync(input: Required<FileType>, options: StorageWriteOptions): void;
  search(directory: string): Promise<string[]>;
  remove(directory: string, callback?: ErrorCallback): Promise<void>;
}