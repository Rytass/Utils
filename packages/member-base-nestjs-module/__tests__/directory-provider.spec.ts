import { isDirectoryProvider } from '../src/typings/directory-provider.interface';
import { LdapAuthProvider } from '../src/providers/ldap/ldap-auth.provider';
import { EntraAuthProvider, type EntraAuthProviderWithDirectory } from '../src/providers/entra/entra-auth.provider';
import { EntraDirectoryProvider } from '../src/providers/entra/entra-directory.provider';
import { OidcAuthProvider } from '../src/providers/oidc/oidc-auth.provider';
import type { AuthenticationProvider } from '../src/typings/authentication-provider.interface';
import type { DirectoryProvider } from '../src/typings/directory-provider.interface';

const TENANT = '11111111-2222-3333-4444-555555555555';

/** Throwaway self-signed pair for the certificate-inheritance tests. */
const TEST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDAzCCAeugAwIBAgIUeoL4NZ74LZIebfv8U1SuDrecVU4wDQYJKoZIhvcNAQEL
BQAwETEPMA0GA1UEAwwGcGFpci1hMB4XDTI2MDgzMDE2MzU0M1oXDTM2MDgyNzE2
MzU0M1owETEPMA0GA1UEAwwGcGFpci1hMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
MIIBCgKCAQEAqT7Hih2GBs68El7FUakwWg36StQP3HU+pGL8h7CgMTWehZbHGHwu
Wrp/RoHYdBnwJpJ1WtPtmUFAlkV3XFxahSz+185PZkeR1N+/rvjk3yLkVBFd4orW
S07Z382rBctSc1hzFThcDJJ31QD1c5jPRU+qYigBmwnlySNqUZ16VpMd1h5mLFh3
eLE/pSvxp83O1Hiee/s4uRnb1QOmns+2VqMO1tVjdKlXWFQKl394+eZzbQh+frdQ
+0Qkh3UOfsPg2np+c3GV9rCo2jmsqRaXg2Qm/gp/NZcetXEcpPuYcEK1Qeex2gUq
CHbchpeMvAqmc0LHp20zrOfRPgqk5+YHpwIDAQABo1MwUTAdBgNVHQ4EFgQUYi4K
6bGY/fBaBM9tM+Y8zAov4zAwHwYDVR0jBBgwFoAUYi4K6bGY/fBaBM9tM+Y8zAov
4zAwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAn9ndYcYFC9Tk
dRyHkmEEvbZ0k3/g9bC2wbxc7hMyv4eTD5xYNLfgeDYzQFzpNHv+V3yJUsdpc07d
SmQwS/ZuJJTnV3dPlL/xMsVZ/QDfnBjt7Q4P4MtGm3cpXTqkdRPzqnlGga7tmkWN
mAdQ0JIQtAwYf0iPQBG9exSIj+4tDlrbqTsMnuUQnntgdLfQZq03JTVBjJnFCGUm
LZs9h9H3eg1InITUhV0q09WfvdIyuamNXSoWNDEF//oDAcu+tBWukfwozi1ntcdX
ejN0r7PzvGp8rX5z4+VbsuiEBYWOcg8R7qEyCaTP09+iKx2XM3UIuitf2wdWYvqm
Ns7QCHS8nQ==
-----END CERTIFICATE-----`;

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCpPseKHYYGzrwS
XsVRqTBaDfpK1A/cdT6kYvyHsKAxNZ6FlscYfC5aun9Ggdh0GfAmknVa0+2ZQUCW
RXdcXFqFLP7Xzk9mR5HU37+u+OTfIuRUEV3iitZLTtnfzasFy1JzWHMVOFwMknfV
APVzmM9FT6piKAGbCeXJI2pRnXpWkx3WHmYsWHd4sT+lK/Gnzc7UeJ57+zi5GdvV
A6aez7ZWow7W1WN0qVdYVAqXf3j55nNtCH5+t1D7RCSHdQ5+w+Daen5zcZX2sKja
OaypFpeDZCb+Cn81lx61cRyk+5hwQrVB57HaBSoIdtyGl4y8CqZzQsenbTOs59E+
CqTn5genAgMBAAECggEAAd3Di9nVRsLAdn1zCxYMjY3GZBzKsL2ESjX7YqC983kS
rOLRe2GceSMN7iE+T0fs3CTItO9z3jkPd7mbIbHzH2wfkhjUAmTbKEBzmLBQk2aE
NLE4xAAF0nypGxcxorPv/sobJH9GQHe5p0Hxed+h2iG6oAn6ko3FFuCGeh7/6voH
If+urMTRtc9AMSPmegHVJ78pnax3u98nSh25FbAHGfMCZ9QNOfA1cJTIP+K5v16v
o4yFHSwSARIiqm8Ejhho2atcoyoBdCQqG9KkzlFG1tIYgOfzdulhYT+JByTgcrPi
E3OY80PcFneJrbjixffWixyWfgXQtVzivJzUWm6cqQKBgQDc/6yh0tqJht6a3UUo
/eLYmcYHqq6t0husEIWfdDkmMmJDf8Po4FDny44aRAqDwHZdiCOGw9ZuKmXjZSHu
c49Pc8vUus8LgMe9VDxwsunshA7hKMRPfl/oIBCsFP9QBKDyPvVADslkxCkL3QB+
gc8Bv9UfNwtfa4fJDqStzcb2zQKBgQDEDMaGz4cHBqt05YxeT1VsyjbyM8bNXCH+
aeX8/zTn9ngaLDc4LXPRTG8Ex2XJ3jnCZuRK3+cpWu8GlCqty4p+uRF5I2C2EOyY
FKTOUu/MWPgWum4pJg+xlB+1JkYqpBja3cgNTkEfNsi2liCN+kXDiZnM7fYI2+ji
3IQxZsEwQwKBgHGXBI9EhkkLxl0JACQ6op88IpoMM65qAQkmkNfNcBZe7TzObc7D
hTIu4QJFGLZxdSVL9R6uiAelySrg71jVksJ+vTTBM+wwq/l3U32FqFCF6/P09Tn6
tabk3Ezmmffx+RuqGnprXz5oyMQtOrTLWbAHfq6Fp1XLOkawPRqMWwi9AoGAXX3O
KrnKpaIbn6pcDxl8Hl4sZ8IjOwmFuIKdx9GYVEooKisNxj9+rL/rbXb9ZpAQMVHJ
6p7t6L3RoOyFkc2v5RCycXdahlh5y2iE01OfwW5oGMadBAh/kWqW2FdBPNJ2e+Ep
ppa73XvNqazcJ3jDTiVPb/fGzaC5ZX5NmBVtaWsCgYEAvpqm1q9AgsvQ3uVmgpE8
Ubw5E4N7E9Vh8YFdlS7kvjgkUYnSPNkZcnKjDUSirY9krEv1bPYqlfuKGPByiezI
RbEOEHuzTMhTcntKM/o42f+ir2zto2+etXHMoOencMgbxLwfBM+9LuOQ6f1xUoiZ
lQErIBb8Hq1mKAhDm+JrBj0=
-----END PRIVATE KEY-----`;

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

describe('EntraAuthProvider certificate credentials', () => {
  const certificate = { certificate: TEST_CERTIFICATE, privateKey: TEST_PRIVATE_KEY };
  const auth = { clientId: 'login-app', redirectUri: 'https://app.example.com/auth/entra/callback' };

  const assertionParams = (provider: { directory?: EntraDirectoryProvider }): unknown =>
    (provider.directory as unknown as { client: { credentialParams(endpoint: string): unknown } }).client;

  it('should let one top-level certificate serve both halves', () => {
    // Writing the same PEM twice is how the two halves drift apart at the next
    // rotation, so the composite lets one entry cover both.
    const provider = new EntraAuthProvider({
      tenantId: TENANT,
      clientCertificate: certificate,
      auth,
      directory: { clientId: 'graph-app' },
    });

    expect(provider.directory).toBeInstanceOf(EntraDirectoryProvider);
    expect(assertionParams(provider)).toBeDefined();
  });

  it('should let each half override the inherited certificate', () => {
    // A deployment with two application registrations needs this.
    expect(
      () =>
        new EntraAuthProvider({
          tenantId: TENANT,
          clientCertificate: certificate,
          auth: { ...auth, clientCertificate: { certificate: TEST_CERTIFICATE, privateKey: 'not a key' } },
          directory: { clientId: 'graph-app' },
        }),
    ).toThrow(/clientCertificate\.privateKey is not a readable PEM/);

    expect(
      () =>
        new EntraAuthProvider({
          tenantId: TENANT,
          clientCertificate: certificate,
          auth,
          directory: {
            clientId: 'graph-app',
            clientCertificate: { certificate: TEST_CERTIFICATE, privateKey: 'not a key' },
          },
        }),
    ).toThrow(/clientCertificate\.privateKey is not a readable PEM/);
  });

  it('should still accept a secret on one half and a certificate on the other', () => {
    // Nothing forces the two halves onto the same credential kind.
    const provider = new EntraAuthProvider({
      tenantId: TENANT,
      auth: { ...auth, clientCertificate: certificate },
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret' },
    });

    expect(provider.directory).toBeInstanceOf(EntraDirectoryProvider);
  });

  it('should not inherit a certificate onto a half that declared a secret', () => {
    // The directory half named a secret explicitly; inheriting a certificate on
    // top of it would be the ambiguity the mutual-exclusion check exists to stop.
    expect(
      () =>
        new EntraAuthProvider({
          tenantId: TENANT,
          clientCertificate: certificate,
          auth,
          directory: { clientId: 'graph-app', clientSecret: 'graph-secret' },
        }),
    ).toThrow(/both clientSecret and clientCertificate/);
  });

  it('should leave a secret-only composite unchanged', () => {
    const provider = new EntraAuthProvider({
      tenantId: TENANT,
      auth: { ...auth, clientSecret: 'login-secret' },
      directory: { clientId: 'graph-app', clientSecret: 'graph-secret' },
    });

    expect(provider.kind).toBe('redirect');
    expect(provider.directory).toBeInstanceOf(EntraDirectoryProvider);
  });
});
