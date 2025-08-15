import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { BaseMemberEntity } from '../models/base-member.entity';
import { getRequestFromContext } from '../utils/get-request-from-context';

export const Account = createParamDecorator(
  (
    data,
    context: ExecutionContext & {
      payload: Pick<BaseMemberEntity, 'id' | 'account'>;
    },
  ): string | null => {
    const request = getRequestFromContext(context);

    return request.payload?.account ?? null;
  },
);
