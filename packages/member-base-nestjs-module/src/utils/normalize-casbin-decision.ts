import type { CasbinAuthorizationDecision, CasbinPermissionCheckerSyncResult } from '../typings/casbin-permission';

export const normalizeCasbinDecision = (result: CasbinPermissionCheckerSyncResult): CasbinAuthorizationDecision =>
  typeof result === 'boolean' ? { allowed: result } : result;
