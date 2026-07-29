import {
  escapeFilterValue,
  extractGroupNames,
  firstString,
  formatObjectGuid,
  isAccountDisabled,
  normalizeAccountInput,
} from '../src/providers/ldap/ldap-attributes';

interface ClientStub {
  bind: jest.Mock;
  search: jest.Mock;
  unbind: jest.Mock;
}

const clients: ClientStub[] = [];
let searchEntries: Record<string, unknown>[] = [];
let bindFailures: string[] = [];

jest.mock('ldapts', () => ({
  __esModule: true,
  Client: jest.fn().mockImplementation(() => {
    const client: ClientStub = {
      bind: jest.fn(async (dn: string) => {
        if (bindFailures.includes(dn)) throw new Error('invalid credentials');
      }),
      search: jest.fn(async () => ({ searchEntries })),
      unbind: jest.fn(async () => undefined),
    };

    clients.push(client);

    return client;
  }),
}));

import { LdapAuthProvider } from '../src/providers/ldap/ldap-auth.provider';
import { AuthProviderMisconfiguredError, InvalidPasswordError } from '../src/constants/errors/base.error';

const USER_DN = 'CN=Wang,OU=Users,DC=corp,DC=local';
const GUID_BYTES = Buffer.from([
  0x78, 0x56, 0x34, 0x12, 0x34, 0x12, 0x78, 0x56, 0x9a, 0xbc, 0xde, 0xf0, 0x12, 0x34, 0x56, 0x78,
]);

const buildProvider = (overrides?: Partial<ConstructorParameters<typeof LdapAuthProvider>[0]>): LdapAuthProvider =>
  new LdapAuthProvider({
    url: 'ldaps://dc.corp.local',
    bindDN: 'CN=svc,DC=corp,DC=local',
    bindPassword: 'svc-secret',
    baseDN: 'DC=corp,DC=local',
    ...overrides,
  });

beforeEach(() => {
  clients.length = 0;
  bindFailures = [];
  searchEntries = [
    {
      dn: USER_DN,
      displayName: 'Wang',
      mail: 'wang@corp.local',
      department: 'Finance',
      memberOf: ['CN=Finance,OU=Groups,DC=corp,DC=local', 'CN=AllStaff,OU=Groups,DC=corp,DC=local'],
      userAccountControl: '512',
      objectGUID: GUID_BYTES,
    },
  ];
});

describe('ldap attribute helpers', () => {
  it('should strip a NetBIOS prefix from the typed account', () => {
    expect(normalizeAccountInput('CORP\\wangxx')).toBe('wangxx');
    expect(normalizeAccountInput('corp/wangxx')).toBe('wangxx');
    expect(normalizeAccountInput('  wangxx  ')).toBe('wangxx');
  });

  it('should leave a UPN untouched', () => {
    expect(normalizeAccountInput('wangxx@corp.local')).toBe('wangxx@corp.local');
  });

  it('should escape filter metacharacters', () => {
    expect(escapeFilterValue('a*b(c)d\\e')).toBe('a\\2ab\\28c\\29d\\5ce');
  });

  it('should render objectGUID with the first three groups byte-reversed', () => {
    expect(formatObjectGuid(GUID_BYTES)).toBe('12345678-1234-5678-9abc-def012345678');
  });

  it('should pass a string guid through and reject anything unusable', () => {
    expect(formatObjectGuid('already-a-string')).toBe('already-a-string');
    expect(formatObjectGuid(Buffer.alloc(4))).toBeNull();
    expect(formatObjectGuid(undefined)).toBeNull();
  });

  it('should read the ACCOUNTDISABLE flag', () => {
    expect(isAccountDisabled('514')).toBe(true); // 512 | 2
    expect(isAccountDisabled('512')).toBe(false);
    expect(isAccountDisabled(undefined)).toBe(false);
  });

  it('should extract group CNs from memberOf', () => {
    expect(extractGroupNames(['CN=Finance,OU=Groups,DC=x', 'CN=Staff,DC=x'])).toEqual(['Finance', 'Staff']);
    expect(extractGroupNames('CN=Solo,DC=x')).toEqual(['Solo']);
    expect(extractGroupNames(undefined)).toEqual([]);
  });

  it('should normalize single or array attribute values', () => {
    expect(firstString(['a', 'b'])).toBe('a');
    expect(firstString('a')).toBe('a');
    expect(firstString([])).toBeUndefined();
    expect(firstString('')).toBeUndefined();
  });
});

describe('LdapAuthProvider', () => {
  it('should bind the user dn and return a guid-keyed identity', async () => {
    const identity = await buildProvider().authenticate({ account: 'CORP\\wangxx', password: 'secret' });

    expect(identity.channel).toBe('ldap');
    expect(identity.identifier).toBe('12345678-1234-5678-9abc-def012345678');
    expect(identity.identifierVerified).toBe(true);
    expect(identity.attributes).toMatchObject({
      dn: USER_DN,
      account: 'wangxx',
      name: 'Wang',
      email: 'wang@corp.local',
      department: 'Finance',
      groups: ['Finance', 'AllStaff'],
    });
  });

  it('should search with an escaped filter built from the normalized account', async () => {
    await buildProvider().authenticate({ account: 'CORP\\wang*xx', password: 'secret' });

    const [searchClient] = clients;

    expect(searchClient.search).toHaveBeenCalledWith(
      'DC=corp,DC=local',
      expect.objectContaining({ filter: '(&(objectClass=user)(sAMAccountName=wang\\2axx))' }),
    );
  });

  it('should reject an empty password instead of attempting an anonymous bind', async () => {
    await expect(buildProvider().authenticate({ account: 'wangxx', password: '' })).rejects.toBeInstanceOf(
      InvalidPasswordError,
    );

    expect(clients).toHaveLength(0);
  });

  it('should reject when the directory returns no entry', async () => {
    searchEntries = [];

    await expect(buildProvider().authenticate({ account: 'ghost', password: 'secret' })).rejects.toBeInstanceOf(
      InvalidPasswordError,
    );
  });

  it('should reject when the user bind fails', async () => {
    bindFailures = [USER_DN];

    await expect(buildProvider().authenticate({ account: 'wangxx', password: 'wrong' })).rejects.toBeInstanceOf(
      InvalidPasswordError,
    );
  });

  it('should reject a disabled account before verifying the password', async () => {
    searchEntries[0].userAccountControl = '514';

    await expect(buildProvider().authenticate({ account: 'wangxx', password: 'secret' })).rejects.toBeInstanceOf(
      InvalidPasswordError,
    );

    // Only the service account bind happened; the user bind was never attempted.
    expect(clients).toHaveLength(1);
  });

  it('should allow a disabled account when the check is turned off', async () => {
    searchEntries[0].userAccountControl = '514';

    const identity = await buildProvider({ rejectDisabledAccounts: false }).authenticate({
      account: 'wangxx',
      password: 'secret',
    });

    expect(identity.identifier).toBe('12345678-1234-5678-9abc-def012345678');
  });

  it('should fail loudly when the identifier attribute is missing', async () => {
    delete searchEntries[0].objectGUID;

    await expect(buildProvider().authenticate({ account: 'wangxx', password: 'secret' })).rejects.toBeInstanceOf(
      AuthProviderMisconfiguredError,
    );
  });

  it('should honour a custom search filter and channel', async () => {
    const provider = buildProvider({
      channel: 'corp-ad',
      searchFilter: account => `(userPrincipalName=${account}@corp.local)`,
    });

    const identity = await provider.authenticate({ account: 'wangxx', password: 'secret' });

    expect(identity.channel).toBe('corp-ad');
    expect(clients[0].search).toHaveBeenCalledWith(
      'DC=corp,DC=local',
      expect.objectContaining({ filter: '(userPrincipalName=wangxx@corp.local)' }),
    );
  });

  it('should always unbind both connections', async () => {
    await buildProvider().authenticate({ account: 'wangxx', password: 'secret' });

    expect(clients).toHaveLength(2);
    clients.forEach(client => expect(client.unbind).toHaveBeenCalled());
  });
});
