export type PathLike = string | Buffer | URL;

export interface File {
  fileName: string;
  mime: string;
  buffer: Buffer;
  size: number;
}

export interface StorageError {
  code: string;
  message: string;
}

export interface StorageUploadOptions {
  maxSize?: number;
  mimeFilter?: string[];
  useFileName?: string | ((data: File) => string);
}

export interface StorageDownloadOptions {
  destination?: string;
}

export interface StorageAsyncCallback {
  callback?: (error: StorageError, data: File) => void;
}

export interface StorageService {
  upload(
    input: PathLike,
    options: StorageUploadOptions & StorageAsyncCallback
  ): void;
  download(
    input: string,
    options: StorageDownloadOptions & StorageAsyncCallback
  ): void;
  uploadSync(input: PathLike, options: StorageUploadOptions): Promise<File>;
  downloadSync(input: string, options: StorageDownloadOptions): Promise<File>;
}
