import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { BaseMemberEntity } from '../models/base-member.entity';

export const Account = createParamDecorator(
  (data, context: ExecutionContext): string | null => {
    const payload = context.switchToHttp().getRequest().payload as
      | Pick<BaseMemberEntity, 'id' | 'account'>
      | undefined;

    return payload?.account ?? null;
  },
);
