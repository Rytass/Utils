import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { OidcClientNotFoundError } from '../constants/errors/base.error';
import { OidcClientEntity, OidcClientRepo } from './models/oidc-client.entity';

/** A client as it may be shown: everything except the stored secret. */
export interface OidcClientView extends Omit<OidcClientEntity, 'clientSecret'> {
  hasSecret: boolean;
}

export interface CreateOidcClientInput {
  /** Generated when omitted. Supply one only to keep an existing client id. */
  clientId?: string;
  name: string;
  redirectUris: string[];
  postLogoutRedirectUris?: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  scope?: string;
  skipConsent?: boolean;
  tokenEndpointAuthMethod?: string;
  /** Set false to register a public client that authenticates with PKCE only. */
  confidential?: boolean;
}

/**
 * update() replaces the record, so an omitted field is cleared rather than
 * left alone — the same semantics a PUT would have.
 */
export type UpdateOidcClientInput = Omit<CreateOidcClientInput, 'clientId' | 'confidential'>;

export interface CreatedOidcClient extends OidcClientView {
  /** Readable exactly once, here. Null for a public client. */
  clientSecret: string | null;
}

export interface RotatedOidcClientSecret {
  clientId: string;
  clientSecret: string;
}

/**
 * Administration of registered service providers.
 *
 * Deliberately a service and not a controller. Who may register a service
 * provider, over which transport, and under which route or GraphQL field is
 * the host application's decision — this package would otherwise force a REST
 * surface onto applications that expose nothing but GraphQL, and freeze the
 * permission resource name into a module its users cannot change.
 *
 * Wrap these methods in your own resolver or controller and guard them with
 * whatever your application already uses, e.g.
 * `@AllowActions([['OidcClient', 'write']])`.
 */
@Injectable()
export class OidcClientService {
  constructor(
    @Inject(OidcClientRepo)
    private readonly clientRepo: Repository<OidcClientEntity>,
  ) {}

  async list(): Promise<OidcClientView[]> {
    const clients = await this.clientRepo.find({ order: { createdAt: 'DESC' } });

    return clients.map(client => this.toView(client));
  }

  /** Null when no such client exists; use get() to raise instead. */
  async findOne(clientId: string): Promise<OidcClientView | null> {
    const client = await this.clientRepo.findOne({ where: { clientId } });

    return client ? this.toView(client) : null;
  }

  async get(clientId: string): Promise<OidcClientView> {
    const client = await this.findOne(clientId);

    if (!client) throw new OidcClientNotFoundError(clientId);

    return client;
  }

  /**
   * Register a client. The generated secret is returned exactly once — it is
   * stored for the token endpoint to compare against and never read back.
   */
  async create(input: CreateOidcClientInput): Promise<CreatedOidcClient> {
    const clientId = input.clientId ?? randomBytes(16).toString('hex');
    const confidential = input.confidential ?? true;
    const clientSecret = confidential ? randomBytes(32).toString('base64url') : null;

    const client = await this.clientRepo.save(
      this.clientRepo.create({
        clientId,
        clientSecret,
        ...this.toColumns(input),
      }),
    );

    return { ...this.toView(client), clientSecret };
  }

  async update(clientId: string, input: UpdateOidcClientInput): Promise<OidcClientView> {
    await this.get(clientId);

    // The secret is intentionally not updatable here; rotating it is a
    // separate, explicit operation rather than a side effect of an edit.
    await this.clientRepo.update({ clientId }, this.toColumns(input));

    return this.get(clientId);
  }

  async rotateSecret(clientId: string): Promise<RotatedOidcClientSecret> {
    await this.get(clientId);

    const clientSecret = randomBytes(32).toString('base64url');

    await this.clientRepo.update({ clientId }, { clientSecret });

    return { clientId, clientSecret };
  }

  async remove(clientId: string): Promise<void> {
    const client = await this.clientRepo.findOne({ where: { clientId } });

    if (!client) throw new OidcClientNotFoundError(clientId);

    await this.clientRepo.softRemove(client);
  }

  private toColumns(input: UpdateOidcClientInput): Partial<OidcClientEntity> {
    return {
      name: input.name,
      redirectUris: input.redirectUris,
      postLogoutRedirectUris: input.postLogoutRedirectUris ?? null,
      grantTypes: input.grantTypes ?? null,
      responseTypes: input.responseTypes ?? null,
      scope: input.scope ?? null,
      skipConsent: input.skipConsent ?? false,
      tokenEndpointAuthMethod: input.tokenEndpointAuthMethod ?? null,
    };
  }

  private toView(client: OidcClientEntity): OidcClientView {
    const { clientSecret, ...rest } = client;

    return { ...rest, hasSecret: Boolean(clientSecret) };
  }
}
