import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import type { Enforcer } from 'casbin';

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('@nestjs/graphql', () => ({ GqlExecutionContext: { create: jest.fn() } }));

import { verify } from 'jsonwebtoken';
import { CasbinGuard } from '../src/guards/casbin.guard';
import { AllowActions } from '../src/decorators/action.decorator';
import { getAuthScope } from '../src/utils/get-auth-scope';
import type { AuthCacheScope } from '../src/typings/auth-cache-scope';
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

const buildGuard = (checker: CasbinPermissionChecker, verificationScope?: AuthCacheScope): CasbinGuard =>
  new CasbinGuard(false, {} as Enforcer, 'test-secret', true, AllowActions, checker, 'access_token', verificationScope);

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
