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
  ENABLE_GLOBAL_GUARD,
} from '../typings/member-base-providers';
import { BaseMemberEntity } from '../models/base-member.entity';
import { Reflector } from '@nestjs/core';
import { IS_ROUTE_PUBLIC } from '../decorators/is-public.decorator';
import { AllowActions } from '../decorators/action.decorator';
import { verify } from 'jsonwebtoken';
import { IS_ROUTE_ONLY_AUTHENTICATED } from '../decorators/authenticated.decorator';

@Injectable()
export class CasbinGuard implements CanActivate {
  constructor(
    @Inject(CASBIN_ENFORCER)
    private readonly enforcer: Enforcer,
    @Inject(ACCESS_TOKEN_SECRET)
    private readonly accessTokenSecret: string,
    @Inject(ENABLE_GLOBAL_GUARD)
    private readonly enableGlobalGuard: boolean,
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

    const allowActions = reflector.get(AllowActions, context.getHandler());

    if (!allowActions?.length) return false;

    const contextType = context.getType<'http' | 'graphql'>();

    let token: string | null;

    switch (contextType) {
      case 'graphql': {
        const { GqlExecutionContext } = await import('@nestjs/graphql');

        const ctx = GqlExecutionContext.create(context).getContext<{
          token: string | null;
        }>();

        token = ctx?.token ?? null;
        break;
      }

      case 'http':
      default:
        token = (
          context.switchToHttp().getRequest().headers.authorization ?? ''
        )
          .replace(/^Bearer\s/, '')
          .trim();

        break;
    }

    if (!token) return false;

    try {
      const payload = verify(token, this.accessTokenSecret) as Pick<
        BaseMemberEntity,
        'id' | 'account'
      >;

      context.switchToHttp().getRequest().payload = payload;

      if (onlyAuthenticated) return true;

      return Promise.all(
        allowActions.map(([domain, subject, action]) =>
          this.enforcer.enforce(payload.id, domain, subject, action),
        ),
      ).then((results) => results.some((result) => result));
    } catch (ex) {
      return false;
    }
  }
}
