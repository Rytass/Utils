import { Request } from 'express';

export const getTokenFromRequest = async (req: Request, cookieMode = false): Promise<string | null> => {
  return (cookieMode ? req.cookies.token : (req.headers.authorization ?? '').replace(/^Bearer\s/, '').trim()) ?? null;
};
