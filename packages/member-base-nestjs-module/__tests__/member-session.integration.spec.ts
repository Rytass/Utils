import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { DataSource, getMetadataArgsStorage, Repository } from 'typeorm';
import { hash } from 'argon2';
import { sign, verify as verifyJWT } from 'jsonwebtoken';
import { MemberBaseService } from '../src/services/member-base.service';
import { MemberBaseAdminService } from '../src/services/member-base-admin.service';
import { MemberSessionService } from '../src/services/member-session.service';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { AuthenticationGateway } from '../src/services/authentication-gateway.service';
import { OAuthService } from '../src/services/oauth.service';
import { OidcSsoBridge } from '../src/oidc/sso-bridge.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { MemberSessionEntity } from '../src/models/member-session.entity';
import { MemberLoginLogEntity } from '../src/models/member-login-log.entity';
import { MemberPasswordHistoryEntity } from '../src/models/member-password-history.entity';
import { MemberOAuthRecordEntity } from '../src/models/member-oauth-record.entity';
import type { AuthenticationProvider } from '../src/typings/authentication-provider.interface';
import { withPrimaryReads } from './__utils__/with-primary-reads';
import type { CustomOAuth2Provider } from '../src/typings/oauth2-provider.interface';
import type { MemberBaseOidcProviderOptions } from '../src/oidc/oidc-provider.options';
import {
  InvalidToken,
  MemberNotFoundError,
  PasswordChangedError,
  RefreshTokenReuseDetectedError,
  SessionExpiredError,
  SessionNotFoundError,
  SessionRejectedError,
  SessionRevokedError,
  SessionRotationConflictError,
} from '../src/constants/errors/base.error';

const ACCESS_TOKEN_SECRET = 'access-secret';
const REFRESH_TOKEN_SECRET = 'refresh-secret';
const REFRESH_TOKEN_EXPIRATION = 60 * 60 * 24 * 90;
const PASSWORD = 'Passw0rd-one';

/**
 * The shipped entity declares Postgres column types, which sqlite refuses at
 * metadata validation. Swap just those types, in this file's module registry,
 * for the sqlite equivalents — the entity, its column names, its indexes and
 * every query run against it stay the shipped ones.
 */
const SQLITE_TYPES: Record<string, string> = { timestamptz: 'datetime', cidr: 'varchar' };

for (const column of getMetadataArgsStorage().columns) {
  if (column.target === MemberSessionEntity && typeof column.options.type === 'string') {
    column.options.type = (SQLITE_TYPES[column.options.type] ?? column.options.type) as typeof column.options.type;
  }
}

/** The private UPDATE every rotation goes through, reached for in tests only. */
interface ReplaceTokenSpyable {
  replaceToken(sessionId: string, fromTokenId: string, toTokenId: string): Promise<boolean>;
}

interface Claims {
  id: string;
  account: string;
  sid?: string;
  jti?: string;
  domain?: string;
  authTime?: number;
  passwordChangedAt?: number | null;
  exp: number;
  iat: number;
}

const refreshClaims = (token: string): Claims => verifyJWT(token, REFRESH_TOKEN_SECRET) as Claims;
const accessClaims = (token: string): Claims => verifyJWT(token, ACCESS_TOKEN_SECRET) as Claims;

/** Just enough of a member repository: the session table is the one under test. */
const createMemberRepo = (): {
  repo: Repository<BaseMemberEntity>;
  members: Map<string, BaseMemberEntity>;
  readModes: string[];
} => {
  const members = new Map<string, BaseMemberEntity>();

  const repo = {
    findOne: jest.fn(async ({ where }: { where: Partial<BaseMemberEntity> }) => {
      const found = [...members.values()].find(member =>
        Object.entries(where).every(([key, value]) => {
          const actual = member[key as keyof BaseMemberEntity];

          return value instanceof Date && actual instanceof Date
            ? actual.getTime() === value.getTime()
            : actual === value;
        }),
      );

      return found ?? null;
    }),
    save: jest.fn(async (member: BaseMemberEntity) => {
      members.set(member.id, member);

      return member;
    }),
  } as unknown as Repository<BaseMemberEntity>;

  return { repo, members, readModes: withPrimaryReads(repo) };
};

interface Harness {
  dataSource: DataSource;
  sessionRepo: Repository<MemberSessionEntity>;
  sessions: MemberSessionService;
  service: MemberBaseService;
  admin: MemberBaseAdminService;
  memberRepo: Repository<BaseMemberEntity>;
  memberReadModes: string[];
  removeMember: (id: string) => void;
  addMember: (account: string) => Promise<BaseMemberEntity>;
}

interface HarnessOptions {
  rotationGraceSeconds?: number;
  recordUserAgent?: boolean;
  recordIp?: boolean;
}

const createHarness = async (options: HarnessOptions = {}): Promise<Harness> => {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [MemberSessionEntity],
    synchronize: true,
  });

  await dataSource.initialize();

  const sessionRepo = dataSource.getRepository(MemberSessionEntity);
  const { repo: memberRepo, members, readModes: memberReadModes } = createMemberRepo();

  const sessions = new MemberSessionService(
    sessionRepo,
    REFRESH_TOKEN_EXPIRATION,
    options.rotationGraceSeconds ?? 10,
    options.recordUserAgent ?? false,
    options.recordIp ?? false,
  );

  const historyRepo = {
    create: (value: unknown): unknown => value,
    save: async (value: unknown): Promise<unknown> => value,
    find: async (): Promise<unknown[]> => [],
  } as unknown as Repository<MemberPasswordHistoryEntity>;

  const passwordValidator = new PasswordValidatorService(
    true,
    true,
    true,
    false,
    8,
    undefined,
    undefined,
    historyRepo,
    undefined,
  );

  const service = new MemberBaseService(
    undefined,
    memberRepo,
    { save: jest.fn(), findOne: jest.fn() } as unknown as Repository<MemberLoginLogEntity>,
    5,
    60 * 60,
    'reset-secret',
    ACCESS_TOKEN_SECRET,
    60 * 15,
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRATION,
    false,
    historyRepo,
    undefined,
    false,
    passwordValidator,
    (member: BaseMemberEntity) => ({ id: member.id, account: member.account }),
    null,
    {},
    true,
    true,
    sessions,
  );

  const admin = new MemberBaseAdminService(memberRepo, passwordValidator, historyRepo, {}, sessions);

  const addMember = async (account: string): Promise<BaseMemberEntity> => {
    const member = new BaseMemberEntity();

    member.id = randomUUID();
    member.account = account;
    member.password = await hash(PASSWORD);
    member.passwordChangedAt = new Date('2026-01-01T00:00:00.000Z');
    member.resetPasswordRequestedAt = null;
    member.loginFailedCounter = 0;
    member.shouldUpdatePassword = false;

    members.set(member.id, member);

    return member;
  };

  const removeMember = (id: string): void => {
    members.delete(id);
  };

  return { dataSource, sessionRepo, sessions, service, admin, memberRepo, memberReadModes, removeMember, addMember };
};

/** Move the last rotation into the past, which is what waiting out the grace window does. */
const ageRotation = async (harness: Harness, sessionId: string, seconds: number): Promise<void> => {
  await harness.sessionRepo.update({ id: sessionId }, { previousRotatedAt: new Date(Date.now() - seconds * 1000) });
};

const rowOf = async (harness: Harness, sessionId: string): Promise<MemberSessionEntity> =>
  harness.sessionRepo.findOneOrFail({ where: { id: sessionId } });

describe('login sessions, against a real database', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await harness.dataSource.destroy();
  });

  describe('opening a session', () => {
    it('should store one session per login and bind both tokens to it', async () => {
      const member = await harness.addMember('alice');
      const before = Date.now();

      const pair = await harness.service.login('alice', PASSWORD);

      const refresh = refreshClaims(pair.refreshToken);
      const access = accessClaims(pair.accessToken);
      const rows = await harness.sessionRepo.find();

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: refresh.sid,
        memberId: member.id,
        currentTokenId: refresh.jti,
        previousTokenId: null,
        previousRotatedAt: null,
        revokedAt: null,
        revokedReason: null,
        passwordChangedAt: member.passwordChangedAt,
      });

      expect(access.sid).toBe(refresh.sid);
      expect(access.jti).toBeUndefined();
      expect(rows[0].expiresAt.getTime()).toBeGreaterThanOrEqual(before + REFRESH_TOKEN_EXPIRATION * 1000);
    });

    it('should give two logins of one member two independent sessions', async () => {
      await harness.addMember('alice');

      const phone = await harness.service.login('alice', PASSWORD);
      const laptop = await harness.service.login('alice', PASSWORD);

      expect(refreshClaims(phone.refreshToken).sid).not.toBe(refreshClaims(laptop.refreshToken).sid);
      expect(await harness.sessionRepo.count()).toBe(2);
    });

    it('should record neither user agent nor ip unless asked to', async () => {
      await harness.addMember('alice');

      const pair = await harness.service.login('alice', PASSWORD, {
        domain: 'tenant-a',
        ip: '203.0.113.7',
        userAgent: 'jest',
      });

      expect(await rowOf(harness, refreshClaims(pair.refreshToken).sid as string)).toMatchObject({
        domain: 'tenant-a',
        userAgent: null,
        ip: null,
      });
    });

    it('should never let an address the cidr column would refuse fail the login', async () => {
      const recording = await createHarness({ recordIp: true });

      await recording.addMember('alice');

      const scoped = await recording.service.login('alice', PASSWORD, { ip: 'fe80::1%en0' });
      const garbage = await recording.service.login('alice', PASSWORD, { ip: 'not-an-address' });

      expect((await rowOf(recording, refreshClaims(scoped.refreshToken).sid as string)).ip).toBe('fe80::1/128');
      expect((await rowOf(recording, refreshClaims(garbage.refreshToken).sid as string)).ip).toBeNull();

      await recording.dataSource.destroy();
    });

    it('should record user agent and ip when both are switched on', async () => {
      const recording = await createHarness({ recordUserAgent: true, recordIp: true });

      await recording.addMember('alice');

      const pair = await recording.service.login('alice', PASSWORD, { ip: '2001:db8::1', userAgent: 'jest' });

      expect(await rowOf(recording, refreshClaims(pair.refreshToken).sid as string)).toMatchObject({
        userAgent: 'jest',
        ip: '2001:db8::1/128',
      });

      await recording.dataSource.destroy();
    });
  });

  describe('every login path opens a session', () => {
    const expectTrackedPair = async (pair: { accessToken: string; refreshToken: string }): Promise<void> => {
      const refresh = refreshClaims(pair.refreshToken);
      const row = await rowOf(harness, refresh.sid as string);

      expect(row.currentTokenId).toBe(refresh.jti);
      expect(accessClaims(pair.accessToken).sid).toBe(refresh.sid);
      // The session was opened under the member's password: a path that opened
      // it without one would leave it inactive from the start.
      expect(row.passwordChangedAt?.getTime()).toBe(refresh.passwordChangedAt);
      expect(await harness.service.isSessionActive(refresh.id, refresh.sid as string)).toBe(true);
      // The proof that it is tracked: it refreshes.
      await expect(harness.service.refreshToken(pair.refreshToken)).resolves.toBeDefined();
    };

    const createGateway = (providers: AuthenticationProvider[]): AuthenticationGateway =>
      new AuthenticationGateway(
        providers,
        harness.memberRepo,
        { findOne: jest.fn(async () => null), save: jest.fn() } as unknown as Repository<MemberOAuthRecordEntity>,
        harness.service,
        true,
        false,
        null,
      );

    it('MemberBaseService.login — password', async () => {
      await harness.addMember('alice');

      await expectTrackedPair(await harness.service.login('alice', PASSWORD));
    });

    it('AuthenticationGateway.login — a credential provider such as LDAP or Entra', async () => {
      const member = await harness.addMember('alice');

      const directory: AuthenticationProvider = {
        channel: 'ldap',
        kind: 'credential',
        authenticate: async () => ({ channel: 'ldap', identifier: 'alice', memberId: member.id }),
      };

      const pair = await createGateway([directory]).login('ldap', {}, { domain: 'tenant-a', ip: '203.0.113.7' });

      await expectTrackedPair(pair);
      expect(refreshClaims(pair.refreshToken).domain).toBe('tenant-a');
    });

    it('AuthenticationGateway.handleCallback then issueTokenPair — a redirect provider such as OIDC', async () => {
      const member = await harness.addMember('alice');

      const issuer: AuthenticationProvider = {
        channel: 'oidc',
        kind: 'redirect',
        handleCallback: async () => ({ channel: 'oidc', identifier: 'sub-1', memberId: member.id }),
      };

      // What RedirectAuthController does with the gateway's answer.
      const { member: resolved } = await createGateway([issuer]).handleCallback('oidc', { code: 'c' });

      await expectTrackedPair(await harness.service.issueTokenPair(resolved, { ip: '203.0.113.7' }));
    });

    it('OAuthService — an OAuth2 code exchange', async () => {
      const member = await harness.addMember('alice');

      const provider: CustomOAuth2Provider = {
        channel: 'line',
        clientId: 'id',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/callback',
        scope: ['profile'],
        requestUrl: 'https://line.example.com/authorize',
        getAccessTokenFromCode: async () => 'upstream-token',
        getAccountFromAccessToken: async () => 'alice',
      };

      const queryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => ({ member })),
      };

      const oauth = new OAuthService(
        [provider],
        harness.memberRepo,
        { createQueryBuilder: () => queryBuilder } as unknown as Repository<MemberOAuthRecordEntity>,
        harness.service,
      );

      await expectTrackedPair(await oauth.loginWithCustomOAuth2Code('line', 'code'));
    });

    it('OidcSsoBridge.issueSession — the interaction login of this package as an issuer', async () => {
      const member = await harness.addMember('alice');
      const cookies = new Map<string, string>();

      const bridge = new OidcSsoBridge(
        { issuer: 'https://id.example.com' } as MemberBaseOidcProviderOptions,
        harness.service,
        true,
        ACCESS_TOKEN_SECRET,
        60 * 15,
        REFRESH_TOKEN_EXPIRATION,
      );

      await bridge.issueSession(
        { cookie: (name: string, value: string) => cookies.set(name, value), req: { headers: {} } },
        member,
      );

      await expectTrackedPair({
        accessToken: cookies.get('access_token') as string,
        refreshToken: cookies.get('refresh_token') as string,
      });
    });

    it('signRefreshToken called directly — a session is opened for it', async () => {
      const member = await harness.addMember('alice');

      const refreshToken = harness.service.signRefreshToken(member);

      // No await between signing and refreshing: the refresh has to wait for
      // the insert the synchronous call could not.
      const pair = await harness.service.refreshToken(refreshToken);

      expect(refreshClaims(pair.refreshToken).sid).toBe(refreshClaims(refreshToken).sid);
      expect(await harness.sessionRepo.count()).toBe(1);
    });

    it('signRefreshToken called directly — a failed insert is logged and the token never refreshes', async () => {
      const member = await harness.addMember('alice');
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      jest.spyOn(harness.sessionRepo, 'insert').mockRejectedValueOnce(new Error('connection lost'));

      const refreshToken = harness.service.signRefreshToken(member);

      await expect(harness.service.refreshToken(refreshToken)).rejects.toBeInstanceOf(SessionNotFoundError);
      expect(logged).toHaveBeenCalledWith(expect.stringContaining('connection lost'));
    });
  });

  describe('rotation', () => {
    it('should replace the token id, remember the one it replaced and extend the session', async () => {
      await harness.addMember('alice');

      const first = await harness.service.login('alice', PASSWORD, { domain: 'tenant-a' });
      const firstClaims = refreshClaims(first.refreshToken);
      const opened = await rowOf(harness, firstClaims.sid as string);

      const second = await harness.service.refreshToken(first.refreshToken);
      const secondClaims = refreshClaims(second.refreshToken);
      const rotated = await rowOf(harness, firstClaims.sid as string);

      expect(secondClaims.sid).toBe(firstClaims.sid);
      expect(secondClaims.jti).not.toBe(firstClaims.jti);
      expect(secondClaims.domain).toBe('tenant-a');
      expect(secondClaims.authTime).toBe(firstClaims.authTime);
      expect(accessClaims(second.accessToken).sid).toBe(firstClaims.sid);
      expect(rotated.currentTokenId).toBe(secondClaims.jti);
      expect(rotated.previousTokenId).toBe(firstClaims.jti);
      expect(rotated.previousRotatedAt).toBeInstanceOf(Date);
      expect(rotated.expiresAt.getTime()).toBeGreaterThanOrEqual(opened.expiresAt.getTime());
      expect(rotated.lastRefreshedAt.getTime()).toBeGreaterThanOrEqual(opened.lastRefreshedAt.getTime());
    });

    it('should keep rotating down a chain of refreshes', async () => {
      await harness.addMember('alice');

      let pair = await harness.service.login('alice', PASSWORD);
      const seen = new Set<string>([refreshClaims(pair.refreshToken).jti as string]);

      for (let turn = 0; turn < 4; turn += 1) {
        pair = await harness.service.refreshToken(pair.refreshToken);
        seen.add(refreshClaims(pair.refreshToken).jti as string);
      }

      expect(seen.size).toBe(5);
    });

    it('should let exactly one of two concurrent refreshes rotate, and hand both the same token id', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const loginClaims = refreshClaims(login.refreshToken);
      const replaceToken = jest.spyOn(harness.sessions as unknown as ReplaceTokenSpyable, 'replaceToken');

      const [left, right] = await Promise.all([
        harness.service.refreshToken(login.refreshToken),
        harness.service.refreshToken(login.refreshToken),
      ]);

      const row = await rowOf(harness, loginClaims.sid as string);

      // Both reached the UPDATE, so the database — not the read before it — is
      // what kept the second from rotating again.
      expect(replaceToken).toHaveBeenCalledTimes(2);
      expect(await Promise.all(replaceToken.mock.results.map(result => result.value))).toEqual(
        expect.arrayContaining([true, false]),
      );

      expect(refreshClaims(left.refreshToken).jti).toBe(row.currentTokenId);
      expect(refreshClaims(right.refreshToken).jti).toBe(row.currentTokenId);
      expect(row.previousTokenId).toBe(loginClaims.jti);
      expect(row.revokedAt).toBeNull();
    });

    it('should hold under a burst of concurrent refreshes', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const loginClaims = refreshClaims(login.refreshToken);

      const pairs = await Promise.all(
        Array.from({ length: 8 }, () => harness.service.refreshToken(login.refreshToken)),
      );

      const row = await rowOf(harness, loginClaims.sid as string);

      expect(new Set(pairs.map(pair => refreshClaims(pair.refreshToken).jti))).toEqual(new Set([row.currentTokenId]));
      expect(row.previousTokenId).toBe(loginClaims.jti);
      expect(row.revokedAt).toBeNull();
    });

    it('should accept the token just rotated away while the grace window is open, without rotating again', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const rotated = await harness.service.refreshToken(login.refreshToken);
      const afterRotation = await rowOf(harness, refreshClaims(login.refreshToken).sid as string);

      const late = await harness.service.refreshToken(login.refreshToken);
      const row = await rowOf(harness, refreshClaims(login.refreshToken).sid as string);

      expect(refreshClaims(late.refreshToken).jti).toBe(refreshClaims(rotated.refreshToken).jti);
      expect(refreshClaims(late.refreshToken).sid).toBe(refreshClaims(login.refreshToken).sid);
      expect(accessClaims(late.accessToken).sid).toBe(refreshClaims(login.refreshToken).sid);
      // The late request wrote nothing: in particular it did not restart the
      // window, or replaying the old token would keep it open indefinitely.
      expect(row).toEqual(afterRotation);
      // And the pair the late caller was handed carries on working.
      await expect(harness.service.refreshToken(late.refreshToken)).resolves.toBeDefined();
    });
  });

  describe('reading the session', () => {
    it('should read from the primary, so a lagging replica cannot fake a reuse', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const createQueryRunner = jest.spyOn(harness.dataSource, 'createQueryRunner');

      await harness.service.refreshToken(login.refreshToken);

      // TypeORM's own default for a SELECT is 'slave' (DataSource
      // .defaultReplicationModeForReads); writes ask with no mode, which is
      // master. Not one read may have gone to a replica.
      expect(createQueryRunner).toHaveBeenCalledWith('master');
      expect(createQueryRunner.mock.calls.filter(([mode]) => mode === 'slave')).toEqual([]);
    });

    it('should read the member from the primary too, on refresh and on reissue', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);

      harness.memberReadModes.length = 0;

      await harness.service.refreshToken(login.refreshToken);
      await harness.service.reissueSessionTokens(member.id, refreshClaims(login.refreshToken).sid as string);

      expect(harness.memberReadModes).toEqual(['master', 'master']);
    });

    it('should check the password again before answering a refresh that lost its race', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      // While this refresh is between its checks and its write, the member
      // changes the password, keeping this session, and reissues it.
      jest
        .spyOn(harness.sessions as unknown as ReplaceTokenSpyable, 'replaceToken')
        .mockImplementationOnce(async () => {
          await harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two', { keepSessionId: sessionId });
          await harness.service.reissueSessionTokens(member.id, sessionId);

          return false;
        });

      // The reissue rotated away the token this refresh holds, inside the grace
      // window; without a second check it would be handed the new pair.
      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(PasswordChangedError);
    });

    it('should call a lost rotation that still finds its token current a conflict, not a reuse', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      // What a stale read looks like: the UPDATE matched nothing, yet the row
      // that comes back still names the presented token as current.
      jest.spyOn(harness.sessions as unknown as ReplaceTokenSpyable, 'replaceToken').mockResolvedValueOnce(false);

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toMatchObject({
        constructor: SessionRotationConflictError,
        code: 132,
      });

      expect((await rowOf(harness, sessionId)).revokedAt).toBeNull();
      expect(new SessionRotationConflictError()).not.toBeInstanceOf(InvalidToken);
      await expect(harness.service.refreshToken(login.refreshToken)).resolves.toBeDefined();
    });

    it('should accept timestamps a custom type parser hands back as strings', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      await harness.service.refreshToken(login.refreshToken);

      const row = await rowOf(harness, sessionId);
      const asString = (value: Date | null): Date => (value?.toISOString() ?? null) as unknown as Date;
      const stringly = {
        ...row,
        expiresAt: asString(row.expiresAt),
        lastRefreshedAt: asString(row.lastRefreshedAt),
        previousRotatedAt: asString(row.previousRotatedAt),
        passwordChangedAt: asString(row.passwordChangedAt),
      };

      jest.spyOn(harness.sessions, 'findSession').mockResolvedValue(stringly);

      // The member's own passwordChangedAt as a string too.
      member.passwordChangedAt = member.passwordChangedAt.toISOString() as unknown as Date;

      // The grace window reads previousRotatedAt; isSessionActive reads
      // expiresAt and passwordChangedAt. All of them as strings.
      await expect(harness.service.refreshToken(login.refreshToken)).resolves.toBeDefined();
      await expect(harness.service.isSessionActive(member.id, sessionId)).resolves.toBe(true);
    });

    it('should report an id that cannot be a session as no session, without asking the database', async () => {
      const member = await harness.addMember('alice');

      await harness.service.login('alice', PASSWORD);

      const createQueryRunner = jest.spyOn(harness.dataSource, 'createQueryRunner');

      expect(await harness.service.revokeSession('not-a-uuid', 'admin')).toBe(false);
      expect(await harness.service.revokeMemberSession(member.id, "1' OR '1'='1")).toBe(false);
      expect(await harness.service.isSessionActive(member.id, 'nope')).toBe(false);
      expect(await harness.service.revokeAllSessions('not-a-uuid', { reason: 'admin' })).toBe(0);
      await expect(harness.service.reissueSessionTokens(member.id, 'nope')).rejects.toBeInstanceOf(
        SessionNotFoundError,
      );

      expect(createQueryRunner).not.toHaveBeenCalled();
    });

    it('should spare nothing when keepSessionId cannot be a session', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);

      await harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two', { keepSessionId: 'not-a-uuid' });

      expect((await rowOf(harness, refreshClaims(login.refreshToken).sid as string)).revokedReason).toBe(
        'password_changed',
      );
    });
  });

  describe('reuse detection', () => {
    it('should revoke the session when a rotated token comes back after the grace window (KB-415 B)', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;
      const rotated = await harness.service.refreshToken(login.refreshToken);

      await ageRotation(harness, sessionId, 11);

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(
        RefreshTokenReuseDetectedError,
      );

      expect(await rowOf(harness, sessionId)).toMatchObject({ revokedReason: 'reuse_detected' });
      expect((await rowOf(harness, sessionId)).revokedAt).toBeInstanceOf(Date);

      // The legitimate holder is taken down with the thief; that is the point.
      await expect(harness.service.refreshToken(rotated.refreshToken)).rejects.toMatchObject({
        constructor: SessionRevokedError,
        reason: 'reuse_detected',
      });
    });

    it('should treat a token two rotations old as reuse even inside the window', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const second = await harness.service.refreshToken(login.refreshToken);

      await harness.service.refreshToken(second.refreshToken);

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(
        RefreshTokenReuseDetectedError,
      );
    });

    it('should revoke on the second use straight away when the grace window is zero', async () => {
      const strict = await createHarness({ rotationGraceSeconds: 0 });

      await strict.addMember('alice');

      const login = await strict.service.login('alice', PASSWORD);

      await strict.service.refreshToken(login.refreshToken);

      await expect(strict.service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(
        RefreshTokenReuseDetectedError,
      );

      await strict.dataSource.destroy();
    });

    it('should leave the member’s other sessions alone', async () => {
      await harness.addMember('alice');

      const phone = await harness.service.login('alice', PASSWORD);
      const laptop = await harness.service.login('alice', PASSWORD);

      await harness.service.refreshToken(phone.refreshToken);
      await ageRotation(harness, refreshClaims(phone.refreshToken).sid as string, 11);
      await expect(harness.service.refreshToken(phone.refreshToken)).rejects.toBeInstanceOf(
        RefreshTokenReuseDetectedError,
      );

      await expect(harness.service.refreshToken(laptop.refreshToken)).resolves.toBeDefined();
    });
  });

  describe('logout', () => {
    it('should refuse a refresh with the token that was logged out (KB-415 A)', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);

      expect(await harness.service.revokeSessionByRefreshToken(login.refreshToken)).toBe(true);

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toMatchObject({
        constructor: SessionRevokedError,
        reason: 'logout',
        code: 128,
      });
    });

    it('should log out only the device that asked', async () => {
      await harness.addMember('alice');

      const phone = await harness.service.login('alice', PASSWORD);
      const laptop = await harness.service.login('alice', PASSWORD);

      await harness.service.revokeSessionByRefreshToken(phone.refreshToken);

      await expect(harness.service.refreshToken(phone.refreshToken)).rejects.toBeInstanceOf(SessionRevokedError);
      await expect(harness.service.refreshToken(laptop.refreshToken)).resolves.toBeDefined();
    });

    it('should refuse the pair a refresh returned before the logout', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      // The refresh completed on the server; its response is still on the wire.
      const inFlight = await harness.service.refreshToken(login.refreshToken);

      await harness.service.revokeSessionByRefreshToken(login.refreshToken);

      // The response lands after the logout and the client stores it. It is a
      // dead end: its refresh token belongs to the session that was just ended.
      await expect(harness.service.refreshToken(inFlight.refreshToken)).rejects.toBeInstanceOf(SessionRevokedError);
    });

    it('should refuse a refresh that reaches the server after the logout', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);

      const [, inFlight] = await Promise.all([
        harness.service.revokeSessionByRefreshToken(login.refreshToken),
        harness.service.refreshToken(login.refreshToken).catch((error: unknown) => error),
      ]);

      // Whichever way the race went, nothing it produced can extend the
      // session: it was refused outright, or the pair it got is a dead end.
      if (inFlight instanceof Error) {
        expect(inFlight).toBeInstanceOf(SessionRejectedError);
      } else {
        await expect(
          harness.service.refreshToken((inFlight as { refreshToken: string }).refreshToken),
        ).rejects.toBeInstanceOf(SessionRevokedError);
      }

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(SessionRejectedError);
      expect((await rowOf(harness, refreshClaims(login.refreshToken).sid as string)).revokedAt).toBeInstanceOf(Date);
    });

    it('should not let the previous account’s late refresh outlive a switch to another account', async () => {
      const alice = await harness.addMember('alice');
      const bob = await harness.addMember('bob');

      const aliceLogin = await harness.service.login('alice', PASSWORD);
      const aliceInFlight = await harness.service.refreshToken(aliceLogin.refreshToken);

      await harness.service.revokeSessionByRefreshToken(aliceLogin.refreshToken);

      const bobLogin = await harness.service.login('bob', PASSWORD);

      // Alice's late response overwrites the browser's cookies with her pair.
      // Her access token is still a valid JWT until it expires — the accepted
      // residual window — but it cannot be extended.
      expect(accessClaims(aliceInFlight.accessToken).id).toBe(alice.id);
      await expect(harness.service.refreshToken(aliceInFlight.refreshToken)).rejects.toBeInstanceOf(
        SessionRevokedError,
      );

      await expect(harness.service.refreshToken(aliceLogin.refreshToken)).rejects.toBeInstanceOf(SessionRevokedError);

      // Bob's session is his own and is untouched by any of it.
      const bobRefreshed = await harness.service.refreshToken(bobLogin.refreshToken);

      expect(refreshClaims(bobRefreshed.refreshToken).id).toBe(bob.id);
      expect(refreshClaims(bobRefreshed.refreshToken).sid).toBe(refreshClaims(bobLogin.refreshToken).sid);
    });

    it('should report a second logout as nothing to do and keep the first reason', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      expect(await harness.service.revokeSession(sessionId, 'logout')).toBe(true);
      expect(await harness.service.revokeSession(sessionId, 'admin')).toBe(false);
      expect((await rowOf(harness, sessionId)).revokedReason).toBe('logout');
    });

    it('should still find the session of a refresh token past its own expiry, so it can be logged out', async () => {
      const member = await harness.addMember('alice');
      const session = await harness.sessions.openSession(member);

      const expired = sign(
        { id: member.id, account: member.account, sid: session.sessionId, jti: session.tokenId },
        REFRESH_TOKEN_SECRET,
        { expiresIn: -60 },
      );

      expect((await harness.service.getSessionFromRefreshToken(expired))?.id).toBe(session.sessionId);
      expect(await harness.service.revokeSessionByRefreshToken(expired)).toBe(true);
    });

    it('should not resolve a session from a token it did not sign', async () => {
      const member = await harness.addMember('alice');
      const session = await harness.sessions.openSession(member);

      const forged = sign({ id: member.id, sid: session.sessionId, jti: session.tokenId }, 'someone-elses-secret');

      expect(await harness.service.getSessionFromRefreshToken(forged)).toBeNull();
      expect(await harness.service.revokeSessionByRefreshToken(forged)).toBe(false);
      expect(await harness.service.getSessionFromRefreshToken('not-a-jwt')).toBeNull();
    });
  });

  describe('OidcSsoBridge login from a member-base session', () => {
    const createBridge = (): OidcSsoBridge =>
      new OidcSsoBridge(
        { issuer: 'https://id.example.com' } as MemberBaseOidcProviderOptions,
        harness.service,
        true,
        ACCESS_TOKEN_SECRET,
        60 * 15,
        REFRESH_TOKEN_EXPIRATION,
      );

    it('should accept the access token of an open session', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);

      const claims = await createBridge().readActiveLocalSession({ cookies: { access_token: login.accessToken } });

      expect(claims).toMatchObject({ id: member.id, sid: refreshClaims(login.refreshToken).sid });
    });

    it('should refuse it after logout, though the token itself is still valid', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);

      await harness.service.revokeSessionByRefreshToken(login.refreshToken);

      expect(accessClaims(login.accessToken).sid).toBeDefined();
      expect(await createBridge().readActiveLocalSession({ cookies: { access_token: login.accessToken } })).toBeNull();
    });

    it('should refuse it after a password change even when revoking the session failed', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);

      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      jest.spyOn(harness.sessions, 'revokeAllSessions').mockRejectedValueOnce(new Error('connection terminated'));

      await harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two');

      expect((await rowOf(harness, refreshClaims(login.refreshToken).sid as string)).revokedAt).toBeNull();
      expect(await createBridge().readActiveLocalSession({ cookies: { access_token: login.accessToken } })).toBeNull();
      expect(
        await createBridge().resolveSkippableLogin({ cookies: { access_token: login.accessToken } }, {}),
      ).toBeNull();
    });
  });

  describe('OidcSsoBridge.clearSession', () => {
    const createBridge = (): OidcSsoBridge =>
      new OidcSsoBridge(
        { issuer: 'https://id.example.com' } as MemberBaseOidcProviderOptions,
        harness.service,
        true,
        ACCESS_TOKEN_SECRET,
        60 * 15,
        REFRESH_TOKEN_EXPIRATION,
      );

    /** The revocation clearSession starts is not awaited by it; let it land. */
    const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 25));

    it('should clear the cookies before it returns, exactly as it did when it revoked nothing', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const clearCookie = jest.fn();

      // No await: a caller written before sessions existed does not have one.
      const returned: unknown = createBridge().clearSession({
        clearCookie,
        req: { headers: {}, cookies: { refresh_token: login.refreshToken } },
      });

      expect(returned).toBeUndefined();
      expect(clearCookie.mock.calls.map(([name]) => name)).toEqual(['access_token', 'refresh_token']);

      await settle();

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toMatchObject({
        constructor: SessionRevokedError,
        reason: 'logout',
      });
    });

    it('should revoke from the raw Cookie header when no cookie parser is installed', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);

      createBridge().clearSession({
        clearCookie: jest.fn(),
        req: { headers: { cookie: `theme=dark; refresh_token=${login.refreshToken}; other=1` } },
      });

      await settle();

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toMatchObject({
        constructor: SessionRevokedError,
        reason: 'logout',
      });
    });

    it('should still clear the cookies, and log, when the revocation fails', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const clearCookie = jest.fn();
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      jest.spyOn(harness.sessions, 'revokeSession').mockRejectedValueOnce(new Error('connection terminated'));

      createBridge().clearSession({
        clearCookie,
        req: { headers: {}, cookies: { refresh_token: login.refreshToken } },
      });

      await settle();

      expect(clearCookie.mock.calls.map(([name]) => name)).toEqual(['access_token', 'refresh_token']);
      // Nothing is thrown at a caller that is not waiting; it is logged instead.
      expect(logged).toHaveBeenCalledWith(expect.stringContaining('connection terminated'));
    });

    it('should clear the cookies and revoke nothing when the browser sent no refresh cookie', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const clearCookie = jest.fn();

      createBridge().clearSession({ clearCookie, req: { headers: {} } });

      await settle();

      expect(clearCookie).toHaveBeenCalledTimes(2);
      await expect(harness.service.refreshToken(login.refreshToken)).resolves.toBeDefined();
    });
  });

  describe('ending one of a member\u2019s own sessions', () => {
    it('should end it, and leave the member\u2019s other sessions alone', async () => {
      const member = await harness.addMember('alice');

      const phone = await harness.service.login('alice', PASSWORD);
      const laptop = await harness.service.login('alice', PASSWORD);

      expect(
        await harness.service.revokeMemberSession(member.id, refreshClaims(phone.refreshToken).sid as string),
      ).toBe(true);

      await expect(harness.service.refreshToken(phone.refreshToken)).rejects.toMatchObject({
        constructor: SessionRevokedError,
        reason: 'logout',
      });

      await expect(harness.service.refreshToken(laptop.refreshToken)).resolves.toBeDefined();
    });

    it('should refuse to end another member\u2019s session', async () => {
      await harness.addMember('alice');

      const bob = await harness.addMember('bob');
      const aliceLogin = await harness.service.login('alice', PASSWORD);
      const aliceSessionId = refreshClaims(aliceLogin.refreshToken).sid as string;

      expect(await harness.service.revokeMemberSession(bob.id, aliceSessionId)).toBe(false);
      expect((await rowOf(harness, aliceSessionId)).revokedAt).toBeNull();
      await expect(harness.service.refreshToken(aliceLogin.refreshToken)).resolves.toBeDefined();
    });
  });

  describe('isSessionActive', () => {
    it('should be true for an open session of the member, and false for anyone else', async () => {
      const alice = await harness.addMember('alice');
      const bob = await harness.addMember('bob');
      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      expect(await harness.service.isSessionActive(alice.id, sessionId)).toBe(true);
      expect(await harness.service.isSessionActive(bob.id, sessionId)).toBe(false);

      await harness.service.revokeSession(sessionId, 'logout');

      expect(await harness.service.isSessionActive(alice.id, sessionId)).toBe(false);
    });

    it('should treat a session older than the password as ended, even if revoking it failed', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      jest.spyOn(harness.sessions, 'revokeAllSessions').mockRejectedValueOnce(new Error('connection terminated'));

      await harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two');

      // The row was never revoked...
      expect((await rowOf(harness, sessionId)).revokedAt).toBeNull();
      // ...and still the session no longer counts as open.
      expect(await harness.service.isSessionActive(member.id, sessionId)).toBe(false);
    });

    it('should not be thrown by a database clock ahead of the application', async () => {
      const member = await harness.addMember('alice');

      // What a passwordChangedAt stamped by the database's now() looks like when
      // that clock is a little ahead: later than the session opened just after.
      member.passwordChangedAt = new Date(Date.now() + 5_000);

      const login = await harness.service.login('alice', PASSWORD);

      expect(await harness.service.isSessionActive(member.id, refreshClaims(login.refreshToken).sid as string)).toBe(
        true,
      );
    });

    it('should treat a session opened under the previous password as ended, however late it was opened', async () => {
      const member = await harness.addMember('alice');
      const previous = member.passwordChangedAt;

      await harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two');

      // A login that read the member before the change and wrote its session
      // after it: newer than the change, issued under the old password.
      const late = await harness.sessions.openSession({ id: member.id, passwordChangedAt: previous });

      expect(await harness.service.isSessionActive(member.id, late.sessionId)).toBe(false);
    });

    it('should count a session kept through a password change, and only that one', async () => {
      const member = await harness.addMember('alice');
      const kept = await harness.service.login('alice', PASSWORD);
      const other = await harness.service.login('alice', PASSWORD);
      const keptId = refreshClaims(kept.refreshToken).sid as string;
      const otherId = refreshClaims(other.refreshToken).sid as string;

      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      // The others survive on the table: revoking them fails.
      jest.spyOn(harness.sessions, 'revokeAllSessions').mockRejectedValueOnce(new Error('connection terminated'));

      await harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two', { keepSessionId: keptId });

      expect((await rowOf(harness, otherId)).revokedAt).toBeNull();
      expect(await harness.service.isSessionActive(member.id, keptId)).toBe(true);
      expect(await harness.service.isSessionActive(member.id, otherId)).toBe(false);
    });

    it('should reissue the session a password change kept, and refuse one that merely outlived it', async () => {
      const member = await harness.addMember('alice');
      const kept = await harness.service.login('alice', PASSWORD);
      const leftover = await harness.service.login('alice', PASSWORD);
      const keptId = refreshClaims(kept.refreshToken).sid as string;
      const leftoverId = refreshClaims(leftover.refreshToken).sid as string;

      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      jest.spyOn(harness.sessions, 'revokeAllSessions').mockRejectedValueOnce(new Error('connection terminated'));

      await harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two', { keepSessionId: keptId });

      // Still open on the table, and its access token is still valid — but it
      // was not kept, so it cannot be turned into tokens under the new password.
      await expect(harness.service.reissueSessionTokens(member.id, leftoverId)).rejects.toBeInstanceOf(
        PasswordChangedError,
      );

      expect((await rowOf(harness, leftoverId)).currentTokenId).toBe(refreshClaims(leftover.refreshToken).jti);

      const reissued = await harness.service.reissueSessionTokens(member.id, keptId);

      await expect(harness.service.refreshToken(reissued.refreshToken)).resolves.toBeDefined();
    });

    it('should not keep a session when marking it as kept fails', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      jest.spyOn(harness.sessions, 'adoptPassword').mockRejectedValueOnce(new Error('connection terminated'));

      await expect(
        harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two', { keepSessionId: sessionId }),
      ).resolves.toBeDefined();

      expect(logged).toHaveBeenCalledWith(expect.stringContaining('could not be kept'));
      // Not left looking open: it is revoked with the rest.
      expect((await rowOf(harness, sessionId)).revokedReason).toBe('password_changed');
      expect(await harness.service.isSessionActive(member.id, sessionId)).toBe(false);
      await expect(harness.service.reissueSessionTokens(member.id, sessionId)).rejects.toBeInstanceOf(
        PasswordChangedError,
      );
    });

    it('should not spare a session that could not be marked as kept, without any error', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      // The mark matched no row — the session was revoked a moment earlier, say.
      jest.spyOn(harness.sessions, 'adoptPassword').mockResolvedValueOnce(false);

      await harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two', { keepSessionId: sessionId });

      expect((await rowOf(harness, sessionId)).revokedReason).toBe('password_changed');
    });

    it('should not let a reissue undo a keep that landed while it was running', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      // A reissue has passed its checks; before it writes, the member changes
      // the password and keeps this session.
      jest
        .spyOn(harness.sessions as unknown as ReplaceTokenSpyable, 'replaceToken')
        .mockImplementationOnce(async function (this: ReplaceTokenSpyable, ...args) {
          await harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two', { keepSessionId: sessionId });

          return Reflect.apply(
            Object.getPrototypeOf(harness.sessions).replaceToken as ReplaceTokenSpyable['replaceToken'],
            harness.sessions,
            args,
          );
        });

      await harness.service.reissueSessionTokens(member.id, sessionId);

      // The session is still the one the password change kept.
      expect(await harness.service.isSessionActive(member.id, sessionId)).toBe(true);
    });

    it('should not let keepSessionId adopt another member\u2019s session', async () => {
      const alice = await harness.addMember('alice');
      const bob = await harness.addMember('bob');
      const bobLogin = await harness.service.login('bob', PASSWORD);
      const bobSessionId = refreshClaims(bobLogin.refreshToken).sid as string;
      const before = (await rowOf(harness, bobSessionId)).passwordChangedAt;

      await harness.service.changePassword(alice.id, PASSWORD, 'Passw0rd-two', { keepSessionId: bobSessionId });

      expect((await rowOf(harness, bobSessionId)).passwordChangedAt).toEqual(before);
      expect(await harness.service.isSessionActive(bob.id, bobSessionId)).toBe(true);
    });
  });

  describe('archiving a member', () => {
    it('should end every session, so a later restore brings none of them back', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);

      (harness.memberRepo as unknown as { softRemove: jest.Mock }).softRemove = jest.fn(async () => member);

      await harness.admin.archiveMember(member.id);

      expect((await rowOf(harness, refreshClaims(login.refreshToken).sid as string)).revokedReason).toBe('admin');
    });

    it('should refuse to refresh a session of an archived member, even one that escaped revocation', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);

      jest.spyOn(harness.sessions, 'revokeAllSessions').mockResolvedValue(0);
      (harness.memberRepo as unknown as { softRemove: jest.Mock }).softRemove = jest.fn(async () => {
        harness.removeMember(member.id);

        return member;
      });

      await harness.admin.archiveMember(member.id);

      // The session row is untouched, and still nothing can be done with it.
      expect((await rowOf(harness, refreshClaims(login.refreshToken).sid as string)).revokedAt).toBeNull();
      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(MemberNotFoundError);
      expect(await harness.service.isSessionActive(member.id, refreshClaims(login.refreshToken).sid as string)).toBe(
        false,
      );
    });

    it('should also end a session opened while the member was being archived', async () => {
      const member = await harness.addMember('alice');
      const sessions: string[] = [];

      (harness.memberRepo as unknown as { softRemove: jest.Mock }).softRemove = jest.fn(async () => {
        // A login lands between the first revocation and the archive.
        sessions.push((await harness.sessions.openSession(member)).sessionId);

        return member;
      });

      await harness.admin.archiveMember(member.id);

      expect((await rowOf(harness, sessions[0])).revokedReason).toBe('admin');
    });

    it('should leave the member active when the sessions cannot be ended', async () => {
      const member = await harness.addMember('alice');
      const softRemove = jest.fn(async () => member);

      (harness.memberRepo as unknown as { softRemove: jest.Mock }).softRemove = softRemove;
      jest.spyOn(harness.sessions, 'revokeAllSessions').mockRejectedValueOnce(new Error('connection terminated'));

      await expect(harness.admin.archiveMember(member.id)).rejects.toThrow('connection terminated');
      expect(softRemove).not.toHaveBeenCalled();
    });
  });

  describe('password changes', () => {
    it('should not report a failure to revoke as a failed password change, and still refuse the old tokens', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      jest.spyOn(harness.sessions, 'revokeAllSessions').mockRejectedValueOnce(new Error('connection terminated'));

      await expect(harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two')).resolves.toBeDefined();
      expect(logged).toHaveBeenCalledWith(expect.stringContaining('connection terminated'));
      await expect(harness.service.login('alice', 'Passw0rd-two')).resolves.toBeDefined();

      // The session row is still open, and the token is refused anyway.
      expect((await rowOf(harness, refreshClaims(login.refreshToken).sid as string)).revokedAt).toBeNull();
      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(PasswordChangedError);
    });

    it('should refuse to guess when the driver does not report affected rows', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const original = harness.sessionRepo.createQueryBuilder.bind(harness.sessionRepo);
      const silent = {
        update: (): unknown => silent,
        set: (): unknown => silent,
        where: (): unknown => silent,
        andWhere: (): unknown => silent,
        execute: async (): Promise<unknown> => ({ raw: [], generatedMaps: [] }),
      };

      // Reads pass an alias; the UPDATE does not.
      jest
        .spyOn(harness.sessionRepo, 'createQueryBuilder')
        .mockImplementation(((...args: Parameters<typeof original>) =>
          args[0] ? original(...args) : silent) as unknown as typeof original);

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toThrow(/did not report how many rows/);
    });

    it('should not report a failure to revoke after a reset as an invalid reset token', async () => {
      await harness.addMember('alice');

      const resetToken = await harness.service.getResetPasswordToken('alice');

      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      jest.spyOn(harness.sessions, 'revokeAllSessions').mockRejectedValueOnce(new Error('connection terminated'));

      await expect(harness.service.changePasswordWithToken(resetToken, 'Passw0rd-two')).resolves.toBeDefined();
      // The password did change, so the old one no longer signs in.
      await expect(harness.service.login('alice', PASSWORD)).rejects.toBeDefined();
      await expect(harness.service.login('alice', 'Passw0rd-two')).resolves.toBeDefined();
    });

    it('should revoke every session of the member on changePassword', async () => {
      const member = await harness.addMember('alice');

      await harness.addMember('bob');

      const phone = await harness.service.login('alice', PASSWORD);
      const laptop = await harness.service.login('alice', PASSWORD);
      const bob = await harness.service.login('bob', PASSWORD);

      await harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two');

      for (const pair of [phone, laptop]) {
        await expect(harness.service.refreshToken(pair.refreshToken)).rejects.toMatchObject({
          constructor: SessionRevokedError,
          reason: 'password_changed',
        });
      }

      await expect(harness.service.refreshToken(bob.refreshToken)).resolves.toBeDefined();
    });

    it('should keep the session named by keepSessionId and let it be reissued', async () => {
      const member = await harness.addMember('alice');

      const phone = await harness.service.login('alice', PASSWORD, { domain: 'tenant-a' });
      const laptop = await harness.service.login('alice', PASSWORD);
      const keepSessionId = accessClaims(phone.accessToken).sid as string;

      await harness.service.changePassword(member.id, PASSWORD, 'Passw0rd-two', { keepSessionId });

      await expect(harness.service.refreshToken(laptop.refreshToken)).rejects.toBeInstanceOf(SessionRevokedError);

      // The kept session is open, but the token the phone holds embeds the old
      // passwordChangedAt. It is refused without being consumed or revoked.
      await expect(harness.service.refreshToken(phone.refreshToken)).rejects.toBeInstanceOf(PasswordChangedError);
      expect((await rowOf(harness, keepSessionId)).revokedAt).toBeNull();
      expect((await rowOf(harness, keepSessionId)).currentTokenId).toBe(refreshClaims(phone.refreshToken).jti);

      const reissued = await harness.service.reissueSessionTokens(member.id, keepSessionId);

      expect(refreshClaims(reissued.refreshToken)).toMatchObject({ sid: keepSessionId, domain: 'tenant-a' });
      expect(accessClaims(reissued.accessToken).sid).toBe(keepSessionId);
      await expect(harness.service.refreshToken(reissued.refreshToken)).resolves.toBeDefined();
    });

    it('should refuse to reissue a session for a member it does not belong to', async () => {
      const alice = await harness.addMember('alice');
      const bob = await harness.addMember('bob');

      const aliceLogin = await harness.service.login('alice', PASSWORD);
      const aliceSessionId = refreshClaims(aliceLogin.refreshToken).sid as string;

      // Bob is authenticated and names Alice's session.
      await expect(harness.service.reissueSessionTokens(bob.id, aliceSessionId)).rejects.toBeInstanceOf(
        SessionNotFoundError,
      );

      // Nothing of hers moved, and nothing was signed for her.
      expect((await rowOf(harness, aliceSessionId)).currentTokenId).toBe(refreshClaims(aliceLogin.refreshToken).jti);
      await expect(harness.service.reissueSessionTokens(alice.id, aliceSessionId)).resolves.toBeDefined();
    });

    it('should neither spare nor revoke another member’s session named as keepSessionId', async () => {
      const alice = await harness.addMember('alice');

      await harness.addMember('bob');

      const aliceLogin = await harness.service.login('alice', PASSWORD);
      const bobLogin = await harness.service.login('bob', PASSWORD);

      await harness.service.changePassword(alice.id, PASSWORD, 'Passw0rd-two', {
        keepSessionId: refreshClaims(bobLogin.refreshToken).sid,
      });

      await expect(harness.service.refreshToken(aliceLogin.refreshToken)).rejects.toBeInstanceOf(SessionRevokedError);
      await expect(harness.service.refreshToken(bobLogin.refreshToken)).resolves.toBeDefined();
    });

    it('should not claim a fresh authentication on a reissued pair unless told when it happened', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      const unstated = await harness.service.reissueSessionTokens(member.id, sessionId);

      expect(accessClaims(unstated.accessToken).authTime).toBeUndefined();
      expect(refreshClaims(unstated.refreshToken).authTime).toBeUndefined();
      // And the refresh carries the absence forward rather than inventing one.
      expect(accessClaims((await harness.service.refreshToken(unstated.refreshToken)).accessToken).authTime).toBe(
        undefined,
      );

      const stated = await harness.service.reissueSessionTokens(member.id, sessionId, { authTime: 1_700_000_000 });

      expect(accessClaims(stated.accessToken).authTime).toBe(1_700_000_000);
    });

    it('should call a reissue that races the same device\u2019s refresh a conflict, not a revocation', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      jest.spyOn(harness.sessions as unknown as ReplaceTokenSpyable, 'replaceToken').mockResolvedValueOnce(false);

      await expect(harness.service.reissueSessionTokens(member.id, sessionId)).rejects.toBeInstanceOf(
        SessionRotationConflictError,
      );

      expect((await rowOf(harness, sessionId)).revokedAt).toBeNull();
    });

    it('should report a reissue that races a revocation as the revocation', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      jest
        .spyOn(harness.sessions as unknown as ReplaceTokenSpyable, 'replaceToken')
        .mockImplementationOnce(async () => {
          await harness.sessions.revokeSession(sessionId, 'logout');

          return false;
        });

      await expect(harness.service.reissueSessionTokens(member.id, sessionId)).rejects.toMatchObject({
        constructor: SessionRevokedError,
        reason: 'logout',
      });
    });

    it('should refuse to reissue for a session that is gone or revoked', async () => {
      const member = await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      await harness.service.revokeSession(sessionId, 'logout');

      await expect(harness.service.reissueSessionTokens(member.id, sessionId)).rejects.toBeInstanceOf(
        SessionRevokedError,
      );

      await expect(harness.service.reissueSessionTokens(member.id, randomUUID())).rejects.toBeInstanceOf(
        SessionNotFoundError,
      );
    });

    it('should revoke every session on a reset through the emailed token', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const resetToken = await harness.service.getResetPasswordToken('alice');

      await harness.service.changePasswordWithToken(resetToken, 'Passw0rd-two');

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toMatchObject({
        constructor: SessionRevokedError,
        reason: 'password_changed',
      });
    });

    it('should not report a failure to revoke as a failed administrator reset', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      jest.spyOn(harness.sessions, 'revokeAllSessions').mockRejectedValueOnce(new Error('connection terminated'));

      await expect(harness.admin.resetMemberPassword(member.id, 'Passw0rd-two')).resolves.toBeDefined();
      expect(logged).toHaveBeenCalledWith(expect.stringContaining('connection terminated'));
      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(PasswordChangedError);
    });

    it('should revoke every session when an administrator resets the password', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);

      await harness.admin.resetMemberPassword(member.id, 'Passw0rd-two');

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toMatchObject({
        constructor: SessionRevokedError,
        reason: 'admin',
      });
    });

    it('should revoke all but one through revokeAllSessions and report how many', async () => {
      const member = await harness.addMember('alice');

      const keep = await harness.service.login('alice', PASSWORD);

      await harness.service.login('alice', PASSWORD);
      await harness.service.login('alice', PASSWORD);

      const revoked = await harness.service.revokeAllSessions(member.id, {
        reason: 'admin',
        exceptSessionId: refreshClaims(keep.refreshToken).sid,
      });

      expect(revoked).toBe(2);
      expect(await harness.service.revokeAllSessions(member.id, { reason: 'admin' })).toBe(1);
    });
  });

  describe('refusals a client can tell apart', () => {
    it('should refuse a refresh token from before sessions existed exactly as 0.14 refused a bad one', async () => {
      const member = await harness.addMember('alice');

      // Exactly what 0.14.0 signed: no sid, no jti.
      const legacy = sign(
        { id: member.id, account: member.account, passwordChangedAt: member.passwordChangedAt.getTime() },
        REFRESH_TOKEN_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRATION },
      );

      // Same class, code, status and message as 0.14's answer to any bad token,
      // so a client keyed on any of them signs the user out as it always did.
      const refusal = await harness.service.refreshToken(legacy).catch((error: unknown) => error);

      expect((refusal as object).constructor).toBe(InvalidToken);
      expect(refusal).toMatchObject({ code: 104, message: 'Invalid token' });
      expect((refusal as InvalidToken).getStatus()).toBe(400);
      expect(refusal).not.toBeInstanceOf(SessionRejectedError);
      expect(await harness.sessionRepo.count()).toBe(0);
    });

    it('should refuse a token whose session row has been purged', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);

      await harness.sessionRepo.clear();

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(SessionNotFoundError);
    });

    it('should refuse a token naming another member’s session', async () => {
      const alice = await harness.addMember('alice');
      const bob = await harness.addMember('bob');
      const bobSession = await harness.sessions.openSession(bob);

      const crossed = sign(
        {
          id: alice.id,
          account: alice.account,
          passwordChangedAt: alice.passwordChangedAt.getTime(),
          sid: bobSession.sessionId,
          jti: bobSession.tokenId,
        },
        REFRESH_TOKEN_SECRET,
        { expiresIn: 60 },
      );

      await expect(harness.service.refreshToken(crossed)).rejects.toBeInstanceOf(SessionNotFoundError);
      expect((await rowOf(harness, bobSession.sessionId)).revokedAt).toBeNull();
    });

    it('should refuse an expired session and record why', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const sessionId = refreshClaims(login.refreshToken).sid as string;

      await harness.sessionRepo.update({ id: sessionId }, { expiresAt: new Date(Date.now() - 1000) });

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toMatchObject({
        constructor: SessionExpiredError,
        code: 129,
      });

      expect((await rowOf(harness, sessionId)).revokedReason).toBe('expired');
      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(SessionExpiredError);
    });

    it('should report a token that is not ours, or past its own expiry, as InvalidToken', async () => {
      const member = await harness.addMember('alice');
      const session = await harness.sessions.openSession(member);
      const claims = { id: member.id, account: member.account, sid: session.sessionId, jti: session.tokenId };

      await expect(harness.service.refreshToken('not-a-jwt')).rejects.toBeInstanceOf(InvalidToken);
      await expect(harness.service.refreshToken(sign(claims, 'someone-elses-secret'))).rejects.toBeInstanceOf(
        InvalidToken,
      );

      await expect(
        harness.service.refreshToken(sign(claims, REFRESH_TOKEN_SECRET, { expiresIn: -60 })),
      ).rejects.toBeInstanceOf(InvalidToken);
    });

    it('should refuse without consuming the token when the member is gone', async () => {
      const member = await harness.addMember('alice');
      const login = await harness.service.login('alice', PASSWORD);

      jest.spyOn(harness.memberRepo, 'findOne').mockResolvedValueOnce(null);

      await expect(harness.service.refreshToken(login.refreshToken)).rejects.toBeInstanceOf(MemberNotFoundError);
      expect((await rowOf(harness, refreshClaims(login.refreshToken).sid as string)).currentTokenId).toBe(
        refreshClaims(login.refreshToken).jti,
      );

      expect(member.id).toBe(refreshClaims(login.refreshToken).id);
    });

    it('should let a database failure through as itself, not as a refusal', async () => {
      await harness.addMember('alice');

      const login = await harness.service.login('alice', PASSWORD);
      const outage = new Error('connection terminated unexpectedly');

      jest.spyOn(harness.sessions, 'findSession').mockRejectedValueOnce(outage);

      const failure = await harness.service.refreshToken(login.refreshToken).catch((error: unknown) => error);

      expect(failure).toBe(outage);
      expect(failure).not.toBeInstanceOf(SessionRejectedError);
      expect(failure).not.toBeInstanceOf(InvalidToken);

      // Nothing was decided, so the same token works once the database is back.
      await expect(harness.service.refreshToken(login.refreshToken)).resolves.toBeDefined();
    });

    it('should give each refusal its own class and code, under one base class that is still an InvalidToken', () => {
      const refusals = [
        [new SessionRevokedError('logout'), 128],
        [new SessionExpiredError(), 129],
        [new RefreshTokenReuseDetectedError(), 130],
        [new SessionNotFoundError(), 131],
      ] as const;

      for (const [error, code] of refusals) {
        expect(error).toBeInstanceOf(SessionRejectedError);
        expect(error.code).toBe(code);
        expect(error.getStatus()).toBe(400);
        // Code written against 0.14 catches a refused refresh as InvalidToken.
        expect(error).toBeInstanceOf(InvalidToken);
      }

      expect(new Set(refusals.map(([error]) => error.constructor)).size).toBe(4);
      expect(new InvalidToken()).not.toBeInstanceOf(SessionRejectedError);
    });
  });

  describe('purging', () => {
    it('should delete expired and revoked sessions and keep live ones', async () => {
      const member = await harness.addMember('alice');

      const live = await harness.sessions.openSession(member);
      const expired = await harness.sessions.openSession(member);
      const revoked = await harness.sessions.openSession(member);

      await harness.sessionRepo.update({ id: expired.sessionId }, { expiresAt: new Date(Date.now() - 1000) });
      await harness.sessions.revokeSession(revoked.sessionId, 'logout');
      await harness.sessionRepo.update({ id: revoked.sessionId }, { revokedAt: new Date(Date.now() - 1000) });

      expect(await harness.sessions.purgeExpiredSessions()).toBe(2);
      expect((await harness.sessionRepo.find()).map(row => row.id)).toEqual([live.sessionId]);
    });

    it('should keep sessions that ended after the cut-off', async () => {
      const member = await harness.addMember('alice');
      const revoked = await harness.sessions.openSession(member);

      await harness.sessions.revokeSession(revoked.sessionId, 'logout');

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

      expect(await harness.sessions.purgeExpiredSessions({ before: yesterday })).toBe(0);
      expect(await harness.sessionRepo.count()).toBe(1);
    });
  });
});
