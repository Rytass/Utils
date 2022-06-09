export interface StorageLocalCacheOptions {
  maxSize: number;
  ttl: number;
}

export interface StorageLocalOptions {
  defaultDirectory?: string;
  cache?: StorageLocalCacheOptions;
}

export interface DetectLocalFileType {
  mime: string;
  extension?: string;
}
