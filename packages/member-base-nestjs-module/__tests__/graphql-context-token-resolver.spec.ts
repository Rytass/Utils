import {
  GraphQLContextTokenResolver,
  createGraphQLContextTokenResolver,
} from '../src/helpers/graphql-context-token-resolver';

describe('GraphQLContextTokenResolver', () => {
  it('should extract token from Authorization header with Bearer prefix', async () => {
    const context = {
      req: {
        headers: { authorization: 'Bearer test-token-123' },
        cookies: {},
      },
    };

    const result = await GraphQLContextTokenResolver(context);

    expect(result.token).toBe('test-token-123');
  });

  it('should extract token from Authorization header without Bearer prefix', async () => {
    const context = {
      req: {
        headers: { authorization: 'test-token-456' },
        cookies: {},
      },
    };

    const result = await GraphQLContextTokenResolver(context);

    expect(result.token).toBe('test-token-456');
  });

  it('should extract token from cookies', async () => {
    const context = {
      req: {
        headers: {},
        cookies: { access_token: 'cookie-token-789' },
      },
    };

    const result = await GraphQLContextTokenResolver(context);

    expect(result.token).toBe('cookie-token-789');
  });

  it('should prefer Authorization header over cookies', async () => {
    const context = {
      req: {
        headers: { authorization: 'Bearer header-token' },
        cookies: { access_token: 'cookie-token' },
      },
    };

    const result = await GraphQLContextTokenResolver(context);

    expect(result.token).toBe('header-token');
  });

  it('should return empty string when no token is present', async () => {
    const context = {
      req: {
        headers: {},
        cookies: {},
      },
    };

    const result = await GraphQLContextTokenResolver(context);

    expect(result.token).toBe('');
  });

  it('should trim whitespace from token', async () => {
    const context = {
      req: {
        headers: { authorization: 'Bearer   test-token-with-spaces   ' },
        cookies: {},
      },
    };

    const result = await GraphQLContextTokenResolver(context);

    expect(result.token).toBe('test-token-with-spaces');
  });

  it('should handle undefined cookies', async () => {
    const context = {
      req: {
        headers: {},
        cookies: undefined as unknown as Record<string, string>,
      },
    };

    const result = await GraphQLContextTokenResolver(context);

    expect(result.token).toBe('');
  });

  it('should preserve original context properties', async () => {
    const context = {
      req: {
        headers: { authorization: 'Bearer test-token' },
        cookies: {},
      },
    };

    const result = await GraphQLContextTokenResolver(context);

    expect(result).toEqual(expect.objectContaining(context));
    expect(result.token).toBe('test-token');
  });

  it('should return null token when an error occurs', async () => {
    // Create a context where accessing properties throws an error
    const context = {
      req: {
        get headers(): never {
          throw new Error('Simulated error');
        },
        cookies: {},
      },
    };

    const result = await GraphQLContextTokenResolver(
      context as {
        req: { headers: Record<string, string>; cookies: Record<string, string> };
      },
    );

    expect(result.token).toBe(null);
  });

  // It used to read a cookie called `token`, which this package has never
  // written, so context.token was empty for every cookie-authenticated caller.
  it('should read the cookie name the module actually writes', async () => {
    const result = await GraphQLContextTokenResolver({
      req: { headers: {}, cookies: { access_token: 'from-default-cookie' } },
    });

    expect(result.token).toBe('from-default-cookie');
  });

  it('should ignore the historical token cookie', async () => {
    const result = await GraphQLContextTokenResolver({
      req: { headers: {}, cookies: { token: 'stale-name' } },
    });

    expect(result.token).toBe('');
  });

  it('should accept a bearer prefix in any casing', async () => {
    const result = await GraphQLContextTokenResolver({
      req: { headers: { authorization: 'bearer lowercase-prefix' }, cookies: {} },
    });

    expect(result.token).toBe('lowercase-prefix');
  });
});

describe('createGraphQLContextTokenResolver', () => {
  it('should read a customised cookie name', async () => {
    const resolve = createGraphQLContextTokenResolver({ cookieName: 'sid' });

    const result = await resolve({ req: { headers: {}, cookies: { sid: 'custom-name' } } });

    expect(result.token).toBe('custom-name');
  });

  it('should still prefer the authorization header', async () => {
    const resolve = createGraphQLContextTokenResolver({ cookieName: 'sid' });

    const result = await resolve({
      req: { headers: { authorization: 'Bearer from-header' }, cookies: { sid: 'from-cookie' } },
    });

    expect(result.token).toBe('from-header');
  });

  it('should fall back to the default name when none is given', async () => {
    const resolve = createGraphQLContextTokenResolver();

    const result = await resolve({ req: { headers: {}, cookies: { access_token: 'default-name' } } });

    expect(result.token).toBe('default-name');
  });

  // The guard ignores cookies entirely when cookieMode is off. A resolver that
  // kept reading them would publish a token the guard had refused to trust —
  // one left over from before the mode was turned off, for instance.
  it('should ignore cookies when cookie mode is off, as the guard does', async () => {
    const resolve = createGraphQLContextTokenResolver({ cookieMode: false });

    const result = await resolve({ req: { headers: {}, cookies: { access_token: 'stale-cookie' } } });

    expect(result.token).toBe('');
  });

  it('should still read the header when cookie mode is off', async () => {
    const resolve = createGraphQLContextTokenResolver({ cookieMode: false });

    const result = await resolve({
      req: { headers: { authorization: 'Bearer from-header' }, cookies: { access_token: 'ignored' } },
    });

    expect(result.token).toBe('from-header');
  });
});
