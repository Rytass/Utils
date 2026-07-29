import type { MemberBaseOidcProviderOptions } from './oidc-provider.options';
import type { OidcProviderLike } from './oidc.factory';

export const MEMBER_BASE_OIDC_OPTIONS = Symbol('MEMBER_BASE_OIDC_OPTIONS') as symbol & {
  __type: MemberBaseOidcProviderOptions;
};

export const OIDC_PROVIDER_INSTANCE = Symbol('OIDC_PROVIDER_INSTANCE') as symbol & {
  __type: OidcProviderLike;
};

export const OIDC_ROUTE_PREFIX = Symbol('OIDC_ROUTE_PREFIX') as symbol & { __type: string };
