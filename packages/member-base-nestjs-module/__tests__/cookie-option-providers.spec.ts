import { Provider } from '@nestjs/common';
import { OptionProviders } from '../src/constants/option-providers';
import { ACCESS_TOKEN_COOKIE_NAME, COOKIE_OPTIONS, REFRESH_TOKEN_COOKIE_NAME } from '../src/typings/member-base.tokens';
import type { MemberBaseModuleOptionsDTO } from '../src/typings/member-base-module-options.dto';
import type { CookieOptionsConfig } from '../src/utils/resolve-cookie-options';

interface FactoryProvider {
  provide: unknown;
  useFactory: (...args: unknown[]) => unknown;
}

const resolve = <T>(token: unknown, options?: MemberBaseModuleOptionsDTO): T => {
  const provider = OptionProviders.find(
    (candidate: Provider) => (candidate as FactoryProvider).provide === token,
  ) as FactoryProvider;

  return provider.useFactory(options) as T;
};

describe('cookie name providers', () => {
  // Several suites assert these literals, and every existing deployment
  // depends on them.
  it('should keep the historical names when nothing is configured', () => {
    expect(resolve<string>(ACCESS_TOKEN_COOKIE_NAME)).toBe('access_token');
    expect(resolve<string>(REFRESH_TOKEN_COOKIE_NAME)).toBe('refresh_token');
    expect(resolve<string>(ACCESS_TOKEN_COOKIE_NAME, {})).toBe('access_token');
  });

  it('should take the configured names', () => {
    const options: MemberBaseModuleOptionsDTO = {
      accessTokenCookieName: 'sid',
      refreshTokenCookieName: 'sid_r',
    };

    expect(resolve<string>(ACCESS_TOKEN_COOKIE_NAME, options)).toBe('sid');
    expect(resolve<string>(REFRESH_TOKEN_COOKIE_NAME, options)).toBe('sid_r');
  });

  it('should let each name be overridden on its own', () => {
    const options: MemberBaseModuleOptionsDTO = { accessTokenCookieName: 'sid' };

    expect(resolve<string>(ACCESS_TOKEN_COOKIE_NAME, options)).toBe('sid');
    expect(resolve<string>(REFRESH_TOKEN_COOKIE_NAME, options)).toBe('refresh_token');
  });
});

describe('cookie attribute provider', () => {
  it('should default to a site-wide lax cookie', () => {
    expect(resolve<CookieOptionsConfig>(COOKIE_OPTIONS)).toEqual({
      path: '/',
      sameSite: 'lax',
      // Both stay undefined so they can be decided per request, from the host
      // the response is actually written for.
      secure: undefined,
      domain: undefined,
    });
  });

  it('should carry every configured attribute through', () => {
    const options: MemberBaseModuleOptionsDTO = {
      cookiePath: '/app',
      cookieSameSite: 'none',
      cookieSecure: true,
      cookieDomain: '.example.com',
    };

    expect(resolve<CookieOptionsConfig>(COOKIE_OPTIONS, options)).toEqual({
      path: '/app',
      sameSite: 'none',
      secure: true,
      domain: '.example.com',
    });
  });

  it('should keep an explicit false for secure rather than treating it as unset', () => {
    expect(resolve<CookieOptionsConfig>(COOKIE_OPTIONS, { cookieSecure: false }).secure).toBe(false);
  });
});
