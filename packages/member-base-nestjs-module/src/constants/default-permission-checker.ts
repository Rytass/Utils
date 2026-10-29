import type {
  CasbinAuthorizationDecision,
  CasbinDomainResolver,
  CasbinPermissionChecker,
  CasbinPermissionCheckerParams,
} from '../typings/casbin-permission';
import type { AuthCacheScope } from '../typings/auth-cache-scope';
import { createScopedMemo } from '../utils/scoped-memo';
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
/** Overrides for the two well-known names, when a policy table already uses them. */
export interface DefaultPermissionCheckerNames {
  superAdminRole?: string;
  defaultDomain?: string;
}

/** Where the checker may reuse what it decided — see `casbinPermissionCacheScope`. */
export interface DefaultPermissionCheckerCacheOptions {
  cacheScope?: AuthCacheScope;
}

export const createDefaultPermissionChecker = (
  domainResolver?: CasbinDomainResolver,
  names?: DefaultPermissionCheckerNames,
  cacheOptions?: DefaultPermissionCheckerCacheOptions,
): CasbinPermissionChecker => {
  const superAdminRole = names?.superAdminRole ?? SUPER_ADMIN_ROLE;
  const defaultDomain = names?.defaultDomain ?? DEFAULT_CASBIN_DOMAIN;
  const memo = createScopedMemo(cacheOptions?.cacheScope);

  // Keyed on what decides the answer and nothing else. The domains are the
  // resolved ones, in order: rows of one list that resolve to different
  // projects must not share a decision, and matchedDomain depends on the order.
  const isSuperAdmin = ({ enforcer, payload, context }: CasbinPermissionCheckerParams): Promise<boolean> =>
    memo(
      context,
      (): string => JSON.stringify(['super-admin', payload.id]),
      (): Promise<boolean> => enforcer.hasGroupingPolicy(payload.id, superAdminRole, defaultDomain),
    );

  const decide = (
    { enforcer, payload, actions, context }: CasbinPermissionCheckerParams,
    domains: string[],
  ): Promise<CasbinAuthorizationDecision> =>
    memo(
      context,
      (): string => JSON.stringify(['decision', payload.id, domains, actions]),
      async (): Promise<CasbinAuthorizationDecision> => {
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
      },
    );

  if (!domainResolver) {
    return async (params: CasbinPermissionCheckerParams): Promise<boolean> => {
      if (await isSuperAdmin(params)) return true;

      const decision = await decide(params, [params.payload.domain ?? defaultDomain]);

      return decision.allowed;
    };
  }

  return async (params: CasbinPermissionCheckerParams): Promise<CasbinAuthorizationDecision> => {
    if (await isSuperAdmin(params)) {
      return { allowed: true, matchedDomain: defaultDomain };
    }

    const { context, request, payload, actions } = params;
    // Asked on every call even when reuse is on: the answer depends on the
    // arguments and parent of the field being guarded, which is the whole
    // reason a resolver is configured.
    const resolved = await domainResolver({ context, request, payload, actions });
    const domains = Array.isArray(resolved) ? resolved : [resolved];

    if (!domains.length) return { allowed: false };

    // A copy per caller, down to matchedAction: request.casbinDecision is handed
    // to interceptors and filters, and one of them editing it must rewrite
    // neither the answer other fields reuse nor the route's own AllowActions
    // metadata, which the tuple comes from.
    const decision = await decide(params, domains);

    return decision.matchedAction ? { ...decision, matchedAction: [...decision.matchedAction] } : { ...decision };
  };
};
