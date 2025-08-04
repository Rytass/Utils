import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Action, Subject } from './action.decorator';
import { Enforcer } from 'casbin';
import { BaseMemberEntity } from '../models/base-member.entity';
import { getRequestFromContext } from '../utils/get-request-from-context';

type Resource = [Subject, Action];

export const HasPermission = createParamDecorator(
  ([object, action]: Resource, context: ExecutionContext) => {
    const request = getRequestFromContext(context);

    return (
      request.enforcer?.enforce(request.payload ?? {}, object, action) ?? false
    );
  },
);
