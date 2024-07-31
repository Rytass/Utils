import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Enforcer } from 'casbin';
import { AllowActions } from '../decorators/action.decorator';
import { IS_ROUTE_PUBLIC } from '../decorators/is-public.decorator';
import { CASBIN_ENFORCER } from '../typings/member-base-providers';

@Injectable()
export class CasbinGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CASBIN_ENFORCER)
    private readonly enforcer: Enforcer,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>(
      IS_ROUTE_PUBLIC,
      context.getHandler(),
    );

    if (isPublic) return true;

    const allowActions = this.reflector.get(AllowActions, context.getHandler());

    if (!allowActions?.length) return false;

    const request = context.switchToHttp().getRequest() as Request;

    console.log(request, this.enforcer);

    return true;
  }
}
