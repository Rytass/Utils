import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../utils/get-request-from-context';
import { CASBIN_ENFORCER } from '../typings/member-base-providers';

export const MemberId = createParamDecorator(
  (data, context: ExecutionContext): string | null => {
    const request = getRequestFromContext(context);

    if (request._injectedEnforcer !== CASBIN_ENFORCER) {
      throw new Error(
        '@Account decorator should configure with EnforcerMiddleware',
      );
    }

    return request.payload?.id ?? null;
  },
);
