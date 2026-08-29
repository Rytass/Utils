// Microsoft Entra ID.
//
// Isolated behind its own entry point for symmetry with `/ldap` and
// `/oidc-provider`, not because it pulls a dependency in — everything here runs
// on Node's built-in `fetch` and the `jsonwebtoken` peer this package already
// requires. Neither `@azure/msal-node` nor `@microsoft/microsoft-graph-client`
// is needed, and neither is installed.
export {
  EntraAuthProvider,
  type EntraAuthOptions,
  type EntraAuthProviderOptions,
  type EntraCompositeDirectoryOptions,
  type EntraAuthProviderWithDirectory,
} from './providers/entra/entra-auth.provider';

export {
  EntraDirectoryProvider,
  type EntraDirectoryOptions,
  type EntraDirectoryListOptions,
  type EntraDeltaResult,
} from './providers/entra/entra-directory.provider';

export {
  EntraGraphClient,
  DEFAULT_AUTHORITY_BASE_URL,
  DEFAULT_GRAPH_BASE_URL,
  type EntraClientCertificate,
  type EntraGraphClientOptions,
} from './providers/entra/entra-graph-client';

// Types only. The attribute helpers behind them (buildSelect, readAccount,
// extractGroupNames, isAccountDisabled, readRemovalReason) stay internal: they
// are this provider's private plumbing, and two of them shared a name with the
// /ldap exports while taking a different argument type — which is a silent
// ambiguous-star-export for anyone re-exporting both subpaths from one barrel.
export type {
  EntraAccountAttribute,
  EntraDirectoryEntry,
  EntraDirectoryObjectRef,
  EntraRemovalReason,
} from './providers/entra/entra-attributes';
