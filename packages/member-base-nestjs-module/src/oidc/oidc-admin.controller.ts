import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { AllowActions } from '../decorators/action.decorator';
import { OidcClientEntity, OidcClientRepo } from './models/oidc-client.entity';

export interface UpsertOidcClientBody {
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

export interface OidcClientView extends Omit<OidcClientEntity, 'clientSecret'> {
  hasSecret: boolean;
}

/**
 * Administration of registered service providers.
 *
 * Unlike the protocol endpoints these are NOT public: they run through the
 * application's own Casbin policy via @AllowActions, so whoever may manage
 * clients is decided by the same rules that govern every other resource.
 *
 * Each handler carries its own decorator because CasbinGuard reads metadata
 * from the handler rather than the class.
 */
@Controller('oidc-clients')
export class OidcAdminController {
  constructor(
    @Inject(OidcClientRepo)
    private readonly clientRepo: Repository<OidcClientEntity>,
  ) {}

  @AllowActions([['OidcClient', 'read']])
  @Get()
  async list(): Promise<OidcClientView[]> {
    const clients = await this.clientRepo.find({ order: { createdAt: 'DESC' } });

    return clients.map(client => this.toView(client));
  }

  @AllowActions([['OidcClient', 'read']])
  @Get(':clientId')
  async get(@Param('clientId') clientId: string): Promise<OidcClientView> {
    const client = await this.clientRepo.findOne({ where: { clientId } });

    if (!client) throw new NotFoundException('Client not found');

    return this.toView(client);
  }

  /**
   * Register a client. The generated secret is returned exactly once — it is
   * stored for the token endpoint to compare against and never read back.
   */
  @AllowActions([['OidcClient', 'write']])
  @Post()
  async create(@Body() body: UpsertOidcClientBody): Promise<OidcClientView & { clientSecret?: string }> {
    const clientId = body.clientId ?? randomBytes(16).toString('hex');
    const confidential = body.confidential ?? true;
    const clientSecret = confidential ? randomBytes(32).toString('base64url') : null;

    const client = await this.clientRepo.save(
      this.clientRepo.create({
        clientId,
        clientSecret,
        name: body.name,
        redirectUris: body.redirectUris,
        postLogoutRedirectUris: body.postLogoutRedirectUris ?? null,
        grantTypes: body.grantTypes ?? null,
        responseTypes: body.responseTypes ?? null,
        scope: body.scope ?? null,
        skipConsent: body.skipConsent ?? false,
        tokenEndpointAuthMethod: body.tokenEndpointAuthMethod ?? null,
      }),
    );

    return { ...this.toView(client), ...(clientSecret ? { clientSecret } : {}) };
  }

  @AllowActions([['OidcClient', 'write']])
  @Put(':clientId')
  async update(@Param('clientId') clientId: string, @Body() body: UpsertOidcClientBody): Promise<OidcClientView> {
    const client = await this.clientRepo.findOne({ where: { clientId } });

    if (!client) throw new NotFoundException('Client not found');

    // The secret is intentionally not updatable here; rotating it is a
    // separate, explicit operation rather than a side effect of an edit.
    await this.clientRepo.update(
      { clientId },
      {
        name: body.name,
        redirectUris: body.redirectUris,
        postLogoutRedirectUris: body.postLogoutRedirectUris ?? null,
        grantTypes: body.grantTypes ?? null,
        responseTypes: body.responseTypes ?? null,
        scope: body.scope ?? null,
        skipConsent: body.skipConsent ?? false,
        tokenEndpointAuthMethod: body.tokenEndpointAuthMethod ?? null,
      },
    );

    return this.get(clientId);
  }

  @AllowActions([['OidcClient', 'write']])
  @Post(':clientId/rotate-secret')
  async rotateSecret(@Param('clientId') clientId: string): Promise<{ clientId: string; clientSecret: string }> {
    const client = await this.clientRepo.findOne({ where: { clientId } });

    if (!client) throw new NotFoundException('Client not found');

    const clientSecret = randomBytes(32).toString('base64url');

    await this.clientRepo.update({ clientId }, { clientSecret });

    return { clientId, clientSecret };
  }

  @AllowActions([['OidcClient', 'write']])
  @Delete(':clientId')
  async remove(@Param('clientId') clientId: string): Promise<{ clientId: string }> {
    const client = await this.clientRepo.findOne({ where: { clientId } });

    if (!client) throw new NotFoundException('Client not found');

    await this.clientRepo.softRemove(client);

    return { clientId };
  }

  private toView(client: OidcClientEntity): OidcClientView {
    const { clientSecret, ...rest } = client;

    return { ...rest, hasSecret: Boolean(clientSecret) };
  }
}
