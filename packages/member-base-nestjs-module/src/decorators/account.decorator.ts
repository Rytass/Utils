import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { BaseMemberEntity } from '../models/base-member.entity';

export const Account = createParamDecorator(
  (
    data,
    context: ExecutionContext & {
      payload: Pick<BaseMemberEntity, 'id' | 'account'>;
    },
  ): string | null => {
    return context.payload?.account ?? null;
  },
);
