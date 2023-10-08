export interface VaultAuthMethodAccountPassword {
  account: string;
  password: string;
}

export type VaultAuthMethods = VaultAuthMethodAccountPassword;

export interface VaultSecretOptions {
  host: string;
  auth: VaultAuthMethods;
  online?: boolean;
  tokenTTL?: number;
  onError?: (error: string) => void;
  onReady?: () => void;
}

export interface VaultSecretOnlineOptions {
  host: string;
  auth: VaultAuthMethods;
  online: true;
  tokenTTL?: number;
  onError?: (error: string) => void;
  onReady?: () => void;
}

export interface VaultSecretOfflineOptions {
  host: string;
  auth: VaultAuthMethods;
  online?: false;
  tokenTTL?: number;
  onError?: (error: string) => void;
  onReady?: () => void;
}

export type VaultGetType<O extends VaultSecretOptions, T> = O extends VaultSecretOnlineOptions ? Promise<T> : T;
export type VaultSetType<O extends VaultSecretOptions> = O extends VaultSecretOnlineOptions ? Promise<void> : void;
export type VaultDeleteType<O extends VaultSecretOptions> = O extends VaultSecretOnlineOptions ? Promise<void> : void;

export enum VaultEvents {
  INITED = 'INITED',
  READY = 'READY',
  TOKEN_RENEWED = 'TOKEN_RENEWED',
  TERMINATED = 'TERMINATED',
  ERROR = 'ERROR',
}

export enum VaultSecretState {
  INIT = 'INIT',
  READY = 'READY',
  TERMINATED = 'TERMINATED',
}

enum VaultTokenType {
  SERVICE = 'service',
  BATCH = 'batch',
}

interface VaultAPIBaseInfo<T> {
  request_id: string;
  lease_id: string;
  renewable: boolean;
  lease_duration: number;
  data: T;
  wrap_info: null;
  warnings: string[] | null;
}

interface VaultTokenRetrieveAuthResponse {
  client_token: string;
  accessor: string;
  policies: string[];
  token_policies: string[];
  metadata: Record<string, string> | null;
  lease_duration: number;
  renewable: boolean;
  entity_id: string;
  token_type: VaultTokenType;
  orphan: boolean;
  mfa_requirement: null;
  num_uses: number;
}

export type VaultTokenRetrieveSuccessResponse = {
  auth: VaultTokenRetrieveAuthResponse;
} & VaultAPIBaseInfo<null>

export interface VaultAPIFailedResponse {
  errors: string[];
}

export type VaultTokenRetrieveResponse = VaultTokenRetrieveSuccessResponse | VaultAPIFailedResponse;

interface VaultTokenGetSecretData {
  data: Record<string, any>,
  metadata: {
    created_time: string;
    custom_metadata: null;
    deletion_time: string;
    destroyed: boolean;
    version: number;
  };
}

export type VaultGetSecretSuccessResponse = VaultAPIBaseInfo<VaultTokenGetSecretData>

export type VaultGetSecretResponse = VaultGetSecretSuccessResponse | VaultAPIFailedResponse;
