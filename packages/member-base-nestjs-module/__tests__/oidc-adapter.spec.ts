import { FindOperator, Repository } from 'typeorm';
import {
  countNonExpiringOidcPayloads,
  createOidcAdapterFactory,
  purgeExpiredOidcPayloads,
} from '../src/oidc/oidc-adapter';
import { OidcPayloadEntity } from '../src/oidc/models/oidc-payload.entity';
import { OidcClientEntity } from '../src/oidc/models/oidc-client.entity';
import type { OidcSecretCipher } from '../src/oidc/oidc-provider.options';

interface Harness {
  readonly Adapter: ReturnType<typeof createOidcAdapterFactory>;
  readonly rows: OidcPayloadEntity[];
  readonly clients: OidcClientEntity[];
  readonly payloadRepo: Repository<OidcPayloadEntity>;
}

const buildHarness = (secretCipher?: OidcSecretCipher): Harness => {
  const rows: OidcPayloadEntity[] = [];
  const clients: OidcClientEntity[] = [];

  // The repository fake has to understand the FindOperator values the adapter
  // actually passes (LessThan for the expiry sweep), not just plain equality.
  const matchValue = (actual: unknown, expected: unknown): boolean => {
    if (expected instanceof FindOperator) {
      const target = expected.value as unknown;

      switch (expected.type) {
        case 'lessThan':
          return actual instanceof Date && target instanceof Date && actual.getTime() < target.getTime();
        case 'isNull':
          return actual === null;
        default:
          throw new Error(`unsupported FindOperator in test fake: ${expected.type}`);
      }
    }

    return actual === expected;
  };

  const matches = (row: OidcPayloadEntity, where: Partial<OidcPayloadEntity>): boolean =>
    Object.entries(where).every(([key, value]) => matchValue((row as unknown as Record<string, unknown>)[key], value));

  const payloadRepo = {
    create: (entity: OidcPayloadEntity) => entity,
    save: jest.fn(async (entity: OidcPayloadEntity) => {
      const index = rows.findIndex(row => row.model === entity.model && row.id === entity.id);

      if (index >= 0) rows[index] = entity;
      else rows.push(entity);

      return entity;
    }),
    findOne: jest.fn(
      async ({ where }: { where: Partial<OidcPayloadEntity> }) => rows.find(row => matches(row, where)) ?? null,
    ),
    update: jest.fn(async (where: Partial<OidcPayloadEntity>, patch: Partial<OidcPayloadEntity>) => {
      rows.filter(row => matches(row, where)).forEach(row => Object.assign(row, patch));
    }),
    delete: jest.fn(async (where: Partial<OidcPayloadEntity>) => {
      const remaining = rows.filter(row => !matches(row, where));
      const affected = rows.length - remaining.length;

      rows.length = 0;
      rows.push(...remaining);

      return { affected };
    }),
    count: jest.fn(async () => rows.filter(row => row.expiresAt === null).length),
  } as unknown as Repository<OidcPayloadEntity>;

  const clientRepo = {
    findOne: jest.fn(
      async ({ where }: { where: { clientId: string } }) =>
        clients.find(client => client.clientId === where.clientId) ?? null,
    ),
  } as unknown as Repository<OidcClientEntity>;

  return {
    Adapter: createOidcAdapterFactory(payloadRepo, clientRepo, secretCipher),
    rows,
    clients,
    payloadRepo,
  };
};

describe('oidc adapter payload lifecycle', () => {
  it('should round-trip a payload through upsert and find', async () => {
    const { Adapter } = buildHarness();
    const adapter = new Adapter('AccessToken');

    await adapter.upsert('token-1', { accountId: 'member-1' }, 3600);

    await expect(adapter.find('token-1')).resolves.toMatchObject({ accountId: 'member-1' });
  });

  it('should scope lookups to the model', async () => {
    const { Adapter } = buildHarness();

    await new Adapter('AccessToken').upsert('shared-id', { kind: 'access' }, 3600);

    await expect(new Adapter('RefreshToken').find('shared-id')).resolves.toBeUndefined();
  });

  it('should index grantId, userCode and uid off the payload', async () => {
    const { Adapter, rows } = buildHarness();

    await new Adapter('Session').upsert('s-1', { grantId: 'g-1', userCode: 'u-1', uid: 'uid-1' }, 60);

    expect(rows[0]).toMatchObject({ grantId: 'g-1', userCode: 'u-1', uid: 'uid-1' });
  });

  it('should find by user code and uid', async () => {
    const { Adapter } = buildHarness();
    const adapter = new Adapter('Session');

    await adapter.upsert('s-1', { uid: 'uid-1', userCode: 'u-1' }, 60);

    await expect(adapter.findByUid('uid-1')).resolves.toMatchObject({ uid: 'uid-1' });
    await expect(adapter.findByUserCode('u-1')).resolves.toMatchObject({ userCode: 'u-1' });
  });

  it('should treat an expired row as absent without deleting it on read', async () => {
    const { Adapter, rows } = buildHarness();
    const adapter = new Adapter('AuthorizationCode');

    await adapter.upsert('code-1', { used: false }, -10);

    await expect(adapter.find('code-1')).resolves.toBeUndefined();
    // A read path must not turn into a write; the sweep owns deletion.
    expect(rows).toHaveLength(1);
  });

  it('should expose consumedAt as the consumed timestamp', async () => {
    const { Adapter } = buildHarness();
    const adapter = new Adapter('AuthorizationCode');

    await adapter.upsert('code-1', { redirectUri: 'https://sp/cb' }, 600);
    await adapter.consume('code-1');

    const found = await adapter.find('code-1');

    expect(found?.consumed).toEqual(expect.any(Number));
  });

  it('should destroy a single artefact', async () => {
    const { Adapter, rows } = buildHarness();
    const adapter = new Adapter('AccessToken');

    await adapter.upsert('token-1', {}, 60);
    await adapter.destroy('token-1');

    expect(rows).toHaveLength(0);
  });

  it('should revoke every artefact sharing a grant id', async () => {
    const { Adapter, rows } = buildHarness();

    await new Adapter('AccessToken').upsert('at-1', { grantId: 'g-1' }, 60);
    await new Adapter('RefreshToken').upsert('rt-1', { grantId: 'g-1' }, 60);
    await new Adapter('AccessToken').upsert('at-2', { grantId: 'g-2' }, 60);

    await new Adapter('AccessToken').revokeByGrantId('g-1');

    expect(rows.map(row => row.id)).toEqual(['at-2']);
  });
});

describe('oidc adapter client model', () => {
  it('should serve clients from the administered table as oidc metadata', async () => {
    const { Adapter, clients } = buildHarness();

    clients.push({
      clientId: 'sp-1',
      clientSecret: 'secret',
      name: 'Service Provider',
      redirectUris: ['https://sp.example.com/cb'],
      postLogoutRedirectUris: null,
      grantTypes: null,
      responseTypes: null,
      scope: 'openid email',
      skipConsent: true,
      tokenEndpointAuthMethod: null,
    } as OidcClientEntity);

    const metadata = await new Adapter('Client').find('sp-1');

    expect(metadata).toMatchObject({
      client_id: 'sp-1',
      client_secret: 'secret',
      redirect_uris: ['https://sp.example.com/cb'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
    });
  });

  it('should describe a public client as authenticating with none', async () => {
    const { Adapter, clients } = buildHarness();

    clients.push({
      clientId: 'spa',
      clientSecret: null,
      name: 'SPA',
      redirectUris: ['https://spa.example.com/cb'],
      postLogoutRedirectUris: null,
      grantTypes: null,
      responseTypes: null,
      scope: null,
      skipConsent: false,
      tokenEndpointAuthMethod: null,
    } as OidcClientEntity);

    const metadata = await new Adapter('Client').find('spa');

    expect(metadata).toMatchObject({ token_endpoint_auth_method: 'none' });
    expect(metadata).not.toHaveProperty('client_secret');
  });

  it('should resolve an unknown client to undefined', async () => {
    const { Adapter } = buildHarness();

    await expect(new Adapter('Client').find('nope')).resolves.toBeUndefined();
  });

  describe('secret at rest', () => {
    const cipher: OidcSecretCipher = {
      encrypt: plain => `enc:${plain}`,
      decrypt: stored => {
        if (!stored.startsWith('enc:')) throw new Error('not encrypted with this key');

        return stored.slice(4);
      },
    };

    const pushClient = (clients: OidcClientEntity[], clientSecret: string | null): void => {
      clients.push({
        clientId: 'sp-1',
        clientSecret,
        name: 'Service Provider',
        redirectUris: ['https://sp.example.com/cb'],
        postLogoutRedirectUris: null,
        grantTypes: null,
        responseTypes: null,
        scope: null,
        skipConsent: false,
        tokenEndpointAuthMethod: null,
      } as OidcClientEntity);
    };

    it('should hand the provider the decrypted secret', async () => {
      const { Adapter, clients } = buildHarness(cipher);

      pushClient(clients, 'enc:the-real-secret');

      // The provider compares client_secret_basic against this value, so it
      // has to be the plaintext however the column stores it.
      await expect(new Adapter('Client').find('sp-1')).resolves.toMatchObject({
        client_secret: 'the-real-secret',
        token_endpoint_auth_method: 'client_secret_basic',
      });
    });

    it('should leave a public client alone', async () => {
      const { Adapter, clients } = buildHarness(cipher);

      pushClient(clients, null);

      await expect(new Adapter('Client').find('sp-1')).resolves.toMatchObject({
        token_endpoint_auth_method: 'none',
      });
    });

    it('should accept an async cipher, so a kms or vault call can back it', async () => {
      const asyncCipher: OidcSecretCipher = {
        encrypt: async plain => `enc:${plain}`,
        decrypt: async stored => stored.slice(4),
      };

      const { Adapter, clients } = buildHarness(asyncCipher);

      pushClient(clients, 'enc:the-real-secret');

      await expect(new Adapter('Client').find('sp-1')).resolves.toMatchObject({
        client_secret: 'the-real-secret',
      });
    });

    it('should fail loudly on a rejected async decrypt', async () => {
      const failing: OidcSecretCipher = {
        encrypt: async plain => plain,
        decrypt: async () => {
          throw new Error('kms: AccessDeniedException');
        },
      };

      const { Adapter, clients } = buildHarness(failing);

      pushClient(clients, 'enc:whatever');

      await expect(new Adapter('Client').find('sp-1')).rejects.toThrow(/AccessDeniedException/);
    });

    it('should fail loudly on a secret it cannot decrypt', async () => {
      const { Adapter, clients } = buildHarness(cipher);

      pushClient(clients, 'written-before-the-cipher-was-configured');

      // Returning undefined here would answer invalid_client on every request
      // with nothing wrong visible in the table — the exact failure this
      // package keeps trying to make impossible.
      await expect(new Adapter('Client').find('sp-1')).rejects.toThrow(/rotate this client's secret/);
    });
  });
});

describe('oidc payload maintenance', () => {
  it('should purge only rows that already expired', async () => {
    const { Adapter, payloadRepo, rows } = buildHarness();

    await new Adapter('AccessToken').upsert('expired', {}, -10);
    await new Adapter('AccessToken').upsert('alive', {}, 3600);

    const removed = await purgeExpiredOidcPayloads(payloadRepo);

    expect(removed).toBe(1);
    expect(rows.map(row => row.id)).toEqual(['alive']);
  });

  it('should count rows that never expire', async () => {
    const { Adapter, payloadRepo } = buildHarness();

    await new Adapter('Session').upsert('forever', {}, 0);

    await expect(countNonExpiringOidcPayloads(payloadRepo)).resolves.toBe(1);
  });
});
