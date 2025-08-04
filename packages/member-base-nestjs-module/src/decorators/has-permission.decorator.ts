import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Action, Subject } from './action.decorator';
import { Enforcer } from 'casbin';
import { BaseMemberEntity } from '../models/base-member.entity';

type Resource = [Subject, Action];

export const HasPermission = createParamDecorator(
  (
    [object, action]: Resource,
    context: ExecutionContext & {
      enforcer: Enforcer;
      payload: Pick<BaseMemberEntity, 'id' | 'account'>;
    },
  ) => {
    return (
      context.enforcer?.enforce(context.payload ?? {}, object, action) ?? false
    );
  },
);
