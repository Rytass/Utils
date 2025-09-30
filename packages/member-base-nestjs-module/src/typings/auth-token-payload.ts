export type AuthTokenPayloadBase = {
  id: string;
  account?: string;
  domain?: string;
} & Record<string, unknown>;
