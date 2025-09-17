import { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { Enforcer } from 'casbin';

type InjectedRequest = Request & {
  enforcer?: Enforcer;
  payload?: { id: string; account?: string; domain?: string } & Record<string, unknown>;
  casbinPermissionChecker?: (options: {
    enforcer: Enforcer;
    payload: { id: string; account?: string; domain?: string } & Record<string, unknown>;
    actions: [string, string][];
  }) => Promise<boolean>;
  _injectedEnforcer: symbol;
};

export const getRequestFromContext = (context: ExecutionContext): InjectedRequest => {
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
