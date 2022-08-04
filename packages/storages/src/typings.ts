import { ConvertableFile, FileConverter } from '@rytass/file-converter';

export type InputFile = ConvertableFile;

export interface ReadBufferFileOptions {
  format: 'buffer';
}

export interface ReadStreamFileOptions {
  format: 'stream';
}

export type FilenameHashAlgorithm = 'sha1' | 'sha256';

export interface StorageOptions<O extends Record<string, any> = Record<string, any>> {
  converters?: FileConverter<O>[];
  hashAlgorithm?: FilenameHashAlgorithm;
}

export type FileKey = string;

export interface StorageFile {
  readonly key: FileKey;
}
