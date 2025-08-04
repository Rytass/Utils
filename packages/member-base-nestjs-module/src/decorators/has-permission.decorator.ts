import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Action, Subject } from './action.decorator';
import { ContextPayload } from '../guards/casbin.guard';

type Resource = [Subject, Action];

export const HasPermission = createParamDecorator(
  ([object, action]: Resource, context: ExecutionContext) => {
    const contextType = context.getType<'http' | 'graphql'>();

    switch (contextType) {
      case 'graphql': {
        const { GqlExecutionContext } = require('@nestjs/graphql');

        const ctx = (
          GqlExecutionContext as {
            create: (context: ExecutionContext) => {
              getContext: () => ContextPayload;
            };
          }
        )
          .create(context)
          .getContext();

        return ctx.enforcer.enforce(ctx, object, action);
      }

      case 'http':
      default: {
        const ctx = context.switchToHttp().getRequest<ContextPayload>();

        return ctx.enforcer.enforce(ctx, object, action);
      }
    }
  },
);
