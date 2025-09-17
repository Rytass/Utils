export type OAuthChannel = 'google' | 'facebook' | (string & {});

export interface BaseOAuth2Provider {
  channel: OAuthChannel;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  getState?: () => string | Promise<string>;
}

export interface GoogleOAuth2Provider extends BaseOAuth2Provider {
  channel: 'google';
  scope?: string[];
}

export interface FacebookOAuth2Provider extends BaseOAuth2Provider {
  channel: 'facebook';
  scope?: string[];
}

export interface CustomOAuth2Provider extends BaseOAuth2Provider {
  channel: string;
  scope: string[];
  requestUrl: string;
  getAccessTokenFromCode: (code: string) => Promise<string>;
  getAccountFromAccessToken: (accessToken: string) => Promise<string>;
}

export type OAuth2Provider = GoogleOAuth2Provider | FacebookOAuth2Provider | CustomOAuth2Provider;

// Type guards for OAuth2 providers
export const isGoogleProvider = (provider: OAuth2Provider): provider is GoogleOAuth2Provider =>
  provider.channel === 'google';

export const isFacebookProvider = (provider: OAuth2Provider): provider is FacebookOAuth2Provider =>
  provider.channel === 'facebook';

export const isCustomProvider = (provider: OAuth2Provider): provider is CustomOAuth2Provider =>
  provider.channel !== 'google' && provider.channel !== 'facebook';
