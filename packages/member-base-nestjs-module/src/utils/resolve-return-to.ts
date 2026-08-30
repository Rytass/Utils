/**
 * How the token pair reaches a given destination.
 *
 * `cookie` is the default and means "whatever the module-level `cookieMode`
 * says" — cookies when it is on, query parameters on the destination when it is
 * off, exactly as before this option existed.
 *
 * `fragment` puts the pair after a `#`, which never leaves the browser: it is
 * not sent to the server, so it stays out of access logs and `Referer` headers,
 * and the operating system hands a custom-scheme url to a native app whole.
 */
export type ReturnToDelivery = 'cookie' | 'fragment';

/**
 * An allowlist entry that also says how tokens reach it.
 *
 * Delivery is a property of the **destination**, never of the request. A
 * `?delivery=` parameter would let anyone put a token pair on a web url, and a
 * web url is written to browser history, to `Referer`, and to every reverse
 * proxy log in front of it. Bound to the allowlist, it states a fact about the
 * deployment instead: *this* destination is a native app, and its urls are not
 * recorded anywhere.
 */
export interface AllowedReturnTo {
  /** Matched exactly as a bare string entry is — by origin, or by path prefix. */
  url: string;
  /** default: 'cookie' */
  delivery?: ReturnToDelivery;
}

/** A resolved destination and the way tokens are to reach it. */
export interface ReturnToTarget {
  url: string;
  delivery: ReturnToDelivery;
}

/**
 * Base for parsing a relative candidate. Never dereferenced, never emitted —
 * it exists only so `new URL` can resolve a path into a comparable shape.
 */
const RELATIVE_BASE = 'https://return-to.invalid';

/**
 * Characters that make the parser and the browser disagree.
 *
 * `new URL()` silently strips ASCII tab, LF and CR *before* parsing, per the
 * WHATWG URL spec. So `/\t/evil.test` looks like a path to any check performed
 * on the raw string, and parses as the protocol-relative url `//evil.test`.
 * A browser strips them too and navigates off-origin.
 *
 * The whole C0 range plus space and DEL is rejected rather than only those
 * three: none of them belongs in a redirect target, and an allowlist that
 * enumerates exactly the bypasses known today is one parser change away from
 * being wrong again.
 */
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARACTERS = /[\u0000-\u0020\u007f]/;

/**
 * Longest destination accepted.
 *
 * The value is stored in the transaction cookie, and browsers silently drop a
 * cookie over ~4KB — so an allowlisted origin plus a few kilobytes of query
 * string is a one-link login denial of service that ends in a puzzling 400.
 * Four figures is far beyond any real redirect target.
 */
const MAX_RETURN_TO_LENGTH = 1024;

/**
 * A same-origin candidate: a path, and unambiguously a path.
 *
 * `//evil.example` and `/\evil.example` both look relative and are read as
 * protocol-relative urls by browsers, which is the classic way an allowlist
 * that only checks the leading slash is walked straight past.
 */
const isRelativePath = (value: string): boolean =>
  value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\');

const parse = (value: string, relativeBase?: string): URL | null => {
  try {
    return new URL(value, relativeBase);
  } catch {
    return null;
  }
};

/** `/app` permits `/app` and `/app/settings`, but never `/application`. */
const pathAllows = (allowedPath: string, candidatePath: string): boolean => {
  if (allowedPath === '/' || allowedPath === '') return true;

  const normalized = allowedPath.endsWith('/') ? allowedPath.slice(0, -1) : allowedPath;

  return candidatePath === normalized || candidatePath.startsWith(`${normalized}/`);
};

const matches = (allowedEntry: string, candidate: URL, candidateIsRelative: boolean): boolean => {
  if (isRelativePath(allowedEntry)) {
    if (!candidateIsRelative) return false;

    return pathAllows(parse(allowedEntry, RELATIVE_BASE)?.pathname ?? '', candidate.pathname);
  }

  if (candidateIsRelative) return false;

  const allowed = parse(allowedEntry);

  if (!allowed) return false;

  // Origin comparison by protocol and host rather than `origin`, because a
  // custom scheme (`myapp://auth`) has an opaque origin that never matches
  // itself — and a native app redirect is exactly what this has to support.
  // WHATWG lowercases the host only for special schemes, so `myapp://AUTH`
  // and `myapp://auth` are different hosts to the parser and the same
  // destination to a native app. Fold both rather than surprise that caller.
  return (
    allowed.protocol === candidate.protocol &&
    allowed.host.toLowerCase() === candidate.host.toLowerCase() &&
    pathAllows(allowed.pathname, candidate.pathname)
  );
};

/**
 * Where the callback is allowed to send the browser.
 *
 * An unlisted destination silently becomes `fallback`. That is the whole point:
 * `returnTo` arrives from whoever built the link, so an unchecked value turns
 * the login endpoint into an open redirect — a phishing page reachable from a
 * url on the application's own domain, which is the shape credential-harvesting
 * campaigns look for.
 *
 * What is returned is the **parsed and re-serialised** url, never the caller's
 * original string. Returning the raw input is what turns any disagreement
 * between this parser and the browser's into a bypass; emitting only what was
 * actually inspected closes that class of bug rather than the one instance of
 * it that control characters happened to expose.
 */
export const resolveReturnTo = (
  /** Typed as a string, validated as unknown: it comes off the wire. */
  returnTo: string | undefined,
  allowedReturnTo: readonly (string | AllowedReturnTo)[],
  fallback: string,
): string => resolveReturnToTarget(returnTo, allowedReturnTo, fallback).url;

/**
 * The same resolution, plus which entry matched and therefore how tokens are
 * delivered there.
 *
 * The fallback is always `cookie`. It is not an allowlist entry, so nothing has
 * declared it safe to put a token pair on — and a destination reached because
 * the requested one was refused is the last place to start emitting
 * credentials.
 *
 * First match wins, so an entry ordered earlier decides the delivery for a
 * destination that several entries would admit.
 */
export const resolveReturnToTarget = (
  returnTo: string | undefined,
  allowedReturnTo: readonly (string | AllowedReturnTo)[],
  fallback: string,
): ReturnToTarget => {
  const fallbackTarget: ReturnToTarget = { url: fallback, delivery: 'cookie' };

  // Not `!returnTo`: a repeated query parameter (`?returnTo=/a&returnTo=/b`)
  // arrives from Express as an ARRAY, and every string method below would throw
  // on it — an unauthenticated 500 from a hand-written url. The type says
  // string; the wire does not have to agree, so this checks rather than trusts.
  if (typeof returnTo !== 'string' || returnTo === '' || allowedReturnTo.length === 0) return fallbackTarget;

  if (returnTo.length > MAX_RETURN_TO_LENGTH) return fallbackTarget;

  if (FORBIDDEN_CHARACTERS.test(returnTo)) return fallbackTarget;

  const candidateIsRelative = isRelativePath(returnTo);
  const candidate = parse(returnTo, candidateIsRelative ? RELATIVE_BASE : undefined);

  if (!candidate) return fallbackTarget;

  const entry = allowedReturnTo.find(candidateEntry =>
    matches(typeof candidateEntry === 'string' ? candidateEntry : candidateEntry.url, candidate, candidateIsRelative),
  );

  if (entry === undefined) return fallbackTarget;

  const delivery: ReturnToDelivery = typeof entry === 'string' ? 'cookie' : (entry.delivery ?? 'cookie');

  if (candidateIsRelative) {
    // The placeholder base must not leak into a same-origin destination, so a
    // relative candidate is re-serialised from its parts rather than from href.
    return { url: `${candidate.pathname}${candidate.search}${candidate.hash}`, delivery };
  }

  // Credentials are never compared — `matches` looks at protocol, host and path
  // — so emitting them would put uninspected attacker text in a Location header,
  // in the exact `https://trusted@evil` shape browsers warn about. Drop them.
  candidate.username = '';
  candidate.password = '';

  return { url: candidate.href, delivery };
};
