import type { ExecutionContext } from '@nestjs/common';
import type { GqlExecutionContext } from '@nestjs/graphql';
import type { BaseMemberEntity } from '../models/base-member.entity';

export const getPayloadFromContext = (
  context: ExecutionContext,
): Pick<BaseMemberEntity, 'id' | 'account'> | undefined => {
  const contextType = context.getType<'http' | 'graphql'>();

  switch (contextType) {
    case 'graphql': {
      const { GqlExecutionContext } = require('@nestjs/graphql') as {
        GqlExecutionContext: {
          create(context: ExecutionContext): GqlExecutionContext;
        };
      };

      const ctx = GqlExecutionContext.create(context).getContext<{
        token: string | null;
        payload?: Pick<BaseMemberEntity, 'id' | 'account'>;
      }>();

      return ctx.payload;
    }

    case 'http':
    default:
      return context.switchToHttp().getRequest().payload;
  }
};
