import 'reflect-metadata';
import type { ExecutionContext, FactoryProvider } from '@nestjs/common';
import type { Enforcer } from 'casbin';

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('@nestjs/graphql', () => ({ GqlExecutionContext: { create: jest.fn() } }));

import { verify } from 'jsonwebtoken';
import { CasbinGuard } from '../src/guards/casbin.guard';
import { AllowActions } from '../src/decorators/action.decorator';
import { createDefaultPermissionChecker } from '../src/constants/default-permission-checker';
import { OptionProviders } from '../src/constants/option-providers';
import { CASBIN_PERMISSION_CHECKER } from '../src/typings/member-base.tokens';
import { getAuthScope } from '../src/utils/get-auth-scope';
import type { AuthCacheScope } from '../src/typings/auth-cache-scope';
import type { MemberBaseModuleOptionsDTO } from '../src/typings/member-base-module-options.dto';
import type { CasbinAuthorizationDecision, CasbinPermissionChecker } from '../src/typings/casbin-permission';

const mockVerify = verify as jest.MockedFunction<typeof verify>;

const { GqlExecutionContext } = jest.requireMock('@nestjs/graphql') as {
  GqlExecutionContext: { create: jest.Mock };
};

type MutableRequest = {
  headers: Record<string, string>;
  payload?: unknown;
  casbinDecision?: CasbinAuthorizationDecision;
};

class TestResolver {
  @AllowActions([['article', 'read']])
  guardedField(): void {}
}

const MEMBER_ID = 'member-1';

const createRequest = (token = 'valid-token'): MutableRequest => ({
  headers: { authorization: `Bearer ${token}` },
});

/**
 * One field resolution: `operationContext` is the GraphQL context value shared
 * by every field of one operation, `req` the HTTP request underneath it.
 */
const createFieldContext = (params: {
  req: MutableRequest;
  operationContext: object;
  args?: Record<string, unknown>;
  operation?: 'query' | 'mutation' | 'subscription';
}): ExecutionContext => {
  const resolverArgs = [
    {},
    params.args ?? {},
    params.operationContext,
    { operation: { operation: params.operation ?? 'query' } },
  ];

  const context = {
    getType: (): string => 'graphql',
    getArgByIndex: (index: number): unknown => resolverArgs[index],
    getHandler: () => TestResolver.prototype.guardedField,
    getClass: () => TestResolver,
  } as unknown as ExecutionContext;

  return context;
};

const createHttpContext = (request: object): ExecutionContext =>
  ({
    getType: (): string => 'http',
    switchToHttp: () => ({ getRequest: (): object => request }),
  }) as unknown as ExecutionContext;

// The guard reads req through GqlExecutionContext; route every context to the
// req it was built with.
const routeGqlContexts = (pairs: [ExecutionContext, MutableRequest][]): void => {
  GqlExecutionContext.create.mockImplementation((source: ExecutionContext) => {
    const pair = pairs.find(([context]) => context === source);

    return pair
      ? {
          getContext: (): { req: MutableRequest } => ({ req: pair[1] }),
          getArgs: (): Record<string, unknown> => (source.getArgByIndex(1) as Record<string, unknown>) ?? {},
        }
      : undefined;
  });
};

const createEnforcer = (
  enforce: (sub: string, dom: string, obj: string, act: string) => Promise<boolean> = async (): Promise<boolean> =>
    true,
): { enforcer: Enforcer; hasGroupingPolicy: jest.Mock; enforce: jest.Mock } => {
  const mocks = {
    hasGroupingPolicy: jest.fn(async () => false),
    enforce: jest.fn(enforce),
  };

  return { enforcer: mocks as unknown as Enforcer, ...mocks };
};

const buildGuard = (checker: CasbinPermissionChecker, verificationScope?: AuthCacheScope): CasbinGuard =>
  new CasbinGuard(false, {} as Enforcer, 'test-secret', true, AllowActions, checker, 'access_token', verificationScope);

const buildCheckerFromOptions = (options: MemberBaseModuleOptionsDTO): Promise<CasbinPermissionChecker> => {
  const provider = OptionProviders.find(
    candidate => (candidate as FactoryProvider).provide === CASBIN_PERMISSION_CHECKER,
  ) as FactoryProvider<CasbinPermissionChecker>;

  return (provider.useFactory as (options?: MemberBaseModuleOptionsDTO) => Promise<CasbinPermissionChecker>)(options);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockVerify.mockReturnValue({ id: MEMBER_ID } as unknown as ReturnType<typeof verify>);
});

describe('getAuthScope', () => {
  it('is the request over HTTP', () => {
    const request = {};

    expect(getAuthScope(createHttpContext(request))).toBe(request);
  });

  it('is the operation context over GraphQL, not the shared req', () => {
    const req = createRequest();
    const operationContext = { req };

    expect(getAuthScope(createFieldContext({ req, operationContext }))).toBe(operationContext);
  });

  it('is absent for a subscription and without a context', () => {
    const req = createRequest();

    expect(getAuthScope(createFieldContext({ req, operationContext: { req }, operation: 'subscription' }))).toBeNull();
    expect(getAuthScope(undefined)).toBeNull();
  });

  it('is absent for websocket and microservice contexts', () => {
    for (const type of ['ws', 'rpc']) {
      const context = {
        getType: (): string => type,
        switchToHttp: () => ({ getRequest: (): object => ({}) }),
      } as unknown as ExecutionContext;

      expect(getAuthScope(context)).toBeNull();
    }
  });
});

describe('default checker with casbinPermissionCacheScope', () => {
  const actions: [string, string][] = [['article', 'read']];

  it('decides once for concurrent fields of one operation', async () => {
    const { enforcer, enforce, hasGroupingPolicy } = createEnforcer();
    const checker = createDefaultPermissionChecker(undefined, undefined, { cacheScope: 'operation' });
    const req = createRequest();
    const operationContext = { req };

    const results = await Promise.all(
      Array.from({ length: 50 }, () =>
        checker({
          enforcer,
          payload: { id: MEMBER_ID },
          actions,
          context: createFieldContext({ req, operationContext }),
        }),
      ),
    );

    expect(results.every(result => result === true)).toBe(true);
    expect(hasGroupingPolicy).toHaveBeenCalledTimes(1);
    expect(enforce).toHaveBeenCalledTimes(1);
  });

  it('does not let one resolved domain answer for another within an operation', async () => {
    const { enforcer, enforce } = createEnforcer(async (_sub, dom) => dom === 'project:a');
    const checker = createDefaultPermissionChecker(
      ({ context }) => [`project:${(context?.getArgByIndex(1) as { projectId: string }).projectId}`],
      undefined,
      { cacheScope: 'operation' },
    );

    const req = createRequest();
    const operationContext = { req };
    const check = (projectId: string): ReturnType<CasbinPermissionChecker> =>
      checker({
        enforcer,
        payload: { id: MEMBER_ID },
        actions,
        context: createFieldContext({ req, operationContext, args: { projectId } }),
      });

    await expect(check('a')).resolves.toEqual({ allowed: true, matchedDomain: 'project:a', matchedAction: actions[0] });
    await expect(check('b')).resolves.toEqual({ allowed: false });
    await expect(check('a')).resolves.toMatchObject({ allowed: true });
    expect(enforce).toHaveBeenCalledTimes(2);
  });

  it('decides afresh in another operation sharing the same req (batched request)', async () => {
    const { enforcer, enforce } = createEnforcer();
    const checker = createDefaultPermissionChecker(undefined, undefined, { cacheScope: 'operation' });
    const req = createRequest();

    for (const operationContext of [{ req }, { req }]) {
      await checker({
        enforcer,
        payload: { id: MEMBER_ID },
        actions,
        context: createFieldContext({ req, operationContext }),
      });
    }

    expect(enforce).toHaveBeenCalledTimes(2);
  });

  it('never reuses inside a subscription', async () => {
    const { enforcer, enforce } = createEnforcer();
    const checker = createDefaultPermissionChecker(undefined, undefined, { cacheScope: 'operation' });
    const req = createRequest();
    const operationContext = { req };

    for (let index = 0; index < 3; index += 1) {
      await checker({
        enforcer,
        payload: { id: MEMBER_ID },
        actions,
        context: createFieldContext({ req, operationContext, operation: 'subscription' }),
      });
    }

    expect(enforce).toHaveBeenCalledTimes(3);
  });

  it('retries after a rejected check instead of inheriting the failure', async () => {
    const { enforcer, enforce } = createEnforcer();
    const checker = createDefaultPermissionChecker(undefined, undefined, { cacheScope: 'operation' });
    const req = createRequest();
    const operationContext = { req };
    const check = (): ReturnType<CasbinPermissionChecker> =>
      checker({
        enforcer,
        payload: { id: MEMBER_ID },
        actions,
        context: createFieldContext({ req, operationContext }),
      });

    enforce.mockRejectedValueOnce(new Error('adapter down'));

    await expect(check()).rejects.toThrow('adapter down');
    await expect(check()).resolves.toBe(true);
    expect(enforce).toHaveBeenCalledTimes(2);
  });

  it('hands each caller its own decision object', async () => {
    const { enforcer } = createEnforcer();
    const checker = createDefaultPermissionChecker(() => ['tenant'], undefined, { cacheScope: 'operation' });
    const req = createRequest();
    const operationContext = { req };
    const check = (): ReturnType<CasbinPermissionChecker> =>
      checker({
        enforcer,
        payload: { id: MEMBER_ID },
        actions,
        context: createFieldContext({ req, operationContext }),
      });

    const first = (await check()) as CasbinAuthorizationDecision;

    first.allowed = false;

    await expect(check()).resolves.toMatchObject({ allowed: true });
  });

  it('does not hand out the route metadata tuple as matchedAction', async () => {
    const { enforcer } = createEnforcer();
    const routeActions: [string, string][] = [['article', 'read']];
    const checker = createDefaultPermissionChecker(() => ['tenant'], undefined, { cacheScope: 'operation' });
    const req = createRequest();
    const operationContext = { req };

    const decision = (await checker({
      enforcer,
      payload: { id: MEMBER_ID },
      actions: routeActions,
      context: createFieldContext({ req, operationContext }),
    })) as CasbinAuthorizationDecision;

    (decision.matchedAction as [string, string])[0] = 'tampered';

    expect(routeActions).toEqual([['article', 'read']]);
    await expect(
      checker({
        enforcer,
        payload: { id: MEMBER_ID },
        actions: routeActions,
        context: createFieldContext({ req, operationContext }),
      }),
    ).resolves.toMatchObject({ matchedAction: ['article', 'read'] });
  });

  it('decides afresh once the reuse window has passed', async () => {
    const { enforcer, enforce } = createEnforcer();
    const checker = createDefaultPermissionChecker(undefined, undefined, { cacheScope: 'operation' });
    const req = createRequest();
    const operationContext = { req };
    const now = jest.spyOn(performance, 'now').mockReturnValue(1_000_000);
    const check = (): ReturnType<CasbinPermissionChecker> =>
      checker({
        enforcer,
        payload: { id: MEMBER_ID },
        actions,
        context: createFieldContext({ req, operationContext }),
      });

    await check();
    await check();

    now.mockReturnValue(1_000_000 + 61 * 1000);

    await check();

    expect(enforce).toHaveBeenCalledTimes(2);

    now.mockRestore();
  });

  it('keeps reusing fresh entries after older ones expire', async () => {
    const { enforcer, enforce } = createEnforcer();
    const checker = createDefaultPermissionChecker(
      ({ context }) => [`project:${(context?.getArgByIndex(1) as { projectId: string }).projectId}`],
      undefined,
      { cacheScope: 'operation' },
    );

    const req = createRequest();
    const operationContext = { req };
    const now = jest.spyOn(performance, 'now').mockReturnValue(1_000_000);
    const check = (projectId: string): ReturnType<CasbinPermissionChecker> =>
      checker({
        enforcer,
        payload: { id: MEMBER_ID },
        actions,
        context: createFieldContext({ req, operationContext, args: { projectId } }),
      });

    await check('a'); // super-admin lookup aside, enforce #1
    now.mockReturnValue(1_000_000 + 30 * 1000);
    await check('b'); // enforce #2
    now.mockReturnValue(1_000_000 + 61 * 1000);
    await check('c'); // a has expired and is swept; enforce #3
    await check('b'); // still fresh, reused
    await check('a'); // expired, decided again: enforce #4

    expect(enforce).toHaveBeenCalledTimes(4);

    now.mockRestore();
  });

  it('stays off for any value other than operation', async () => {
    for (const cacheScope of [null, 'Operation', 'request'] as unknown as AuthCacheScope[]) {
      const { enforcer, enforce } = createEnforcer();
      const checker = createDefaultPermissionChecker(undefined, undefined, { cacheScope });
      const req = createRequest();
      const operationContext = { req };

      for (let index = 0; index < 2; index += 1) {
        await checker({
          enforcer,
          payload: { id: MEMBER_ID },
          actions,
          context: createFieldContext({ req, operationContext }),
        });
      }

      expect(enforce).toHaveBeenCalledTimes(2);
    }
  });

  it('keeps deciding on every call when the scope is none', async () => {
    const { enforcer, enforce } = createEnforcer();
    const checker = createDefaultPermissionChecker();
    const req = createRequest();
    const operationContext = { req };

    for (let index = 0; index < 3; index += 1) {
      await checker({
        enforcer,
        payload: { id: MEMBER_ID },
        actions,
        context: createFieldContext({ req, operationContext }),
      });
    }

    expect(enforce).toHaveBeenCalledTimes(3);
  });

  it('refuses to start with a custom checker', async () => {
    await expect(
      buildCheckerFromOptions({ casbinPermissionChecker: async () => true, casbinPermissionCacheScope: 'operation' }),
    ).rejects.toThrow(/casbinPermissionCacheScope only applies to the default permission checker/);

    await expect(
      buildCheckerFromOptions({ casbinPermissionChecker: async () => true, casbinPermissionCacheScope: 'none' }),
    ).resolves.toEqual(expect.any(Function));

    await expect(
      buildCheckerFromOptions({
        casbinPermissionChecker: async () => true,
        casbinPermissionCacheScope: null as unknown as AuthCacheScope,
      }),
    ).resolves.toEqual(expect.any(Function));
  });
});

describe('CasbinGuard with accessTokenVerificationCacheScope', () => {
  const allowAll: CasbinPermissionChecker = async () => true;

  const runFields = async (guard: CasbinGuard, contexts: [ExecutionContext, MutableRequest][]): Promise<boolean[]> => {
    routeGqlContexts(contexts);

    const results: boolean[] = [];

    for (const [context] of contexts) {
      results.push(await guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0]));
    }

    return results;
  };

  it('verifies once per operation and keeps the payload when the token expires partway', async () => {
    const guard = buildGuard(allowAll, 'operation');
    const req = createRequest();
    const operationContext = { req };
    const first = createFieldContext({ req, operationContext });
    const second = createFieldContext({ req, operationContext });

    routeGqlContexts([
      [first, req],
      [second, req],
    ]);

    await expect(guard.canActivate(first as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);

    mockVerify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    await expect(guard.canActivate(second as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);
    expect(req.payload).toEqual({ id: MEMBER_ID });
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('gives each field its own copy of the reused payload', async () => {
    const guard = buildGuard(allowAll, 'operation');
    const req = createRequest();
    const operationContext = { req };
    const first = createFieldContext({ req, operationContext });
    const second = createFieldContext({ req, operationContext });

    routeGqlContexts([
      [first, req],
      [second, req],
    ]);

    mockVerify.mockReturnValue({ id: MEMBER_ID, scopes: ['read'] } as unknown as ReturnType<typeof verify>);

    await guard.canActivate(first as Parameters<CasbinGuard['canActivate']>[0]);
    (req.payload as { id: string }).id = 'tampered';
    (req.payload as { scopes: string[] }).scopes.push('write');
    await guard.canActivate(second as Parameters<CasbinGuard['canActivate']>[0]);

    expect(req.payload).toEqual({ id: MEMBER_ID, scopes: ['read'] });
    expect(mockVerify).toHaveBeenCalledTimes(1);
  });

  it('verifies again for another operation, another token or a subscription', async () => {
    const guard = buildGuard(allowAll, 'operation');
    const req = createRequest();
    const operationContext = { req };
    const otherTokenReq = createRequest('other-token');

    await runFields(guard, [
      [createFieldContext({ req, operationContext }), req],
      [createFieldContext({ req, operationContext: { req } }), req],
      [createFieldContext({ req: otherTokenReq, operationContext }), otherTokenReq],
      [createFieldContext({ req, operationContext: { req }, operation: 'subscription' }), req],
    ]);

    expect(mockVerify).toHaveBeenCalledTimes(4);
  });

  it('verifies again once the reuse window has passed', async () => {
    const guard = buildGuard(allowAll, 'operation');
    const req = createRequest();
    const operationContext = { req };
    const now = jest.spyOn(performance, 'now').mockReturnValue(1_000_000);

    await runFields(guard, [[createFieldContext({ req, operationContext }), req]]);

    now.mockReturnValue(1_000_000 + 61 * 1000);

    await runFields(guard, [[createFieldContext({ req, operationContext }), req]]);

    expect(mockVerify).toHaveBeenCalledTimes(2);

    now.mockRestore();
  });

  it('verifies every field when left at the default', async () => {
    const guard = buildGuard(allowAll);
    const req = createRequest();
    const operationContext = { req };

    await runFields(guard, [
      [createFieldContext({ req, operationContext }), req],
      [createFieldContext({ req, operationContext }), req],
    ]);

    expect(mockVerify).toHaveBeenCalledTimes(2);
  });
});
