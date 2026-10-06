interface CookieSource {
  cookies?: Record<string, string>;
  headers?: Record<string, string | string[] | undefined>;
}

/** RFC 6265 lets a value be wrapped in double quotes; they are not part of it. */
const unquote = (value: string): string =>
  value.length >= 2 && value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;

/**
 * Every value a request carries for one cookie name, the parsed one first.
 *
 * A browser sends more than one cookie of the same name when they were set
 * with different paths or domains — which a sibling subdomain can do on
 * purpose. A reader that wants "the" cookie takes the first; one that has to
 * act on all of them, like a logout, takes every one.
 */
export const readCookies = (req: CookieSource, name: string): string[] => {
  const parsed = req.cookies?.[name];
  const header = req.headers?.cookie;

  const fromHeader =
    typeof header === 'string'
      ? header
          .split(';')
          .map(part => part.trim())
          .filter(part => part.startsWith(`${name}=`))
          .flatMap(part => {
            try {
              return [unquote(decodeURIComponent(part.slice(name.length + 1)))];
            } catch {
              // decodeURIComponent throws URIError on a malformed escape, and
              // the header is entirely attacker-controlled — `Cookie: oidc_tx=%`
              // would otherwise escape the handler as an unauthenticated 500
              // instead of the 400 that a bad transaction is supposed to produce.
              return [];
            }
          })
      : [];

  const values = typeof parsed === 'string' ? [parsed, ...fromHeader] : fromHeader;

  return values.filter((value, index) => value !== '' && values.indexOf(value) === index);
};

/**
 * Read one cookie without assuming `cookie-parser` is installed.
 *
 * The guard reads `req.cookies` and treats its absence as "no cookie", which
 * is fine for a token that also arrives in a header. The callers of this have
 * no second source — a redirect login's transaction, the refresh token a
 * logout revokes — and failing, or quietly doing half the job, because a
 * middleware is missing is worth not doing silently.
 */
export const readCookie = (req: CookieSource, name: string): string | undefined => readCookies(req, name)[0];
