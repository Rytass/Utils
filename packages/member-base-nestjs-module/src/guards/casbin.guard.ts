import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Enforcer } from 'casbin';
import {
  ACCESS_TOKEN_SECRET,
  CASBIN_ENFORCER,
  CASBIN_PERMISSION_CHECKER,
  CASBIN_PERMISSION_DECORATOR,
  COOKIE_MODE,
  ENABLE_GLOBAL_GUARD,
  REFRESH_TOKEN_SECRET,
} from '../typings/member-base-providers';
import { BaseMemberEntity } from '../models/base-member.entity';
import { type ReflectableDecorator, Reflector } from '@nestjs/core';
import { IS_ROUTE_PUBLIC } from '../decorators/is-public.decorator';
import { AllowActions } from '../decorators/action.decorator';
import { verify } from 'jsonwebtoken';
import { IS_ROUTE_ONLY_AUTHENTICATED } from '../decorators/authenticated.decorator';
import { getTokenFromContext } from '../utils/get-token-from-context';
import { getRequestFromContext } from '../utils/get-request-from-context';

export interface ContextPayload {
  token: string | null;
  payload?: Pick<BaseMemberEntity, 'id' | 'account'>;
  enforcer: Enforcer;
}

@Injectable()
export class CasbinGuard implements CanActivate {
  constructor(
    @Inject(COOKIE_MODE)
    private readonly cookieMode: boolean,
    @Inject(CASBIN_ENFORCER)
    private readonly enforcer: Enforcer,
    @Inject(ACCESS_TOKEN_SECRET)
    private readonly accessTokenSecret: string,
    @Inject(REFRESH_TOKEN_SECRET)
    private readonly refreshTokenSecret: string,
    @Inject(ENABLE_GLOBAL_GUARD)
    private readonly enableGlobalGuard: boolean,
    @Inject(CASBIN_PERMISSION_DECORATOR)
    private readonly permissionDecorator: ReflectableDecorator<any>,
    @Inject(CASBIN_PERMISSION_CHECKER)
    private readonly permissionChecker: ({
      enforcer,
      payload,
      actions,
    }: {
      enforcer: Enforcer;
      payload: { id: string; domain?: string };
      actions: any;
    }) => Promise<boolean>,
  ) {}

  async canActivate(
    context: ExecutionContext & {
      enforcer: Enforcer;
      payload: { id: string; domain?: string };
    },
  ): Promise<boolean> {
    const request = await getRequestFromContext(context);
    const token = await getTokenFromContext(context, this.cookieMode);

    if (token) {
      try {
        const payload = verify(token, this.cookieMode ? this.refreshTokenSecret : this.accessTokenSecret) as Pick<
          BaseMemberEntity,
          'id' | 'account'
        >;

        request.payload = payload;
      } catch (ex) {
        request.payload = undefined;
      }
    } else {
      request.payload = undefined;
    }

    request.enforcer = this.enforcer;
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

    return this.permissionChecker({
      enforcer: this.enforcer,
      payload: request.payload,
      actions: allowActions,
    });
  }
}
