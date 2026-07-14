import type {
  CasbinAuthorizationDecision,
  CasbinDomainResolver,
  CasbinPermissionChecker,
  CasbinPermissionCheckerParams,
} from '../typings/casbin-permission';
import { DEFAULT_CASBIN_DOMAIN } from './default-casbin-domain';
import { SUPER_ADMIN_ROLE } from './super-admin-role';

// Builds the module's built-in Casbin permission checker. Extracted from the
// CASBIN_PERMISSION_CHECKER provider so it can be unit-tested directly.
//
// A member holding the SUPER_ADMIN_ROLE grouping (keyed to DEFAULT_CASBIN_DOMAIN)
// is short-circuit-allowed for every guarded action, regardless of the requested
// domain — this is how the default admin gets global allow-all access. Everyone
// else falls through to the original enforce-based logic, unchanged.
//
// The checker is only invoked with a non-null enforcer (the guard denies
// policy-guarded routes when the enforcer is null before reaching here).
export const createDefaultPermissionChecker = (domainResolver?: CasbinDomainResolver): CasbinPermissionChecker => {
  if (!domainResolver) {
    return async ({ enforcer, payload, actions }: CasbinPermissionCheckerParams): Promise<boolean> => {
      if (await enforcer.hasGroupingPolicy(payload.id, SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN)) {
        return true;
      }

      return Promise.all(
        actions.map(([subject, action]) =>
          enforcer.enforce(payload.id, payload.domain ?? DEFAULT_CASBIN_DOMAIN, subject, action),
        ),
      ).then(results => results.some(result => result));
    };
  }

  return async ({
    enforcer,
    payload,
    actions,
    context,
    request,
  }: CasbinPermissionCheckerParams): Promise<CasbinAuthorizationDecision> => {
    if (await enforcer.hasGroupingPolicy(payload.id, SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN)) {
      return { allowed: true, matchedDomain: DEFAULT_CASBIN_DOMAIN };
    }

    const resolved = await domainResolver({ context, request, payload, actions });
    const domains = Array.isArray(resolved) ? resolved : [resolved];

    if (!domains.length) return { allowed: false };

    const candidates = domains.flatMap(domain => actions.map(action => ({ domain, action })));

    const results = await Promise.all(
      candidates.map(({ domain, action }) => enforcer.enforce(payload.id, domain, action[0], action[1])),
    );

    const matchedIndex = results.findIndex(result => result);

    if (matchedIndex === -1) return { allowed: false };

    return {
      allowed: true,
      matchedDomain: candidates[matchedIndex].domain,
      matchedAction: candidates[matchedIndex].action,
    };
  };
};
