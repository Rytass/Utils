import { OidcAuthProvider } from '../oidc/oidc-auth.provider';
import {
  EntraDirectoryProvider,
  type EntraDeltaResult,
  type EntraDirectoryListOptions,
  type EntraDirectoryOptions,
} from './entra-directory.provider';
import { DEFAULT_AUTHORITY_BASE_URL, type EntraClientCertificate } from './entra-graph-client';
import type { EntraAccountAttribute, EntraDirectoryEntry } from './entra-attributes';
import type {
  AuthContext,
  AuthenticatedIdentity,
  AuthenticationProvider,
  AuthorizationRequest,
  AuthProviderKind,
} from '../../typings/authentication-provider.interface';
import type { DirectoryProvider } from '../../typings/directory-provider.interface';

/** The browser-facing half: an OpenID Connect authorization code flow. */
export interface EntraAuthOptions {
  clientId: string;
  /** Mutually exclusive with `clientCertificate`. */
  clientSecret?: string;
  /**
   * Certificate client authentication for the login half. Overrides the
   * composite's `clientCertificate`; omit both to fall back to a secret.
   */
  clientCertificate?: EntraClientCertificate;
  redirectUri: string;
  /** default: ['openid', 'profile', 'email'] */
  scope?: string[];
  /**
   * Claim used as the stable identifier for the local binding.
   * default: 'oid' — see the class comment for why this is not 'sub'.
   */
  identifierClaim?: string;
  /** default: true. */
  usePKCE?: boolean;
  /** Fetch the userinfo endpoint and merge its claims. default: false */
  fetchUserinfo?: boolean;
  /**
   * Claim carrying the account name, when the tenant's account key is not the
   * UPN.
   *
   * default: `preferred_username`, falling back to `upn` then `email`.
   *
   * A hybrid tenant configured with `directory.accountAttribute:
   * 'onPremisesSamAccountName'` keys accounts on sAMAccountName, but no
   * standard id token claim carries it — Entra emits it only if the app
   * registration is configured to, and the claim name is that configuration's
   * choice. Name it here so the login path and the directory path agree; leave
   * it unset and they will not (a warning says so once).
   */
  accountClaim?: string;
  /** prompt, login_hint, domain_hint, acr_values... */
  extraAuthorizationParams?: Record<string, string>;
  /**
   * Override the derived issuer.
   *
   * Only needed when `tenantId` is not the tenant's GUID: Entra's v2.0
   * discovery document always declares the GUID form, and the id token is
   * verified against the issuer it declares.
   */
  issuer?: string;
  /** Route back-channel calls (discovery, token, JWKS) through another origin. */
  internalBaseUrl?: string;
}

/**
 * The service-to-service half: what to read from Microsoft Graph.
 *
 * `tenantId`, `graphBaseUrl` and `authorityBaseUrl` are inherited from the
 * composite, so only the credential and the reading preferences appear here.
 * The credential is separate on purpose — the two halves may be two app
 * registrations, since one needs a redirect uri and the other needs
 * administrator-consented application permissions.
 */
export type EntraCompositeDirectoryOptions = Omit<
  EntraDirectoryOptions,
  'tenantId' | 'graphBaseUrl' | 'authorityBaseUrl' | 'channel'
>;

export interface EntraAuthProviderOptions {
  /** default: 'entra' */
  channel?: string;
  /**
   * Directory (tenant) id, normally the GUID.
   *
   * `common` and `organizations` are not supported: the id token issuer differs
   * per tenant, and this module pins issuer validation rather than accepting
   * whatever the token declares.
   */
  tenantId: string;
  /** default: 'https://login.microsoftonline.com'. National clouds need their own. */
  authorityBaseUrl?: string;
  /** default: 'https://graph.microsoft.com'. Same reason. */
  graphBaseUrl?: string;
  /**
   * A certificate credential both halves inherit.
   *
   * The two halves authenticate to two different hosts, but nothing stops one
   * registered certificate serving both — and writing the same PEM twice is how
   * they drift apart at the next rotation. Either half may still override it
   * with its own `clientCertificate`, which is what a deployment using two
   * application registrations needs.
   *
   * Strongly preferred over a secret on Entra: a client secret there
   * [cannot be given a lifetime beyond 24 months](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials),
   * so every secret-based integration carries a scheduled outage.
   */
  clientCertificate?: EntraClientCertificate;
  auth: EntraAuthOptions;
  /** Omit to register Entra as an authentication source only. */
  directory?: EntraCompositeDirectoryOptions;
}

/** The directory contract this composite forwards, at its concrete types. */
type EntraDirectoryCapability = DirectoryProvider<EntraDirectoryListOptions, EntraDirectoryEntry>;

const stripTrailingSlash = (url: string): string => url.replace(/\/$/, '');

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/**
 * Microsoft Entra ID as a single channel, over the two protocols it actually
 * takes.
 *
 * Signing a user in and reading the tenant are separate systems in Entra:
 * `login.microsoftonline.com` speaks OpenID Connect to a browser,
 * `graph.microsoft.com` answers client-credentials calls from a server, and the
 * permissions are granted independently. An LDAP directory needs no such split
 * — one bind does both — so a caller who has one `LdapAuthProvider` and expects
 * `gateway.getProvider(channel)` to answer both "who is this user" and "who is
 * in the directory" would otherwise have to hold two objects and configure the
 * tenant twice. This class is that seam, and nothing more: the OIDC half is the
 * existing `OidcAuthProvider`, the Graph half is `EntraDirectoryProvider`.
 *
 * **`identifierClaim` defaults to `oid`, not `sub`.** Entra's `sub` is
 * pairwise: the same person receives a different `sub` in every application, by
 * design. Binding a local member to it produces an identifier that is stable
 * only as long as nothing else ever has to recognise the same person — a second
 * application, a Graph query, an export — at which point the binding cannot be
 * correlated with anything. `oid` is the object id of the user in this tenant:
 * immutable, identical everywhere, and the same value `EntraDirectoryProvider`
 * binds on, so a login and a directory sync resolve to one member.
 *
 * Directory capability is opt-in. Without a `directory` block the instance is
 * an authentication source only, and `isDirectoryProvider()` answers `false`
 * for it rather than exposing methods that would fail at the first call.
 */
export class EntraAuthProvider implements AuthenticationProvider {
  readonly channel: string;
  readonly kind: AuthProviderKind = 'redirect';

  /** The Graph reader, when one was configured. Also usable directly. */
  readonly directory?: EntraDirectoryProvider;

  // Present only when `directory` was configured. Defined as instance
  // properties rather than methods so that the capability check is a fact about
  // the object, not about the class: prototype methods would exist on every
  // instance and make isDirectoryProvider() answer true for an
  // authentication-only provider.
  //
  // Their types are derived from the interface rather than restated, so a
  // change to DirectoryProvider is a compile error here instead of a silent
  // divergence — this class cannot `implements` it, since the whole point is
  // that the members are conditionally absent.
  readonly findUser?: EntraDirectoryCapability['findUser'];
  readonly findAllUsers?: EntraDirectoryCapability['findAllUsers'];
  readonly toIdentity?: EntraDirectoryCapability['toIdentity'];
  readonly findChangedUsers?: NonNullable<EntraDirectoryCapability['findChangedUsers']>;

  private readonly oidc: OidcAuthProvider;
  private readonly identifierClaim: string;
  private readonly accountClaim?: string;
  // Two latches, not one. The unset case is a configuration fact and is always
  // worth saying; the named-but-absent case is an observation about one token
  // and can be a false positive. Sharing a latch would let a false positive
  // spend the warning and leave the real misconfiguration silent for the life
  // of the process — which of the two fires would depend on who logs in first.
  private warnedAboutMissingAccountClaim = false;
  private warnedAboutAbsentAccountClaim = false;

  constructor(options: EntraAuthProviderOptions) {
    this.channel = options.channel ?? 'entra';
    this.identifierClaim = options.auth.identifierClaim ?? 'oid';
    this.accountClaim = options.auth.accountClaim;

    const authority = stripTrailingSlash(options.authorityBaseUrl ?? DEFAULT_AUTHORITY_BASE_URL);

    this.oidc = new OidcAuthProvider({
      channel: this.channel,
      issuer: options.auth.issuer ?? `${authority}/${options.tenantId}/v2.0`,
      internalBaseUrl: options.auth.internalBaseUrl,
      clientId: options.auth.clientId,
      clientSecret: options.auth.clientSecret,
      clientCertificate: options.auth.clientCertificate ?? options.clientCertificate,
      redirectUri: options.auth.redirectUri,
      scope: options.auth.scope,
      usePKCE: options.auth.usePKCE,
      fetchUserinfo: options.auth.fetchUserinfo,
      identifierClaim: this.identifierClaim,
      extraAuthorizationParams: options.auth.extraAuthorizationParams,
    });

    if (!options.directory) return;

    const directory = new EntraDirectoryProvider({
      ...options.directory,
      clientCertificate: options.directory.clientCertificate ?? options.clientCertificate,
      tenantId: options.tenantId,
      graphBaseUrl: options.graphBaseUrl,
      authorityBaseUrl: options.authorityBaseUrl,
      channel: this.channel,
    });

    this.directory = directory;
    this.findUser = (account): Promise<EntraDirectoryEntry | null> => directory.findUser(account);
    this.findAllUsers = (listOptions): Promise<EntraDirectoryEntry[]> => directory.findAllUsers(listOptions);
    this.toIdentity = (entry): AuthenticatedIdentity => directory.toIdentity(entry);
    this.findChangedUsers = (cursor): Promise<EntraDeltaResult> => directory.findChangedUsers(cursor);
  }

  /**
   * The account name as the login path can see it.
   *
   * `accountClaim` is honoured when configured. When it is not, and the
   * directory half is keyed on sAMAccountName, the two halves genuinely
   * disagree — the id token carries no such claim by default — so this says so
   * rather than quietly emitting a UPN where a `syncOnAuthenticate` handler
   * expects sAMAccountName and writing the field back and forth on every login.
   */
  private readAccountClaim(claims: Readonly<Record<string, unknown>>): string | undefined {
    const named = this.accountClaim ? asString(claims[this.accountClaim]) : undefined;

    if (named) return named;

    this.warnAboutAccountShape();

    return asString(claims.preferred_username) ?? asString(claims.upn) ?? asString(claims.email);
  }

  /**
   * Say, once per cause, that the login path and the directory path may not
   * report the same `attributes.account`.
   *
   * The two causes are not equally certain, and the wording says so. An unset
   * `accountClaim` is a configuration fact: the id token cannot carry
   * sAMAccountName, so every synchronised user diverges. A configured claim
   * that this particular token did not carry is only an observation — the
   * likeliest innocent explanation is a cloud-only account, which has no
   * on-premises identity, and for which the directory half falls back to the
   * UPN too, so nothing actually diverges. Accusing the app registration there
   * would send an operator to audit something that is correct.
   */
  private warnAboutAccountShape(): void {
    if (this.accountClaim) {
      if (this.warnedAboutAbsentAccountClaim) return;

      this.warnedAboutAbsentAccountClaim = true;

      // Ungated by the directory configuration on purpose: naming a claim the
      // token does not carry is a mistake about the claim, and it is silent
      // otherwise — the account simply falls back to the UPN. Whether the two
      // halves then disagree is a separate question, appended only when they
      // actually can.
      console.warn(
        `[MemberBase] Entra channel "${this.channel}": an id token carried no "${this.accountClaim}" claim, so ` +
          'attributes.account fell back to the UPN for that sign-in. Check that the app registration emits it ' +
          'under exactly that name.' +
          (this.accountAttribute === 'onPremisesSamAccountName'
            ? ' Expected for a cloud-only account, which has no on-premises identity and which the directory half ' +
              'also reports by UPN; for a synchronised account it means the login and directory paths disagree.'
            : ''),
      );

      return;
    }

    if (this.accountAttribute === 'onPremisesSamAccountName') {
      if (this.warnedAboutMissingAccountClaim) return;

      this.warnedAboutMissingAccountClaim = true;

      console.warn(
        `[MemberBase] Entra channel "${this.channel}" reads the directory by onPremisesSamAccountName, but no ` +
          'auth.accountClaim is configured. No standard id token claim carries sAMAccountName, so ' +
          'attributes.account is the UPN on the login path and the sAMAccountName on the directory path for ' +
          'every synchronised user. Configure the optional claim and name it in auth.accountClaim, or do not ' +
          'write attributes.account back to the member.',
      );
    }
  }

  /** Which account attribute the directory half is keyed on, if configured. */
  get accountAttribute(): EntraAccountAttribute | undefined {
    return this.directory ? this.directory.accountAttributeName : undefined;
  }

  async createAuthorizationRequest(context?: AuthContext): Promise<AuthorizationRequest> {
    return this.oidc.createAuthorizationRequest(context);
  }

  async getAuthorizationUrl(): Promise<string> {
    // Same refusal as OidcAuthProvider: PKCE and the nonce require the caller to
    // retain per-attempt secrets, which a bare url cannot express.
    return this.oidc.getAuthorizationUrl();
  }

  /**
   * Complete the callback and normalise the identity.
   *
   * Two adjustments on top of what `OidcAuthProvider` returns, both to make a
   * login and a directory read resolve to the same shape:
   *
   * - `identifierVerified` is true for `oid` (and `sub`). Those are asserted by
   *   the issuer and cannot be claimed by a user, unlike an email address.
   * - `account`, `name` and `email` are filled in from the standard claims, so
   *   a `syncOnAuthenticate` handler written against the directory mapping does
   *   not need a second branch for the login path — provided `auth.accountClaim`
   *   is set when the directory is keyed on sAMAccountName, since no standard
   *   claim carries that value.
   *
   * Every raw claim is still present alongside them.
   */
  async handleCallback(params: Record<string, string>, _context?: AuthContext): Promise<AuthenticatedIdentity> {
    const identity = await this.oidc.handleCallback(params);
    const claims = identity.attributes ?? {};

    const account = this.readAccountClaim(claims);

    return {
      ...identity,
      identifierVerified:
        this.identifierClaim === 'oid' || this.identifierClaim === 'sub' ? true : identity.identifierVerified,
      attributes: {
        ...claims,
        objectId: asString(claims.oid),
        account: account ?? identity.identifier,
        name: asString(claims.name) ?? account ?? identity.identifier,
        email: asString(claims.email) ?? asString(claims.preferred_username),
        // `groups` is deliberately not mapped here. When the optional claim is
        // configured Entra emits group *object ids*, while the directory half
        // reports display names; writing both under one key would make a group
        // check silently depend on which path produced the identity.
      },
    };
  }
}

/**
 * Narrowed view of a composite that was configured with a directory.
 *
 * `isDirectoryProvider()` is the runtime check; this is the type it narrows to
 * when the provider is already known to be an `EntraAuthProvider`.
 *
 * The `Required` half is not decoration: intersecting with `DirectoryProvider`
 * alone leaves every member that is optional on `EntraAuthProvider` optional,
 * so the delta method — the one capability that is Entra's and not the shared
 * interface's — stayed uncallable through a type whose whole purpose was to
 * make it callable.
 */
export type EntraAuthProviderWithDirectory = EntraAuthProvider &
  DirectoryProvider &
  Required<Pick<EntraAuthProvider, 'findUser' | 'findAllUsers' | 'toIdentity' | 'findChangedUsers' | 'directory'>>;
