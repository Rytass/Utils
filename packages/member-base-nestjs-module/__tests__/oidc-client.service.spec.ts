import { Repository } from 'typeorm';
import { OidcClientService } from '../src/oidc/oidc-client.service';
import { OidcClientEntity } from '../src/oidc/models/oidc-client.entity';
import { OidcClientNotFoundError } from '../src/constants/errors/base.error';

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

interface FakeRepo {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  softRemove: jest.Mock;
}

const createRepo = (client: OidcClientEntity | null = buildClient()): FakeRepo => ({
  find: jest.fn(async () => (client ? [client] : [])),
  findOne: jest.fn(async () => client),
  create: jest.fn((input: Partial<OidcClientEntity>) => input as OidcClientEntity),
  save: jest.fn(async (input: Partial<OidcClientEntity>) => buildClient(input)),
  update: jest.fn(async () => ({ affected: 1 })),
  softRemove: jest.fn(async () => undefined),
});

const createService = (repo: FakeRepo): OidcClientService =>
  new OidcClientService(repo as unknown as Repository<OidcClientEntity>);

describe('OidcClientService', () => {
  describe('reading', () => {
    it('should never expose the stored secret', async () => {
      const service = createService(createRepo());

      const [view] = await service.list();

      expect(view).not.toHaveProperty('clientSecret');
      expect(view.hasSecret).toBe(true);
    });

    it('should report a public client as having no secret', async () => {
      const service = createService(createRepo(buildClient({ clientSecret: null })));

      const view = await service.get('reporting');

      expect(view.hasSecret).toBe(false);
    });

    it('should list the newest client first', async () => {
      const repo = createRepo();
      const service = createService(repo);

      await service.list();

      expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    });

    it('should return null from findOne when the client is unknown', async () => {
      const service = createService(createRepo(null));

      await expect(service.findOne('missing')).resolves.toBeNull();
    });

    it('should throw from get when the client is unknown', async () => {
      const service = createService(createRepo(null));

      await expect(service.get('missing')).rejects.toBeInstanceOf(OidcClientNotFoundError);
    });
  });

  describe('create', () => {
    it('should return the generated secret exactly once', async () => {
      const repo = createRepo();
      const service = createService(repo);

      const created = await service.create({ name: 'Reporting', redirectUris: ['https://a.example.com/cb'] });

      expect(created.clientSecret).toEqual(expect.any(String));
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: created.clientSecret }));
      expect(created.hasSecret).toBe(true);
    });

    it('should generate a client id when none is supplied', async () => {
      const repo = createRepo();
      const service = createService(repo);

      await service.create({ name: 'Reporting', redirectUris: ['https://a.example.com/cb'] });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ clientId: expect.any(String) }));
      expect(repo.create.mock.calls[0][0].clientId).not.toBe('');
    });

    it('should keep a supplied client id', async () => {
      const repo = createRepo();
      const service = createService(repo);

      await service.create({ clientId: 'reporting', name: 'Reporting', redirectUris: ['https://a.example.com/cb'] });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'reporting' }));
    });

    it('should issue no secret for a public client', async () => {
      const repo = createRepo();
      const service = createService(repo);

      const created = await service.create({
        name: 'Mobile',
        redirectUris: ['app://cb'],
        confidential: false,
      });

      expect(created.clientSecret).toBeNull();
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ clientSecret: null }));
    });

    it('should default skipConsent to false', async () => {
      const repo = createRepo();
      const service = createService(repo);

      await service.create({ name: 'Reporting', redirectUris: ['https://a.example.com/cb'] });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ skipConsent: false }));
    });
  });

  describe('update', () => {
    it('should reject an unknown client before writing', async () => {
      const repo = createRepo(null);
      const service = createService(repo);

      await expect(service.update('missing', { name: 'x', redirectUris: [] })).rejects.toBeInstanceOf(
        OidcClientNotFoundError,
      );

      expect(repo.update).not.toHaveBeenCalled();
    });

    it('should clear the fields the caller omitted', async () => {
      const repo = createRepo(buildClient({ scope: 'openid email', grantTypes: ['authorization_code'] }));
      const service = createService(repo);

      await service.update('reporting', { name: 'Reporting', redirectUris: ['https://a.example.com/cb'] });

      expect(repo.update).toHaveBeenCalledWith(
        { clientId: 'reporting' },
        expect.objectContaining({ scope: null, grantTypes: null }),
      );
    });

    it('should never touch the secret', async () => {
      const repo = createRepo();
      const service = createService(repo);

      await service.update('reporting', { name: 'Reporting', redirectUris: ['https://a.example.com/cb'] });

      expect(repo.update.mock.calls[0][1]).not.toHaveProperty('clientSecret');
    });
  });

  describe('rotateSecret', () => {
    it('should persist and return a fresh secret', async () => {
      const repo = createRepo();
      const service = createService(repo);

      const rotated = await service.rotateSecret('reporting');

      expect(rotated.clientSecret).toEqual(expect.any(String));
      expect(rotated.clientSecret).not.toBe('stored-secret');
      expect(repo.update).toHaveBeenCalledWith({ clientId: 'reporting' }, { clientSecret: rotated.clientSecret });
    });

    it('should reject an unknown client before writing', async () => {
      const repo = createRepo(null);
      const service = createService(repo);

      await expect(service.rotateSecret('missing')).rejects.toBeInstanceOf(OidcClientNotFoundError);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft remove the client', async () => {
      const client = buildClient();
      const repo = createRepo(client);
      const service = createService(repo);

      await service.remove('reporting');

      expect(repo.softRemove).toHaveBeenCalledWith(client);
    });

    it('should reject an unknown client', async () => {
      const repo = createRepo(null);
      const service = createService(repo);

      await expect(service.remove('missing')).rejects.toBeInstanceOf(OidcClientNotFoundError);
      expect(repo.softRemove).not.toHaveBeenCalled();
    });
  });
});
