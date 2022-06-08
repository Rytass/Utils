export type WriteFileInput = string | Buffer
export type FileName = string | ((data: FileType) => string | string);

export interface FileType {
  readonly buffer: Buffer;
  readonly size: number;
  extension?: string;
  mime?: string;
}

export interface StorageErrorInterface {
  code: string;
  message?: string;
}

export interface StorageWriteOptions {
  maxSize?: number;
  fileName?: FileName
  directory?: string;
}

export interface StorageReadOptions {
  directory?: string;
}

export interface StorageAsyncCallback {
  callback?: (error?: StorageErrorInterface, data?: FileType) => void;
}

export interface StorageService {
  write(
    input: Required<FileType>,
    options: StorageWriteOptions & StorageAsyncCallback
  ): void;
  read(input: string, options: StorageReadOptions): Promise<FileType>;
  writeSync(input: Required<FileType>, options: StorageWriteOptions): void;
  find(input: string): Promise<string[]>;
}
