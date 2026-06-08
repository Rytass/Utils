import { StorageOptions } from '@rytass/storages';
import { BlobAccessType } from '@vercel/blob';

export interface StorageVercelBlobOptions extends StorageOptions {
  token?: string;
  pathPrefix?: string;
  /**
   * Blob access level.
   * - `public`: blobs are served from a permanent, anonymous URL.
   * - `private`: blobs require authentication; `url()` returns a short-lived presigned URL.
   * @default 'public'
   */
  access?: BlobAccessType;
  /**
   * For private blobs only: lifetime (in seconds) of the presigned URL returned by `url()`.
   * Ignored for public blobs (their URLs are permanent).
   * @default 3600
   */
  signedUrlExpiresIn?: number;
  [key: string]: unknown;
}
