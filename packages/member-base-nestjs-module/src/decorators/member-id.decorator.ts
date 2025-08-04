import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { BaseMemberEntity } from '../models/base-member.entity';

export const MemberId = createParamDecorator(
  (
    data,
    context: ExecutionContext & {
      payload: Pick<BaseMemberEntity, 'id' | 'account'>;
    },
  ): string | null => {
    return context.payload?.id ?? null;
  },
);
