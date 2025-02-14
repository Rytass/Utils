export interface BaseOAuth2Provider {
  channel: 'google' | 'facebook' | string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  getState?: () => string | Promise<string>;
}

export interface GoogleOAuth2Provider extends BaseOAuth2Provider {
  channel: 'google';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];
  getState?: () => string | Promise<string>;
}

export interface FacebookOAuth2Provider extends BaseOAuth2Provider {
  channel: 'facebook';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];
  getState?: () => string | Promise<string>;
}

export interface CustomOAuth2Provider extends BaseOAuth2Provider {
  channel: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  requestUrl: string;
  getAccessTokenFromCode: (code: string) => Promise<string>;
  getAccountFromAccessToken: (accessToken: string) => Promise<string>;
  getState?: () => string | Promise<string>;
}

export type OAuth2Provider =
  | GoogleOAuth2Provider
  | FacebookOAuth2Provider
  | CustomOAuth2Provider;
