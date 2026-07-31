import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { OidcInteractionsController } from '../src/oidc/interactions.controller';
import { OidcClientEntity } from '../src/oidc/models/oidc-client.entity';
import { AuthenticationGateway } from '../src/services/authentication-gateway.service';
import { MemberBaseService } from '../src/services/member-base.service';
import { OidcSsoBridge } from '../src/oidc/sso-bridge.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import type { MemberBaseOidcProviderOptions } from '../src/oidc/oidc-provider.options';
import type { OidcInteractionDetails, OidcPromptDetails } from '../src/oidc/oidc.factory';

const MEMBER = { id: 'member-1', account: 'alice', deletedAt: null } as unknown as BaseMemberEntity;

const CLIENT = {
  clientId: 'reporting',
  clientSecret: 'super-secret-value',
  name: 'Reporting',
  skipConsent: false,
} as OidcClientEntity;

const INTERACTION_IAT = 1_700_000_000;

interface FakeGrant {
  props: { accountId: string; clientId: string } | null;
  addOIDCScope: jest.Mock;
  addOIDCClaims: jest.Mock;
  addResourceScope: jest.Mock;
  save: jest.Mock;
}

const createGrant = (props: { accountId: string; clientId: string } | null): FakeGrant => ({
  props,
  addOIDCScope: jest.fn(),
  addOIDCClaims: jest.fn(),
  addResourceScope: jest.fn(),
  save: jest.fn(async () => 'grant-1'),
});

interface FakeResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  redirectedTo: string | null;
  set: jest.Mock;
  send: jest.Mock;
  json: jest.Mock;
  redirect: jest.Mock;
  status: jest.Mock;
  cookie: jest.Mock;
}

const createResponse = (): FakeResponse => {
  const res: FakeResponse = {
    statusCode: 200,
    headers: {},
    body: undefined,
    redirectedTo: null,
    set: jest.fn((field: string, value: string) => {
      res.headers[field] = value;

      return res;
    }),
    send: jest.fn((body: string) => {
      res.body = body;

      return res;
    }),
    json: jest.fn((body: unknown) => {
      res.body = body;

      return res;
    }),
    redirect: jest.fn((status: number, url: string) => {
      res.statusCode = status;
      res.redirectedTo = url;

      return res;
    }),
    status: jest.fn((code: number) => {
      res.statusCode = code;

      return res;
    }),
    cookie: jest.fn(),
  };

  return res;
};

const htmlRequest = (extra?: Record<string, unknown>): Record<string, unknown> => ({
  headers: { accept: 'text/html,application/xhtml+xml' },
  ...extra,
});

/** What fetch and axios send. */
const apiRequest = (extra?: Record<string, unknown>): Record<string, unknown> => ({
  headers: { accept: '*/*' },
  ...extra,
});

interface HarnessOptions {
  prompt?: { name: string; details?: OidcPromptDetails; reasons?: string[] };
  params?: Record<string, unknown>;
  session?: { accountId?: string };
  grantId?: string;
  interaction?: MemberBaseOidcProviderOptions['interaction'];
  client?: OidcClientEntity | null;
  skippableLogin?: { member: BaseMemberEntity } | null;
  localSession?: { id: string; authTime?: number } | null;
  acceptLocalSession?: boolean;
  authenticate?: jest.Mock;
  channels?: { channel: string; kind: string }[];
}

interface Harness {
  controller: OidcInteractionsController;
  res: FakeResponse;
  details: OidcInteractionDetails;
  interactionResult: jest.Mock;
  interactionFinished: jest.Mock;
  Grant: jest.Mock & { find: jest.Mock };
  grants: FakeGrant[];
  foundGrant: FakeGrant;
  issueSession: jest.Mock;
  resolveSkippableLogin: jest.Mock;
}

const buildHarness = (options: HarnessOptions = {}): Harness => {
  const details: OidcInteractionDetails = {
    uid: 'abc123',
    iat: INTERACTION_IAT,
    exp: INTERACTION_IAT + 3600,
    prompt: {
      name: options.prompt?.name ?? 'login',
      details: options.prompt?.details ?? {},
      reasons: options.prompt?.reasons ?? [],
    },
    params: { client_id: 'reporting', scope: 'openid profile', ...options.params },
    session: options.session,
    grantId: options.grantId,
  };

  const grants: FakeGrant[] = [];
  const foundGrant = createGrant(null);

  const Grant = Object.assign(
    jest.fn().mockImplementation((props: { accountId: string; clientId: string }) => {
      const grant = createGrant(props);

      grants.push(grant);

      return grant;
    }),
    { find: jest.fn(async () => undefined as FakeGrant | undefined) },
  ) as jest.Mock & { find: jest.Mock };

  const interactionResult = jest.fn(async () => 'https://idp.example.com/oidc/auth/abc123');
  const interactionFinished = jest.fn(async () => undefined);

  const provider = {
    interactionDetails: jest.fn(async () => details),
    interactionResult,
    interactionFinished,
    Grant,
  };

  const resolveSkippableLogin = jest.fn(async () => options.skippableLogin ?? null);
  const issueSession = jest.fn();

  const ssoBridge = {
    resolveSkippableLogin,
    issueSession,
    readLocalSession: jest.fn(() => options.localSession ?? null),
    acceptLocalSession: options.acceptLocalSession ?? true,
  } as unknown as OidcSsoBridge;

  const gateway = {
    authenticate: options.authenticate ?? jest.fn(async () => ({ member: MEMBER })),
    listProviders: jest.fn(() => options.channels ?? [{ channel: 'password', kind: 'credential' }]),
  } as unknown as AuthenticationGateway;

  const memberBaseService = {
    findById: jest.fn(async (id: string) => (id === MEMBER.id ? MEMBER : null)),
  } as unknown as MemberBaseService;

  const client = options.client === undefined ? CLIENT : options.client;

  const clientRepo = {
    findOne: jest.fn(async () => client),
  } as unknown as Repository<OidcClientEntity>;

  const controller = new OidcInteractionsController(
    provider as never,
    { issuer: 'https://idp.example.com/oidc', interaction: options.interaction } as MemberBaseOidcProviderOptions,
    'oidc',
    gateway,
    ssoBridge,
    memberBaseService,
    clientRepo,
  );

  return {
    controller,
    res: createResponse(),
    details,
    interactionResult,
    interactionFinished,
    Grant,
    grants,
    foundGrant,
    issueSession,
    resolveSkippableLogin,
  };
};

describe('OidcInteractionsController login prompt', () => {
  it('should redirect to the application login page with the interaction identifiers', async () => {
    const harness = buildHarness({ interaction: { loginPageUrl: '/sign-in?theme=dark' } });

    await harness.controller.show(htmlRequest(), harness.res);

    expect(harness.res.redirect).toHaveBeenCalledWith(
      303,
      '/sign-in?theme=dark&uid=abc123&prompt=login&client_id=reporting',
    );
  });

  // A relative page URL must stay relative; the parser's placeholder origin is
  // not somewhere a browser may be sent.
  it('should keep a relative page url relative and an absolute one absolute', async () => {
    const relative = buildHarness({ interaction: { loginPageUrl: '/sign-in' } });

    await relative.controller.show(htmlRequest(), relative.res);

    expect(relative.res.redirectedTo).toBe('/sign-in?uid=abc123&prompt=login&client_id=reporting');

    const absolute = buildHarness({ interaction: { loginPageUrl: 'https://app.example.com/sign-in' } });

    await absolute.controller.show(htmlRequest(), absolute.res);

    expect(absolute.res.redirectedTo).toBe(
      'https://app.example.com/sign-in?uid=abc123&prompt=login&client_id=reporting',
    );
  });

  it('should hand the whole interaction to a page url function', async () => {
    const loginPageUrl = jest.fn(() => '/custom');
    const harness = buildHarness({
      params: { max_age: '300', prompt: 'login' },
      prompt: { name: 'login', reasons: ['no_session'] },
      interaction: { loginPageUrl },
    });

    await harness.controller.show(htmlRequest(), harness.res);

    expect(loginPageUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'abc123',
        promptName: 'login',
        promptReasons: ['no_session'],
        clientId: 'reporting',
        params: expect.objectContaining({ max_age: '300', prompt: 'login' }),
      }),
    );

    expect(harness.res.redirectedTo).toBe('/custom');
  });

  it('should let an existing member session stand in for the login page', async () => {
    const harness = buildHarness({
      skippableLogin: { member: MEMBER },
      interaction: { loginPageUrl: '/sign-in' },
    });

    await harness.controller.show(htmlRequest(), harness.res);

    expect(harness.interactionFinished).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { login: { accountId: 'member-1' } },
      { mergeWithLastSubmission: false },
    );

    expect(harness.res.redirect).not.toHaveBeenCalled();
  });

  // The page is served from <prefix>/interaction/<uid>, so a relative action
  // would resolve against <prefix>/interaction/ and lose the uid.
  it('should give the built-in page a submit path that actually resolves', async () => {
    const harness = buildHarness();

    await harness.controller.show(htmlRequest(), harness.res);

    expect(harness.res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(harness.res.body).toContain('action="/oidc/interaction/abc123/login"');
  });

  it('should prefer a custom renderer over the built-in page', async () => {
    const renderLogin = jest.fn(() => '<html>mine</html>');
    const harness = buildHarness({ interaction: { renderLogin } });

    await harness.controller.show(htmlRequest(), harness.res);

    expect(renderLogin).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'abc123', channels: ['password'], submitUrl: '/oidc/interaction/abc123/login' }),
    );

    expect(harness.res.body).toBe('<html>mine</html>');
  });

  it('should ignore a custom renderer when a page url is configured', async () => {
    const renderLogin = jest.fn(() => '<html>mine</html>');
    const harness = buildHarness({ interaction: { loginPageUrl: '/sign-in', renderLogin } });

    await harness.controller.show(htmlRequest(), harness.res);

    expect(renderLogin).not.toHaveBeenCalled();
    expect(harness.res.redirectedTo).toContain('/sign-in');
  });
});

describe('OidcInteractionsController consent prompt', () => {
  const consentPrompt = {
    name: 'consent',
    details: {
      missingOIDCScope: ['openid', 'profile'],
      missingOIDCClaims: ['sub', 'email'],
      missingResourceScopes: { 'https://api.example.com': ['read', 'write'] },
    } as OidcPromptDetails,
  };

  it('should grant every outstanding scope, claim and resource scope on auto consent', async () => {
    const harness = buildHarness({
      prompt: consentPrompt,
      session: { accountId: 'member-1' },
      interaction: { autoConsent: true },
    });

    await harness.controller.show(htmlRequest(), harness.res);

    const [grant] = harness.grants;

    expect(grant.addOIDCScope).toHaveBeenCalledWith('openid profile');
    expect(grant.addOIDCClaims).toHaveBeenCalledWith(['sub', 'email']);
    expect(grant.addResourceScope).toHaveBeenCalledWith('https://api.example.com', 'read write');

    expect(harness.interactionFinished).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { consent: { grantId: 'grant-1' } },
      { mergeWithLastSubmission: true },
    );
  });

  // Granting only the scope leaves the claims outstanding, the prompt fires
  // again on the retry, and the flow becomes a redirect loop.
  it('should not leave claims or resource scopes ungranted', async () => {
    const harness = buildHarness({
      prompt: consentPrompt,
      session: { accountId: 'member-1' },
      interaction: { autoConsent: true },
    });

    await harness.controller.show(htmlRequest(), harness.res);

    const [grant] = harness.grants;

    expect(grant.addOIDCClaims).toHaveBeenCalled();
    expect(grant.addResourceScope).toHaveBeenCalled();
  });

  it('should extend an existing grant rather than replace it', async () => {
    const harness = buildHarness({
      prompt: consentPrompt,
      session: { accountId: 'member-1' },
      grantId: 'existing-grant',
      interaction: { autoConsent: true },
    });

    harness.Grant.find.mockResolvedValue(harness.foundGrant);

    await harness.controller.show(htmlRequest(), harness.res);

    expect(harness.Grant.find).toHaveBeenCalledWith('existing-grant');
    expect(harness.Grant).not.toHaveBeenCalled();
    expect(harness.foundGrant.addOIDCScope).toHaveBeenCalledWith('openid profile');
  });

  it('should start a new grant when the recorded one has expired', async () => {
    const harness = buildHarness({
      prompt: consentPrompt,
      session: { accountId: 'member-1' },
      grantId: 'expired-grant',
      interaction: { autoConsent: true },
    });

    harness.Grant.find.mockResolvedValue(undefined);

    await harness.controller.show(htmlRequest(), harness.res);

    expect(harness.grants).toHaveLength(1);
    expect(harness.grants[0].props).toEqual({ accountId: 'member-1', clientId: 'reporting' });
  });

  it('should redirect to the application consent page when consent is required', async () => {
    const harness = buildHarness({
      prompt: consentPrompt,
      session: { accountId: 'member-1' },
      interaction: { consentPageUrl: '/authorize' },
    });

    await harness.controller.show(htmlRequest(), harness.res);

    expect(harness.res.redirect).toHaveBeenCalledWith(303, '/authorize?uid=abc123&prompt=consent&client_id=reporting');
    expect(harness.interactionFinished).not.toHaveBeenCalled();
  });

  it('should honour the client skipConsent column when autoConsent is unset', async () => {
    const harness = buildHarness({
      prompt: consentPrompt,
      session: { accountId: 'member-1' },
      client: { ...CLIENT, skipConsent: true },
    });

    await harness.controller.show(htmlRequest(), harness.res);

    expect(harness.interactionFinished).toHaveBeenCalled();
  });

  // Previously this answered 400 and third-party authorization simply failed.
  it('should fall back to the built-in consent page instead of failing', async () => {
    const harness = buildHarness({ prompt: consentPrompt, session: { accountId: 'member-1' } });

    await harness.controller.show(htmlRequest(), harness.res);

    expect(harness.res.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(harness.res.body).toContain('action="/oidc/interaction/abc123/consent"');
    expect(harness.res.body).toContain('action="/oidc/interaction/abc123/abort"');
    expect(harness.res.body).toContain('Reporting');
  });

  it('should hand a custom consent renderer everything it needs', async () => {
    const renderConsent = jest.fn(() => '<html>consent</html>');
    const harness = buildHarness({
      prompt: consentPrompt,
      session: { accountId: 'member-1' },
      interaction: { renderConsent },
    });

    await harness.controller.show(htmlRequest(), harness.res);

    expect(renderConsent).toHaveBeenCalledWith({
      uid: 'abc123',
      clientId: 'reporting',
      clientName: 'Reporting',
      missingScopes: ['openid', 'profile'],
      missingClaims: ['sub', 'email'],
      missingResourceScopes: { 'https://api.example.com': ['read', 'write'] },
      submitUrl: '/oidc/interaction/abc123/consent',
      abortUrl: '/oidc/interaction/abc123/abort',
    });

    expect(harness.res.body).toBe('<html>consent</html>');
  });

  it('should refuse a consent prompt that carries no authenticated subject', async () => {
    const harness = buildHarness({ prompt: consentPrompt, interaction: { autoConsent: true } });

    await harness.controller.show(htmlRequest(), harness.res);

    expect(harness.res.statusCode).toBe(400);
    expect(harness.interactionFinished).not.toHaveBeenCalled();
  });
});

describe('OidcInteractionsController details endpoint', () => {
  it('should describe a consent prompt without ever exposing the client secret', async () => {
    const harness = buildHarness({
      prompt: {
        name: 'consent',
        details: { missingOIDCScope: ['profile'], missingOIDCClaims: ['email'] },
        reasons: ['og_scope'],
      },
      params: { redirect_uri: 'https://app.example.com/cb', state: 'xyz', response_type: 'code', max_age: '300' },
      session: { accountId: 'member-1' },
    });

    await harness.controller.describe(apiRequest(), harness.res);

    expect(harness.res.body).toEqual({
      uid: 'abc123',
      prompt: { name: 'consent', reasons: ['og_scope'] },
      client: { clientId: 'reporting', name: 'Reporting' },
      params: {
        clientId: 'reporting',
        scope: 'openid profile',
        redirectUri: 'https://app.example.com/cb',
        responseType: 'code',
        state: 'xyz',
        prompt: null,
        maxAge: 300,
      },
      channels: [],
      consent: {
        missingScopes: ['profile'],
        missingClaims: ['email'],
        missingResourceScopes: {},
      },
      session: { accountId: 'member-1', account: 'alice' },
    });

    expect(JSON.stringify(harness.res.body)).not.toContain('super-secret-value');
  });

  it('should describe a login prompt with the channels the form may use', async () => {
    const harness = buildHarness({
      channels: [
        { channel: 'password', kind: 'credential' },
        { channel: 'ldap', kind: 'credential' },
        { channel: 'google', kind: 'redirect' },
      ],
    });

    await harness.controller.describe(apiRequest(), harness.res);

    const view = harness.res.body as { channels: string[]; consent: unknown; session: unknown };

    expect(view.channels).toEqual(['password', 'ldap']);
    expect(view.consent).toBeNull();
    expect(view.session).toBeNull();
  });
});

describe('OidcInteractionsController login submission', () => {
  it('should answer an api client with the location as data', async () => {
    const harness = buildHarness();

    await harness.controller.login({ account: 'alice', password: 'pw' }, apiRequest({ ip: '10.0.0.1' }), harness.res);

    expect(harness.res.json).toHaveBeenCalledWith({ redirectTo: 'https://idp.example.com/oidc/auth/abc123' });
    expect(harness.res.redirect).not.toHaveBeenCalled();
    expect(harness.issueSession).toHaveBeenCalled();

    // Nest defaults a POST to 201, which would claim a resource was created.
    expect(harness.res.statusCode).toBe(200);

    expect(harness.interactionResult).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { login: { accountId: 'member-1' } },
      { mergeWithLastSubmission: false },
    );
  });

  it('should answer a browser form with a redirect', async () => {
    const harness = buildHarness();

    await harness.controller.login({ account: 'alice', password: 'pw' }, htmlRequest(), harness.res);

    expect(harness.res.redirect).toHaveBeenCalledWith(303, 'https://idp.example.com/oidc/auth/abc123');
    expect(harness.res.json).not.toHaveBeenCalled();
  });

  it('should report a failure to an api client without revealing which half was wrong', async () => {
    const harness = buildHarness({
      authenticate: jest.fn(async () => {
        throw new Error('no such account');
      }),
    });

    await harness.controller.login({ account: 'alice', password: 'pw' }, apiRequest(), harness.res);

    expect(harness.res.statusCode).toBe(401);
    expect(harness.res.body).toEqual({ error: 'invalid_credentials', message: 'Invalid account or password' });
    expect(JSON.stringify(harness.res.body)).not.toContain('no such account');
  });

  it('should re-render the form for a browser after a failure', async () => {
    const harness = buildHarness({
      authenticate: jest.fn(async () => {
        throw new Error('wrong password');
      }),
    });

    await harness.controller.login({ account: 'alice', password: 'pw' }, htmlRequest(), harness.res);

    expect(harness.res.body).toContain('Invalid account or password');
    expect(harness.res.body).toContain('action="/oidc/interaction/abc123/login"');
  });

  it('should send a failed login back to a configured page with an error marker', async () => {
    const harness = buildHarness({
      interaction: { loginPageUrl: '/sign-in' },
      authenticate: jest.fn(async () => {
        throw new Error('nope');
      }),
    });

    await harness.controller.login({ account: 'alice', password: 'pw' }, htmlRequest(), harness.res);

    expect(harness.res.redirectedTo).toContain('error=Invalid+account+or+password');
  });

  it('should refuse a channel the interaction is not allowed to use', async () => {
    const harness = buildHarness({ interaction: { allowedChannels: ['password'] } });

    await expect(
      harness.controller.login({ account: 'a', password: 'b', channel: 'ldap' }, apiRequest(), harness.res),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OidcInteractionsController consent submission', () => {
  const buildConsentHarness = (): Harness =>
    buildHarness({
      prompt: {
        name: 'consent',
        details: {
          missingOIDCScope: ['openid', 'profile', 'email'],
          missingOIDCClaims: ['sub', 'email'],
          missingResourceScopes: { 'https://api.example.com': ['read', 'write'] },
        },
      },
      session: { accountId: 'member-1' },
    });

  it('should grant everything outstanding when the submission names nothing', async () => {
    const harness = buildConsentHarness();

    await harness.controller.consent({}, apiRequest(), harness.res);

    const [grant] = harness.grants;

    expect(grant.addOIDCScope).toHaveBeenCalledWith('openid profile email');
    expect(grant.addOIDCClaims).toHaveBeenCalledWith(['sub', 'email']);
    expect(harness.res.json).toHaveBeenCalledWith({ redirectTo: 'https://idp.example.com/oidc/auth/abc123' });
  });

  it('should narrow the grant to what was actually chosen', async () => {
    const harness = buildConsentHarness();

    await harness.controller.consent(
      { scopes: ['openid', 'profile'], claims: ['sub'], resourceScopes: { 'https://api.example.com': ['read'] } },
      apiRequest(),
      harness.res,
    );

    const [grant] = harness.grants;

    expect(grant.addOIDCScope).toHaveBeenCalledWith('openid profile');
    expect(grant.addOIDCClaims).toHaveBeenCalledWith(['sub']);
    expect(grant.addResourceScope).toHaveBeenCalledWith('https://api.example.com', 'read');
  });

  // Trusting the submission would let a page grant itself something the client
  // never asked for.
  it('should never grant a scope the client did not request', async () => {
    const harness = buildConsentHarness();

    await harness.controller.consent({ scopes: ['openid', 'admin'] }, apiRequest(), harness.res);

    expect(harness.grants[0].addOIDCScope).toHaveBeenCalledWith('openid');
  });

  it('should discard a malformed selection rather than trust it', async () => {
    const harness = buildConsentHarness();

    await harness.controller.consent(
      { scopes: [42, 'profile'] as unknown as string[], resourceScopes: 'nope' as unknown as Record<string, string[]> },
      apiRequest(),
      harness.res,
    );

    expect(harness.grants[0].addOIDCScope).toHaveBeenCalledWith('profile');
    expect(harness.grants[0].addResourceScope).toHaveBeenCalledWith('https://api.example.com', 'read write');
  });

  it('should refuse to record consent for an interaction awaiting a login', async () => {
    const harness = buildHarness({ prompt: { name: 'login' }, session: { accountId: 'member-1' } });

    await expect(harness.controller.consent({}, apiRequest(), harness.res)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OidcInteractionsController local session endpoint', () => {
  it('should satisfy prompt=login when the member authenticated during this interaction', async () => {
    const harness = buildHarness({
      params: { prompt: 'login' },
      localSession: { id: 'member-1', authTime: INTERACTION_IAT + 5 },
    });

    await harness.controller.completeWithLocalSession(apiRequest(), harness.res);

    expect(harness.interactionResult).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { login: { accountId: 'member-1' } },
      { mergeWithLastSubmission: false },
    );

    // A fresh authentication answers the prompt on its own terms.
    expect(harness.resolveSkippableLogin).not.toHaveBeenCalled();
  });

  it('should fall back to the ordinary skip rules for an inherited session', async () => {
    const harness = buildHarness({
      localSession: { id: 'member-1', authTime: INTERACTION_IAT - 600 },
      skippableLogin: { member: MEMBER },
    });

    await harness.controller.completeWithLocalSession(apiRequest(), harness.res);

    expect(harness.resolveSkippableLogin).toHaveBeenCalled();
    expect(harness.res.json).toHaveBeenCalledWith({ redirectTo: 'https://idp.example.com/oidc/auth/abc123' });
  });

  // Otherwise the relying party's demand for a fresh login would be silently
  // voided by whatever session the browser happened to be carrying.
  it('should refuse an inherited session the skip rules reject', async () => {
    const harness = buildHarness({
      params: { prompt: 'login' },
      localSession: { id: 'member-1', authTime: INTERACTION_IAT - 600 },
      skippableLogin: null,
    });

    await expect(harness.controller.completeWithLocalSession(apiRequest(), harness.res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should refuse a token that predates the authTime claim on a prompt=login request', async () => {
    const harness = buildHarness({
      params: { prompt: 'login' },
      localSession: { id: 'member-1' },
      skippableLogin: null,
    });

    await expect(harness.controller.completeWithLocalSession(apiRequest(), harness.res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should refuse a request carrying no member-base session', async () => {
    const harness = buildHarness({ localSession: null });

    await expect(harness.controller.completeWithLocalSession(apiRequest(), harness.res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should refuse a session whose member no longer exists', async () => {
    const harness = buildHarness({ localSession: { id: 'ghost', authTime: INTERACTION_IAT + 5 } });

    await expect(harness.controller.completeWithLocalSession(apiRequest(), harness.res)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should stay closed when session bridging is switched off', async () => {
    const harness = buildHarness({
      acceptLocalSession: false,
      localSession: { id: 'member-1', authTime: INTERACTION_IAT + 5 },
    });

    await expect(harness.controller.completeWithLocalSession(apiRequest(), harness.res)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('should refuse to resolve a consent prompt', async () => {
    const harness = buildHarness({
      prompt: { name: 'consent' },
      localSession: { id: 'member-1', authTime: INTERACTION_IAT + 5 },
    });

    await expect(harness.controller.completeWithLocalSession(apiRequest(), harness.res)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('OidcInteractionsController abort endpoint', () => {
  it('should report a refusal as access_denied and replace any prior submission', async () => {
    const harness = buildHarness({ prompt: { name: 'consent' }, session: { accountId: 'member-1' } });

    await harness.controller.abort({}, apiRequest(), harness.res);

    expect(harness.interactionResult).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { error: 'access_denied', error_description: 'End-User aborted interaction' },
      { mergeWithLastSubmission: false },
    );

    expect(harness.res.json).toHaveBeenCalledWith({ redirectTo: 'https://idp.example.com/oidc/auth/abc123' });
  });

  it('should carry a supplied description through', async () => {
    const harness = buildHarness({ prompt: { name: 'consent' } });

    await harness.controller.abort({ errorDescription: 'Not this account' }, htmlRequest(), harness.res);

    expect(harness.interactionResult).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { error: 'access_denied', error_description: 'Not this account' },
      { mergeWithLastSubmission: false },
    );

    expect(harness.res.redirect).toHaveBeenCalledWith(303, 'https://idp.example.com/oidc/auth/abc123');
  });
});
