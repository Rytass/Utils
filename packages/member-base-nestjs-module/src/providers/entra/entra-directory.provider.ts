import { AuthProviderMisconfiguredError, DirectoryRequestFailedError } from '../../constants/errors/base.error';
import {
  buildSelect,
  extractGroupNames,
  GROUP_ODATA_TYPE,
  isAccountDisabled,
  readAccount,
  readRemovalReason,
  type EntraAccountAttribute,
  type EntraDirectoryEntry,
  type EntraDirectoryObjectRef,
} from './entra-attributes';
import { EntraGraphClient, type EntraClientCertificate } from './entra-graph-client';
import { pickExtraAttributes } from '../../utils/pick-extra-attributes';
import type { AuthenticatedIdentity } from '../../typings/authentication-provider.interface';
import type {
  DirectoryDeltaResult,
  DirectoryListOptions,
  DirectoryProvider,
  DirectoryRemovedEntry,
} from '../../typings/directory-provider.interface';

export interface EntraDirectoryOptions {
  tenantId: string;
  clientId: string;
  clientSecret?: string;
  /** Certificate-based client credentials, as an alternative to the secret. */
  clientCertificate?: EntraClientCertificate;
  /** default: 'https://graph.microsoft.com'. National clouds (US Gov, China) need their own. */
  graphBaseUrl?: string;
  /** default: 'https://login.microsoftonline.com'. Same reason. */
  authorityBaseUrl?: string;
  /**
   * Extra attributes to `$select`, appended to the default set.
   *
   * Each one is also placed on `toIdentity`'s `attributes` under the name Graph
   * used, with the value Graph sent and no interpretation applied — this module
   * has no opinion on what a tenant's own fields mean. An attribute the tenant
   * has not populated is simply absent.
   */
  extraAttributes?: string[];
  /** Fetch group memberships alongside each user. default: true */
  includeGroups?: boolean;
  /**
   * Which attribute carries the account name.
   * default: 'userPrincipalName'
   */
  accountAttribute?: EntraAccountAttribute;
  /** Channel this directory answers for. default: 'entra' */
  channel?: string;
  /** Retries on 429 and 5xx. default: 3 */
  maxRetries?: number;
  /** Ceiling on one backoff wait, in milliseconds. default: 30000 */
  maxRetryDelayMs?: number;
}

/** Graph's own dialect: an OData `$filter`, not an LDAP or SCIM expression. */
export interface EntraDirectoryListOptions extends DirectoryListOptions {
  /** OData `$filter`, e.g. `accountEnabled eq true`. */
  filter?: string;
}

/**
 * Graph's delta answer, in the shared shape.
 *
 * `cursor` is Graph's `$deltatoken`. It is named for what it is to the caller —
 * an opaque resume point they persist — rather than for the vendor's spelling,
 * so a reconciliation job written against `DirectoryProvider` does not have to
 * know which directory produced it.
 */
export type EntraDeltaResult = DirectoryDeltaResult<EntraDirectoryEntry>;

/** The documented maximum page size for `/users`. */
const PLAIN_PAGE_SIZE = 999;

/**
 * Reads a Microsoft Entra ID tenant through Microsoft Graph.
 *
 * The directory half of an Entra integration, and usable on its own: an
 * application that signs users in some other way can still reconcile against
 * the tenant. It is not an authentication provider — no password is ever
 * presented here, and Graph has no notion of one.
 *
 * Everything is a plain query. **Nothing is scheduled**, nothing is written
 * back to a local member, and no upsert or deactivation policy is implied —
 * those are the application's decisions, exactly as they are for
 * `LdapAuthProvider`.
 */
export class EntraDirectoryProvider implements DirectoryProvider<EntraDirectoryListOptions, EntraDirectoryEntry> {
  readonly channel: string;

  private readonly client: EntraGraphClient;

  constructor(private readonly options: EntraDirectoryOptions) {
    this.channel = options.channel ?? 'entra';
    this.client = new EntraGraphClient({
      tenantId: options.tenantId,
      clientId: options.clientId,
      clientSecret: options.clientSecret,
      clientCertificate: options.clientCertificate,
      graphBaseUrl: options.graphBaseUrl,
      authorityBaseUrl: options.authorityBaseUrl,
      maxRetries: options.maxRetries,
      maxRetryDelayMs: options.maxRetryDelayMs,
    });
  }

  /**
   * One user, by account name or object id.
   *
   * `/users/{key}` accepts the object id and the userPrincipalName directly.
   * A tenant keyed on `onPremisesSamAccountName` has no such addressable key,
   * so that configuration filters instead — which is also why it needs the
   * advanced query headers.
   */
  async findUser(account: string): Promise<EntraDirectoryEntry | null> {
    const entry = await this.fetchUser(account);

    if (!entry) return null;

    return this.withGroups(entry);
  }

  /**
   * Every user in the tenant, or every user matching an OData `$filter`.
   *
   * Potentially the entire directory: the caller owns the scheduling and the
   * pacing, and `filter` is how a reconciliation narrows the set it pulls
   * (`accountEnabled eq true`, `department eq 'Sales'`).
   */
  async findAllUsers(options?: EntraDirectoryListOptions): Promise<EntraDirectoryEntry[]> {
    const params = new URLSearchParams({
      $select: buildSelect(this.options.extraAttributes),
      $top: String(PLAIN_PAGE_SIZE),
    });

    if (options?.filter) {
      params.set('$filter', options.filter);
      // Advanced query capability: several operators only work with both the
      // header and $count, and Graph rejects the filter outright without them.
      params.set('$count', 'true');
    }

    const entries = await this.client.collect<EntraDirectoryEntry>(
      `${this.client.url('/v1.0/users')}?${params.toString()}`,
      options?.filter ? { ConsistencyLevel: 'eventual' } : undefined,
    );

    return this.attachGroups(entries);
  }

  /**
   * What changed since the last call.
   *
   * The counterpart LDAP has no equivalent for: a full listing of a large
   * tenant to find the three accounts that were disabled overnight is mostly
   * waste. Pass `null` on the first run — that walks the whole directory once —
   * and the token returned by the previous call on every run after that.
   *
   * **The token is not stored here.** It is returned so the application can
   * persist it wherever it keeps its own state, which is what lets more than
   * one instance of the application exist — the same reason `OidcAuthProvider`
   * hands the PKCE verifier back instead of holding it.
   *
   * Note that the `$select` sent on the first request is baked into every token
   * derived from it: changing `extraAttributes` later has no effect until the
   * stored token is discarded and a full sync is run again.
   */
  async findChangedUsers(cursor: string | null): Promise<EntraDeltaResult> {
    const url = cursor
      ? // `$select` is deliberately absent: it is already encoded in the token,
        // and sending a different one is rejected.
        `${this.client.url('/v1.0/users/delta')}?${new URLSearchParams({ $deltatoken: cursor }).toString()}`
      : `${this.client.url('/v1.0/users/delta')}?${new URLSearchParams({
          $select: buildSelect(this.options.extraAttributes),
        }).toString()}`;

    const { value, deltaLink } = await this.client.collectDelta<EntraDirectoryEntry>(url);

    const removed = value.reduce<DirectoryRemovedEntry[]>((accumulator, entry) => {
      const reason = readRemovalReason(entry);

      return reason && entry.id ? [...accumulator, { id: entry.id, reason }] : accumulator;
    }, []);

    const changed = value.filter(entry => readRemovalReason(entry) === null);

    // `/users/delta` does not support $expand either, so this is the same
    // per-user resolution the listing path uses. The changed set is small by
    // construction, which is what makes delta worth using at all.
    const entries = await this.attachGroups(changed);

    return { entries, removed, cursor: this.extractDeltaToken(deltaLink) };
  }

  /**
   * Map a Graph user onto the identity shape the gateway consumes.
   *
   * Aligned with `LdapAuthProvider.toIdentity` by meaning rather than by field
   * name, so one `syncOnAuthenticate` handler can serve both directories.
   */
  toIdentity(entry: EntraDirectoryEntry): AuthenticatedIdentity {
    const identifier = typeof entry.id === 'string' ? entry.id : '';

    if (!identifier) {
      // The object id is the only value that survives a rename, a UPN change
      // and a mailbox move, so a binding keyed on anything else is a binding
      // that eventually points at the wrong person.
      throw new AuthProviderMisconfiguredError('Graph entry has no id to bind on');
    }

    const account = readAccount(entry, this.accountAttribute());

    // A `/users/delta` entry carries the id plus *at least* what changed, so
    // most fields here are legitimately absent on an incremental read. Every
    // one of them is left `undefined` rather than filled in with a placeholder:
    // an application writing these back would otherwise overwrite a real
    // account name with the object id and blank a real email on any user whose
    // delta page happened not to mention them.
    return {
      channel: this.channel,
      identifier,
      // The tenant is authoritative for its own object ids; there is nothing
      // for a user to claim here the way an email address can be claimed.
      identifierVerified: true,
      attributes: {
        // Spread first, so an attribute the caller named can never shadow the
        // fields below. Those are the contract every consumer reads — a
        // `extraAttributes: ['department']` that quietly replaced the mapped
        // `department`, or worse `groups`, would turn a widened `$select` into
        // an authorization change.
        ...pickExtraAttributes(entry, this.options.extraAttributes),
        objectId: identifier,
        account,
        userPrincipalName: entry.userPrincipalName ?? undefined,
        name: entry.displayName ?? account,
        email: entry.mail ?? entry.userPrincipalName ?? undefined,
        title: entry.jobTitle ?? undefined,
        department: entry.department ?? undefined,
        groups: extractGroupNames(entry.memberOf),
        disabled: isAccountDisabled(entry),
      },
    };
  }

  /** Which attribute this directory treats as the account key. */
  get accountAttributeName(): EntraAccountAttribute {
    return this.options.accountAttribute ?? 'userPrincipalName';
  }

  private accountAttribute(): EntraAccountAttribute {
    return this.accountAttributeName;
  }

  private async fetchUser(account: string): Promise<EntraDirectoryEntry | null> {
    const select = buildSelect(this.options.extraAttributes);

    if (this.accountAttribute() === 'onPremisesSamAccountName') {
      const params = new URLSearchParams({
        $select: select,
        $filter: `onPremisesSamAccountName eq '${escapeODataString(account)}'`,
        $top: '1',
        $count: 'true',
      });

      const [entry] = await this.client.collect<EntraDirectoryEntry>(
        `${this.client.url('/v1.0/users')}?${params.toString()}`,
        // onPremisesSamAccountName is not indexed for basic queries; without
        // the advanced query capability Graph answers 400 rather than empty.
        { ConsistencyLevel: 'eventual' },
      );

      return entry ?? null;
    }

    try {
      return await this.client.request<EntraDirectoryEntry>(
        `${this.client.url(`/v1.0/users/${encodeURIComponent(account)}`)}?${new URLSearchParams({
          $select: select,
        }).toString()}`,
      );
    } catch (error) {
      // An unknown account is a 404 on this endpoint, and "no such user" is an
      // answer rather than a failure — the same shape findUser has for LDAP.
      if (isNotFound(error)) return null;

      throw error;
    }
  }

  /**
   * Resolve memberships for a set of entries, when the caller asked for them.
   *
   * One request per user, sequentially. That is genuinely expensive over a
   * whole tenant, and it is still the only correct option: `$expand=memberOf`
   * on a directory object is documented to return **at most 20 objects with no
   * `@odata.nextLink`**, so a user in more groups comes back silently truncated
   * with no way to detect it — and a truncated group list feeding an
   * authorization decision is worse than a slow one. `includeGroups: false` is
   * the way out when the application does not need groups.
   */
  private async attachGroups(entries: EntraDirectoryEntry[]): Promise<EntraDirectoryEntry[]> {
    if (!(this.options.includeGroups ?? true)) return entries;

    return entries.reduce<Promise<EntraDirectoryEntry[]>>(
      async (accumulator, entry) => [...(await accumulator), await this.withGroups(entry)],
      Promise.resolve([]),
    );
  }

  /** Attach group display names to one entry. */
  private async withGroups(entry: EntraDirectoryEntry): Promise<EntraDirectoryEntry> {
    if (!(this.options.includeGroups ?? true) || !entry.id) return entry;

    const params = new URLSearchParams({ $select: 'id,displayName', $top: String(PLAIN_PAGE_SIZE) });

    // The OData cast filters directory roles out at the source and, unlike
    // $expand, pages properly — so this list is complete as well as groups-only.
    const groups = await this.client.collect<EntraDirectoryObjectRef>(
      `${this.client.url(
        `/v1.0/users/${encodeURIComponent(entry.id)}/memberOf/microsoft.graph.group`,
      )}?${params.toString()}`,
    );

    return {
      ...entry,
      // The cast is what proves these are groups; Graph does not always echo
      // the annotation back on a cast collection. Stamping it here is what lets
      // extractGroupNames fail closed on anything this provider did not vouch
      // for, instead of treating "untyped" as "probably a group".
      memberOf: groups.map(group => ({ ...group, '@odata.type': GROUP_ODATA_TYPE })),
    };
  }

  /**
   * The resumable part of a delta link.
   *
   * Only the token is handed back, not the whole url: an application persists
   * it, and a stored absolute url would pin a tenant to whichever Graph host
   * answered the first sync.
   */
  private extractDeltaToken(deltaLink: string): string {
    const token = new URL(deltaLink).searchParams.get('$deltatoken');

    if (!token) {
      // The link itself is not repeated: it carries the tenant's sync state,
      // and an exception message is a thing that gets logged.
      throw new AuthProviderMisconfiguredError('Delta link carried no $deltatoken');
    }

    return token;
  }
}

/** OData string literals escape a single quote by doubling it. */
const escapeODataString = (value: string): string => value.replace(/'/g, "''");

const isNotFound = (error: unknown): boolean =>
  error instanceof DirectoryRequestFailedError && error.upstreamStatus === 404;
