import { BadRequestException, Body, Controller, Get, Inject, Logger, Param, Post, Req, Res } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IsPublic } from '../decorators/is-public.decorator';
import { OidcClientEntity, OidcClientRepo } from './models/oidc-client.entity';
import { AuthenticationGateway } from '../services/authentication-gateway.service';
import { PASSWORD_CHANNEL } from '../constants/password-channel';
import { OidcSsoBridge } from './sso-bridge.service';
import { MEMBER_BASE_OIDC_OPTIONS, OIDC_PROVIDER_INSTANCE } from './oidc.tokens';
import type { MemberBaseOidcProviderOptions } from './oidc-provider.options';
import type { OidcProviderLike } from './oidc.factory';
import { renderDefaultLoginPage } from './default-login-page';

interface ResponseLike {
  set(field: string, value: string): unknown;
  send(body: string): unknown;
  status(code: number): ResponseLike;
}

interface LoginBody {
  account?: string;
  password?: string;
  channel?: string;
}

/**
 * The interactive part of the authorization flow.
 *
 * Every handler is marked @IsPublic() individually: CasbinGuard reads the
 * metadata off the handler, so a class-level decorator has no effect and the
 * global guard would otherwise block the login page of the very endpoint that
 * exists to authenticate people.
 */
@Controller()
export class OidcInteractionsController {
  private readonly logger = new Logger(OidcInteractionsController.name);

  constructor(
    @Inject(OIDC_PROVIDER_INSTANCE)
    private readonly provider: OidcProviderLike,
    @Inject(MEMBER_BASE_OIDC_OPTIONS)
    private readonly options: MemberBaseOidcProviderOptions,
    @Inject(AuthenticationGateway)
    private readonly gateway: AuthenticationGateway,
    @Inject(OidcSsoBridge)
    private readonly ssoBridge: OidcSsoBridge,
    @Inject(OidcClientRepo)
    private readonly clientRepo: Repository<OidcClientEntity>,
  ) {}

  @IsPublic()
  @Get('interaction/:uid')
  async show(@Req() req: unknown, @Res() res: unknown): Promise<void> {
    const details = await this.provider.interactionDetails(req, res);

    if (details.prompt.name === 'login') {
      // An existing member-base session can stand in for the login page, but
      // only when the client did not demand otherwise.
      const existing = await this.ssoBridge.resolveSkippableLogin(req, details.params);

      if (existing) {
        await this.provider.interactionFinished(
          req,
          res,
          { login: { accountId: existing.member.id } },
          { mergeWithLastSubmission: false },
        );

        return;
      }

      this.renderLogin(res, details.uid);

      return;
    }

    if (details.prompt.name === 'consent') {
      await this.grantConsent(req, res, details);

      return;
    }

    (res as ResponseLike).status(400).send(`Unsupported prompt: ${details.prompt.name}`);
  }

  @IsPublic()
  @Post('interaction/:uid/login')
  async login(
    @Param('uid') uid: string,
    @Body() body: LoginBody,
    @Req() req: unknown,
    @Res() res: unknown,
  ): Promise<void> {
    const channel = body.channel ?? this.allowedChannels()[0] ?? PASSWORD_CHANNEL;

    if (!this.allowedChannels().includes(channel)) {
      throw new BadRequestException(`Channel "${channel}" is not permitted for interactive login`);
    }

    try {
      const { member } = await this.gateway.authenticate(
        channel,
        { account: body.account ?? '', password: body.password ?? '' },
        { ip: this.clientIp(req) },
      );

      this.ssoBridge.issueSession(res, member);

      await this.provider.interactionFinished(
        req,
        res,
        // The local member id is the subject, not the external identifier: it
        // stays stable when a directory account is renamed or re-created.
        { login: { accountId: member.id } },
        { mergeWithLastSubmission: false },
      );
    } catch (error) {
      this.logger.warn(`Interactive login failed for "${body.account}" on ${channel}: ${(error as Error).message}`);

      // Deliberately generic: distinguishing "no such account" from "wrong
      // password" here would turn the login form into an account oracle.
      this.renderLogin(res, uid, 'Invalid account or password');
    }
  }

  private async grantConsent(
    req: unknown,
    res: unknown,
    details: { params: Record<string, unknown>; session?: { accountId?: string }; grantId?: string },
  ): Promise<void> {
    const accountId = details.session?.accountId;

    if (!accountId) {
      (res as ResponseLike).status(400).send('No active session for consent');

      return;
    }

    const clientId = String(details.params.client_id);

    if (!(await this.shouldAutoConsent(clientId))) {
      (res as ResponseLike).status(400).send('Consent is required for this client but no consent screen is configured');

      return;
    }

    const grant = new this.provider.Grant({ accountId, clientId });

    grant.addOIDCScope(String(details.params.scope ?? 'openid'));

    const grantId = await grant.save();

    await this.provider.interactionFinished(req, res, { consent: { grantId } }, { mergeWithLastSubmission: true });
  }

  private async shouldAutoConsent(clientId: string): Promise<boolean> {
    const configured = this.options.interaction?.autoConsent;

    if (typeof configured === 'function') return configured(clientId);

    if (typeof configured === 'boolean') return configured;

    // Falls back to the client's own registration flag, so a third-party
    // client never has consent granted on its behalf by default.
    return this.clientSkipsConsent(clientId);
  }

  private async clientSkipsConsent(clientId: string): Promise<boolean> {
    const client = await this.clientRepo.findOne({ where: { clientId } });

    return client?.skipConsent === true;
  }

  private renderLogin(res: unknown, uid: string, error?: string): void {
    const channels = this.allowedChannels();
    const html =
      this.options.interaction?.renderLogin?.({ uid, channels, error }) ??
      renderDefaultLoginPage({ uid, channels, error });

    (res as ResponseLike).set('content-type', 'text/html; charset=utf-8');
    (res as ResponseLike).send(html);
  }

  private allowedChannels(): string[] {
    const configured = this.options.interaction?.allowedChannels;

    if (configured?.length) return configured;

    return this.gateway
      .listProviders()
      .filter(provider => provider.kind === 'credential')
      .map(provider => provider.channel);
  }

  private clientIp(req: unknown): string | undefined {
    const request = req as { ip?: string; socket?: { remoteAddress?: string } };

    return request.ip ?? request.socket?.remoteAddress;
  }
}
