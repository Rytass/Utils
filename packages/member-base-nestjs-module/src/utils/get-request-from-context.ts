import { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { GqlExecutionContext as GQLContext } from '@nestjs/graphql';
import { Enforcer } from 'casbin';
import { BaseMemberEntity } from '../models/base-member.entity';

type InjectedRequest = Request & {
  enforcer?: Enforcer;
  payload?: Pick<BaseMemberEntity, 'id' | 'account'>;
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
          create(context: ExecutionContext): GQLContext;
        };
      };

      return GqlExecutionContext.create(context).getContext()
        .req as InjectedRequest;
    }

    case 'http':
    default:
      return context.switchToHttp().getRequest<InjectedRequest>();
  }
};
