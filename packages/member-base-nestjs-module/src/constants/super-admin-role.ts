// Well-known Casbin role that the default permission checker treats as allow-all.
// A member holding this grouping policy (in DEFAULT_CASBIN_DOMAIN) is granted every
// guarded action regardless of the requested domain. Consumers can grant it to other
// members via `enforcer.addGroupingPolicy(memberId, SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN)`.
export const SUPER_ADMIN_ROLE = '::SUPER_ADMIN::';
