import { randomBytes } from 'node:crypto';
import {
  Controller,
  Get,
  Inject,
  Logger,
  OnApplicationBootstrap,
  Param,
  Query,
  Req,
  Res,
  type Type,
} from '@nestjs/common';
import { IsPublic } from '../decorators/is-public.decorator';
import { AuthenticationGateway } from '../services/authentication-gateway.service';
import { MemberBaseService } from '../services/member-base.service';
import { COOKIE_MODE, REDIRECT_AUTH_OPTIONS } from '../typings/member-base.tokens';
import { DEFAULT_REDIRECT_AUTH_ROUTE_PREFIX } from '../typings/redirect-auth.options';
import {
  AuthProviderMisconfiguredError,
  RedirectAuthDeniedError,
  RedirectAuthTransactionError,
} from '../constants/errors/base.error';
import { resolveCookieOptions } from '../utils/resolve-cookie-options';
import { resolveReturnTo } from '../utils/resolve-return-to';
import type { Request, Response } from 'express';
import type { AuthorizationRequest } from '../typings/authentication-provider.interface';
import type { ResolvedRedirectAuthOptions } from '../typings/redirect-auth.options';
import type { TokenPairDto } from '../dto/token-pair.dto';

/** What the start route stores and the callback route hands back. */
interface RedirectAuthTransaction {
  channel: string;
  state: string;
  codeVerifier?: string;
  nonce?: string;
  /** Already checked against the allowlist, so the callback trusts it. */
  returnTo: string;
}

const base64url = (input: Buffer): string => input.toString('base64url');

/**
 * Read one cookie without assuming `cookie-parser` is installed.
 *
 * The rest of the package reads `req.cookies` and treats its absence as "no
 * cookie", which is fine for a token that also arrives in a header. This one
 * has no second source: without it every login fails, and failing because a
 * middleware is missing is worth not doing silently.
 */
const readCookie = (req: Request, name: string): string | undefined => {
  const parsed = (req as { cookies?: Record<string, string> }).cookies?.[name];

  if (typeof parsed === 'string') return parsed;

  const header = req.headers?.cookie;

  if (typeof header !== 'string') return undefined;

  const match = header
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));

  if (!match) return undefined;

  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    // decodeURIComponent throws URIError on a malformed escape, and the header
    // is entirely attacker-controlled — `Cookie: oidc_tx=%` would otherwise
    // escape the handler as an unauthenticated 500 instead of the 400 that a
    // bad transaction is supposed to produce.
    return undefined;
  }
};

/**
 * `*\/*` — what fetch and axios send — deliberately does not count as a request
 * for HTML, matching the OIDC interaction routes: an API client wants the
 * location as data.
 */
const wantsHtml = (req: Request): boolean => {
  const accept = req.headers?.accept;
  const header = Array.isArray(accept) ? accept[0] : accept;

  return typeof header === 'string' && header.includes('text/html');
};

/**
 * Placeholder origin for parsing a same-origin destination. Never emitted.
 */
const RELATIVE_BASE = 'https://return-to.invalid';

/**
 * Append the pair to a destination's **query string**.
 *
 * Naive concatenation is wrong whenever the destination carries a fragment:
 * `/dash#section` + `?accessToken=…` yields `/dash#section?accessToken=…`,
 * where the tokens are inside the fragment, never leave the browser, and the
 * login silently completes with the destination receiving nothing. Parsing puts
 * them in the query and keeps the fragment where it was.
 */
const withTokenParams = (destination: string, tokenPair: TokenPairDto): string => {
  const isRelative = destination.startsWith('/');

  let url: URL;

  try {
    url = new URL(destination, isRelative ? RELATIVE_BASE : undefined);
  } catch {
    // Unparseable destinations cannot occur — resolveReturnTo emits only
    // re-serialised urls — but falling back to the raw string keeps a
    // misconfigured successRedirect working rather than failing the login.
    const separator = destination.includes('?') ? '&' : '?';

    return `${destination}${separator}accessToken=${encodeURIComponent(tokenPair.accessToken)}&refreshToken=${encodeURIComponent(tokenPair.refreshToken)}`;
  }

  url.searchParams.set('accessToken', tokenPair.accessToken);
  url.searchParams.set('refreshToken', tokenPair.refreshToken);

  return isRelative ? `${url.pathname}${url.search}${url.hash}` : url.href;
};

/**
 * The browser half of a `kind: 'redirect'` provider, as two mounted routes.
 *
 * `OidcAuthProvider` and `EntraAuthProvider` are stateless by design: they hand
 * the caller a state, a PKCE verifier and a nonce and expect them back on the
 * callback. That is the right split — it is what lets an application run more
 * than one instance — but it left every application to write the same cookie
 * and the same callback route, and to get the same three things wrong: an
 * unvalidated `state`, a `returnTo` that is an open redirect, and cookies whose
 * attributes drift from the ones the rest of the module writes.
 *
 * Nothing here is registered unless `redirectAuth` is configured.
 */
/**
 * Path segments the legacy `OAuthCallbacksController` already owns under
 * `/auth`. A channel with one of these names is unreachable through the
 * redirect routes, because both controllers register three-segment paths and
 * the legacy one is registered first.
 */
const SHADOWED_CHANNEL_NAMES = new Set(['login', 'callbacks']);

@Controller()
export class RedirectAuthController implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedirectAuthController.name);

  /** The sameSite downgrade is a per-process fact; say it once. */
  private warnedAboutSameSite = false;

  constructor(
    @Inject(REDIRECT_AUTH_OPTIONS)
    private readonly options: ResolvedRedirectAuthOptions,
    @Inject(AuthenticationGateway)
    private readonly gateway: AuthenticationGateway,
    @Inject(MemberBaseService)
    private readonly memberBaseService: MemberBaseService,
    @Inject(COOKIE_MODE)
    private readonly cookieMode: boolean,
  ) {}

  /**
   * Warn about a channel the legacy OAuth2 routes would shadow.
   *
   * Only under the default prefix, where the two controllers share `/auth`.
   * The failure is otherwise silent and confusing — the request reaches the
   * OAuth2 handler with a nonsense channel rather than 404ing — and it cannot
   * be detected before the providers are registered, which is why this runs on
   * bootstrap rather than at module definition.
   */
  onApplicationBootstrap(): void {
    if (this.options.routePrefix !== DEFAULT_REDIRECT_AUTH_ROUTE_PREFIX) return;

    const shadowed = this.gateway
      .listProviders()
      .filter(provider => provider.kind === 'redirect' && SHADOWED_CHANNEL_NAMES.has(provider.channel))
      .map(provider => provider.channel);

    if (!shadowed.length) return;

    this.logger.warn(
      `Redirect channel(s) ${shadowed.join(', ')} are unreachable: OAuthCallbacksController already serves ` +
        `/${this.options.routePrefix}/login/:channel and /${this.options.routePrefix}/callbacks/:channel, and it is ` +
        'registered first. Rename the channel, or set redirectAuth.routePrefix to something other than ' +
        `"${DEFAULT_REDIRECT_AUTH_ROUTE_PREFIX}".`,
    );
  }

  /**
   * Begin an authorization request and remember what the callback will need.
   */
  @IsPublic()
  @Get(':channel/start')
  async start(
    @Param('channel') channel: string,
    @Query('returnTo') returnTo: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const provider = this.gateway.getProvider(channel);

    if (provider.kind !== 'redirect') {
      throw new AuthProviderMisconfiguredError(`Provider "${channel}" is not a redirect provider`);
    }

    const context = { ip: req.ip };

    const request: AuthorizationRequest = provider.createAuthorizationRequest
      ? await provider.createAuthorizationRequest(context)
      : await this.legacyAuthorizationRequest(channel, context);

    this.writeTransaction(req, res, {
      channel,
      state: request.state,
      codeVerifier: request.codeVerifier,
      nonce: request.nonce,
      // Checked here rather than on the callback: an unlisted destination is a
      // configuration mistake, and finding it at the start of the flow beats
      // finding it after the user has authenticated.
      returnTo: resolveReturnTo(returnTo, this.options.allowedReturnTo, this.options.successRedirect),
    });

    if (wantsHtml(req)) {
      res.redirect(request.url);

      return;
    }

    res.status(200).json({ redirectTo: request.url });
  }

  /**
   * Complete the callback: match the state, resolve the member, issue tokens.
   */
  @IsPublic()
  @Get(':channel/callback')
  async callback(
    @Param('channel') channel: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Cleared before the cookie is even read, so the comment is true of every
    // path rather than only the ones that get past parsing: clearing depends on
    // the configured name and attributes, never on the content.
    this.clearTransaction(req, res);

    const transaction = this.readTransaction(req);

    if (transaction.channel !== channel) {
      // A callback delivered to a channel other than the one that started it is
      // either a misrouted redirect uri or a deliberate cross-channel replay.
      throw new RedirectAuthTransactionError('Callback channel does not match the authorization request');
    }

    if (!state || state !== transaction.state) {
      throw new RedirectAuthTransactionError();
    }

    // Checked only after the state matches, which is what makes `oauthError`
    // worth branching on. It is exposed so a host can tell `access_denied` from
    // `login_required`; reading it before the state check would let it carry
    // arbitrary text from anyone holding some readable transaction cookie, with
    // no evidence the callback belongs to an authorization request this
    // application issued.
    //
    // The legitimate denial path is unaffected: RFC 6749 §4.1.2.1 requires the
    // authorization server to echo `state` on the error response whenever the
    // request carried one. An issuer that does not surfaces as a transaction
    // error rather than a denial — a worse diagnostic, but only for an issuer
    // already out of spec.
    if (error) {
      throw new RedirectAuthDeniedError(error, errorDescription);
    }

    if (!code) {
      throw new RedirectAuthTransactionError('Callback carried no authorization code');
    }

    const { member } = await this.gateway.handleCallback(
      channel,
      {
        code,
        ...(transaction.codeVerifier ? { codeVerifier: transaction.codeVerifier } : {}),
        ...(transaction.nonce ? { nonce: transaction.nonce } : {}),
      },
      { ip: req.ip },
    );

    const tokenPair: TokenPairDto = {
      accessToken: this.memberBaseService.signAccessToken(member),
      refreshToken: this.memberBaseService.signRefreshToken(member),
    };

    // Follows the module-wide cookieMode switch rather than inventing a third
    // convention: with it off the guard would never read a cookie this route
    // wrote, so the tokens travel on the destination url exactly as they do
    // from OAuthCallbacksController.
    if (this.cookieMode) {
      this.setTokenCookies(req, res, tokenPair);
    }

    const redirectTo = this.cookieMode ? transaction.returnTo : withTokenParams(transaction.returnTo, tokenPair);

    if (wantsHtml(req)) {
      res.redirect(redirectTo);

      return;
    }

    res.status(200).json({ redirectTo });
  }

  /** A provider that predates createAuthorizationRequest still works. */
  private async legacyAuthorizationRequest(channel: string, context: { ip?: string }): Promise<AuthorizationRequest> {
    const state = base64url(randomBytes(16));

    return { url: await this.gateway.getAuthorizationUrl(channel, state, context), state };
  }

  private writeTransaction(req: Request, res: Response, transaction: RedirectAuthTransaction): void {
    res.cookie(this.options.txCookieName, JSON.stringify(transaction), {
      ...this.transactionCookieOptions(req),
      maxAge: this.options.txCookieMaxAge * 1000,
    });
  }

  private readTransaction(req: Request): RedirectAuthTransaction {
    const raw = readCookie(req, this.options.txCookieName);

    if (!raw) {
      throw new RedirectAuthTransactionError('No authorization transaction cookie was presented');
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new RedirectAuthTransactionError('Authorization transaction cookie is not readable');
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new RedirectAuthTransactionError('Authorization transaction cookie is not readable');
    }

    const candidate = parsed as Partial<RedirectAuthTransaction>;

    if (typeof candidate.channel !== 'string' || typeof candidate.state !== 'string') {
      throw new RedirectAuthTransactionError('Authorization transaction cookie is incomplete');
    }

    return {
      channel: candidate.channel,
      state: candidate.state,
      codeVerifier: typeof candidate.codeVerifier === 'string' ? candidate.codeVerifier : undefined,
      nonce: typeof candidate.nonce === 'string' ? candidate.nonce : undefined,
      // Re-checked on the way out. The cookie is httpOnly but it is still data
      // that left this process, and trusting it would reopen the redirect the
      // start route closed.
      returnTo: resolveReturnTo(
        typeof candidate.returnTo === 'string' ? candidate.returnTo : undefined,
        this.options.allowedReturnTo,
        this.options.successRedirect,
      ),
    };
  }

  private clearTransaction(req: Request, res: Response): void {
    const { path, domain, sameSite, secure } = this.transactionCookieOptions(req);

    // Path and domain have to match what it was set with, or the browser treats
    // this as a different cookie and leaves the original in place.
    res.clearCookie(this.options.txCookieName, { path, sameSite, secure, ...(domain ? { domain } : {}) });
  }

  /**
   * The module's cookie attributes, with one deliberate exception.
   *
   * A `SameSite=Strict` cookie is not sent on a navigation that originates at
   * the issuer, which is precisely the request the callback runs on — every
   * login would fail with a missing transaction. The tokens keep whatever the
   * application configured; only this short-lived transaction cookie is relaxed
   * to `Lax`, which is still not sent on a cross-site POST or subresource.
   */
  private transactionCookieOptions(req: Request): ReturnType<typeof resolveCookieOptions> {
    const resolved = resolveCookieOptions(req, this.options.cookieOptions);

    if (resolved.sameSite !== 'strict') return resolved;

    if (!this.warnedAboutSameSite) {
      this.warnedAboutSameSite = true;

      this.logger.warn(
        `cookieSameSite is "strict", which a browser will not send on the redirect back from the issuer. ` +
          `The "${this.options.txCookieName}" cookie is written with "lax" instead; the session cookies are unaffected.`,
      );
    }

    return { ...resolved, sameSite: 'lax' };
  }

  private setTokenCookies(req: Request, res: Response, tokenPair: TokenPairDto): void {
    const common = resolveCookieOptions(req, this.options.cookieOptions);

    res.cookie(this.options.accessTokenCookieName, tokenPair.accessToken, {
      ...common,
      maxAge: this.options.accessTokenExpiration * 1000,
    });

    res.cookie(this.options.refreshTokenCookieName, tokenPair.refreshToken, {
      ...common,
      maxAge: this.options.refreshTokenExpiration * 1000,
    });
  }
}

/**
 * The controller, bound to a path.
 *
 * `@Controller()` takes its prefix at decoration time, so a configurable mount
 * point cannot come from DI. Subclassing applies the path without duplicating a
 * line of the implementation: Nest walks the prototype chain for route
 * handlers, and resolves the constructor's `@Inject()` dependencies through the
 * same chain.
 *
 * That is a framework behaviour rather than one of ours, so it is covered by
 * booting a real application and issuing real requests
 * (`redirect-auth.routing.e2e.spec.ts`) rather than by asserting the metadata a
 * unit test could read back from the decorator. A Nest version that changed
 * prototype-chain discovery would turn that suite red instead of silently
 * unmounting these routes.
 */
export const createRedirectAuthController = (routePrefix: string): Type<RedirectAuthController> => {
  @Controller(routePrefix)
  class MountedRedirectAuthController extends RedirectAuthController {}

  return MountedRedirectAuthController;
};
