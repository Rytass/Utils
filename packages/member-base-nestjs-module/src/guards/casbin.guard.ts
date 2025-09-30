import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
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
import { verify } from 'jsonwebtoken';
import { IS_ROUTE_ONLY_AUTHENTICATED } from '../decorators/authenticated.decorator';
import { getTokenFromContext } from '../utils/get-token-from-context';
import { getRequestFromContext } from '../utils/get-request-from-context';
import type { AuthTokenPayloadBase } from '../typings/auth-token-payload';

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
    private readonly permissionChecker: (params: {
      enforcer: Enforcer;
      payload: AuthTokenPayloadBase;
      actions: [Subject, Action][];
    }) => Promise<boolean>,
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
        const payload = verify(token, this.accessTokenSecret) as AuthTokenPayloadBase;

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

    if (!allowActions?.length && !onlyAuthenticated) return false;

    if (!token) return false;

    if (!request.payload) return false;

    if (onlyAuthenticated) return true;

    if (!this.enforcer) return false;

    return this.permissionChecker({ enforcer: this.enforcer, payload: request.payload, actions: allowActions });
  }
}
