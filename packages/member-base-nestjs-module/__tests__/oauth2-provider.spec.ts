import {
  isGoogleProvider,
  isFacebookProvider,
  isCustomProvider,
  GoogleOAuth2Provider,
  FacebookOAuth2Provider,
  CustomOAuth2Provider,
  OAuth2Provider,
} from '../src/typings/oauth2-provider.interface';

describe('OAuth2 Provider Type Guards', () => {
  const googleProvider: GoogleOAuth2Provider = {
    channel: 'google',
    clientId: 'google-client-id',
    clientSecret: 'google-client-secret',
    redirectUri: 'https://example.com/callback/google',
    scope: ['email', 'profile'],
  };

  const facebookProvider: FacebookOAuth2Provider = {
    channel: 'facebook',
    clientId: 'facebook-client-id',
    clientSecret: 'facebook-client-secret',
    redirectUri: 'https://example.com/callback/facebook',
    scope: ['email', 'public_profile'],
  };

  const customProvider: CustomOAuth2Provider = {
    channel: 'custom-oauth',
    clientId: 'custom-client-id',
    clientSecret: 'custom-client-secret',
    redirectUri: 'https://example.com/callback/custom',
    scope: ['read', 'write'],
    requestUrl: 'https://custom-oauth.com/authorize',
    getAccessTokenFromCode: async (code: string): Promise<string> => `token-for-${code}`,
    getAccountFromAccessToken: async (token: string): Promise<string> => `account-for-${token}`,
  };

  describe('isGoogleProvider', () => {
    it('should return true for Google provider', () => {
      expect(isGoogleProvider(googleProvider)).toBe(true);
    });

    it('should return false for Facebook provider', () => {
      expect(isGoogleProvider(facebookProvider)).toBe(false);
    });

    it('should return false for custom provider', () => {
      expect(isGoogleProvider(customProvider)).toBe(false);
    });
  });

  describe('isFacebookProvider', () => {
    it('should return true for Facebook provider', () => {
      expect(isFacebookProvider(facebookProvider)).toBe(true);
    });

    it('should return false for Google provider', () => {
      expect(isFacebookProvider(googleProvider)).toBe(false);
    });

    it('should return false for custom provider', () => {
      expect(isFacebookProvider(customProvider)).toBe(false);
    });
  });

  describe('isCustomProvider', () => {
    it('should return true for custom provider', () => {
      expect(isCustomProvider(customProvider)).toBe(true);
    });

    it('should return false for Google provider', () => {
      expect(isCustomProvider(googleProvider)).toBe(false);
    });

    it('should return false for Facebook provider', () => {
      expect(isCustomProvider(facebookProvider)).toBe(false);
    });
  });

  describe('Provider interfaces', () => {
    it('should allow optional scope for Google provider', () => {
      const provider: GoogleOAuth2Provider = {
        channel: 'google',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://example.com/callback',
      };

      expect(isGoogleProvider(provider)).toBe(true);
      expect(provider.scope).toBeUndefined();
    });

    it('should allow optional scope for Facebook provider', () => {
      const provider: FacebookOAuth2Provider = {
        channel: 'facebook',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://example.com/callback',
      };

      expect(isFacebookProvider(provider)).toBe(true);
      expect(provider.scope).toBeUndefined();
    });

    it('should allow optional getState function', () => {
      const providerWithGetState: OAuth2Provider = {
        channel: 'google',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://example.com/callback',
        getState: () => 'random-state-string',
      };

      expect(providerWithGetState.getState).toBeDefined();
      expect(providerWithGetState.getState!()).toBe('random-state-string');
    });

    it('should support async getState function', async () => {
      const providerWithAsyncGetState: OAuth2Provider = {
        channel: 'google',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://example.com/callback',
        getState: async () => 'async-state-string',
      };

      const state = await providerWithAsyncGetState.getState!();

      expect(state).toBe('async-state-string');
    });
  });

  describe('Custom provider functions', () => {
    it('should call getAccessTokenFromCode correctly', async () => {
      const accessToken = await customProvider.getAccessTokenFromCode('test-code');

      expect(accessToken).toBe('token-for-test-code');
    });

    it('should call getAccountFromAccessToken correctly', async () => {
      const account = await customProvider.getAccountFromAccessToken('test-token');

      expect(account).toBe('account-for-test-token');
    });
  });
});
