import { CanActivate, ExecutionContext, Inject, Injectable, Logger } from '@nestjs/common';
import { Enforcer } from 'casbin';
import {
  ACCESS_TOKEN_SECRET,
  CASBIN_ENFORCER,
  CASBIN_PERMISSION_CHECKER,
  CASBIN_PERMISSION_DECORATOR,
  COOKIE_MODE,
  ENABLE_GLOBAL_GUARD,
  ACCESS_TOKEN_COOKIE_NAME,
} from '../typings/member-base.tokens';
import { type ReflectableDecorator, Reflector } from '@nestjs/core';
import { IS_ROUTE_PUBLIC } from '../decorators/is-public.decorator';
import { AllowActions, type Subject, type Action } from '../decorators/action.decorator';
import jwt from 'jsonwebtoken';
import { IS_ROUTE_ONLY_AUTHENTICATED } from '../decorators/authenticated.decorator';
import { getTokenFromContext } from '../utils/get-token-from-context';
import { getRequestFromContext } from '../utils/get-request-from-context';
import { normalizeCasbinDecision } from '../utils/normalize-casbin-decision';
import type { AuthTokenPayloadBase } from '../typings/auth-token-payload';
import type { CasbinPermissionChecker } from '../typings/casbin-permission';
import {
  CasbinEnforcerUnavailableError,
  InvalidAccessTokenError,
  MissingAccessTokenError,
  PermissionDeniedError,
  RouteMissingPermissionMetadataError,
} from '../constants/errors/base.error';

const logger = new Logger('CasbinGuard');

/**
 * Handlers already reported as undecorated.
 *
 * Module level rather than per instance so a second guard instance — a
 * request-scoped one, a second module importing the guard — does not restart
 * the reporting, and weak so a handler can still be collected. The condition is
 * a property of the handler, not of the request, so one line per handler for
 * the lifetime of the process is the whole signal.
 */
const reportedUndecoratedHandlers = new WeakSet<object>();

const warnMissingPermissionMetadata = (context: ExecutionContext): void => {
  const handler = context.getHandler();

  if (reportedUndecoratedHandlers.has(handler)) return;

  reportedUndecoratedHandlers.add(handler);

  // getClass is the one context method this guard did not already need, and it
  // is reached only when something is misconfigured — a partial context (a
  // consumer's own guard test, say) must not turn the intended 403 into a
  // TypeError.
  const controllerName = context.getClass?.()?.name ?? 'unknown';

  logger.warn(
    `Route ${controllerName}.${handler.name} carries none of @AllowActions(), @Authenticated() or ` +
      '@IsPublic(), so it is denied to everyone including a super admin. Decorate it or remove it.',
  );
};

@Injectable()
export class CasbinGuard implements CanActivate {
  constructor(
    @Inject(COOKIE_MODE)
    private readonly cookieMode: boolean,
    @Inject(CASBIN_ENFORCER)
    private readonly enforcer: Enforcer | null,
    @Inject(ACCESS_TOKEN_SECRET)
    private readonly accessTokenSecret: string,
    @Inject(ENABLE_GLOBAL_GUARD)
    private readonly enableGlobalGuard: boolean,
    @Inject(CASBIN_PERMISSION_DECORATOR)
    private readonly permissionDecorator: ReflectableDecorator<[Subject, Action][]>,
    @Inject(CASBIN_PERMISSION_CHECKER)
    private readonly permissionChecker: CasbinPermissionChecker,
    @Inject(ACCESS_TOKEN_COOKIE_NAME)
    private readonly accessTokenCookieName: string,
  ) {}

  async canActivate(
    context: ExecutionContext & {
      enforcer: Enforcer;
      payload: { id: string; domain?: string };
    },
  ): Promise<boolean> {
    const request = await getRequestFromContext(context);
    const token = await getTokenFromContext(context, this.cookieMode, this.accessTokenCookieName);

    if (token) {
      try {
        const payload = jwt.verify(token, this.accessTokenSecret) as AuthTokenPayloadBase;

        request.payload = payload;
      } catch (_ex) {
        request.payload = undefined;
      }
    } else {
      request.payload = undefined;
    }

    request.enforcer = this.enforcer ?? undefined;
    request.casbinPermissionChecker = this.permissionChecker;

    if (!this.enableGlobalGuard) return true;

    const reflector = new Reflector();

    const isPublic = reflector.get<boolean>(IS_ROUTE_PUBLIC, context.getHandler());

    const onlyAuthenticated = reflector.get<boolean>(IS_ROUTE_ONLY_AUTHENTICATED, context.getHandler());

    if (isPublic) return true;

    const allowActions = reflector.get(this.permissionDecorator ?? AllowActions, context.getHandler());

    // Checked before the token, because a handler nobody decorated is broken
    // for every caller — who is asking does not change the answer.
    if (!allowActions?.length && !onlyAuthenticated) {
      warnMissingPermissionMetadata(context);

      throw new RouteMissingPermissionMetadataError();
    }

    if (!token) throw new MissingAccessTokenError();

    if (!request.payload) throw new InvalidAccessTokenError();

    if (onlyAuthenticated) return true;

    if (!this.enforcer) throw new CasbinEnforcerUnavailableError();

    const result = await this.permissionChecker({
      enforcer: this.enforcer,
      payload: request.payload,
      actions: allowActions,
      context,
      request,
    });

    const decision = normalizeCasbinDecision(result);

    // Written before the throw: an exception filter reading the request is the
    // only place left that can still see which domain and action were tried.
    request.casbinDecision = decision;

    if (!decision.allowed) throw new PermissionDeniedError(decision);

    return true;
  }
}
