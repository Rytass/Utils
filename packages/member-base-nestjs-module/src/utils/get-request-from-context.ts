import { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { Enforcer } from 'casbin';
import { BaseMemberEntity } from '../models/base-member.entity';

type InjectedRequest = Request & {
  enforcer?: Enforcer;
  payload?: Pick<BaseMemberEntity, 'id' | 'account'> & { domain?: string };
  casbinPermissionChecker?: (options: {
    enforcer: Enforcer;
    payload: Pick<BaseMemberEntity, 'id' | 'account'>;
    actions: any;
  }) => Promise<boolean>;
  _injectedEnforcer: symbol;
};

export const getRequestFromContext = (
  context: ExecutionContext,
): InjectedRequest => {
  const contextType = context.getType<'http' | 'graphql'>();

  switch (contextType) {
    case 'graphql': {
      const { GqlExecutionContext } = require('@nestjs/graphql') as {
        GqlExecutionContext: {
          create: (context: ExecutionContext) => {
            getContext: () => { req: InjectedRequest };
          };
        };
      };

      return GqlExecutionContext.create(context).getContext().req;
    }

    case 'http':
    default:
      return context.switchToHttp().getRequest<InjectedRequest>();
  }
};
