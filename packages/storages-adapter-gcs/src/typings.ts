import { StorageOptions } from '@rytass/storages';

export interface GCSOptions extends StorageOptions {
  bucket: string;
  projectId: string;
  credentials: {
    client_email: string;
    private_key: string;
  }; // ref: CredentialBody;
}
