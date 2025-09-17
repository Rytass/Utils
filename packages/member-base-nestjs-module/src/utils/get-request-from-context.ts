import { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Enforcer } from 'casbin';
import type { AuthTokenPayloadBase } from '../typings/auth-token-payload';

type InjectedRequest = Request & {
  enforcer?: Enforcer | null;
  payload?: AuthTokenPayloadBase;
  casbinPermissionChecker?: (options: {
    enforcer: Enforcer;
    payload: AuthTokenPayloadBase;
    actions: [string, string][];
  }) => Promise<boolean>;
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
