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
  /** Extra attributes to request and expose on the identity. */
  extraAttributes?: string[];
  /**
   * Reject accounts flagged as disabled in userAccountControl.
   * default: true
   */
  rejectDisabledAccounts?: boolean;
  /** Socket timeout in milliseconds. default: 5000 */
  timeout?: number;
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

    const identifier = formatObjectGuid(entry[this.options.identifierAttribute ?? 'objectGUID']);

    if (!identifier) {
      throw new AuthProviderMisconfiguredError(
        `Directory entry for "${account}" has no ${this.options.identifierAttribute ?? 'objectGUID'} to bind on`,
      );
    }

    return {
      channel: this.channel,
      identifier,
      // The directory is authoritative for its own entries.
      identifierVerified: true,
      attributes: {
        dn,
        account,
        name: firstString(entry.displayName) ?? account,
        email: firstString(entry.mail),
        title: firstString(entry.title),
        department: firstString(entry.department),
        description: firstString(entry.description),
        groups: extractGroupNames(entry.memberOf),
      },
    };
  }

  private async findUser(account: string): Promise<Record<string, unknown> | null> {
    const client = this.createClient();

    try {
      await client.bind(this.options.bindDN, this.options.bindPassword);

      const filter =
        this.options.searchFilter?.(account) ??
        `(&(objectClass=user)(${this.options.accountAttribute ?? 'sAMAccountName'}=${escapeFilterValue(account)}))`;

      const searchOptions: SearchOptions = {
        scope: 'sub',
        filter,
        attributes: [
          ...DEFAULT_ATTRIBUTES,
          this.options.identifierAttribute ?? 'objectGUID',
          this.options.accountAttribute ?? 'sAMAccountName',
          ...(this.options.extraAttributes ?? []),
        ],
      };

      const { searchEntries } = await client.search(this.options.baseDN, searchOptions);

      return (searchEntries[0] as Record<string, unknown> | undefined) ?? null;
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
    return new Client({ url: this.options.url, timeout: this.options.timeout ?? 5000 });
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
