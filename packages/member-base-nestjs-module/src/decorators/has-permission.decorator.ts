import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Action, Subject } from './action.decorator';
import { ContextPayload } from '../guards/casbin.guard';
import { CASBIN_ENFORCER } from '../typings/member-base-providers';
import { getRequestFromContext } from '../utils/get-request-from-context';

type Resource = [Subject, Action];

export const HasPermission = createParamDecorator(
  ([object, action]: Resource, context: ExecutionContext) => {
    const request = getRequestFromContext(context);

    if (request._injectedEnforcer !== CASBIN_ENFORCER) {
      throw new Error(
        '@HasPermission decorator should configure with EnforcerMiddleware',
      );
    }

    return (
      request.enforcer?.enforce(request.payload ?? {}, object, action) ?? false
    );
  },
);
