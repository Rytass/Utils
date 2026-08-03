import { Inject, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import {
  InconsistentOidcClientGrantsError,
  InvalidOidcRedirectUriError,
  OidcClientAlreadyExistsError,
  OidcClientIdRetiredError,
  OidcClientNotFoundError,
  PublicOidcClientNotAllowedError,
} from '../constants/errors/base.error';
import { OidcClientEntity, OidcClientRepo } from './models/oidc-client.entity';
import { DEFAULT_CLIENT_GRANT_TYPES, DEFAULT_CLIENT_RESPONSE_TYPES } from './oidc-adapter';
import { MEMBER_BASE_OIDC_OPTIONS } from './oidc.tokens';
import type { MemberBaseOidcProviderOptions, OidcClientValidationContext } from './oidc-provider.options';

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

/** The full state of a client, as `update` in its default 'replace' mode writes it. */
export type UpdateOidcClientInput = Omit<CreateOidcClientInput, 'clientId' | 'confidential'>;

/** Only the fields being changed, for `update` in 'merge' mode. */
export type PatchOidcClientInput = Partial<UpdateOidcClientInput>;

/**
 * 'replace' writes the whole record, so an omitted field is cleared — correct
 * for a PUT, and a silent way to lose `grantTypes` from an edit form that
 * forgot to submit it. 'merge' leaves omitted fields alone.
 */
export interface UpdateOidcClientOptions {
  mode?: 'replace' | 'merge';
}

export interface CreatedOidcClient extends OidcClientView {
  /** Readable exactly once, here. Null for a public client. */
  clientSecret: string | null;
}

export interface RotatedOidcClientSecret {
  clientId: string;
  clientSecret: string;
}

const CODE_RESPONSE_TYPE = 'code';
const AUTHORIZATION_CODE_GRANT = 'authorization_code';

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
    @Inject(MEMBER_BASE_OIDC_OPTIONS)
    private readonly options: MemberBaseOidcProviderOptions,
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

    if (!confidential && this.options.clients?.allowPublic === false) {
      throw new PublicOidcClientNotAllowedError();
    }

    await this.assertIdAvailable(clientId);
    await this.assertValid(input, { operation: 'create', clientId });

    const clientSecret = confidential ? randomBytes(32).toString('base64url') : null;

    const client = await this.clientRepo.save(
      this.clientRepo.create({
        clientId,
        clientSecret: clientSecret === null ? null : await this.encryptSecret(clientSecret),
        ...this.toColumns(input),
      }),
    );

    return { ...this.toView(client), clientSecret };
  }

  async update(
    clientId: string,
    input: UpdateOidcClientInput,
    options?: UpdateOidcClientOptions & { mode?: 'replace' },
  ): Promise<OidcClientView>;
  async update(
    clientId: string,
    input: PatchOidcClientInput,
    options: UpdateOidcClientOptions & { mode: 'merge' },
  ): Promise<OidcClientView>;
  async update(
    clientId: string,
    input: PatchOidcClientInput,
    options?: UpdateOidcClientOptions,
  ): Promise<OidcClientView> {
    const existing = await this.get(clientId);
    const resolved = options?.mode === 'merge' ? this.merge(existing, input) : (input as UpdateOidcClientInput);

    await this.assertValid(resolved, { operation: 'update', clientId, existing });

    // The secret is intentionally not updatable here; rotating it is a
    // separate, explicit operation rather than a side effect of an edit.
    await this.clientRepo.update({ clientId }, this.toColumns(resolved));

    return this.get(clientId);
  }

  async rotateSecret(clientId: string): Promise<RotatedOidcClientSecret> {
    await this.get(clientId);

    const clientSecret = randomBytes(32).toString('base64url');

    await this.clientRepo.update({ clientId }, { clientSecret: await this.encryptSecret(clientSecret) });

    return { clientId, clientSecret };
  }

  /** Returns what was removed, so a caller can report it without re-reading. */
  async remove(clientId: string): Promise<OidcClientView> {
    const client = await this.clientRepo.findOne({ where: { clientId } });

    if (!client) throw new OidcClientNotFoundError(clientId);

    await this.clientRepo.softRemove(client);

    return this.toView(client);
  }

  /**
   * Bring back a removed client, secret and all.
   *
   * The alternative to reusing a retired id: the row still holds the primary
   * key, so the id can never be registered again.
   */
  async restore(clientId: string): Promise<OidcClientView> {
    const client = await this.clientRepo.findOne({ where: { clientId }, withDeleted: true });

    if (!client) throw new OidcClientNotFoundError(clientId);

    if (!client.deletedAt) return this.toView(client);

    await this.clientRepo.recover(client);

    return this.get(clientId);
  }

  /**
   * `clientId` is the primary key, and `save` on an existing key updates
   * rather than inserts — registering a taken id would silently overwrite the
   * live client and replace its secret. A removed id is worse: the soft-delete
   * leaves the row in place, so the insert reaches the driver as a unique
   * violation nobody can read.
   */
  private async assertIdAvailable(clientId: string): Promise<void> {
    const existing = await this.clientRepo.findOne({ where: { clientId }, withDeleted: true });

    if (!existing) return;

    throw existing.deletedAt ? new OidcClientIdRetiredError(clientId) : new OidcClientAlreadyExistsError(clientId);
  }

  /**
   * The built-in rules are the ones whose absence corrupts data or produces an
   * `invalid_client` that the table gives no hint about. Anything beyond them
   * is the application's own policy, and goes in `clients.validate`.
   */
  private async assertValid(
    input: CreateOidcClientInput | UpdateOidcClientInput,
    context: OidcClientValidationContext,
  ): Promise<void> {
    this.assertRedirectUris(input.redirectUris ?? [], true);
    this.assertRedirectUris(input.postLogoutRedirectUris ?? [], false);
    this.assertGrantsConsistent(input);

    await this.options.clients?.validate?.(input, context);
  }

  /**
   * Both columns are `simple-array`, which joins on commas into a text column:
   * a URI containing one is split into two on the way back out, with nothing
   * reported. Fragments are separately forbidden for redirect_uri by OIDC Core
   * 3.1.2.1.
   */
  private assertRedirectUris(uris: readonly string[], forbidFragment: boolean): void {
    uris.forEach(uri => {
      if (uri.includes(',')) {
        throw new InvalidOidcRedirectUriError(uri, 'a comma would be stored as two separate uris');
      }

      if (forbidFragment && uri.includes('#')) {
        throw new InvalidOidcRedirectUriError(uri, 'OIDC Core 3.1.2.1 forbids a fragment component');
      }
    });
  }

  /**
   * Checked against the same defaults the adapter applies, so "left unset" is
   * judged the way the provider will actually see it. Only this pairing is
   * enforced; the rest of the metadata is oidc-provider's to validate.
   */
  private assertGrantsConsistent(input: CreateOidcClientInput | UpdateOidcClientInput): void {
    const responseTypes = input.responseTypes ?? DEFAULT_CLIENT_RESPONSE_TYPES;
    const grantTypes = input.grantTypes ?? DEFAULT_CLIENT_GRANT_TYPES;

    if (responseTypes.includes(CODE_RESPONSE_TYPE) && !grantTypes.includes(AUTHORIZATION_CODE_GRANT)) {
      throw new InconsistentOidcClientGrantsError(
        `response_types includes "${CODE_RESPONSE_TYPE}" but grant_types does not include ` +
          `"${AUTHORIZATION_CODE_GRANT}"; every request from this client would be rejected as invalid_client`,
      );
    }
  }

  private merge(existing: OidcClientView, input: PatchOidcClientInput): UpdateOidcClientInput {
    return {
      name: input.name ?? existing.name,
      redirectUris: input.redirectUris ?? existing.redirectUris,
      postLogoutRedirectUris: input.postLogoutRedirectUris ?? existing.postLogoutRedirectUris ?? undefined,
      grantTypes: input.grantTypes ?? existing.grantTypes ?? undefined,
      responseTypes: input.responseTypes ?? existing.responseTypes ?? undefined,
      scope: input.scope ?? existing.scope ?? undefined,
      skipConsent: input.skipConsent ?? existing.skipConsent,
      tokenEndpointAuthMethod: input.tokenEndpointAuthMethod ?? existing.tokenEndpointAuthMethod ?? undefined,
    };
  }

  private async encryptSecret(plain: string): Promise<string> {
    const cipher = this.options.clients?.secretCipher;

    return cipher ? cipher.encrypt(plain) : plain;
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
