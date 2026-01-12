import { GraphQLContextTokenResolver } from '../src/helpers/graphql-context-token-resolver';

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
        cookies: { token: 'cookie-token-789' },
      },
    };

    const result = await GraphQLContextTokenResolver(context);

    expect(result.token).toBe('cookie-token-789');
  });

  it('should prefer Authorization header over cookies', async () => {
    const context = {
      req: {
        headers: { authorization: 'Bearer header-token' },
        cookies: { token: 'cookie-token' },
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
});
