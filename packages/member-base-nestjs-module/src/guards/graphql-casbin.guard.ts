import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Enforcer } from 'casbin';
import {
  CASBIN_ENFORCER,
  ENABLE_GLOBAL_GUARD,
} from '../typings/member-base-providers';
import { BaseMemberEntity } from '../models/base-member.entity';
import { Reflector } from '@nestjs/core';
import { IS_ROUTE_PUBLIC } from '../decorators/is-public.decorator';
import { AllowActions } from '../decorators/action.decorator';

@Injectable()
export class GraphQLCasbinGuard implements CanActivate {
  constructor(
    @Inject(CASBIN_ENFORCER)
    private readonly enforcer: Enforcer,
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

    const { GqlExecutionContext } = await import('@nestjs/graphql');

    const ctx = GqlExecutionContext.create(context).getContext<Pick<
      BaseMemberEntity,
      'id' | 'account'
    > | null>();

    if (!ctx) return false;

    return Promise.all(
      allowActions.map(([domain, subject, action]) =>
        this.enforcer.enforce(ctx.id, domain, subject, action),
      ),
    ).then((results) => results.some((result) => result));
  }
}