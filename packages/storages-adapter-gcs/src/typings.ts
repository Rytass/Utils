import { StorageOptions } from '@rytass/storages';

export interface GCSOptions extends StorageOptions {
  bucket: string;
  projectId: string;
  credentials?: {
    client_email: string;
    private_key: string;
  }; // ref: CredentialBody; optional for GKE Workload Identity / ADC
  [key: string]: unknown;
}

export interface GCSUrlOptions {
  /**
   * Filename shown to the browser when downloading through the signed URL.
   * Converted to a `Content-Disposition: attachment` response header (RFC 6266 / RFC 5987, UTF-8 safe).
   * Ignored when `responseDisposition` is given.
   */
  filename?: string;
  /** Raw `Content-Disposition` value overriding the response header, e.g. `inline` */
  responseDisposition?: string;
}
