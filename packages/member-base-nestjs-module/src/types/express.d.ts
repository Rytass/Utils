import type { Enforcer } from 'casbin';
import type { AuthTokenPayloadBase } from '../typings/auth-token-payload';
import type { CasbinAuthorizationDecision } from '../typings/casbin-permission';

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
    /**
     * What the permission checker decided, written by CasbinGuard whether or
     * not the call was allowed — so an exception filter handling the 403 can
     * still report which domain and action were tried.
     */
    casbinDecision?: CasbinAuthorizationDecision;
  }
}
