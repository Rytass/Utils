import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../utils/get-request-from-context';

export const MemberId = createParamDecorator((_data, context: ExecutionContext): string | null => {
  const request = getRequestFromContext(context);

  return request.payload?.id ?? null;
});
