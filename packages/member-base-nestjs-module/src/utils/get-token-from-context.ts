import { ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from './get-request-from-context';

export const getTokenFromContext = async (context: ExecutionContext, cookieMode = false): Promise<string | null> => {
  const request = await getRequestFromContext(context);

  return (
    (cookieMode ? request.cookies.token : (request.headers.authorization ?? '').replace(/^Bearer\s/, '').trim()) ?? null
  );
};
