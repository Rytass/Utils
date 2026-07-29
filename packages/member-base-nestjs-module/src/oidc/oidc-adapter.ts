import { IsNull, LessThan, Repository } from 'typeorm';
import { OidcPayloadEntity } from './models/oidc-payload.entity';
import { OidcClientEntity } from './models/oidc-client.entity';

export interface AdapterPayload extends Record<string, unknown> {
  grantId?: string;
  userCode?: string;
  uid?: string;
  consumed?: unknown;
}

/**
 * The subset of oidc-provider's Adapter contract we implement.
 * https://github.com/panva/node-oidc-provider/blob/main/docs/README.md#adapter
 */
export interface OidcAdapter {
  upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void>;
  find(id: string): Promise<AdapterPayload | undefined>;
  findByUserCode(userCode: string): Promise<AdapterPayload | undefined>;
  findByUid(uid: string): Promise<AdapterPayload | undefined>;
  consume(id: string): Promise<void>;
  destroy(id: string): Promise<void>;
  revokeByGrantId(grantId: string): Promise<void>;
}

export type OidcAdapterConstructor = new (model: string) => OidcAdapter;

const toClientMetadata = (client: OidcClientEntity): AdapterPayload => ({
  client_id: client.clientId,
  ...(client.clientSecret ? { client_secret: client.clientSecret } : {}),
  client_name: client.name,
  redirect_uris: client.redirectUris,
  ...(client.postLogoutRedirectUris ? { post_logout_redirect_uris: client.postLogoutRedirectUris } : {}),
  grant_types: client.grantTypes ?? ['authorization_code', 'refresh_token'],
  response_types: client.responseTypes ?? ['code'],
  ...(client.scope ? { scope: client.scope } : {}),
  token_endpoint_auth_method: client.tokenEndpointAuthMethod ?? (client.clientSecret ? 'client_secret_basic' : 'none'),
});

/**
 * Builds the Adapter class oidc-provider instantiates once per model.
 *
 * Clients are served from their own administered table; everything else is a
 * row in oidc_payloads keyed by (model, id).
 */
export const createOidcAdapterFactory = (
  payloadRepo: Repository<OidcPayloadEntity>,
  clientRepo: Repository<OidcClientEntity>,
): OidcAdapterConstructor =>
  class TypeOrmOidcAdapter implements OidcAdapter {
    constructor(private readonly model: string) {}

    async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
      await payloadRepo.save(
        payloadRepo.create({
          model: this.model,
          id,
          payload,
          grantId: typeof payload.grantId === 'string' ? payload.grantId : null,
          userCode: typeof payload.userCode === 'string' ? payload.userCode : null,
          uid: typeof payload.uid === 'string' ? payload.uid : null,
          expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
        }),
      );
    }

    async find(id: string): Promise<AdapterPayload | undefined> {
      if (this.model === 'Client') {
        const client = await clientRepo.findOne({ where: { clientId: id } });

        return client ? toClientMetadata(client) : undefined;
      }

      const record = await payloadRepo.findOne({ where: { model: this.model, id } });

      return this.materialize(record);
    }

    async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
      return this.materialize(await payloadRepo.findOne({ where: { model: this.model, userCode } }));
    }

    async findByUid(uid: string): Promise<AdapterPayload | undefined> {
      return this.materialize(await payloadRepo.findOne({ where: { model: this.model, uid } }));
    }

    async consume(id: string): Promise<void> {
      await payloadRepo.update({ model: this.model, id }, { consumedAt: new Date() });
    }

    async destroy(id: string): Promise<void> {
      await payloadRepo.delete({ model: this.model, id });
    }

    async revokeByGrantId(grantId: string): Promise<void> {
      await payloadRepo.delete({ grantId });
    }

    /**
     * An expired row must read as absent. Rows are not deleted on read: the
     * sweep is a separate concern so a read path never turns into a write.
     */
    private materialize(record: OidcPayloadEntity | null): AdapterPayload | undefined {
      if (!record) return undefined;

      if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) return undefined;

      return {
        ...record.payload,
        ...(record.consumedAt ? { consumed: Math.floor(record.consumedAt.getTime() / 1000) } : {}),
      };
    }
  };

/**
 * Delete artefacts that expired before `before`.
 *
 * oidc-provider never prunes: without this the table grows without bound. The
 * provider module schedules it, and it is exported so an application can drive
 * it from its own job runner instead.
 */
export const purgeExpiredOidcPayloads = async (
  payloadRepo: Repository<OidcPayloadEntity>,
  before: Date = new Date(),
): Promise<number> => {
  const { affected } = await payloadRepo.delete({ expiresAt: LessThan(before) });

  return affected ?? 0;
};

/** Rows with no expiry at all, surfaced for diagnostics. */
export const countNonExpiringOidcPayloads = (payloadRepo: Repository<OidcPayloadEntity>): Promise<number> =>
  payloadRepo.count({ where: { expiresAt: IsNull() } });
