import { ExecutionContext } from '@nestjs/common';
import { getRequestFromContext } from './get-request-from-context';

export const getTokenFromContext = async (
  context: ExecutionContext,
  cookieMode = false,
  cookieName = 'access_token',
): Promise<string | null> => {
  const request = await getRequestFromContext(context);

  const headerToken = (request.headers.authorization ?? '').replace(/^Bearer\s/i, '').trim();

  if (headerToken) return headerToken;

  if (cookieMode) {
    const cookieToken = request.cookies?.[cookieName];

    if (cookieToken) return cookieToken;
  }

  return null;
};
