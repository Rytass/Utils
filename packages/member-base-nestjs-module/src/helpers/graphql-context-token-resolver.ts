/** Matches the module's own default; see `accessTokenCookieName`. */
const DEFAULT_ACCESS_TOKEN_COOKIE_NAME = 'access_token';

interface GraphQLContextLike {
  req: { headers: Record<string, string>; cookies: Record<string, string> };
}

export interface GraphQLContextTokenResolverOptions {
  /**
   * Cookie to read when there is no Authorization header. Must match
   * `accessTokenCookieName` on the module.
   *
   * default: 'access_token'
   */
  cookieName?: string;

  /**
   * Whether a cookie may supply the token at all. Mirror the module's own
   * `cookieMode`: the guard ignores cookies entirely when that is off, and a
   * resolver that kept reading them would publish a `context.token` the guard
   * had refused to trust — a stale cookie left over from before the mode was
   * turned off, say.
   *
   * default: true
   */
  cookieMode?: boolean;
}

/**
 * Build a GraphQL `context` function that publishes the caller's access token
 * as `context.token`.
 *
 * This is a convenience for an application's own resolvers. Authorization does
 * not depend on it: CasbinGuard reads the request directly through
 * getRequestFromContext, with whichever cookie name the module was configured
 * with.
 *
 * ```ts
 * GraphQLModule.forRoot({
 *   context: createGraphQLContextTokenResolver({ cookieName: 'sid' }),
 * });
 * ```
 */
export const createGraphQLContextTokenResolver = (
  options?: GraphQLContextTokenResolverOptions,
): ((context: GraphQLContextLike) => Promise<{ token: string | null }>) => {
  const cookieName = options?.cookieName ?? DEFAULT_ACCESS_TOKEN_COOKIE_NAME;
  const cookieMode = options?.cookieMode ?? true;

  return async (context: GraphQLContextLike): Promise<{ token: string | null }> => {
    try {
      // Header first, then cookie — the same precedence and the same gating the
      // guard applies, so context.token never disagrees with what authorized
      // the call.
      const cookieToken = cookieMode ? context.req.cookies?.[cookieName] : undefined;

      const token = (context.req.headers.authorization || cookieToken || '').replace(/^Bearer\s/i, '').trim();

      return {
        ...context,
        token,
      };
    } catch (_ex) {
      return {
        ...context,
        token: null,
      };
    }
  };
};

/**
 * The zero-configuration resolver, reading the default cookie name.
 *
 * It previously read a cookie called `token`, which this package has never
 * written under any configuration, so `context.token` was always empty whenever
 * the caller authenticated by cookie rather than by header. Use
 * createGraphQLContextTokenResolver when the name is customised.
 */
export const GraphQLContextTokenResolver = createGraphQLContextTokenResolver();
