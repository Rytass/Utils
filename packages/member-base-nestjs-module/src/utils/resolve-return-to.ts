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
  allowedReturnTo: readonly string[],
  fallback: string,
): string => {
  // Not `!returnTo`: a repeated query parameter (`?returnTo=/a&returnTo=/b`)
  // arrives from Express as an ARRAY, and every string method below would throw
  // on it — an unauthenticated 500 from a hand-written url. The type says
  // string; the wire does not have to agree, so this checks rather than trusts.
  if (typeof returnTo !== 'string' || returnTo === '' || allowedReturnTo.length === 0) return fallback;

  if (returnTo.length > MAX_RETURN_TO_LENGTH) return fallback;

  if (FORBIDDEN_CHARACTERS.test(returnTo)) return fallback;

  const candidateIsRelative = isRelativePath(returnTo);
  const candidate = parse(returnTo, candidateIsRelative ? RELATIVE_BASE : undefined);

  if (!candidate) return fallback;

  if (!allowedReturnTo.some(entry => matches(entry, candidate, candidateIsRelative))) return fallback;

  if (candidateIsRelative) {
    // The placeholder base must not leak into a same-origin destination, so a
    // relative candidate is re-serialised from its parts rather than from href.
    return `${candidate.pathname}${candidate.search}${candidate.hash}`;
  }

  // Credentials are never compared — `matches` looks at protocol, host and path
  // — so emitting them would put uninspected attacker text in a Location header,
  // in the exact `https://trusted@evil` shape browsers warn about. Drop them.
  candidate.username = '';
  candidate.password = '';

  return candidate.href;
};
