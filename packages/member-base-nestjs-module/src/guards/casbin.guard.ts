import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
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
import { ReflectableDecorator, Reflector } from '@nestjs/core';
import { IS_ROUTE_PUBLIC } from '../decorators/is-public.decorator';
import { AllowActions } from '../decorators/action.decorator';
import { verify } from 'jsonwebtoken';
import { Request } from 'express';
import { IS_ROUTE_ONLY_AUTHENTICATED } from '../decorators/authenticated.decorator';

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
      payload: Pick<BaseMemberEntity, 'id' | 'account'>;
      actions: any;
    }) => Promise<boolean>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.enableGlobalGuard) return true;

    const reflector = new Reflector();

    const isPublic = reflector.get<boolean>(
      IS_ROUTE_PUBLIC,
      context.getHandler(),
    );

    const onlyAuthenticated = reflector.get<boolean>(
      IS_ROUTE_ONLY_AUTHENTICATED,
      context.getHandler(),
    );

    if (isPublic) return true;

    const allowActions = reflector.get(
      this.permissionDecorator ?? AllowActions,
      context.getHandler(),
    );

    if (!allowActions?.length && !onlyAuthenticated) return false;

    const contextType = context.getType<'http' | 'graphql'>();

    let token: string | null;

    switch (contextType) {
      case 'graphql': {
        const { GqlExecutionContext } = await import('@nestjs/graphql');

        const ctx = GqlExecutionContext.create(context).getContext<{
          req: Request;
        }>();

        token =
          (this.cookieMode
            ? ctx.req.cookies.token
            : (ctx.req.headers.authorization ?? '')
                .replace(/^Bearer\s/, '')
                .trim()) ?? null;
        break;
      }

      case 'http':
      default:
        token = (
          this.cookieMode
            ? context.switchToHttp().getRequest().cookies.token
            : (context.switchToHttp().getRequest().headers.authorization ?? '')
        )
          .replace(/^Bearer\s/, '')
          .trim();

        break;
    }

    if (!token) return false;

    try {
      const payload = verify(
        token,
        this.cookieMode ? this.refreshTokenSecret : this.accessTokenSecret,
      ) as Pick<BaseMemberEntity, 'id' | 'account'>;

      switch (contextType) {
        case 'graphql': {
          const { GqlExecutionContext } = await import('@nestjs/graphql');

          const ctx = GqlExecutionContext.create(context).getContext<{
            token: string | null;
            payload?: Pick<BaseMemberEntity, 'id' | 'account'>;
          }>();

          ctx.payload = payload;
          break;
        }

        case 'http':
        default:
          context.switchToHttp().getRequest().payload = payload;
          break;
      }

      if (onlyAuthenticated) return true;

      return this.permissionChecker({
        enforcer: this.enforcer,
        payload,
        actions: allowActions,
      });
    } catch (ex) {
      return false;
    }
  }
}
