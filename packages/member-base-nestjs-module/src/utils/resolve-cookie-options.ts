import { Logger } from '@nestjs/common';

const logger = new Logger('MemberBaseCookies');

/** Hosts that can never serve https, and where a Secure cookie is simply dropped. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export type CookieSameSite = 'lax' | 'strict' | 'none';

/** The configured half: what the application asked for, before the request is consulted. */
export interface CookieOptionsConfig {
  path: string;
  sameSite: CookieSameSite;
  /** undefined means "decide from the request host". */
  secure?: boolean;
  /** undefined means host-only, which is the default. */
  domain?: string;
}

export interface ResolvedCookieOptions {
  httpOnly: true;
  path: string;
  sameSite: CookieSameSite;
  secure: boolean;
  domain?: string;
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  hostname?: string;
  /** Express resolves this from the protocol, honouring `trust proxy`. */
  secure?: boolean;
}

let warnedAboutSameSiteNone = false;

/**
 * Drop the port, leaving the bare host.
 *
 * Both sources arrive here in the same shapes: Express keeps the brackets of an
 * IPv6 literal in `hostname` (it only strips what follows `]`), exactly as the
 * Host header carries them.
 */
const stripPort = (host: string): string => {
  if (host.startsWith('[')) {
    const closing = host.indexOf(']');

    return closing === -1 ? host : host.slice(1, closing);
  }

  const colon = host.lastIndexOf(':');

  if (colon === -1) return host;

  // More than one colon and no brackets means a bare IPv6 literal: the last
  // colon belongs to the address, not to a port. Reading it as a port turns
  // `::1` into `:` and quietly marks loopback as remote.
  if (host.indexOf(':') !== colon) return host;

  return host.slice(0, colon);
};

/**
 * The host the response is being written for, normalised.
 *
 * Host names are case-insensitive and may be written fully qualified with a
 * trailing dot, so both are folded away before anything is compared against
 * them.
 */
const readHost = (req: RequestLike | undefined): string | null => {
  const header = req?.headers?.host;
  const raw = req?.hostname ?? (Array.isArray(header) ? header[0] : header);

  if (!raw) return null;

  return stripPort(raw).replace(/\.$/, '').toLowerCase();
};

/**
 * Merge what the application configured with what the request implies.
 *
 * Called for every cookie this package writes, so the OAuth callback and the
 * OIDC session bridge cannot drift apart — and so that clearing a cookie uses
 * the same path and domain it was set with, which is the only way a browser
 * will actually remove it.
 *
 * No Domain attribute is emitted unless one was configured. A browser then
 * scopes the cookie to exactly the host that served the response, which is the
 * safe default: widening it to a parent domain would hand the session to every
 * sibling subdomain, including any that is hosted by someone else.
 *
 * With no request to consult — a unit test's mock response, say — it fails
 * safe and keeps Secure.
 */
export const resolveCookieOptions = (
  req: RequestLike | undefined,
  config: CookieOptionsConfig,
): ResolvedCookieOptions => {
  const host = readHost(req);

  // `req.secure` is the strongest signal available: with `trust proxy` enabled
  // it reflects X-Forwarded-Proto, so a TLS-terminating proxy that rewrites the
  // Host header to localhost still yields a Secure cookie. Everything else
  // falls back to the host, and only loopback loses the flag.
  const secure = config.secure ?? (req?.secure === true || host === null || !LOOPBACK_HOSTS.has(host));

  if (config.sameSite === 'none' && !secure && !warnedAboutSameSiteNone) {
    warnedAboutSameSiteNone = true;

    logger.warn(
      'cookieSameSite is "none" but the cookie is not Secure, and every browser rejects that combination. ' +
        'Serve over https, or set cookieSecure: true if TLS terminates upstream.',
    );
  }

  return {
    // Never configurable: a session token readable from JavaScript is a session
    // token one XSS away from being stolen.
    httpOnly: true,
    path: config.path,
    sameSite: config.sameSite,
    secure,
    ...(config.domain ? { domain: config.domain } : {}),
  };
};

/** Exposed for tests; the warning is once-per-process by design. */
export const resetCookieWarnings = (): void => {
  warnedAboutSameSiteNone = false;
};
