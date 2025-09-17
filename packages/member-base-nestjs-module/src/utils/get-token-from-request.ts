import { Request } from 'express';

export const getTokenFromRequest = async (
  req: Request,
  cookieMode = false,
  cookieName = 'access_token',
): Promise<string | null> => {
  const headerToken = (req.headers.authorization ?? '').replace(/^Bearer\s/i, '').trim();

  if (headerToken) return headerToken;

  if (cookieMode) {
    const cookieToken = req.cookies?.[cookieName];

    if (cookieToken) return cookieToken;
  }

  return null;
};
