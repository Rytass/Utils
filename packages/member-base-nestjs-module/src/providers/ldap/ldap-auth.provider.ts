import { Client, type SearchOptions } from 'ldapts';
import { AuthProviderMisconfiguredError, InvalidPasswordError } from '../../constants/errors/base.error';
import {
  escapeFilterValue,
  extractGroupNames,
  firstString,
  formatObjectGuid,
  isAccountDisabled,
  normalizeAccountInput,
} from './ldap-attributes';
import type {
  AuthContext,
  AuthenticatedIdentity,
  AuthenticationProvider,
  AuthProviderKind,
} from '../../typings/authentication-provider.interface';

/** A raw directory entry, as returned by the server. */
export type LdapDirectoryEntry = Record<string, unknown>;

export interface LdapCredentials {
  account: string;
  password: string;
}

export interface LdapAuthProviderOptions {
  /** default: 'ldap' */
  channel?: string;
  /** ldap:// or ldaps:// url of the directory. */
  url: string;
  /** DN of the service account used to search for users. */
  bindDN: string;
  bindPassword: string;
  /** Search base for user lookups. */
  baseDN: string;
  /**
   * Attribute matched against what the user typed.
   * default: 'sAMAccountName'
   */
  accountAttribute?: string;
  /**
   * Attribute used as the stable identifier for the local binding.
   * default: 'objectGUID' — an account can be renamed, its GUID cannot.
   */
  identifierAttribute?: string;
  /** Override the whole search filter. Receives the normalized account. */
  searchFilter?: (account: string) => string;
  /**
   * Filter used by findAllUsers.
   * default: '(objectClass=user)'
   */
  listFilter?: string;
  /** Extra attributes to request and expose on the identity. */
  extraAttributes?: string[];
  /**
   * Reject accounts flagged as disabled in userAccountControl.
   * default: true
   */
  rejectDisabledAccounts?: boolean;
  /** Socket timeout in milliseconds. default: 5000 */
  timeout?: number;
  /**
   * TLS options passed to the client, for ldaps:// connections.
   *
   * A directory fronted by a private or self-signed certificate needs
   * `{ rejectUnauthorized: false }` (or a `ca`) or every bind fails at the
   * handshake.
   */
  tlsOptions?: Record<string, unknown>;
}

const DEFAULT_ATTRIBUTES = [
  'dn',
  'displayName',
  'mail',
  'title',
  'department',
  'description',
  'memberOf',
  'userAccountControl',
];

/**
 * Authenticates against an LDAP directory (Active Directory included).
 *
 * The password never reaches this process as anything but a bind attempt: the
 * service account locates the user, then the user's own DN is bound with the
 * supplied password. Nothing is stored locally beyond the binding the gateway
 * creates.
 */
export class LdapAuthProvider implements AuthenticationProvider<LdapCredentials> {
  readonly channel: string;
  readonly kind: AuthProviderKind = 'credential';

  constructor(private readonly options: LdapAuthProviderOptions) {
    this.channel = options.channel ?? 'ldap';
  }

  async authenticate(credentials: LdapCredentials, _context?: AuthContext): Promise<AuthenticatedIdentity> {
    const account = normalizeAccountInput(credentials.account);

    if (!account || !credentials.password) {
      // An empty password would otherwise be an anonymous bind, which many
      // directories accept — turning a blank field into a successful login.
      throw new InvalidPasswordError();
    }

    const entry = await this.findUser(account);

    if (!entry) {
      throw new InvalidPasswordError();
    }

    const dn = firstString(entry.dn);

    if (!dn) {
      throw new AuthProviderMisconfiguredError('Directory returned an entry without a dn');
    }

    if ((this.options.rejectDisabledAccounts ?? true) && isAccountDisabled(entry.userAccountControl)) {
      throw new InvalidPasswordError();
    }

    await this.verifyPassword(dn, credentials.password);

    return this.toIdentity(entry);
  }

  /**
   * Look a single directory entry up by the configured account attribute.
   *
   * Exposed because a directory is also a source of truth for attributes, not
   * only for passwords: reconciliation jobs need to read entries without
   * anyone logging in. Nothing here is scheduled — the caller decides when.
   */
  async findUser(account: string): Promise<LdapDirectoryEntry | null> {
    const filter =
      this.options.searchFilter?.(normalizeAccountInput(account)) ??
      `(&(objectClass=user)(${this.accountAttribute()}=${escapeFilterValue(normalizeAccountInput(account))}))`;

    const [entry] = await this.search(filter, 1);

    return entry ?? null;
  }

  /**
   * Every user entry under the configured base DN.
   *
   * Intended for reconciliation against a directory that has changed
   * out-of-band (departments moved, accounts disabled). Potentially a large
   * result set, so the caller owns the scheduling and the pacing.
   *
   * `baseDN` overrides the configured search base for this call, which is how
   * a directory that keeps active users in several containers (and disabled
   * ones in another) is reconciled without pulling in the containers it should
   * be ignoring.
   */
  async findAllUsers(options?: { baseDN?: string; filter?: string }): Promise<LdapDirectoryEntry[]> {
    return this.search(options?.filter ?? this.options.listFilter ?? '(objectClass=user)', undefined, options?.baseDN);
  }

  /** Look an entry up by its distinguished name. */
  async findByDn(dn: string): Promise<LdapDirectoryEntry | null> {
    const client = this.createClient();

    try {
      await client.bind(this.options.bindDN, this.options.bindPassword);

      const { searchEntries } = await client.search(dn, {
        scope: 'base',
        filter: '(objectClass=*)',
        attributes: this.requestedAttributes(),
      });

      return (searchEntries[0] as LdapDirectoryEntry | undefined) ?? null;
    } catch {
      // A missing DN surfaces as a search error rather than an empty result.
      return null;
    } finally {
      await this.safeUnbind(client);
    }
  }

  /**
   * Map a directory entry onto the identity shape the gateway consumes.
   *
   * Lets a reconciliation job feed entries through the same resolution path a
   * login takes, instead of duplicating the attribute mapping.
   */
  toIdentity(entry: LdapDirectoryEntry): AuthenticatedIdentity {
    const identifier = formatObjectGuid(entry[this.identifierAttribute()]);

    if (!identifier) {
      throw new AuthProviderMisconfiguredError(`Directory entry has no ${this.identifierAttribute()} to bind on`);
    }

    const account = firstString(entry[this.accountAttribute()]) ?? firstString(entry.dn) ?? identifier;

    return {
      channel: this.channel,
      identifier,
      identifierVerified: true,
      attributes: {
        dn: firstString(entry.dn),
        account,
        name: firstString(entry.displayName) ?? account,
        email: firstString(entry.mail),
        title: firstString(entry.title),
        department: firstString(entry.department),
        description: firstString(entry.description),
        groups: extractGroupNames(entry.memberOf),
        disabled: isAccountDisabled(entry.userAccountControl),
      },
    };
  }

  private accountAttribute(): string {
    return this.options.accountAttribute ?? 'sAMAccountName';
  }

  private identifierAttribute(): string {
    return this.options.identifierAttribute ?? 'objectGUID';
  }

  private requestedAttributes(): string[] {
    return [
      ...DEFAULT_ATTRIBUTES,
      this.identifierAttribute(),
      this.accountAttribute(),
      ...(this.options.extraAttributes ?? []),
    ];
  }

  private async search(filter: string, sizeLimit?: number, baseDN?: string): Promise<LdapDirectoryEntry[]> {
    const client = this.createClient();

    try {
      await client.bind(this.options.bindDN, this.options.bindPassword);

      const searchOptions: SearchOptions = {
        scope: 'sub',
        filter,
        attributes: this.requestedAttributes(),
        ...(sizeLimit ? { sizeLimit } : {}),
      };

      const { searchEntries } = await client.search(baseDN ?? this.options.baseDN, searchOptions);

      return searchEntries as LdapDirectoryEntry[];
    } finally {
      await this.safeUnbind(client);
    }
  }

  private async verifyPassword(dn: string, password: string): Promise<void> {
    const client = this.createClient();

    try {
      await client.bind(dn, password);
    } catch {
      throw new InvalidPasswordError();
    } finally {
      await this.safeUnbind(client);
    }
  }

  private createClient(): Client {
    return new Client({
      url: this.options.url,
      timeout: this.options.timeout ?? 5000,
      ...(this.options.tlsOptions ? { tlsOptions: this.options.tlsOptions } : {}),
    });
  }

  private async safeUnbind(client: Client): Promise<void> {
    try {
      await client.unbind();
    } catch {
      // A failed unbind must not mask the outcome of the operation that ran
      // inside the try block.
    }
  }
}
