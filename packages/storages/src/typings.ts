import {
  Convertable,
  Converter,
  ConverterManagerInterface,
} from './converter/typings';

export type WriteFileInput = string | Buffer;
export type FileName = string | ((data: FileType) => string | string);
export type ErrorCallback = (error: StorageErrorInterface) => void;
export type ConvertOptions<T> = { errors?: ErrorCallback } & T;

export interface FileType<T extends StorageOptions = any> {
  readonly buffer: Buffer;
  readonly size: number;
  extension?: string;
  mime?: string;
  to(
    extension: Convertable<T['converters']>['extension'],
    options?: Convertable<T['converters']>['options'] & { errors?: ErrorCallback }
  ): Buffer | undefined | Promise<Buffer | undefined>;
}

export interface FileStats
  extends Required<Pick<FileType, 'extension' | 'buffer'>> {}

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
    input: WriteFileInput,
    options?: StorageWriteOptions & StorageAsyncCallback
  ): void;
  read(input: string, options?: StorageReadOptions): Promise<FileType<T>>;
  remove(directory: string, callback?: ErrorCallback): Promise<void>;
}