import 'reflect-metadata';
import { ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext, FactoryProvider } from '@nestjs/common';
import type { Enforcer } from 'casbin';

jest.mock('jsonwebtoken', () => ({ verify: jest.fn() }));
jest.mock('@nestjs/graphql', () => ({ GqlExecutionContext: { create: jest.fn() } }));

import { verify } from 'jsonwebtoken';
import { CasbinGuard } from '../src/guards/casbin.guard';
import { AllowActions } from '../src/decorators/action.decorator';
import { IsPublic } from '../src/decorators/is-public.decorator';
import { Authenticated } from '../src/decorators/authenticated.decorator';
import { OptionProviders } from '../src/constants/option-providers';
import { CASBIN_PERMISSION_CHECKER } from '../src/typings/member-base.tokens';
import type { MemberBaseModuleOptionsDTO } from '../src/typings/member-base-module-options.dto';
import type {
  CasbinAuthorizationDecision,
  CasbinDomainResolverParams,
  CasbinPermissionChecker,
} from '../src/typings/casbin-permission';
import {
  CasbinEnforcerUnavailableError,
  InvalidAccessTokenError,
  MissingAccessTokenError,
  PermissionDeniedError,
  RouteMissingPermissionMetadataError,
} from '../src/constants/errors/base.error';

const mockVerify = verify as jest.MockedFunction<typeof verify>;

const { GqlExecutionContext } = jest.requireMock('@nestjs/graphql') as {
  GqlExecutionContext: { create: jest.Mock };
};

type MutableRequest = {
  headers: Record<string, string>;
  payload?: unknown;
  enforcer?: unknown;
  casbinPermissionChecker?: unknown;
  casbinDecision?: CasbinAuthorizationDecision;
};

class TestController {
  @IsPublic()
  publicRoute(): void {}

  @Authenticated()
  authenticatedRoute(): void {}

  @AllowActions([['article', 'read']])
  guardedRoute(): void {}

  plainRoute(): void {}

  // The undecorated-handler warning is deduplicated per handler for the
  // lifetime of the process, so a test asserting on it needs a handler no other
  // test has already reported.
  firstUnreportedPlainRoute(): void {}

  secondUnreportedPlainRoute(): void {}
}

const createHttpContext = (request: MutableRequest, handler: () => void): ExecutionContext =>
  ({
    getType: jest.fn().mockReturnValue('http'),
    switchToHttp: jest.fn().mockReturnValue({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => TestController,
  }) as unknown as ExecutionContext;

const createGraphqlContext = (
  request: MutableRequest,
  handler: () => void,
  args: Record<string, unknown> = {},
): ExecutionContext => {
  const context = {
    getType: jest.fn().mockReturnValue('graphql'),
    getHandler: () => handler,
    getClass: () => TestController,
  } as unknown as ExecutionContext;

  GqlExecutionContext.create.mockImplementation((source: ExecutionContext) =>
    source === context
      ? {
          getContext: (): { req: MutableRequest } => ({ req: request }),
          getArgs: (): Record<string, unknown> => args,
        }
      : undefined,
  );

  return context;
};

const createRequest = (token = 'valid-token'): MutableRequest => ({
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

const buildGuard = (params: {
  checker: CasbinPermissionChecker;
  enforcer?: Enforcer | null;
  cookieMode?: boolean;
  enableGlobalGuard?: boolean;
}): CasbinGuard =>
  new CasbinGuard(
    params.cookieMode ?? false,
    'enforcer' in params ? (params.enforcer ?? null) : ({} as Enforcer),
    'test-secret',
    params.enableGlobalGuard ?? true,
    AllowActions,
    params.checker,
    'access_token',
  );

const buildDefaultChecker = (options?: MemberBaseModuleOptionsDTO): Promise<CasbinPermissionChecker> => {
  const provider = OptionProviders.find(
    candidate => (candidate as FactoryProvider).provide === CASBIN_PERMISSION_CHECKER,
  ) as FactoryProvider<CasbinPermissionChecker>;

  return (provider.useFactory as (options?: MemberBaseModuleOptionsDTO) => Promise<CasbinPermissionChecker>)(options);
};

describe('CasbinGuard', () => {
  const payload = { id: 'member-1', account: 'user@example.com' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockReturnValue(payload as unknown as ReturnType<typeof verify>);
  });

  describe('checker invocation contract', () => {
    it('should pass context and request to the permission checker (HTTP)', async () => {
      const checker = jest.fn().mockResolvedValue(true);
      const enforcer = {} as Enforcer;
      const guard = buildGuard({ checker, enforcer });
      const request = createRequest();
      const handler = TestController.prototype.guardedRoute;
      const context = createHttpContext(request, handler);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);

      expect(checker).toHaveBeenCalledWith({
        enforcer,
        payload,
        actions: [['article', 'read']],
        context,
        request,
      });
    });

    it('should pass context and request to the permission checker (GraphQL)', async () => {
      const checker = jest.fn().mockResolvedValue(true);
      const enforcer = {} as Enforcer;
      const guard = buildGuard({ checker, enforcer });
      const request = createRequest();
      const handler = TestController.prototype.guardedRoute;
      const context = createGraphqlContext(request, handler);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);

      expect(checker).toHaveBeenCalledWith({
        enforcer,
        payload,
        actions: [['article', 'read']],
        context,
        request,
      });
    });
  });

  describe('decision normalization', () => {
    it('should normalize a boolean result into request.casbinDecision', async () => {
      const guard = buildGuard({ checker: jest.fn().mockResolvedValue(true) });
      const request = createRequest();
      const context = createHttpContext(request, TestController.prototype.guardedRoute);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);

      expect(request.casbinDecision).toEqual({ allowed: true });
    });

    it('should keep a rich decision object on request.casbinDecision and gate by allowed', async () => {
      const decision: CasbinAuthorizationDecision = {
        allowed: true,
        matchedDomain: 'project:42',
        matchedAction: ['document', 'read'],
        meta: { via: 'organization-inheritance' },
      };

      const guard = buildGuard({ checker: jest.fn().mockResolvedValue(decision) });
      const request = createRequest();
      const context = createHttpContext(request, TestController.prototype.guardedRoute);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);

      expect(request.casbinDecision).toBe(decision);
    });

    it('should deny when the decision object is not allowed', async () => {
      const guard = buildGuard({ checker: jest.fn().mockResolvedValue({ allowed: false }) });
      const request = createRequest();
      const context = createHttpContext(request, TestController.prototype.guardedRoute);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).rejects.toThrow(
        PermissionDeniedError,
      );

      expect(request.casbinDecision).toEqual({ allowed: false });
    });
  });

  describe('distinguishable denials', () => {
    const denyingContext = (
      handler: () => void,
      token = 'valid-token',
    ): { request: MutableRequest; context: ExecutionContext } => {
      const request = createRequest(token);

      return { request, context: createHttpContext(request, handler) };
    };

    it('should answer 401 when no token was presented', async () => {
      const checker = jest.fn();
      const guard = buildGuard({ checker });
      const { context } = denyingContext(TestController.prototype.guardedRoute, '');

      const error = await guard
        .canActivate(context as Parameters<CasbinGuard['canActivate']>[0])
        .catch((ex: unknown) => ex);

      expect(error).toBeInstanceOf(MissingAccessTokenError);
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as MissingAccessTokenError).getStatus()).toBe(401);
      expect((error as MissingAccessTokenError).message).toBe('Access token is missing');
      expect(checker).not.toHaveBeenCalled();
    });

    // The reporting case: an @Authenticated() route reached without a session
    // is the one denial an application genuinely should log the user out for,
    // and it used to be indistinguishable from a policy denial.
    it('should answer 401 on an authenticated-only route without a token', async () => {
      const guard = buildGuard({ checker: jest.fn() });
      const { context } = denyingContext(TestController.prototype.authenticatedRoute, '');

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).rejects.toThrow(
        MissingAccessTokenError,
      );
    });

    it('should answer 401 when the token does not verify', async () => {
      mockVerify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const guard = buildGuard({ checker: jest.fn() });
      const { context } = denyingContext(TestController.prototype.guardedRoute);

      const error = await guard
        .canActivate(context as Parameters<CasbinGuard['canActivate']>[0])
        .catch((ex: unknown) => ex);

      expect(error).toBeInstanceOf(InvalidAccessTokenError);
      expect((error as InvalidAccessTokenError).getStatus()).toBe(401);
      expect((error as InvalidAccessTokenError).message).toBe('Access token is invalid or expired');
    });

    it('should answer 403 when the policy denies an authenticated caller', async () => {
      const guard = buildGuard({ checker: jest.fn().mockResolvedValue({ allowed: false }) });
      const { context } = denyingContext(TestController.prototype.guardedRoute);

      const error = await guard
        .canActivate(context as Parameters<CasbinGuard['canActivate']>[0])
        .catch((ex: unknown) => ex);

      expect(error).toBeInstanceOf(PermissionDeniedError);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as PermissionDeniedError).getStatus()).toBe(403);
      expect((error as PermissionDeniedError).message).toBe('Permission denied');
    });

    it('should carry the decision on the thrown 403', async () => {
      const decision: CasbinAuthorizationDecision = {
        allowed: false,
        matchedDomain: 'project:42',
        reason: 'Editing a locked document is not permitted',
      };

      const guard = buildGuard({ checker: jest.fn().mockResolvedValue(decision) });
      const { request, context } = denyingContext(TestController.prototype.guardedRoute);

      const error = await guard
        .canActivate(context as Parameters<CasbinGuard['canActivate']>[0])
        .catch((ex: unknown) => ex);

      expect((error as PermissionDeniedError).message).toBe('Editing a locked document is not permitted');
      expect((error as PermissionDeniedError).decision).toBe(decision);
      // Also on the request, for an exception filter that reads it from there.
      expect(request.casbinDecision).toBe(decision);
    });

    it('should answer 403 with a configuration error when the handler carries no metadata', async () => {
      const guard = buildGuard({ checker: jest.fn() });
      const { context } = denyingContext(TestController.prototype.plainRoute);

      const error = await guard
        .canActivate(context as Parameters<CasbinGuard['canActivate']>[0])
        .catch((ex: unknown) => ex);

      expect(error).toBeInstanceOf(RouteMissingPermissionMetadataError);
      expect((error as RouteMissingPermissionMetadataError).getStatus()).toBe(403);
      expect((error as RouteMissingPermissionMetadataError).message).toBe('Route has no permission metadata');
    });

    it('should answer 403 with a configuration error when no enforcer is configured', async () => {
      const guard = buildGuard({ checker: jest.fn(), enforcer: null });
      const { context } = denyingContext(TestController.prototype.guardedRoute);

      const error = await guard
        .canActivate(context as Parameters<CasbinGuard['canActivate']>[0])
        .catch((ex: unknown) => ex);

      expect(error).toBeInstanceOf(CasbinEnforcerUnavailableError);
      expect((error as CasbinEnforcerUnavailableError).getStatus()).toBe(403);
      expect((error as CasbinEnforcerUnavailableError).message).toBe('Casbin enforcer is not configured');
    });

    it('should warn once per undecorated handler, naming it', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const guard = buildGuard({ checker: jest.fn() });

      const deny = async (handler: () => void): Promise<void> => {
        const { context } = denyingContext(handler);

        await guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0]).catch(() => undefined);
      };

      await deny(TestController.prototype.firstUnreportedPlainRoute);
      await deny(TestController.prototype.firstUnreportedPlainRoute);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('TestController.firstUnreportedPlainRoute');

      await deny(TestController.prototype.secondUnreportedPlainRoute);

      expect(warn).toHaveBeenCalledTimes(2);

      warn.mockRestore();
    });
  });

  describe('backward compatibility regression', () => {
    it('should keep a legacy checker (destructuring only three fields) working', async () => {
      const legacyChecker = ({
        enforcer,
        payload: tokenPayload,
        actions,
      }: {
        enforcer: Enforcer;
        payload: { id: string };
        actions: [string, string][];
      }): Promise<boolean> => enforcer.enforce(tokenPayload.id, 'legacy-domain', actions[0][0], actions[0][1]);

      const enforce = jest.fn().mockResolvedValue(true);
      const guard = buildGuard({
        checker: legacyChecker as CasbinPermissionChecker,
        enforcer: { enforce } as unknown as Enforcer,
      });

      const request = createRequest();
      const context = createHttpContext(request, TestController.prototype.guardedRoute);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);

      expect(enforce).toHaveBeenCalledWith('member-1', 'legacy-domain', 'article', 'read');
      expect(request.casbinDecision).toEqual({ allowed: true });
    });

    it('should call the default checker with the same enforce arguments as before when no new option is set', async () => {
      const enforce = jest.fn().mockResolvedValue(true);
      const hasGroupingPolicy = jest.fn().mockResolvedValue(false);
      const checker = await buildDefaultChecker(undefined);
      const guard = buildGuard({ checker, enforcer: { enforce, hasGroupingPolicy } as unknown as Enforcer });
      const request = createRequest();
      const context = createHttpContext(request, TestController.prototype.guardedRoute);

      mockVerify.mockReturnValue({ ...payload, domain: 'tenant:a' } as unknown as ReturnType<typeof verify>);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);

      expect(enforce).toHaveBeenCalledTimes(1);
      expect(enforce).toHaveBeenCalledWith('member-1', 'tenant:a', 'article', 'read');
    });

    it('should allow public routes without calling the checker', async () => {
      const checker = jest.fn();
      const guard = buildGuard({ checker });
      const context = createHttpContext(createRequest(''), TestController.prototype.publicRoute);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);

      expect(checker).not.toHaveBeenCalled();
    });

    it('should allow authenticated routes with a valid token without calling the checker', async () => {
      const checker = jest.fn();
      const guard = buildGuard({ checker });
      const context = createHttpContext(createRequest(), TestController.prototype.authenticatedRoute);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);

      expect(checker).not.toHaveBeenCalled();
    });

    it('should deny routes without metadata', async () => {
      const guard = buildGuard({ checker: jest.fn() });
      const context = createHttpContext(createRequest(), TestController.prototype.plainRoute);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).rejects.toThrow(
        RouteMissingPermissionMetadataError,
      );
    });

    it('should deny guarded routes without a token', async () => {
      const checker = jest.fn();
      const guard = buildGuard({ checker });
      const context = createHttpContext(createRequest(''), TestController.prototype.guardedRoute);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).rejects.toThrow(
        MissingAccessTokenError,
      );

      expect(checker).not.toHaveBeenCalled();
    });

    it('should deny guarded routes when enforcer is null', async () => {
      const guard = buildGuard({ checker: jest.fn(), enforcer: null });
      const context = createHttpContext(createRequest(), TestController.prototype.guardedRoute);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).rejects.toThrow(
        CasbinEnforcerUnavailableError,
      );
    });

    it('should bypass checks but still decorate the request when the global guard is disabled', async () => {
      const checker = jest.fn();
      const enforcer = {} as Enforcer;
      const guard = buildGuard({ checker, enforcer, enableGlobalGuard: false });
      const request = createRequest();
      const context = createHttpContext(request, TestController.prototype.guardedRoute);

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);

      expect(request.payload).toEqual(payload);
      expect(request.enforcer).toBe(enforcer);
      expect(request.casbinPermissionChecker).toBe(checker);
      expect(checker).not.toHaveBeenCalled();
    });
  });

  describe('casbinDomainResolver integration (GraphQL args to domain)', () => {
    it('should resolve the domain from GraphQL args through the ExecutionContext', async () => {
      const domainResolver = ({ context: executionContext }: CasbinDomainResolverParams): string[] => {
        const args = GqlExecutionContext.create(executionContext).getArgs() as { projectId: string };

        return [`project:${args.projectId}`];
      };

      const checker = await buildDefaultChecker({ casbinDomainResolver: domainResolver });
      const enforce = jest.fn().mockResolvedValue(true);
      const hasGroupingPolicy = jest.fn().mockResolvedValue(false);
      const guard = buildGuard({ checker, enforcer: { enforce, hasGroupingPolicy } as unknown as Enforcer });
      const request = createRequest();
      const context = createGraphqlContext(request, TestController.prototype.guardedRoute, { projectId: '42' });

      await expect(guard.canActivate(context as Parameters<CasbinGuard['canActivate']>[0])).resolves.toBe(true);

      expect(enforce).toHaveBeenCalledWith('member-1', 'project:42', 'article', 'read');
      expect(request.casbinDecision).toEqual({
        allowed: true,
        matchedDomain: 'project:42',
        matchedAction: ['article', 'read'],
      });
    });
  });
});
