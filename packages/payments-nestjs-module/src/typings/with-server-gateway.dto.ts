import type { Request, Response } from 'express';

export interface WithServerGateway {
  defaultServerListener?: (req: Request, res: Response) => Promise<void> | void;
}
