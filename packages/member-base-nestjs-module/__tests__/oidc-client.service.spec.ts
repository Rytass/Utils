import { Repository } from 'typeorm';
import { OidcClientService } from '../src/oidc/oidc-client.service';
import { OidcClientEntity } from '../src/oidc/models/oidc-client.entity';
import {
  InconsistentOidcClientGrantsError,
  InvalidOidcRedirectUriError,
  OidcClientAlreadyExistsError,
  OidcClientIdRetiredError,
  OidcClientNotFoundError,
  PublicOidcClientNotAllowedError,
} from '../src/constants/errors/base.error';
import type { MemberBaseOidcProviderOptions } from '../src/oidc/oidc-provider.options';

const OPTIONS: MemberBaseOidcProviderOptions = { issuer: 'https://idp.example.com/oidc' };

const buildClient = (overrides: Partial<OidcClientEntity> = {}): OidcClientEntity =>
  ({
    clientId: 'reporting',
    clientSecret: 'stored-secret',
    name: 'Reporting',
    redirectUris: ['https://reporting.example.com/auth/callback'],
    postLogoutRedirectUris: null,
    grantTypes: null,
    responseTypes: null,
    scope: null,
    skipConsent: false,
    tokenEndpointAuthMethod: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  }) as OidcClientEntity;

/**
 * Backed by a real array rather than fixed return values: the service now
 * distinguishes "absent", "live" and "soft removed" for the same id, which a
 * findOne that ignores its criteria cannot express.
 */
const createRepo = (
  rows: OidcClientEntity[] = [],
): Repository<OidcClientEntity> & { rows: OidcClientEntity[]; updates: Partial<OidcClientEntity>[] } => {
  const updates: Partial<OidcClientEntity>[] = [];

  const repo = {
    rows,
    updates,
    find: async (): Promise<OidcClientEntity[]> => rows.filter(row => !row.deletedAt),
    findOne: async ({
      where,
      withDeleted,
    }: {
      where: { clientId: string };
      withDeleted?: boolean;
    }): Promise<OidcClientEntity | null> =>
      rows.find(row => row.clientId === where.clientId && (withDeleted || !row.deletedAt)) ?? null,
    create: (input: Partial<OidcClientEntity>): OidcClientEntity => buildClient(input),
    save: async (input: OidcClientEntity): Promise<OidcClientEntity> => {
      rows.push(input);

      return input;
    },
    update: async (
      { clientId }: { clientId: string },
      patch: Partial<OidcClientEntity>,
    ): Promise<{ affected: number }> => {
      updates.push(patch);
      Object.assign(rows.find(row => row.clientId === clientId) as OidcClientEntity, patch);

      return { affected: 1 };
    },
    softRemove: async (row: OidcClientEntity): Promise<OidcClientEntity> => {
      row.deletedAt = new Date('2026-02-01T00:00:00.000Z');

      return row;
    },
    recover: async (row: OidcClientEntity): Promise<OidcClientEntity> => {
      row.deletedAt = null;

      return row;
    },
  };

  return repo as unknown as Repository<OidcClientEntity> & {
    rows: OidcClientEntity[];
    updates: Partial<OidcClientEntity>[];
  };
};

const createService = (
  repo: Repository<OidcClientEntity>,
  options: MemberBaseOidcProviderOptions = OPTIONS,
): OidcClientService => new OidcClientService(repo, options);

const VALID = { name: 'Reporting', redirectUris: ['https://reporting.example.com/auth/callback'] };

describe('OidcClientService', () => {
  describe('reading', () => {
    it('should never expose the stored secret', async () => {
      const service = createService(createRepo([buildClient()]));

      const [view] = await service.list();

      expect(view).not.toHaveProperty('clientSecret');
      expect(view.hasSecret).toBe(true);
    });

    it('should report a public client as having no secret', async () => {
      const service = createService(createRepo([buildClient({ clientSecret: null })]));

      expect((await service.get('reporting')).hasSecret).toBe(false);
    });

    it('should return null from findOne when the client is unknown', async () => {
      await expect(createService(createRepo()).findOne('missing')).resolves.toBeNull();
    });

    it('should throw from get when the client is unknown', async () => {
      await expect(createService(createRepo()).get('missing')).rejects.toBeInstanceOf(OidcClientNotFoundError);
    });

    it('should hide a removed client from list and get', async () => {
      const repo = createRepo([buildClient()]);
      const service = createService(repo);

      await service.remove('reporting');

      await expect(service.list()).resolves.toEqual([]);
      await expect(service.get('reporting')).rejects.toBeInstanceOf(OidcClientNotFoundError);
    });
  });

  describe('create', () => {
    it('should return the generated secret exactly once', async () => {
      const repo = createRepo();

      const created = await createService(repo).create(VALID);

      expect(created.clientSecret).toEqual(expect.any(String));
      expect(created.hasSecret).toBe(true);
      expect(repo.rows[0].clientSecret).toBe(created.clientSecret);
    });

    it('should generate a client id when none is supplied', async () => {
      const repo = createRepo();

      const created = await createService(repo).create(VALID);

      expect(created.clientId).toEqual(expect.any(String));
      expect(created.clientId.length).toBeGreaterThan(0);
    });

    it('should issue no secret for a public client', async () => {
      const repo = createRepo();

      const created = await createService(repo).create({ ...VALID, confidential: false });

      expect(created.clientSecret).toBeNull();
      expect(repo.rows[0].clientSecret).toBeNull();
    });

    it('should reject a public client when the deployment disallows one', async () => {
      const service = createService(createRepo(), { ...OPTIONS, clients: { allowPublic: false } });

      await expect(service.create({ ...VALID, confidential: false })).rejects.toBeInstanceOf(
        PublicOidcClientNotAllowedError,
      );
    });

    it('should still allow a confidential client when public ones are disallowed', async () => {
      const service = createService(createRepo(), { ...OPTIONS, clients: { allowPublic: false } });

      await expect(service.create(VALID)).resolves.toMatchObject({ hasSecret: true });
    });

    it('should refuse to overwrite a live client with the same id', async () => {
      const repo = createRepo([buildClient()]);

      await expect(createService(repo).create({ ...VALID, clientId: 'reporting' })).rejects.toBeInstanceOf(
        OidcClientAlreadyExistsError,
      );

      expect(repo.rows).toHaveLength(1);
    });

    it('should refuse an id still held by a removed client', async () => {
      const repo = createRepo([buildClient()]);
      const service = createService(repo);

      await service.remove('reporting');

      await expect(service.create({ ...VALID, clientId: 'reporting' })).rejects.toBeInstanceOf(
        OidcClientIdRetiredError,
      );
    });
  });

  describe('built-in validation', () => {
    it.each([
      ['a comma', 'https://a.example.com/cb?next=a,b'],
      ['a fragment', 'https://a.example.com/cb#done'],
    ])('should reject a redirect uri containing %s', async (_label, uri) => {
      await expect(createService(createRepo()).create({ ...VALID, redirectUris: [uri] })).rejects.toBeInstanceOf(
        InvalidOidcRedirectUriError,
      );
    });

    it('should reject a comma in a post logout redirect uri', async () => {
      await expect(
        createService(createRepo()).create({ ...VALID, postLogoutRedirectUris: ['https://a.example.com/out?a=1,2'] }),
      ).rejects.toBeInstanceOf(InvalidOidcRedirectUriError);
    });

    it('should allow a fragment in a post logout redirect uri', async () => {
      await expect(
        createService(createRepo()).create({ ...VALID, postLogoutRedirectUris: ['https://a.example.com/out#bye'] }),
      ).resolves.toBeDefined();
    });

    it('should reject response_types code without the authorization_code grant', async () => {
      await expect(
        createService(createRepo()).create({ ...VALID, responseTypes: ['code'], grantTypes: ['refresh_token'] }),
      ).rejects.toBeInstanceOf(InconsistentOidcClientGrantsError);
    });

    it('should judge an unset grant_types against the adapter defaults', async () => {
      // response_types defaults to ['code'] and grant_types to one that
      // includes authorization_code, so neither being set is consistent.
      await expect(createService(createRepo()).create(VALID)).resolves.toBeDefined();
    });

    it('should catch the inconsistency when only grant_types is narrowed', async () => {
      await expect(
        createService(createRepo()).create({ ...VALID, grantTypes: ['client_credentials'] }),
      ).rejects.toBeInstanceOf(InconsistentOidcClientGrantsError);
    });

    it('should run the application hook with the state about to be written', async () => {
      const validate = jest.fn();
      const service = createService(createRepo(), { ...OPTIONS, clients: { validate } });

      await service.create({ ...VALID, clientId: 'reporting' });

      expect(validate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Reporting' }), {
        operation: 'create',
        clientId: 'reporting',
      });
    });

    it('should let the hook reject a registration', async () => {
      const service = createService(createRepo(), {
        ...OPTIONS,
        clients: {
          validate: input => {
            if (input.redirectUris?.some(uri => uri.startsWith('http://'))) throw new Error('https only');
          },
        },
      });

      await expect(service.create({ ...VALID, redirectUris: ['http://a.example.com/cb'] })).rejects.toThrow(
        'https only',
      );
    });

    it('should hand the hook the existing record on an update', async () => {
      const validate = jest.fn();
      const repo = createRepo([buildClient()]);
      const service = createService(repo, { ...OPTIONS, clients: { validate } });

      await service.update('reporting', VALID);

      expect(validate.mock.calls[0][1]).toMatchObject({ operation: 'update', clientId: 'reporting' });
      expect(validate.mock.calls[0][1].existing).toMatchObject({ clientId: 'reporting' });
    });
  });

  describe('update', () => {
    it('should reject an unknown client before writing', async () => {
      const repo = createRepo();

      await expect(createService(repo).update('missing', VALID)).rejects.toBeInstanceOf(OidcClientNotFoundError);
      expect(repo.updates).toHaveLength(0);
    });

    it('should clear the fields the caller omitted in replace mode', async () => {
      const repo = createRepo([buildClient({ scope: 'openid email', grantTypes: ['authorization_code'] })]);

      await createService(repo).update('reporting', VALID);

      expect(repo.updates[0]).toMatchObject({ scope: null, grantTypes: null });
    });

    it('should keep the fields the caller omitted in merge mode', async () => {
      const repo = createRepo([buildClient({ scope: 'openid email', grantTypes: ['authorization_code'] })]);

      await createService(repo).update('reporting', { name: 'Renamed' }, { mode: 'merge' });

      expect(repo.updates[0]).toMatchObject({
        name: 'Renamed',
        scope: 'openid email',
        grantTypes: ['authorization_code'],
      });
    });

    it('should still validate the merged result', async () => {
      const repo = createRepo([buildClient({ responseTypes: ['code'] })]);

      await expect(
        createService(repo).update('reporting', { grantTypes: ['refresh_token'] }, { mode: 'merge' }),
      ).rejects.toBeInstanceOf(InconsistentOidcClientGrantsError);
    });

    it('should never touch the secret', async () => {
      const repo = createRepo([buildClient()]);

      await createService(repo).update('reporting', VALID);

      expect(repo.updates[0]).not.toHaveProperty('clientSecret');
    });
  });

  describe('rotateSecret', () => {
    it('should persist and return a fresh secret', async () => {
      const repo = createRepo([buildClient()]);

      const rotated = await createService(repo).rotateSecret('reporting');

      expect(rotated.clientSecret).not.toBe('stored-secret');
      expect(repo.rows[0].clientSecret).toBe(rotated.clientSecret);
    });

    it('should reject an unknown client before writing', async () => {
      const repo = createRepo();

      await expect(createService(repo).rotateSecret('missing')).rejects.toBeInstanceOf(OidcClientNotFoundError);
      expect(repo.updates).toHaveLength(0);
    });
  });

  describe('secretCipher', () => {
    const cipher = {
      encrypt: (plain: string): string => `enc:${plain}`,
      decrypt: (stored: string): string => stored.replace(/^enc:/, ''),
    };

    it('should store an encrypted secret but return the plaintext once', async () => {
      const repo = createRepo();

      const created = await createService(repo, { ...OPTIONS, clients: { secretCipher: cipher } }).create(VALID);

      expect(repo.rows[0].clientSecret).toBe(`enc:${created.clientSecret}`);
      expect(created.clientSecret).not.toMatch(/^enc:/);
    });

    it('should await an async cipher on create', async () => {
      const repo = createRepo();
      const asyncCipher = {
        encrypt: async (plain: string): Promise<string> => `enc:${plain}`,
        decrypt: async (stored: string): Promise<string> => stored.slice(4),
      };

      const created = await createService(repo, { ...OPTIONS, clients: { secretCipher: asyncCipher } }).create(VALID);

      // A pending promise reaching the column is the failure this guards.
      expect(repo.rows[0].clientSecret).toBe(`enc:${created.clientSecret}`);
    });

    it('should encrypt a rotated secret too', async () => {
      const repo = createRepo([buildClient()]);

      const rotated = await createService(repo, { ...OPTIONS, clients: { secretCipher: cipher } }).rotateSecret(
        'reporting',
      );

      expect(repo.rows[0].clientSecret).toBe(`enc:${rotated.clientSecret}`);
    });
  });

  describe('remove and restore', () => {
    it('should return what was removed', async () => {
      const repo = createRepo([buildClient()]);

      const removed = await createService(repo).remove('reporting');

      expect(removed).toMatchObject({ clientId: 'reporting', name: 'Reporting', hasSecret: true });
      expect(removed).not.toHaveProperty('clientSecret');
    });

    it('should reject removing an unknown client', async () => {
      await expect(createService(createRepo()).remove('missing')).rejects.toBeInstanceOf(OidcClientNotFoundError);
    });

    it('should bring a removed client back', async () => {
      const repo = createRepo([buildClient()]);
      const service = createService(repo);

      await service.remove('reporting');
      const restored = await service.restore('reporting');

      expect(restored.clientId).toBe('reporting');
      await expect(service.get('reporting')).resolves.toBeDefined();
    });

    it('should be a no-op for a client that is not removed', async () => {
      const repo = createRepo([buildClient()]);

      await expect(createService(repo).restore('reporting')).resolves.toMatchObject({ clientId: 'reporting' });
    });

    it('should reject restoring an id that was never registered', async () => {
      await expect(createService(createRepo()).restore('missing')).rejects.toBeInstanceOf(OidcClientNotFoundError);
    });
  });
});
