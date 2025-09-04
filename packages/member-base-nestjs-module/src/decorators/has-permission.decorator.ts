import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Action, Subject } from './action.decorator';
import { getRequestFromContext } from '../utils/get-request-from-context';

type Resource = [Subject, Action];

export const HasPermission = createParamDecorator(([object, action]: Resource, context: ExecutionContext) => {
  const request = getRequestFromContext(context);

  if (!request.payload || !request.enforcer || !request.casbinPermissionChecker) return false;

  return request.casbinPermissionChecker({
    enforcer: request.enforcer,
    payload: request.payload,
    actions: [[object, action]],
  });
});
