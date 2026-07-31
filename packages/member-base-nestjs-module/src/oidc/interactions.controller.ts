import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { IsPublic } from '../decorators/is-public.decorator';
import { OidcClientEntity, OidcClientRepo } from './models/oidc-client.entity';
import { AuthenticationGateway } from '../services/authentication-gateway.service';
import { MemberBaseService } from '../services/member-base.service';
import { PASSWORD_CHANNEL } from '../constants/password-channel';
import { OidcSsoBridge } from './sso-bridge.service';
import { MEMBER_BASE_OIDC_OPTIONS, OIDC_PROVIDER_INSTANCE, OIDC_ROUTE_PREFIX } from './oidc.tokens';
import type {
  MemberBaseOidcProviderOptions,
  OidcConsentRenderParams,
  OidcInteractionPageParams,
  OidcInteractionPageUrl,
} from './oidc-provider.options';
import type { OidcInteractionDetails, OidcProviderLike } from './oidc.factory';
import { renderDefaultLoginPage } from './default-login-page';
import { renderDefaultConsentPage } from './default-consent-page';

interface ResponseLike {
  set(field: string, value: string): unknown;
  send(body: string): unknown;
  json(body: unknown): unknown;
  redirect(status: number, url: string): unknown;
  status(code: number): ResponseLike;
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

interface LoginBody {
  account?: string;
  password?: string;
  channel?: string;
}

/** Narrows what a consent submission is willing to grant. Omitted means "all". */
export interface OidcConsentBody {
  scopes?: string[];
  claims?: string[];
  resourceScopes?: Record<string, string[]>;
}

export interface OidcAbortBody {
  errorDescription?: string;
}

/** Everything an application's own consent or login page needs to render itself. */
export interface OidcInteractionDetailsView {
  uid: string;
  prompt: { name: string; reasons: string[] };
  client: { clientId: string; name: string } | null;
  params: {
    clientId: string;
    scope: string | null;
    redirectUri: string | null;
    responseType: string | null;
    state: string | null;
    prompt: string | null;
    maxAge: number | null;
  };
  /** Credential sources the login form may use. Empty unless a login is pending. */
  channels: string[];
  /** What the client is still waiting to be granted. Null unless consent is pending. */
  consent: {
    missingScopes: string[];
    missingClaims: string[];
    missingResourceScopes: Record<string, string[]>;
  } | null;
  session: { accountId: string; account: string | null } | null;
}

/** Only used to parse a relative page URL; never reaches the response. */
const PLACEHOLDER_ORIGIN = 'http://interaction.invalid';

const asString = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

const asNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;

/**
 * Grant only what was both asked for and chosen.
 *
 * Intersecting rather than trusting the submission keeps a page from handing
 * out a scope the client never requested.
 */
const narrow = (requested: readonly string[], chosen?: readonly string[]): string[] =>
  chosen ? requested.filter(item => chosen.includes(item)) : [...requested];

/**
 * Where to send the browser for a page this module does not own.
 *
 * A string keeps whatever query it already carries and gains the three values
 * a page cannot work without; anything more involved is what the function form
 * is for.
 */
const resolvePageUrl = (configured: OidcInteractionPageUrl, params: OidcInteractionPageParams): string => {
  if (typeof configured === 'function') return configured(params);

  const isAbsolute = /^https?:\/\//i.test(configured);
  const url = new URL(configured, PLACEHOLDER_ORIGIN);

  url.searchParams.set('uid', params.uid);
  url.searchParams.set('prompt', params.promptName);
  url.searchParams.set('client_id', params.clientId);

  if (params.error) url.searchParams.set('error', params.error);

  // A relative URL must stay relative: the placeholder origin is a parsing
  // device, not somewhere a browser should ever be sent.
  return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
};

/**
 * The interactive part of the authorization flow.
 *
 * This package is a backend module, so the intended arrangement is that the
 * application hosts its own login and consent pages and this controller only
 * provides the API that resolves an interaction:
 *
 *   GET  interaction/:uid           redirects to the application's page
 *   GET  interaction/:uid/details   what that page needs in order to render
 *   POST interaction/:uid/login     verify credentials and resolve the prompt
 *   POST interaction/:uid/session   resolve it from an existing member session
 *   POST interaction/:uid/consent   record the grant
 *   POST interaction/:uid/abort     refuse
 *
 * Every route lives under `interaction/:uid` because oidc-provider scopes the
 * `_interaction` cookie to the path it redirected to, and that cookie — not the
 * uid in the path — is what identifies the interaction.
 *
 * The POST endpoints answer with `{ redirectTo }` so a page can drive the
 * redirect itself, and with a 303 when the request came from a browser form
 * (see wantsHtml). The built-in HTML pages rely on the latter.
 *
 * Every handler is marked @IsPublic() individually: CasbinGuard reads the
 * metadata off the handler, so a class-level decorator has no effect and the
 * global guard would otherwise block the login page of the very endpoint that
 * exists to authenticate people.
 */
@Controller()
export class OidcInteractionsController {
  private readonly logger = new Logger(OidcInteractionsController.name);

  /** The built-in pages are a development convenience; say so once each. */
  private readonly warnedBuiltInPages = new Set<string>();

  constructor(
    @Inject(OIDC_PROVIDER_INSTANCE)
    private readonly provider: OidcProviderLike,
    @Inject(MEMBER_BASE_OIDC_OPTIONS)
    private readonly options: MemberBaseOidcProviderOptions,
    @Inject(OIDC_ROUTE_PREFIX)
    private readonly routePrefix: string,
    @Inject(AuthenticationGateway)
    private readonly gateway: AuthenticationGateway,
    @Inject(OidcSsoBridge)
    private readonly ssoBridge: OidcSsoBridge,
    @Inject(MemberBaseService)
    private readonly memberBaseService: MemberBaseService,
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

      this.presentLogin(res as ResponseLike, details);

      return;
    }

    if (details.prompt.name === 'consent') {
      await this.presentConsent(req, res, details);

      return;
    }

    (res as ResponseLike).status(400).send(`Unsupported prompt: ${details.prompt.name}`);
  }

  @IsPublic()
  @Get('interaction/:uid/details')
  async describe(@Req() req: unknown, @Res() res: unknown): Promise<void> {
    const details = await this.provider.interactionDetails(req, res);
    const clientId = String(details.params.client_id ?? '');
    const client = clientId ? await this.clientRepo.findOne({ where: { clientId } }) : null;
    const accountId = details.session?.accountId;
    const member = accountId ? await this.memberBaseService.findById(accountId) : null;
    const promptDetails = details.prompt.details;

    // Deliberately assembled field by field rather than spread: the client row
    // carries a secret, and nothing here may ever leak it.
    const view: OidcInteractionDetailsView = {
      uid: details.uid,
      prompt: { name: details.prompt.name, reasons: details.prompt.reasons ?? [] },
      client: client ? { clientId: client.clientId, name: client.name } : null,
      params: {
        clientId,
        scope: asString(details.params.scope),
        redirectUri: asString(details.params.redirect_uri),
        responseType: asString(details.params.response_type),
        state: asString(details.params.state),
        prompt: asString(details.params.prompt),
        maxAge: asNumber(details.params.max_age),
      },
      channels: details.prompt.name === 'login' ? this.allowedChannels() : [],
      consent:
        details.prompt.name === 'consent'
          ? {
              missingScopes: promptDetails.missingOIDCScope ?? [],
              missingClaims: promptDetails.missingOIDCClaims ?? [],
              missingResourceScopes: promptDetails.missingResourceScopes ?? {},
            }
          : null,
      session: accountId ? { accountId, account: member?.account ?? null } : null,
    };

    (res as ResponseLike).json(view);
  }

  @IsPublic()
  @Post('interaction/:uid/login')
  async login(@Body() body: LoginBody, @Req() req: unknown, @Res() res: unknown): Promise<void> {
    const channels = this.allowedChannels();
    const channel = body.channel ?? channels[0] ?? PASSWORD_CHANNEL;

    if (!channels.includes(channel)) {
      throw new BadRequestException(`Channel "${channel}" is not permitted for interactive login`);
    }

    const details = await this.provider.interactionDetails(req, res);

    try {
      const { member } = await this.gateway.authenticate(
        channel,
        { account: body.account ?? '', password: body.password ?? '' },
        { ip: this.clientIp(req) },
      );

      this.ssoBridge.issueSession(res, member);

      await this.completeInteraction(
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
      this.rejectLogin(req, res as ResponseLike, details);
    }
  }

  /**
   * Resolve a login prompt from a session the application established itself.
   *
   * For applications whose login page runs its own flow — social sign-in, or a
   * GraphQL mutation — and only needs the interaction closed afterwards.
   */
  @IsPublic()
  @Post('interaction/:uid/session')
  async completeWithLocalSession(@Req() req: unknown, @Res() res: unknown): Promise<void> {
    if (!this.ssoBridge.acceptLocalSession) {
      throw new ForbiddenException('Local session bridging is disabled');
    }

    const details = await this.provider.interactionDetails(req, res);

    if (details.prompt.name !== 'login') {
      throw new BadRequestException(`Interaction is awaiting "${details.prompt.name}", not login`);
    }

    const claims = this.ssoBridge.readLocalSession(req);

    if (!claims) throw new UnauthorizedException('No member-base session on this request');

    // An authTime later than the interaction's own issue time proves the member
    // authenticated during this very flow, which is exactly what prompt=login
    // and max_age are asking for. Anything older is an inherited session and
    // has to satisfy the ordinary skip rules instead, so the relying party's
    // decision survives.
    const authenticatedForThisInteraction = claims.authTime !== undefined && claims.authTime >= details.iat;

    if (!authenticatedForThisInteraction && !(await this.ssoBridge.resolveSkippableLogin(req, details.params))) {
      throw new UnauthorizedException('reauthentication_required');
    }

    const member = await this.memberBaseService.findById(claims.id);

    if (!member || member.deletedAt) throw new UnauthorizedException('No member-base session on this request');

    await this.completeInteraction(req, res, { login: { accountId: member.id } }, { mergeWithLastSubmission: false });
  }

  @IsPublic()
  @Post('interaction/:uid/consent')
  async consent(@Body() body: OidcConsentBody, @Req() req: unknown, @Res() res: unknown): Promise<void> {
    const details = await this.provider.interactionDetails(req, res);

    if (details.prompt.name !== 'consent') {
      throw new BadRequestException(`Interaction is awaiting "${details.prompt.name}", not consent`);
    }

    const accountId = details.session?.accountId;

    if (!accountId) throw new BadRequestException('No active session for consent');

    const grantId = await this.buildGrant(details, accountId, String(details.params.client_id), {
      scopes: asStringArray(body?.scopes),
      claims: asStringArray(body?.claims),
      resourceScopes: this.sanitizeResourceScopes(body?.resourceScopes),
    });

    await this.completeInteraction(req, res, { consent: { grantId } }, { mergeWithLastSubmission: true });
  }

  /**
   * Refuse the interaction.
   *
   * Always `access_denied`: that is what a refusal is, and letting the page
   * choose the error would let it misreport to the relying party.
   */
  @IsPublic()
  @Post('interaction/:uid/abort')
  async abort(@Body() body: OidcAbortBody, @Req() req: unknown, @Res() res: unknown): Promise<void> {
    await this.completeInteraction(
      req,
      res,
      {
        error: 'access_denied',
        error_description:
          typeof body?.errorDescription === 'string' ? body.errorDescription : 'End-User aborted interaction',
      },
      { mergeWithLastSubmission: false },
    );
  }

  /**
   * Record the outcome and hand back where to go next.
   *
   * interactionResult rather than interactionFinished, because a caller that
   * asked for JSON needs the location as data — a 303 it cannot read is no use
   * to a page driving the flow with fetch.
   */
  private async completeInteraction(
    req: unknown,
    res: unknown,
    result: Record<string, unknown>,
    options: { mergeWithLastSubmission: boolean },
  ): Promise<void> {
    const redirectTo = await this.provider.interactionResult(req, res, result, options);

    if (this.wantsHtml(req)) {
      (res as ResponseLike).redirect(303, redirectTo);

      return;
    }

    // Explicitly 200: Nest defaults a POST to 201, which would claim a resource
    // was created at a Location this response does not carry.
    (res as ResponseLike).status(200).json({ redirectTo });
  }

  /**
   * Build the grant the consent prompt is waiting for.
   *
   * Mirrors what oidc-provider does for its own interactions: an existing grant
   * is extended rather than replaced, and all three kinds of outstanding
   * request are answered. Granting only the scope would leave the claims and
   * resource scopes missing, and the prompt would fire again on the retry —
   * a redirect loop rather than a failure.
   */
  private async buildGrant(
    details: OidcInteractionDetails,
    accountId: string,
    clientId: string,
    selection?: OidcConsentBody,
  ): Promise<string> {
    const existing = details.grantId ? await this.provider.Grant.find(details.grantId) : undefined;
    const grant = existing ?? new this.provider.Grant({ accountId, clientId });
    const { missingOIDCScope, missingOIDCClaims, missingResourceScopes } = details.prompt.details;

    const scopes = narrow(missingOIDCScope ?? [], selection?.scopes);
    const claims = narrow(missingOIDCClaims ?? [], selection?.claims);

    if (scopes.length) grant.addOIDCScope(scopes.join(' '));

    if (claims.length) grant.addOIDCClaims(claims);

    for (const [indicator, requested] of Object.entries(missingResourceScopes ?? {})) {
      const granted = narrow(requested, selection?.resourceScopes?.[indicator]);

      if (granted.length) grant.addResourceScope(indicator, granted.join(' '));
    }

    return grant.save();
  }

  private async presentConsent(req: unknown, res: unknown, details: OidcInteractionDetails): Promise<void> {
    const accountId = details.session?.accountId;

    if (!accountId) {
      (res as ResponseLike).status(400).send('No active session for consent');

      return;
    }

    const clientId = String(details.params.client_id);

    if (await this.shouldAutoConsent(clientId)) {
      const grantId = await this.buildGrant(details, accountId, clientId);

      await this.provider.interactionFinished(req, res, { consent: { grantId } }, { mergeWithLastSubmission: true });

      return;
    }

    const configured = this.options.interaction?.consentPageUrl;

    if (configured) {
      (res as ResponseLike).redirect(303, resolvePageUrl(configured, this.pageParams(details)));

      return;
    }

    const client = await this.clientRepo.findOne({ where: { clientId } });
    const base = this.interactionBase(details.uid);

    const renderParams: OidcConsentRenderParams = {
      uid: details.uid,
      clientId,
      clientName: client?.name ?? clientId,
      missingScopes: details.prompt.details.missingOIDCScope ?? [],
      missingClaims: details.prompt.details.missingOIDCClaims ?? [],
      missingResourceScopes: details.prompt.details.missingResourceScopes ?? {},
      submitUrl: `${base}/consent`,
      abortUrl: `${base}/abort`,
    };

    const custom = this.options.interaction?.renderConsent;

    if (!custom) this.warnBuiltInPage('consent', 'consentPageUrl', 'renderConsent');

    const html = custom?.(renderParams) ?? renderDefaultConsentPage(renderParams);

    (res as ResponseLike).set('content-type', 'text/html; charset=utf-8');
    (res as ResponseLike).send(html);
  }

  private presentLogin(res: ResponseLike, details: OidcInteractionDetails, error?: string): void {
    const configured = this.options.interaction?.loginPageUrl;

    if (configured) {
      res.redirect(303, resolvePageUrl(configured, this.pageParams(details, error)));

      return;
    }

    this.sendLoginHtml(res, details.uid, error);
  }

  private sendLoginHtml(res: ResponseLike, uid: string, error?: string): void {
    const params = {
      uid,
      channels: this.allowedChannels(),
      error,
      submitUrl: `${this.interactionBase(uid)}/login`,
    };

    const custom = this.options.interaction?.renderLogin;

    if (!custom) this.warnBuiltInPage('login', 'loginPageUrl', 'renderLogin');

    const html = custom?.(params) ?? renderDefaultLoginPage(params);

    res.set('content-type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /**
   * Send a failed login back where it came from.
   *
   * A browser gets the form again; anything else gets the failure as data,
   * since a redirect it cannot follow would read as success.
   */
  private rejectLogin(req: unknown, res: ResponseLike, details: OidcInteractionDetails): void {
    const message = 'Invalid account or password';

    if (!this.wantsHtml(req)) {
      res.status(401).json({ error: 'invalid_credentials', message });

      return;
    }

    this.presentLogin(res, details, message);
  }

  private pageParams(details: OidcInteractionDetails, error?: string): OidcInteractionPageParams {
    return {
      uid: details.uid,
      promptName: details.prompt.name,
      promptReasons: details.prompt.reasons ?? [],
      clientId: String(details.params.client_id ?? ''),
      params: details.params,
      ...(error ? { error } : {}),
    };
  }

  private interactionBase(uid: string): string {
    return `/${this.routePrefix}/interaction/${encodeURIComponent(uid)}`;
  }

  /**
   * `*\/*` — what fetch and axios send — deliberately does not count as a
   * request for HTML: an API client wants the location as data.
   */
  private wantsHtml(req: unknown): boolean {
    const accept = (req as RequestLike).headers?.accept;
    const header = Array.isArray(accept) ? accept[0] : accept;

    return typeof header === 'string' && header.includes('text/html');
  }

  private warnBuiltInPage(kind: string, urlOption: string, renderOption: string): void {
    if (this.warnedBuiltInPages.has(kind)) return;

    this.warnedBuiltInPages.add(kind);

    this.logger.warn(
      `Served the built-in ${kind} page because neither interaction.${urlOption} nor interaction.${renderOption} ` +
        'is configured. It is a development placeholder with no branding and no translations; point ' +
        `interaction.${urlOption} at your own page before running this anywhere but development.`,
    );
  }

  private sanitizeResourceScopes(value: unknown): Record<string, string[]> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string[]>>(
      (accumulator, [indicator, scopes]) => {
        const parsed = asStringArray(scopes);

        return parsed ? { ...accumulator, [indicator]: parsed } : accumulator;
      },
      {},
    );
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

  private allowedChannels(): string[] {
    const configured = this.options.interaction?.allowedChannels;

    if (configured?.length) return configured;

    return this.gateway
      .listProviders()
      .filter(provider => provider.kind === 'credential')
      .map(provider => provider.channel);
  }

  private clientIp(req: unknown): string | undefined {
    const request = req as RequestLike;

    return request.ip ?? request.socket?.remoteAddress;
  }
}
