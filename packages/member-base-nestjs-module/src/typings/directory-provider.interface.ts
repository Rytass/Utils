import type { AuthenticatedIdentity, AuthenticationProvider } from './authentication-provider.interface';

/**
 * A raw directory entry, in whatever shape the source returned it.
 *
 * Deliberately untyped beyond "an object": an LDAP entry and a Microsoft Graph
 * user share no attribute names, and normalising them here would mean throwing
 * away the provider-specific fields a caller reached for the directory to get.
 * A provider may narrow it through the `Entry` type parameter; a caller holding
 * the interface's default sees the untyped form, which is honest — that caller
 * does not know which directory answered.
 */
export type DirectoryEntry = Record<string, unknown>;

/**
 * The attribute set every directory maps onto, by meaning rather than by field
 * name.
 *
 * `AuthenticatedIdentity.attributes` is an untyped bag by design — a channel may
 * carry anything — but the directory sources deliberately agree on these keys so
 * that one reconciliation handler serves all of them. Writing that agreement
 * down is what makes it a contract a third implementor can target instead of a
 * convention two implementors happen to share.
 *
 * Every field is optional: a directory that does not publish a department
 * should omit it rather than invent one.
 */
export interface DirectoryIdentityAttributes {
  /** Human-facing account name, in whatever attribute the directory is keyed on. */
  account?: string;
  /** Display name. */
  name?: string;
  email?: string;
  title?: string;
  department?: string;
  /** Group names — never group ids, and never roles. */
  groups?: string[];
  /** Whether the source considers the account disabled. */
  disabled?: boolean;
}

/**
 * What a listing can be narrowed by.
 *
 * Carries no shared query field. There is none to share: LDAP takes an RFC 4515
 * filter, Graph takes OData, SCIM takes SCIM syntax and the Google Directory
 * API takes a `query` in a fourth dialect — so one `filter` name over four
 * incompatible languages would let a caller write a portable
 * `findAllUsers({ filter })` that is wrong for most directories at runtime.
 *
 * `__dialect` exists so this is enforced rather than merely intended. An *empty*
 * interface is `{}`, which TypeScript exempts from excess-property checking, so
 * `findAllUsers({ filter: '(objectClass=user)' })` would compile against the
 * base type and the guarantee would be decorative. One optional `never` member
 * is enough to make the type non-empty and turn that call into a compile error.
 * It is never read and never set.
 *
 * The consequence is deliberate: after `isDirectoryProvider()` you hold the
 * *base* type and may call `findAllUsers()` with no options, which is the only
 * portable listing. To pass a dialect you must hold the concrete provider,
 * because passing one means you already know which directory answered.
 */
export interface DirectoryListOptions {
  readonly __dialect?: never;
}

/** How an entry left the directory's scope, for sources that can tell. */
export type DirectoryRemovalReason = 'changed' | 'deleted';

export interface DirectoryRemovedEntry {
  readonly id: string;
  /**
   * `changed` means removed from scope but recoverable (soft-deleted, moved out
   * of the searched container); `deleted` means permanently gone. Kept apart
   * rather than collapsed into a boolean because suspending a member and
   * erasing a binding are different decisions, and only the application can
   * make them.
   */
  readonly reason: DirectoryRemovalReason;
}

export interface DirectoryDeltaResult<Entry extends DirectoryEntry = DirectoryEntry> {
  readonly entries: Entry[];
  readonly removed: DirectoryRemovedEntry[];
  /**
   * Opaque resume point. **The caller persists it** — a provider that stored it
   * would be holding a tenant-wide cursor as a per-process fact, which is the
   * same statelessness rule that keeps the PKCE verifier out of
   * `OidcAuthProvider`.
   */
  readonly cursor: string;
}

/**
 * A source of truth for "who is in the directory", as opposed to
 * `AuthenticationProvider`'s "who is this user".
 *
 * `LdapAuthProvider` has answered both questions since it shipped; this
 * interface only gives the second one a name, so a caller can reach it through
 * `AuthenticationGateway.getProvider()` without a cast. Nothing here is
 * scheduled and nothing runs on its own — reconciliation cadence, upsert rules
 * and failure handling stay with the application.
 */
export interface DirectoryProvider<
  ListOptions extends DirectoryListOptions = DirectoryListOptions,
  Entry extends DirectoryEntry = DirectoryEntry,
> {
  /**
   * Channel this directory speaks for.
   *
   * Load-bearing rather than informational: bindings are keyed on
   * `(identity.channel, identity.identifier)`, so a directory that reports a
   * channel no registered `AuthenticationProvider` serves writes binding rows
   * that no login can ever match.
   */
  readonly channel: string;

  /** Look one entry up by whatever the provider treats as the account key. */
  findUser(account: string): Promise<Entry | null>;

  /**
   * Every entry the provider is configured to see.
   *
   * Fully materialised: the whole result set is in memory before the caller
   * sees the first row. That is fine for a directory of thousands and a poor
   * fit for one of hundreds of thousands, where narrowing through `options` —
   * or an incremental read via `findChangedUsers` — is the intended answer.
   */
  findAllUsers(options?: ListOptions): Promise<Entry[]>;

  /**
   * What changed since `cursor`, for a directory that can answer incrementally.
   *
   * Optional because not every source can — the same reason `authenticate` and
   * `handleCallback` are optional on `AuthenticationProvider`. `null` means "no
   * cursor yet", which is a full read that returns the first one.
   */
  findChangedUsers?(cursor: string | null): Promise<DirectoryDeltaResult<Entry>>;

  /**
   * Map an entry onto the identity shape the gateway consumes, so a
   * reconciliation job and a login share one attribute mapping.
   *
   * `attributes` should follow `DirectoryIdentityAttributes`.
   */
  toIdentity(entry: Entry): AuthenticatedIdentity;
}

/**
 * Whether a provider also reads its directory.
 *
 * Replaces the `as unknown as LdapAuthProvider` cast that was previously the
 * only way to reach these methods off `getProvider()`. The check is structural
 * rather than an `instanceof` because directory capability is a property of the
 * configuration, not of the class: `EntraAuthProvider` carries these methods
 * only when a `directory` block was supplied, and answers `false` here when it
 * was not.
 *
 * It does not report whether the directory can answer incrementally — probe
 * `findChangedUsers` on the narrowed provider for that, exactly as the gateway
 * probes `authenticate` and `handleCallback`.
 */
export const isDirectoryProvider = (
  provider: AuthenticationProvider,
): provider is AuthenticationProvider & DirectoryProvider => {
  const candidate = provider as Partial<DirectoryProvider>;

  return (
    typeof candidate.channel === 'string' &&
    typeof candidate.findUser === 'function' &&
    typeof candidate.findAllUsers === 'function' &&
    typeof candidate.toIdentity === 'function'
  );
};
