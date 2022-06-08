export interface StorageLocalCacheOptions {
    maxSize: number
    ttl: number
}

export interface StorageLocalOptions {
    defaultDirectory?: string
    cache?: StorageLocalCacheOptions
}