import { isDirectoryProvider } from '../src/typings/directory-provider.interface';
import { LdapAuthProvider } from '../src/providers/ldap/ldap-auth.provider';
import { EntraAuthProvider, type EntraAuthProviderWithDirectory } from '../src/providers/entra/entra-auth.provider';
import { EntraDirectoryProvider } from '../src/providers/entra/entra-directory.provider';
import { OidcAuthProvider } from '../src/providers/oidc/oidc-auth.provider';
import type { AuthenticationProvider } from '../src/typings/authentication-provider.interface';
import type { DirectoryProvider } from '../src/typings/directory-provider.interface';

const TENANT = '11111111-2222-3333-4444-555555555555';

const ldap = (): LdapAuthProvider =>
  new LdapAuthProvider({
    url: 'ldaps://dc.corp.local',
    bindDN: 'CN=svc,DC=corp,DC=local',
    bindPassword: 'secret',
    baseDN: 'DC=corp,DC=local',
  });

describe('isDirectoryProvider', () => {
  it('should recognise LdapAuthProvider without any cast', () => {
    const provider: AuthenticationProvider = ldap();

    expect(isDirectoryProvider(provider)).toBe(true);

    // The point of the guard: these are reachable off the narrowed type, where
    // `AuthenticationProvider` alone would have needed `as unknown as`.
    if (isDirectoryProvider(provider)) {
      expect(typeof provider.findUser).toBe('function');
      expect(typeof provider.findAllUsers).toBe('function');
      expect(typeof provider.toIdentity).toBe('function');
    }
  });

  it('should reject a provider that only authenticates', () => {
    const provider: AuthenticationProvider = new OidcAuthProvider({
      channel: 'corp-idp',
      issuer: 'https://idp.example.com/oidc',
      clientId: 'client',
      redirectUri: 'https://app.example.com/auth/corp-idp/callback',
    });

    expect(isDirectoryProvider(provider)).toBe(false);
  });

  it('should reject a partially shaped object', () => {
    const halfway = {
      channel: 'half',
      kind: 'credential',
      findUser: async (): Promise<null> => null,
      findAllUsers: async (): Promise<[]> => [],
    } as unknown as AuthenticationProvider;

    expect(isDirectoryProvider(halfway)).toBe(false);
  });

  it('should satisfy the interface structurally for both directory sources', () => {
    // A compile-time assertion as much as a runtime one: if either class drifts
    // out of the interface this stops type checking.
    const providers: DirectoryProvider[] = [
      ldap(),
      new EntraDirectoryProvider({ tenantId: TENANT, clientId: 'app', clientSecret: 'secret' }),
    ];

    expect(providers).toHaveLength(2);
  });

  it('should require a channel, since bindings are keyed on it', () => {
    // A directory reporting a channel no AuthenticationProvider serves writes
    // binding rows that no login can ever match, so the interface declares it.
    const withoutChannel = {
      kind: 'credential',
      findUser: async (): Promise<null> => null,
      findAllUsers: async (): Promise<[]> => [],
      toIdentity: (): never => {
        throw new Error('unused');
      },
    } as unknown as AuthenticationProvider;

    expect(isDirectoryProvider(withoutChannel)).toBe(false);
  });

  it('should leave incremental sync to a separate probe, as the gateway does for authenticate', () => {
    const provider: AuthenticationProvider = ldap();

    expect(isDirectoryProvider(provider)).toBe(true);

    if (isDirectoryProvider(provider)) {
      // LDAP cannot answer incrementally, and the guard does not claim it can.
      expect(provider.findChangedUsers).toBeUndefined();
    }
  });

  it('should preserve the LDAP-only baseDN option through the generic', async () => {
    const provider = ldap();
    const search = jest
      .spyOn(provider as unknown as { search: (...args: unknown[]) => Promise<unknown[]> }, 'search')
      .mockResolvedValue([]);

    await provider.findAllUsers({ baseDN: 'OU=Active,DC=corp,DC=local', filter: '(objectClass=user)' });

    expect(search).toHaveBeenCalledWith('(objectClass=user)', undefined, 'OU=Active,DC=corp,DC=local');
  });
});

describe('EntraAuthProvider directory capability', () => {
  const auth = {
    clientId: 'login-app',
    clientSecret: 'login-secret',
    redirectUri: 'https://app.example.com/auth/entra/callback',
  };

  it('should answer true once a directory block is configured', () => {
    const provider = new EntraAuthProvider({
      tenantId: TENANT,
      auth,
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret' },
    });

    expect(isDirectoryProvider(provider)).toBe(true);
    expect(provider.directory).toBeInstanceOf(EntraDirectoryProvider);
  });

  it('should answer false when it is only an authentication source', () => {
    const provider = new EntraAuthProvider({ tenantId: TENANT, auth });

    expect(isDirectoryProvider(provider)).toBe(false);
    expect(provider.directory).toBeUndefined();
    // Absent rather than present-and-throwing: a caller that checked first is
    // never handed a method that cannot work.
    expect(provider.findUser).toBeUndefined();
    expect(provider.findAllUsers).toBeUndefined();
    expect(provider.toIdentity).toBeUndefined();
    expect(provider.findChangedUsers).toBeUndefined();
  });

  it('should still be a usable redirect authentication provider without a directory', () => {
    const provider = new EntraAuthProvider({ tenantId: TENANT, auth });

    expect(provider.kind).toBe('redirect');
    expect(provider.channel).toBe('entra');
    expect(typeof provider.handleCallback).toBe('function');
    expect(typeof provider.createAuthorizationRequest).toBe('function');
  });

  it('should make delta callable through the narrowed composite type', () => {
    const provider = new EntraAuthProvider({
      tenantId: TENANT,
      auth,
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret' },
    }) as EntraAuthProviderWithDirectory;

    // The narrowing type exists to make this call compile. Intersecting with
    // DirectoryProvider alone left findChangedUsers optional, so the one
    // capability it was meant to expose stayed uncallable.
    expect(typeof provider.findChangedUsers).toBe('function');
    expect(typeof provider.directory.findChangedUsers).toBe('function');
  });

  it('should report the delta cursor under a directory-neutral name', async () => {
    const provider = new EntraAuthProvider({
      tenantId: TENANT,
      auth,
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret' },
    });

    jest.spyOn(provider.directory as EntraDirectoryProvider, 'findChangedUsers').mockResolvedValue({
      entries: [],
      removed: [],
      cursor: 'opaque',
    });

    const result = await provider.findChangedUsers?.(null);

    expect(result?.cursor).toBe('opaque');
  });

  it('should forward directory calls to the Graph reader it owns', async () => {
    const provider = new EntraAuthProvider({
      tenantId: TENANT,
      auth,
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret' },
    });

    const findUser = jest.spyOn(provider.directory as EntraDirectoryProvider, 'findUser').mockResolvedValue(null);

    await provider.findUser?.('wang@corp.com');

    expect(findUser).toHaveBeenCalledWith('wang@corp.com');
  });

  it('should give the directory half the composite channel and tenant', () => {
    const provider = new EntraAuthProvider({
      channel: 'corp-entra',
      tenantId: TENANT,
      auth,
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret' },
    });

    expect(provider.directory?.channel).toBe('corp-entra');
    expect(provider.toIdentity?.({ id: 'oid-1' }).channel).toBe('corp-entra');
  });

  it('should report which account attribute the directory is keyed on', () => {
    const upn = new EntraAuthProvider({
      tenantId: TENANT,
      auth,
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret' },
    });

    const hybrid = new EntraAuthProvider({
      tenantId: TENANT,
      auth,
      directory: {
        clientId: 'graph-app',
        clientSecret: 'graph-secret',
        accountAttribute: 'onPremisesSamAccountName',
      },
    });

    expect(upn.accountAttribute).toBe('userPrincipalName');
    expect(hybrid.accountAttribute).toBe('onPremisesSamAccountName');
    expect(new EntraAuthProvider({ tenantId: TENANT, auth }).accountAttribute).toBeUndefined();
  });
});
