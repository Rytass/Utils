import type { Enforcer } from 'casbin';
import type { AuthTokenPayloadBase } from '../typings/auth-token-payload';

declare module 'express-serve-static-core' {
  interface Request {
    cookies?: Record<string, string>;
    enforcer?: Enforcer | null;
    payload?: AuthTokenPayloadBase;
    casbinPermissionChecker?: (options: {
      enforcer: Enforcer;
      payload: AuthTokenPayloadBase;
      actions: [string, string][];
    }) => Promise<boolean>;
  }
}
