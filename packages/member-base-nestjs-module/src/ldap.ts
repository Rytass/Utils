// LDAP authentication source.
//
// Isolated behind its own entry point so that `ldapts` is only required by
// applications that actually authenticate against a directory. Importing the
// package root never reaches this module.
export { LdapAuthProvider } from './providers/ldap/ldap-auth.provider';
export type { LdapAuthProviderOptions, LdapCredentials, LdapDirectoryEntry } from './providers/ldap/ldap-auth.provider';
export {
  normalizeAccountInput,
  escapeFilterValue,
  formatObjectGuid,
  isAccountDisabled,
  extractGroupNames,
} from './providers/ldap/ldap-attributes';
