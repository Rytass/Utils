import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { BaseMemberEntity } from '../models/base-member.entity';
import { getRequestFromContext } from '../utils/get-request-from-context';

export const MemberId = createParamDecorator(
  (data, context: ExecutionContext): string | null => {
    const request = getRequestFromContext(context);

    return request.payload?.id ?? null;
  },
);
