import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Action, Subject } from './action.decorator';
import { getRequestFromContext } from '../utils/get-request-from-context';
import { normalizeCasbinDecision } from '../utils/normalize-casbin-decision';

type Resource = [Subject, Action];

export const HasPermission = createParamDecorator(([object, action]: Resource, context: ExecutionContext) => {
  const request = getRequestFromContext(context);

  if (!request.payload || !request.enforcer || !request.casbinPermissionChecker) return false;

  const result = request.casbinPermissionChecker({
    enforcer: request.enforcer,
    payload: request.payload,
    actions: [[object, action]],
    context,
    request,
  });

  if (result instanceof Promise) {
    return result.then(resolved => normalizeCasbinDecision(resolved).allowed);
  }

  return normalizeCasbinDecision(result).allowed;
});
