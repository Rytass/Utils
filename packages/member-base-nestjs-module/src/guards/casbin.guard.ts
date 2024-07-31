import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Enforcer } from 'casbin';
import { verify } from 'jsonwebtoken';
import { AllowActions } from '../decorators/action.decorator';
import { IS_ROUTE_PUBLIC } from '../decorators/is-public.decorator';
import {
  ACCESS_TOKEN_SECRET,
  CASBIN_ENFORCER,
  ENABLE_GLOBAL_GUARD,
} from '../typings/member-base-providers';
import { BaseMemberEntity } from '../models/base-member.entity';

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

    if (isPublic) return true;

    const allowActions = reflector.get(AllowActions, context.getHandler());

    if (!allowActions?.length) return false;

    const request = context.switchToHttp().getRequest();

    try {
      const token = (request.headers.authorization ?? '')
        .replace(/^Bearer\s/, '')
        .trim();

      if (!token) return false;

      const payload = verify(token, this.accessTokenSecret) as Pick<
        BaseMemberEntity,
        'id' | 'account'
      >;

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
