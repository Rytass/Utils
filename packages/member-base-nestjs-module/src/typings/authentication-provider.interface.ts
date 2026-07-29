/**
 * Context handed to an authentication provider for a single attempt.
 *
 * Carries the ambient request information the gateway already knows about, so
 * providers do not have to reach for the request object themselves.
 */
export interface AuthContext {
  /** Client IP, recorded on the login log as a /32 cidr. */
  ip?: string;
  /** Casbin domain to stamp on the issued tokens, when the caller uses one. */
  domain?: string;
}

/**
 * The outcome of a successful authentication, before it is mapped onto a local
 * member.
 */
export interface AuthenticatedIdentity {
  /** Channel that vouched for this identity ('password', 'google', 'ldap', ...). */
  channel: string;

  /**
   * Stable identifier of the subject *within that channel*.
   *
   * Prefer an immutable value (an OIDC `sub`, an Active Directory objectGUID)
   * over something the directory lets users change, such as an account name or
   * an email address — the identifier is what the local binding is keyed on.
   */
  identifier: string;

  /**
   * Local member this identity is already known to belong to.
   *
   * The built-in password provider fills this in because it authenticates the
   * member record directly. External channels leave it undefined and let the
   * gateway resolve or provision the member.
   */
  memberId?: string;

  /**
   * Whether the channel actually verified the identifier it returned.
   *
   * Only meaningful for channels whose identifier is a user-claimable value
   * such as an email address. Account linking can be restricted to verified
   * identifiers via `linkExistingAccount: 'verified-only'`.
   */
  identifierVerified?: boolean;

  /** Free-form attributes from the channel (display name, groups, department...). */
  attributes?: Readonly<Record<string, unknown>>;
}

export type AuthProviderKind = 'credential' | 'redirect';

/**
 * A source of truth for "who is this user".
 *
 * Two shapes are supported. A `credential` provider is handed credentials and
 * answers synchronously (password, LDAP bind). A `redirect` provider sends the
 * user agent to a third party and resolves the identity from the callback
 * (OAuth2, OIDC).
 */
export interface AuthenticationProvider<Credentials = unknown> {
  readonly channel: string;
  readonly kind: AuthProviderKind;

  /** Required for `credential` providers. */
  authenticate?(credentials: Credentials, context?: AuthContext): Promise<AuthenticatedIdentity>;

  /** Required for `redirect` providers: where to send the user agent. */
  getAuthorizationUrl?(state: string, context?: AuthContext): Promise<string>;

  /** Required for `redirect` providers: resolve the identity from callback params. */
  handleCallback?(params: Record<string, string>, context?: AuthContext): Promise<AuthenticatedIdentity>;
}

/**
 * Decides what happens when an external identity has no local member yet.
 *
 * `true` provisions a passwordless member, `false` rejects the login, and a
 * function returns the member id to use (or null to reject) — which is how a
 * directory group check or an approval workflow is plugged in.
 */
export type AutoProvisionStrategy = boolean | ((identity: AuthenticatedIdentity) => Promise<string | null>);

/**
 * Decides whether an unbound external identity may claim an existing local
 * member whose `account` equals the identifier.
 *
 * `'verified-only'` requires the channel to have reported
 * `identifierVerified: true`, which is the meaningful setting whenever an
 * identifier is an email address.
 */
export type LinkExistingAccountStrategy = boolean | 'verified-only';
