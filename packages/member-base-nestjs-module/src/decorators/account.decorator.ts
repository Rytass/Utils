import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from '../utils/get-request-from-context';

export const Account = createParamDecorator((data, context: ExecutionContext): string | null => {
  const request = getRequestFromContext(context);

  return request.payload?.account ?? null;
});
