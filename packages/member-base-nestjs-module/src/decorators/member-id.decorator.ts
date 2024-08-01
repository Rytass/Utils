import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getPayloadFromContext } from '../utils/get-payload-from-context';

export const MemberId = createParamDecorator(
  (data, context: ExecutionContext): string | null => {
    const payload = getPayloadFromContext(context);

    return payload?.id ?? null;
  },
);
