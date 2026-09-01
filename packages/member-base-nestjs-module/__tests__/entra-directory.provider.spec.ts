import { createHash, X509Certificate } from 'node:crypto';
import { EntraDirectoryProvider } from '../src/providers/entra/entra-directory.provider';
import { DirectoryRequestFailedError } from '../src/constants/errors/base.error';
import { installFetchMock, queryOf, type FetchMock, type StubbedResponse } from './__utils__/fetch-mock';

const TENANT = '11111111-2222-3333-4444-555555555555';
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;

const createProvider = (
  overrides: Partial<ConstructorParameters<typeof EntraDirectoryProvider>[0]> = {},
): EntraDirectoryProvider =>
  new EntraDirectoryProvider({
    tenantId: TENANT,
    clientId: 'app-id',
    clientSecret: 'app-secret',
    ...overrides,
  });

const tokenResponse = (accessToken = 'graph-token', expiresIn = 3600): StubbedResponse => ({
  body: { access_token: accessToken, expires_in: expiresIn },
});

const isTokenCall = (url: string): boolean => url === TOKEN_URL;

/**
 * A throwaway self-signed certificate and its key, generated for this suite and
 * used nowhere else. Present so the certificate credential path is actually
 * exercised: it is the one credential shape whose format is a claim about
 * Entra rather than about this code, and it was previously untested.
 */
const TEST_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDKTCCAhGgAwIBAgIUWudo6hwyNznGNj5sg+tfsTbWkIcwDQYJKoZIhvcNAQEL
BQAwIzEhMB8GA1UEAwwYbWVtYmVyLWJhc2UtdGVzdC1maXh0dXJlMCAXDTI2MDgy
ODE0NTA1MFoYDzIxMjYwODA0MTQ1MDUwWjAjMSEwHwYDVQQDDBhtZW1iZXItYmFz
ZS10ZXN0LWZpeHR1cmUwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDj
96Kg4ReFzb5DVC+aRoTH8FNcGuEWlYFMv6PDcWIYb9vJxWnQyQiF4g6CY820hRWI
W4nKizBpMDg/Msp0psuvlukzIb7kDyadtuozgM4TCkr6LkXyF5B7BuGtnyh54CTB
29ofRvrtLd3ZyNDEt6yPRlIEMJwcB64kX+N+Z29elLuK0VRyUan1dZ1RgZT5ibqC
E1wzI8lRb41uD2wIBb+34kpdsfMBiduj7JTgbslJVLUMtgPoiVDF/nyjqfsisYF6
J/YGrynsVlumMeFe3ibNfPgFEUHHbed2Y2t4wQj/KI/WFvb4OJb0i7oULyZavlhB
tkC/vDZ6eZEj3vX32v1PAgMBAAGjUzBRMB0GA1UdDgQWBBTEminIC/9VCZxDQO8B
w5IAv0wCETAfBgNVHSMEGDAWgBTEminIC/9VCZxDQO8Bw5IAv0wCETAPBgNVHRMB
Af8EBTADAQH/MA0GCSqGSIb3DQEBCwUAA4IBAQAmbTFzefnbLLHP+R4cvKlD+TjX
x+9wUVhh04th/4G/Z5RSfj0r5WmeEPTk5ge4K/7R+6b/+P1xEYWXr9RrUNrhMgYI
RT5BSu70U5bEaTOY46Dri8lrk5ud9TLyQk8M2DLeETsyfi19CZ/lrGzaBHfIApK5
fe+/qz5C+urQu/WYjhxc/SDP5CQMN+9lbFftx3s/GOCbb4WtkVaVSVtUv1sIrZom
v+hsD5Rl/0Po7HWewxG8/gdFzr+g76AemJ9BTtydfoLwzs0WoHwWrMt8QdIoqNBB
+097W3997wEkuI94C3r/i58/l7D1BeX8RQjkIsOsUtJD77o/vMkCFwQVJerx
-----END CERTIFICATE-----`;

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDj96Kg4ReFzb5D
VC+aRoTH8FNcGuEWlYFMv6PDcWIYb9vJxWnQyQiF4g6CY820hRWIW4nKizBpMDg/
Msp0psuvlukzIb7kDyadtuozgM4TCkr6LkXyF5B7BuGtnyh54CTB29ofRvrtLd3Z
yNDEt6yPRlIEMJwcB64kX+N+Z29elLuK0VRyUan1dZ1RgZT5ibqCE1wzI8lRb41u
D2wIBb+34kpdsfMBiduj7JTgbslJVLUMtgPoiVDF/nyjqfsisYF6J/YGrynsVlum
MeFe3ibNfPgFEUHHbed2Y2t4wQj/KI/WFvb4OJb0i7oULyZavlhBtkC/vDZ6eZEj
3vX32v1PAgMBAAECggEAG904ZRauQ94Wi+891EsbTr76yW7FpXeHsuRXtXtl5JvD
jyGQogL4hjjP0jM1wQNlUuHxcS7bL3hD38GrCmAa1G8LOQM+bGzHqQ5jCQGM7rna
2UKPrRwhPlBkhE7IaUEy7Pkc66bG4/evvr9zeSAEOQz82GNCqZBswihwS5KEA9jK
FuCnkLl+CQVmvdBxJp2YoZN12TRtvoXUx/KuBVdQZkD37KBrN+kj1ORPG/GBhbwd
3OqEXxX/2O5O8v1h22s1fVWXXR+de6lWiTZmxx7uM0uRlz9aj8Hc16vUOp6DbFEG
ScLpRlCfHGww+hpdFMfHeOGRNU0DuPy8wmDzcl68TQKBgQDzJZGefUantaQKJR2C
hdkBtCbrtI7flCaUEEjWBt+A812xNdN8n6oVCTq+FnKSqw8kUz4VuzcZyMG5vo4d
lQFuS6Grv3kOog3H9KZXST2JDfvETl8i7MdsC9HXApQ03YMdHAP+Ofv6i9v+iIk/
ltxjbzh85Iq1IGEDYlZzZpP4LQKBgQDwBKXZvPRsD94cK7KsjUPNC1gTmmRvLorA
AjeXM8a3AfYn0D65nI27UnLyDqCfZqkIGk4i0xuRk5hTMSiOxGnyJtYI/zn8cRou
+eJWeLTqT/ZlVZvmWUVDM3OXKepawprNgrNN1xZkOaqfXXUxA938R4EiP6FjwjuG
IVpN4+5c6wKBgGMcW0E5W4WdOuKPwnmjyZMyNfM6RErKfvc3tBjZ8F0F1pkXkb9o
7dFpU7KMP+OdKqzp6ZK+H3W5KY5nKFLSnCSzW5FAmT3nvKpXBT7rMdQeCRQ5xfnc
fmWCY+S6vmLWME27T71fMWEthV05loh/HBLEEUiHeCrgqerROOANXh95AoGBAO7a
gT3dF5ROeieoqOeksTtlNaJUe+xU8clAq5ex8+f9cLyQNUu7ayRmWXNfcSMQI9in
bOilE4Nc0TLA8e6ZsiFD2q4bZ9Y7q+Xh0Qdimg+vwbF4b2vdnNrSYg6lrM3jafBo
SA2HpYXaCV0MwWokwg2kDvNJRU+kZF4H5PksgfI/AoGAQabnuOsFZ3YvlBQAAP8v
LXj+/oRf9GIZL32UoOS3V5m/L6sSB1XLNmAVpa27PmDIVYVcHUM9qjoeFfp6pP1I
tZXcH1xd7U0p6tWGpkqFgUfr/KxwNOCz91SaAORg9KmucPLozSBBSvHD3xlK+ftD
bPkrEM+hIVXQ/u9P3m7XaSs=
-----END PRIVATE KEY-----`;

/** A second, unrelated key — used to prove a mismatched pair is refused. */
const OTHER_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC8GvpKGN44dJq7
lPrMetgKhUlIZ6eFHae+WVQoFpnir5klu3H4xpDxnaC1ZOrxEFphMAd727RUNvX2
zmfUpJ/c8fksyd2WM53pK+Mni2hAkRWp0pbJiTVSJallNVUP/g3ygsG7Oh8XlFNa
cBdw9WHk5xE/Nt0xarWDQcb1ncXYacCQo9M6mDZAstQUKoPex59JPj1vI20GYXIW
fbGBiayjqj92/tPz6NRxj3ftRdIlHPJaJ0yPs9aTLyGQOclQWP0wZTELPW6IXE9F
LAhJ6u/2ohPgHfQI61wrZIzePjaim0Eyh3lElBAQiaWQ4/0NXB6n2rT6korBYoiy
20CG5UglAgMBAAECggEAWtzJNAupJConKB9Buo5IV2SkzoXLZMC7a3Yo8ahhMx/R
YWmXFy2LjDqxC44w8rsMfU++/bRV+iwGSe7QNuZClm6IB3uHPuu2BpD9i/eKJ04t
4bdowPc3O3QXzFyjtzLoN9GzlSXxKOmsDc6BdD4DyJdZPGjbFejOvxWB7tkEXZF7
GpXaULALpfP+MayVdJy7z+ptH3Qs1lx6q27pOE8BPAXc+gPAKFkPOsjnijmfdnOD
1U2itW1FnEp00j6iDHdTEQcYlq4nRAXOU6qryAXSuX16MonB9UBuWMfWkvB1eyPs
7VGmSqyLNkqeslZJW9OP/+84r7+BKmAvpIPT1jxuzQKBgQDtdLZyhg8z1XID7JFz
1s1IyQmw7w+VXwYcu0ewhY1QLydHEAQtRvfz+7EnCQ7Ohyuh8JbuBGV7CIk3R2/5
xMp2ndlV3NpKGrhrPypABPARE0V2h0QCNGQDL5hKtn1ccDiaylD8S7mrSzR0jJzJ
WCkUzY+OUpDUej2z2Hoznm6l1wKBgQDKy6KNccbYdxx0Rso+qEljzFLAlFkw/8Yi
SiSzfvjUumNHVEjv06yjAL96ldh3moWrhsTsrudfmLfoOYJIG8/erIkcHGeTAQ07
qb79pN3uM6cclS+5YIOZPyiOkXAYaS98LSzommj8qgy3//nlUp2EZv3tIL1AOsKk
keT3L81KYwKBgATzB9J/RNXZvxSh265Ebeb0ecU8VmDQqDn1FVtyjS18rh7nEI85
CXYGavzbTXm0i45Gi37OjKbx2JpUXNsh5O5v/9WwUsR0ph9mI6VN9QsGEc6UpzA8
k1EVruDvyNEibaucR+/aTDZrzN4ZCDOSKNkMJ8/ZnLcxDRQwkOt+g+PlAoGARr5O
0GTWZwD2LiHbv4vZPjUy0PdvPcacCa4vq2Ypy5vRsjpWz0LaQGqsYUkQoHiJFNMI
s0A4eoK99QbKyfjZxOYPVn0aLI/7W8rVU4pF2SivrSrl4RcoETeVIFbf8cQPypO/
zMzAvxNbKHzlYfg19tAu2J/JJTTaXap/YzOLu90CgYAuv0rMkfYQnbkwglHeFs1Y
OkoOFfzJ3je+gie6iPLWinPe3oDMrLFAWGFV7NpqwVuC/UWlqXUdMGw7rOqHn1vF
e0ia5dbSg6enpKe6Rm5rZRlBxNTY7uC9Lf26t0Z9YbgoUQ4ciZxgSSiamv+JEcQ/
M4Kz4lNuEAcQe40x13A+DQ==
-----END PRIVATE KEY-----`;

describe('EntraDirectoryProvider', () => {
  let fetchMock: FetchMock;

  afterEach(() => {
    fetchMock?.restore();
  });

  describe('access token', () => {
    it('should acquire one client-credentials token and reuse it across requests', async () => {
      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        return { body: { value: [{ id: 'a' }] } };
      });

      const provider = createProvider({ includeGroups: false });

      await provider.findAllUsers();
      await provider.findAllUsers();

      const tokenCalls = fetchMock.calls.filter(call => isTokenCall(call.url));

      expect(tokenCalls).toHaveLength(1);

      const body = new URLSearchParams(tokenCalls[0].init?.body as string);

      expect(body.get('grant_type')).toBe('client_credentials');
      expect(body.get('client_id')).toBe('app-id');
      expect(body.get('client_secret')).toBe('app-secret');
      // `.default` is the client-credentials spelling; naming scopes is rejected.
      expect(body.get('scope')).toBe('https://graph.microsoft.com/.default');
    });

    it('should renew the token once it is inside the renewal margin', async () => {
      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse('short-lived', 30);

        return { body: { value: [] } };
      });

      const provider = createProvider({ includeGroups: false });

      await provider.findAllUsers();
      await provider.findAllUsers();

      // A 30 second lifetime is entirely inside the 60 second margin, so the
      // token is treated as already due for renewal on the next call.
      expect(fetchMock.calls.filter(call => isTokenCall(call.url))).toHaveLength(2);
    });

    it('should drop the cached token and replay the request once on a 401', async () => {
      let usersCall = 0;

      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        usersCall += 1;

        return usersCall === 1 ? { status: 401, body: { error: { message: 'expired' } } } : { body: { value: [] } };
      });

      const provider = createProvider({ includeGroups: false });

      await expect(provider.findAllUsers()).resolves.toEqual([]);

      expect(fetchMock.calls.filter(call => isTokenCall(call.url))).toHaveLength(2);
    });

    it('should attach the bearer token to every graph call', async () => {
      fetchMock = installFetchMock(url => (isTokenCall(url) ? tokenResponse('bearer-value') : { body: { value: [] } }));

      await createProvider({ includeGroups: false }).findAllUsers();

      const graphCall = fetchMock.calls.find(call => !isTokenCall(call.url));

      expect((graphCall?.init?.headers as Record<string, string>).authorization).toBe('Bearer bearer-value');
    });
  });

  describe('paging', () => {
    it('should follow @odata.nextLink until the collection ends', async () => {
      const secondPage = 'https://graph.microsoft.com/v1.0/users?$skiptoken=page-2';

      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        if (url === secondPage) return { body: { value: [{ id: 'c' }] } };

        return { body: { value: [{ id: 'a' }, { id: 'b' }], '@odata.nextLink': secondPage } };
      });

      const entries = await createProvider({ includeGroups: false }).findAllUsers();

      expect(entries.map(entry => entry.id)).toEqual(['a', 'b', 'c']);
      expect(fetchMock.calls.filter(call => !isTokenCall(call.url))).toHaveLength(2);
    });

    it('should never use $expand for memberships', async () => {
      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        if (url.includes('/memberOf/')) return { body: { value: [] } };

        return { body: { value: [{ id: 'a' }] } };
      });

      await createProvider().findAllUsers();

      const listCall = fetchMock.calls.filter(call => !isTokenCall(call.url) && !call.url.includes('/memberOf/'))[0];
      const query = queryOf(listCall.url);

      // $expand on a directory object returns at most 20 objects and carries no
      // @odata.nextLink, so a user in more groups comes back silently truncated.
      expect(query.get('$expand')).toBeNull();
      expect(query.get('$top')).toBe('999');
    });

    it('should resolve memberships per user through the paged group cast', async () => {
      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        if (url.includes('/memberOf/')) return { body: { value: [{ id: 'g1', displayName: 'Sales' }] } };

        return { body: { value: [{ id: 'a' }, { id: 'b' }] } };
      });

      const entries = await createProvider().findAllUsers();

      const groupCalls = fetchMock.calls.filter(call => call.url.includes('/memberOf/microsoft.graph.group'));

      expect(groupCalls).toHaveLength(2);
      expect(queryOf(groupCalls[0].url).get('$top')).toBe('999');
      expect(entries.every(entry => (entry.memberOf ?? []).length === 1)).toBe(true);
    });

    it('should send the advanced query headers only when a filter is supplied', async () => {
      fetchMock = installFetchMock(url => (isTokenCall(url) ? tokenResponse() : { body: { value: [] } }));

      const provider = createProvider({ includeGroups: false });

      await provider.findAllUsers();
      await provider.findAllUsers({ filter: "department eq 'Sales'" });

      const [plain, filtered] = fetchMock.calls.filter(call => !isTokenCall(call.url));

      expect((plain.init?.headers as Record<string, string>).ConsistencyLevel).toBeUndefined();
      expect((filtered.init?.headers as Record<string, string>).ConsistencyLevel).toBe('eventual');
      expect(queryOf(filtered.url).get('$count')).toBe('true');
      expect(queryOf(filtered.url).get('$filter')).toBe("department eq 'Sales'");
    });
  });

  describe('throttling', () => {
    it('should honour Retry-After on a 429 and then succeed', async () => {
      let attempts = 0;

      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        attempts += 1;

        return attempts === 1
          ? { status: 429, headers: { 'retry-after': '2' }, body: { error: { message: 'throttled' } } }
          : { body: { value: [{ id: 'a' }] } };
      });

      const entries = await createProvider({ includeGroups: false }).findAllUsers();

      expect(entries).toHaveLength(1);
      expect(fetchMock.delays).toEqual([2000]);
    });

    it('should refuse to retry early when Retry-After exceeds the cap, and surface the delay', async () => {
      fetchMock = installFetchMock(url =>
        isTokenCall(url) ? tokenResponse() : { status: 429, headers: { 'retry-after': '600' }, body: {} },
      );

      const provider = createProvider({ includeGroups: false, maxRetryDelayMs: 5_000 });

      // Retrying sooner than the directory asked only deepens a throttle, and
      // holding the request open for ten minutes is not an option either — so
      // the wait is handed to the caller instead of being silently shortened.
      await expect(provider.findAllUsers()).rejects.toMatchObject({
        upstreamStatus: 429,
        retryAfterMs: 600_000,
      });

      expect(fetchMock.delays).toEqual([]);
    });

    it('should back off exponentially on a 5xx that carries no Retry-After', async () => {
      let attempts = 0;

      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        attempts += 1;

        return attempts < 3 ? { status: 503, body: {} } : { body: { value: [] } };
      });

      await createProvider({ includeGroups: false }).findAllUsers();

      expect(fetchMock.delays).toEqual([1000, 2000]);
    });

    it('should give up after maxRetries and report the upstream status', async () => {
      fetchMock = installFetchMock(url =>
        isTokenCall(url) ? tokenResponse() : { status: 429, body: { error: { message: 'still throttled' } } },
      );

      const provider = createProvider({ includeGroups: false, maxRetries: 2 });

      await expect(provider.findAllUsers()).rejects.toBeInstanceOf(DirectoryRequestFailedError);

      // The original attempt plus two retries.
      expect(fetchMock.calls.filter(call => !isTokenCall(call.url))).toHaveLength(3);
    });
  });

  describe('findUser', () => {
    it('should address a user directly by userPrincipalName and attach groups', async () => {
      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        if (url.includes('/memberOf/')) {
          return { body: { value: [{ id: 'g1', displayName: 'Sales' }] } };
        }

        return { body: { id: 'oid-1', userPrincipalName: 'wang@corp.com', displayName: 'Wang' } };
      });

      const entry = await createProvider().findUser('wang@corp.com');

      expect(entry?.id).toBe('oid-1');
      // The provider stamps the annotation, because the cast endpoint is what
      // proves these are groups and extractGroupNames now fails closed.
      expect(entry?.memberOf).toEqual([{ id: 'g1', displayName: 'Sales', '@odata.type': '#microsoft.graph.group' }]);

      expect(createProvider().toIdentity(entry ?? {}).attributes?.groups).toEqual(['Sales']);

      const graphCalls = fetchMock.calls.filter(call => !isTokenCall(call.url));

      expect(graphCalls[0].url).toContain('/v1.0/users/wang%40corp.com');
      // The OData cast keeps directory roles out of the group list at source.
      expect(graphCalls[1].url).toContain('/memberOf/microsoft.graph.group');
    });

    it('should answer null rather than throwing when the account does not exist', async () => {
      fetchMock = installFetchMock(url =>
        isTokenCall(url) ? tokenResponse() : { status: 404, body: { error: { message: 'not found' } } },
      );

      await expect(createProvider({ includeGroups: false }).findUser('ghost@corp.com')).resolves.toBeNull();
    });

    it('should filter on onPremisesSamAccountName for a hybrid tenant', async () => {
      fetchMock = installFetchMock(url =>
        isTokenCall(url) ? tokenResponse() : { body: { value: [{ id: 'oid-2', onPremisesSamAccountName: 'wangxx' }] } },
      );

      const provider = createProvider({ includeGroups: false, accountAttribute: 'onPremisesSamAccountName' });
      const entry = await provider.findUser('wangxx');

      expect(entry?.id).toBe('oid-2');

      const graphCall = fetchMock.calls.filter(call => !isTokenCall(call.url))[0];

      expect(queryOf(graphCall.url).get('$filter')).toBe("onPremisesSamAccountName eq 'wangxx'");
      expect((graphCall.init?.headers as Record<string, string>).ConsistencyLevel).toBe('eventual');
    });

    it('should escape a single quote in an OData string literal', async () => {
      fetchMock = installFetchMock(url => (isTokenCall(url) ? tokenResponse() : { body: { value: [] } }));

      const provider = createProvider({ includeGroups: false, accountAttribute: 'onPremisesSamAccountName' });

      await provider.findUser("o'brien");

      const graphCall = fetchMock.calls.filter(call => !isTokenCall(call.url))[0];

      expect(queryOf(graphCall.url).get('$filter')).toBe("onPremisesSamAccountName eq 'o''brien'");
    });
  });

  describe('toIdentity', () => {
    const provider = new EntraDirectoryProvider({
      tenantId: TENANT,
      clientId: 'app-id',
      clientSecret: 'app-secret',
      channel: 'entra',
    });

    it('should bind on the object id, not the account name', () => {
      const identity = provider.toIdentity({ id: 'oid-1', userPrincipalName: 'wang@corp.com' });

      expect(identity.attributes?.account).toBe('wang@corp.com');

      expect(identity.identifier).toBe('oid-1');
      expect(identity.identifierVerified).toBe(true);
      expect(identity.channel).toBe('entra');
    });

    it('should map accountEnabled onto attributes.disabled, tri-state', () => {
      expect(provider.toIdentity({ id: 'oid-1', accountEnabled: false }).attributes?.disabled).toBe(true);
      expect(provider.toIdentity({ id: 'oid-1', accountEnabled: true }).attributes?.disabled).toBe(false);
      // Absent is neither. A delta entry carries the id plus at least what
      // changed, so answering `false` here would let a reconciliation job
      // re-enable a suspended member on any unrelated change.
      expect(provider.toIdentity({ id: 'oid-1' }).attributes?.disabled).toBeUndefined();
    });

    it('should not invent values a partial delta entry never carried', () => {
      const identity = provider.toIdentity({ id: 'oid-1', displayName: 'New Name' });

      // Filling these in would overwrite a real account name with the object id
      // and blank a real email on the next reconciliation write-back.
      expect(identity.attributes?.account).toBeUndefined();
      expect(identity.attributes?.email).toBeUndefined();
      expect(identity.attributes?.groups).toBeUndefined();
      expect(identity.attributes?.disabled).toBeUndefined();
      // What the entry did carry is still reported.
      expect(identity.attributes?.name).toBe('New Name');
      expect(identity.identifier).toBe('oid-1');
    });

    it('should place extraAttributes on the identity, uninterpreted', () => {
      // Asking Graph for an attribute and then dropping it made
      // `extraAttributes` a request with no response. What the tenant's own
      // fields mean is the application's business, so they arrive under Graph's
      // names with Graph's values and no mapping applied.
      const withExtras = new EntraDirectoryProvider({
        tenantId: TENANT,
        clientId: 'app-id',
        clientSecret: 'app-secret',
        extraAttributes: ['employeeId', 'employeeOrgData'],
      });

      const identity = withExtras.toIdentity({
        id: 'oid-1',
        userPrincipalName: 'wang@corp.com',
        employeeId: 'E-00427',
        employeeOrgData: { division: 'Hardware', costCenter: '4711' },
        officeLocation: 'Taipei',
      });

      expect(identity.attributes?.employeeId).toBe('E-00427');
      expect(identity.attributes?.employeeOrgData).toEqual({ division: 'Hardware', costCenter: '4711' });
      // Not asked for, so not reported — even though Graph's default projection
      // returned it.
      expect('officeLocation' in (identity.attributes ?? {})).toBe(false);
    });

    it('should not let an extra attribute shadow a mapped one', () => {
      // Widening `$select` must not be able to change what a group check reads.
      const shadowing = new EntraDirectoryProvider({
        tenantId: TENANT,
        clientId: 'app-id',
        clientSecret: 'app-secret',
        extraAttributes: ['groups', 'department', 'account'],
      });

      const identity = shadowing.toIdentity({
        id: 'oid-1',
        department: 'R&D',
        memberOf: [],
        groups: ['Domain Admins'],
        account: 'someone-else',
        userPrincipalName: 'wang@corp.com',
      });

      expect(identity.attributes?.groups).toEqual([]);
      expect(identity.attributes?.account).toBe('wang@corp.com');
      expect(identity.attributes?.department).toBe('R&D');
    });

    it('should omit an extra attribute a delta entry did not carry', () => {
      const withExtras = new EntraDirectoryProvider({
        tenantId: TENANT,
        clientId: 'app-id',
        clientSecret: 'app-secret',
        extraAttributes: ['employeeId'],
      });

      const identity = withExtras.toIdentity({ id: 'oid-1', displayName: 'Wang' });

      expect('employeeId' in (identity.attributes ?? {})).toBe(false);
    });

    it('should report no groups as absent, not as an empty list', () => {
      expect(provider.toIdentity({ id: 'oid-1' }).attributes?.groups).toBeUndefined();
      expect(provider.toIdentity({ id: 'oid-1', memberOf: [] }).attributes?.groups).toEqual([]);
    });

    it('should map the documented graph fields onto the shared attribute names', () => {
      const identity = provider.toIdentity({
        id: 'oid-1',
        userPrincipalName: 'wang@corp.com',
        displayName: 'Wang',
        mail: 'wang@example.com',
        jobTitle: 'Engineer',
        department: 'R&D',
      });

      expect(identity.attributes).toMatchObject({
        account: 'wang@corp.com',
        name: 'Wang',
        email: 'wang@example.com',
        title: 'Engineer',
        department: 'R&D',
      });
    });

    it('should fall back to userPrincipalName when no mail is set', () => {
      const identity = provider.toIdentity({ id: 'oid-1', userPrincipalName: 'wang@corp.com' });

      expect(identity.attributes?.email).toBe('wang@corp.com');
    });

    it('should report group display names and drop anything not marked a group', () => {
      const identity = provider.toIdentity({
        id: 'oid-1',
        memberOf: [
          { id: 'g1', displayName: 'Sales', '@odata.type': '#microsoft.graph.group' },
          { id: 'r1', displayName: 'Global Administrator', '@odata.type': '#microsoft.graph.directoryRole' },
          // Untyped: fails CLOSED. Treating it as a group is how a directory
          // role reaches a list that a membership check reads.
          { id: 'g2', displayName: 'Everyone' },
        ],
      });

      expect(identity.attributes?.groups).toEqual(['Sales']);
    });

    it('should use onPremisesSamAccountName as the account when configured to', () => {
      const hybrid = new EntraDirectoryProvider({
        tenantId: TENANT,
        clientId: 'app-id',
        clientSecret: 'app-secret',
        accountAttribute: 'onPremisesSamAccountName',
      });

      const identity = hybrid.toIdentity({
        id: 'oid-1',
        userPrincipalName: 'wang@corp.com',
        onPremisesSamAccountName: 'wangxx',
      });

      expect(identity.attributes?.account).toBe('wangxx');
      // The UPN is still reported, just not as the account key.
      expect(identity.attributes?.userPrincipalName).toBe('wang@corp.com');
    });

    it('should fall back to the UPN for a cloud-only account in a hybrid tenant', () => {
      const hybrid = new EntraDirectoryProvider({
        tenantId: TENANT,
        clientId: 'app-id',
        clientSecret: 'app-secret',
        accountAttribute: 'onPremisesSamAccountName',
      });

      expect(hybrid.toIdentity({ id: 'oid-1', userPrincipalName: 'cloud@corp.com' }).attributes?.account).toBe(
        'cloud@corp.com',
      );
    });

    it('should refuse an entry with no id', () => {
      expect(() => provider.toIdentity({ userPrincipalName: 'wang@corp.com' })).toThrow(/no id to bind on/);
    });
  });

  describe('findChangedUsers', () => {
    it('should run a full sync when no token is held and return the next one', async () => {
      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        return {
          body: {
            value: [{ id: 'oid-1', displayName: 'Wang' }],
            '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/users/delta?$deltatoken=TOKEN-1',
          },
        };
      });

      const result = await createProvider({ includeGroups: false }).findChangedUsers(null);

      expect(result.entries.map(entry => entry.id)).toEqual(['oid-1']);
      expect(result.cursor).toBe('TOKEN-1');

      const graphCall = fetchMock.calls.filter(call => !isTokenCall(call.url))[0];

      expect(queryOf(graphCall.url).get('$select')).toContain('accountEnabled');
    });

    it('should resume from a stored token without re-sending $select', async () => {
      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        return {
          body: { value: [], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/users/delta?$deltatoken=TOKEN-2' },
        };
      });

      await createProvider({ includeGroups: false }).findChangedUsers('TOKEN-1');

      const query = queryOf(fetchMock.calls.filter(call => !isTokenCall(call.url))[0].url);

      expect(query.get('$deltatoken')).toBe('TOKEN-1');
      // The projection is baked into the token; sending a different one is
      // rejected by Graph.
      expect(query.get('$select')).toBeNull();
    });

    it('should surface both @removed reasons separately', async () => {
      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        return {
          body: {
            value: [
              { id: 'oid-1', displayName: 'Wang' },
              { id: 'oid-2', '@removed': { reason: 'changed' } },
              { id: 'oid-3', '@removed': { reason: 'deleted' } },
            ],
            '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/users/delta?$deltatoken=TOKEN-3',
          },
        };
      });

      const result = await createProvider({ includeGroups: false }).findChangedUsers(null);

      // Soft-deleted (restorable) and hard-deleted stay distinguishable: an
      // application may suspend for one and unbind for the other.
      expect(result.removed).toEqual([
        { id: 'oid-2', reason: 'changed' },
        { id: 'oid-3', reason: 'deleted' },
      ]);

      expect(result.entries.map(entry => entry.id)).toEqual(['oid-1']);
    });

    it('should page a delta collection through nextLink to the deltaLink', async () => {
      const secondPage = 'https://graph.microsoft.com/v1.0/users/delta?$skiptoken=page-2';

      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        if (url === secondPage) {
          return {
            body: {
              value: [{ id: 'oid-2' }],
              '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/users/delta?$deltatoken=TOKEN-4',
            },
          };
        }

        return { body: { value: [{ id: 'oid-1' }], '@odata.nextLink': secondPage } };
      });

      const result = await createProvider({ includeGroups: false }).findChangedUsers(null);

      expect(result.entries.map(entry => entry.id)).toEqual(['oid-1', 'oid-2']);
      expect(result.cursor).toBe('TOKEN-4');
    });

    it('should resolve groups per changed entry, since delta cannot expand', async () => {
      fetchMock = installFetchMock(url => {
        if (isTokenCall(url)) return tokenResponse();

        if (url.includes('/memberOf/')) return { body: { value: [{ id: 'g1', displayName: 'Sales' }] } };

        return {
          body: {
            value: [{ id: 'oid-1' }, { id: 'oid-9', '@removed': { reason: 'deleted' } }],
            '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/users/delta?$deltatoken=TOKEN-5',
          },
        };
      });

      const result = await createProvider().findChangedUsers(null);

      expect(result.entries[0].memberOf).toEqual([
        { id: 'g1', displayName: 'Sales', '@odata.type': '#microsoft.graph.group' },
      ]);

      // Only the surviving entry is looked up; a removed one has nothing to read.
      expect(fetchMock.calls.filter(call => call.url.includes('/memberOf/'))).toHaveLength(1);
    });

    it('should refuse a delta response that carries no deltaLink', async () => {
      fetchMock = installFetchMock(url => (isTokenCall(url) ? tokenResponse() : { body: { value: [] } }));

      await expect(createProvider({ includeGroups: false }).findChangedUsers(null)).rejects.toBeInstanceOf(
        DirectoryRequestFailedError,
      );
    });
  });

  describe('configuration', () => {
    it('should require one of clientSecret or clientCertificate', () => {
      expect(() => new EntraDirectoryProvider({ tenantId: TENANT, clientId: 'app-id' })).toThrow(
        /clientSecret or clientCertificate/,
      );
    });

    it('should sign a certificate client assertion in the documented form', async () => {
      // The whole credential path was previously unexercised, and its header
      // format is a factual claim about Entra rather than about this code.
      // https://learn.microsoft.com/en-us/entra/identity-platform/certificate-credentials
      fetchMock = installFetchMock(url => (isTokenCall(url) ? tokenResponse() : { body: { value: [] } }));

      await new EntraDirectoryProvider({
        tenantId: TENANT,
        clientId: 'app-id',
        clientCertificate: { certificate: TEST_CERTIFICATE, privateKey: TEST_PRIVATE_KEY },
        includeGroups: false,
      }).findAllUsers();

      const body = new URLSearchParams(fetchMock.calls[0].init?.body as string);

      expect(body.get('client_assertion_type')).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      expect(body.get('client_secret')).toBeNull();

      const assertion = body.get('client_assertion') ?? '';
      const [header, payload] = assertion
        .split('.')
        .slice(0, 2)
        .map(part => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')));

      expect(header.alg).toBe('PS256');
      expect(header.typ).toBe('JWT');
      // base64url of the SHA-256 over the certificate's DER encoding, derived
      // here rather than taken as input so the wrong hash cannot be supplied.
      expect(header['x5t#S256']).toBe(
        createHash('sha256').update(new X509Certificate(TEST_CERTIFICATE).raw).digest('base64url'),
      );

      expect(header.x5t).toBeUndefined();

      expect(payload.aud).toBe(TOKEN_URL);
      expect(payload.iss).toBe('app-id');
      expect(payload.sub).toBe('app-id');
      expect(typeof payload.jti).toBe('string');
    });

    it('should name the option when the certificate is not readable PEM', () => {
      // Thrown at construction rather than at the first call: a broken
      // credential is a deployment mistake, and the issuer only ever reports it
      // as a bare invalid_client whenever someone eventually tries to log in.
      // A crypto stack trace would send the reader looking in the wrong place.
      expect(
        () =>
          new EntraDirectoryProvider({
            tenantId: TENANT,
            clientId: 'app-id',
            clientCertificate: { certificate: 'not a certificate', privateKey: TEST_PRIVATE_KEY },
            includeGroups: false,
          }),
      ).toThrow(/clientCertificate\.certificate is not a readable PEM/);
    });

    it('should refuse a certificate and key that are not a pair', () => {
      // Both are individually valid PEM, so nothing downstream would complain —
      // the assertion signs fine and the issuer rejects it with no reason.
      expect(
        () =>
          new EntraDirectoryProvider({
            tenantId: TENANT,
            clientId: 'app-id',
            clientCertificate: { certificate: TEST_CERTIFICATE, privateKey: OTHER_PRIVATE_KEY },
            includeGroups: false,
          }),
      ).toThrow(/are not a pair/);
    });

    it('should refuse both a secret and a certificate on the same half', () => {
      expect(
        () =>
          new EntraDirectoryProvider({
            tenantId: TENANT,
            clientId: 'app-id',
            clientSecret: 'app-secret',
            clientCertificate: { certificate: TEST_CERTIFICATE, privateKey: TEST_PRIVATE_KEY },
          }),
      ).toThrow(/both clientSecret and clientCertificate/);
    });

    it('should target a national cloud when the base urls are overridden', async () => {
      fetchMock = installFetchMock(url =>
        url.startsWith('https://login.partner.microsoftonline.cn') ? tokenResponse() : { body: { value: [] } },
      );

      await createProvider({
        includeGroups: false,
        graphBaseUrl: 'https://microsoftgraph.chinacloudapi.cn',
        authorityBaseUrl: 'https://login.partner.microsoftonline.cn',
      }).findAllUsers();

      expect(fetchMock.calls[0].url).toBe(`https://login.partner.microsoftonline.cn/${TENANT}/oauth2/v2.0/token`);

      expect(fetchMock.calls[1].url).toContain('https://microsoftgraph.chinacloudapi.cn/v1.0/users');

      const scope = new URLSearchParams(fetchMock.calls[0].init?.body as string).get('scope');

      expect(scope).toBe('https://microsoftgraph.chinacloudapi.cn/.default');
    });

    it('should append extraAttributes to the default $select', async () => {
      fetchMock = installFetchMock(url => (isTokenCall(url) ? tokenResponse() : { body: { value: [] } }));

      await createProvider({ includeGroups: false, extraAttributes: ['employeeId', 'officeLocation'] }).findAllUsers();

      const select = queryOf(fetchMock.calls[1].url).get('$select') ?? '';

      expect(select.startsWith('id,userPrincipalName')).toBe(true);
      expect(select.endsWith('employeeId,officeLocation')).toBe(true);
    });
  });
});
