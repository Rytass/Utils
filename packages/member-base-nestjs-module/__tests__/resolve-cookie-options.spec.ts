import { Logger } from '@nestjs/common';
import {
  resolveCookieOptions,
  resetCookieWarnings,
  type CookieOptionsConfig,
} from '../src/utils/resolve-cookie-options';

const DEFAULTS: CookieOptionsConfig = { path: '/', sameSite: 'lax' };

/** A bare Node response carries only the Host header; Express adds `hostname`. */
const requestWithHost = (host: string): { headers: Record<string, string> } => ({ headers: { host } });

describe('resolveCookieOptions defaults', () => {
  it('should never allow javascript to read the cookie', () => {
    expect(resolveCookieOptions(requestWithHost('idp.example.com'), DEFAULTS).httpOnly).toBe(true);
  });

  // Anything narrower leaves the cookie unreadable on the rest of the
  // application, which is exactly the bug the OAuth callback used to have.
  it('should scope the cookie to the whole site by default', () => {
    expect(resolveCookieOptions(requestWithHost('idp.example.com'), DEFAULTS).path).toBe('/');
  });

  it('should default to a host-only cookie', () => {
    const resolved = resolveCookieOptions(requestWithHost('idp.example.com'), DEFAULTS);

    // No Domain attribute means the browser scopes it to exactly this host, so
    // a sibling subdomain cannot read the session.
    expect(resolved.domain).toBeUndefined();
    expect('domain' in resolved).toBe(false);
  });

  it('should default to lax', () => {
    expect(resolveCookieOptions(requestWithHost('idp.example.com'), DEFAULTS).sameSite).toBe('lax');
  });
});

describe('resolveCookieOptions secure flag', () => {
  it.each(['localhost', '127.0.0.1', '::1'])('should drop Secure on %s so local development works', host => {
    expect(resolveCookieOptions(requestWithHost(host), DEFAULTS).secure).toBe(false);
  });

  it('should keep Secure for every other host', () => {
    expect(resolveCookieOptions(requestWithHost('idp.example.com'), DEFAULTS).secure).toBe(true);
    expect(resolveCookieOptions(requestWithHost('10.0.1.5'), DEFAULTS).secure).toBe(true);
  });

  it('should ignore the port when deciding', () => {
    expect(resolveCookieOptions(requestWithHost('localhost:4123'), DEFAULTS).secure).toBe(false);
    expect(resolveCookieOptions(requestWithHost('idp.example.com:8443'), DEFAULTS).secure).toBe(true);
  });

  it('should read a bracketed ipv6 host without mistaking a colon for a port', () => {
    expect(resolveCookieOptions(requestWithHost('[::1]:3000'), DEFAULTS).secure).toBe(false);
    expect(resolveCookieOptions(requestWithHost('[::1]'), DEFAULTS).secure).toBe(false);
  });

  // Express keeps the brackets of an IPv6 literal in `hostname` — it only
  // strips what follows the closing bracket — so this arrives as '[::1]', not
  // '::1', and a naive comparison marks loopback as remote.
  it('should recognise the bracketed form express puts in hostname', () => {
    expect(resolveCookieOptions({ hostname: '[::1]' }, DEFAULTS).secure).toBe(false);
  });

  it('should treat host names case-insensitively', () => {
    expect(resolveCookieOptions(requestWithHost('LOCALHOST:3000'), DEFAULTS).secure).toBe(false);
    expect(resolveCookieOptions({ hostname: 'LocalHost' }, DEFAULTS).secure).toBe(false);
  });

  it('should ignore a fully qualified trailing dot', () => {
    expect(resolveCookieOptions(requestWithHost('localhost.'), DEFAULTS).secure).toBe(false);
  });

  it('should prefer the framework resolved hostname, which honours trust proxy', () => {
    const req = { hostname: 'idp.example.com', headers: { host: 'internal:3000' } };

    expect(resolveCookieOptions(req, DEFAULTS).secure).toBe(true);
  });

  // A TLS-terminating proxy that does not rewrite Host hands the application
  // `localhost`. Without this the cookie would quietly lose Secure on an https
  // deployment.
  it('should keep Secure when the request itself is https, whatever the host says', () => {
    const req = { hostname: 'localhost', secure: true };

    expect(resolveCookieOptions(req, DEFAULTS).secure).toBe(true);
  });

  it('should let an explicit setting win over the host', () => {
    expect(resolveCookieOptions(requestWithHost('localhost'), { ...DEFAULTS, secure: true }).secure).toBe(true);
    expect(resolveCookieOptions(requestWithHost('idp.example.com'), { ...DEFAULTS, secure: false }).secure).toBe(false);
  });

  // A mock response in a unit test, or a bare stream with no Host header.
  it('should fail safe when there is no request to read', () => {
    expect(resolveCookieOptions(undefined, DEFAULTS).secure).toBe(true);
    expect(resolveCookieOptions({}, DEFAULTS).secure).toBe(true);
  });
});

describe('resolveCookieOptions explicit configuration', () => {
  it('should emit a configured domain verbatim', () => {
    const resolved = resolveCookieOptions(requestWithHost('idp.example.com'), {
      ...DEFAULTS,
      domain: '.example.com',
    });

    expect(resolved.domain).toBe('.example.com');
  });

  it('should carry a configured path and sameSite through', () => {
    const resolved = resolveCookieOptions(requestWithHost('idp.example.com'), {
      path: '/app',
      sameSite: 'strict',
    });

    expect(resolved).toMatchObject({ path: '/app', sameSite: 'strict' });
  });
});

describe('resolveCookieOptions sameSite none', () => {
  beforeEach(() => resetCookieWarnings());

  // Every browser rejects SameSite=None without Secure, so the cookie would be
  // dropped with no other sign that anything is wrong.
  it('should warn when sameSite none is not secure', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    resolveCookieOptions(requestWithHost('localhost'), { ...DEFAULTS, sameSite: 'none' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('rejects that combination'));

    warn.mockRestore();
  });

  it('should warn only once, since this is per-configuration not per-request', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    resolveCookieOptions(requestWithHost('localhost'), { ...DEFAULTS, sameSite: 'none' });
    resolveCookieOptions(requestWithHost('localhost'), { ...DEFAULTS, sameSite: 'none' });

    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('should stay quiet when sameSite none is secure', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    resolveCookieOptions(requestWithHost('idp.example.com'), { ...DEFAULTS, sameSite: 'none' });

    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});
