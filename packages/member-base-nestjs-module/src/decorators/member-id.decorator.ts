import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { BaseMemberEntity } from '../models/base-member.entity';

export const MemberId = createParamDecorator(
  (data, context: ExecutionContext): string | null => {
    const payload = context.switchToHttp().getRequest().payload as
      | Pick<BaseMemberEntity, 'id' | 'account'>
      | undefined;

    return payload?.id ?? null;
  },
);
