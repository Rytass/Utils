import { hash } from 'argon2';
import { verify as verifyJWT } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { MemberBaseService } from '../src/services/member-base.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { MemberLoginLogEntity } from '../src/models/member-login-log.entity';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { InvalidPasswordError, MemberBannedError, MemberNotFoundError } from '../src/constants/errors/base.error';
import type { AuthTokenPayloadBase } from '../src/typings/auth-token-payload';

/**
 * Covers the Phase 1 additions: verifyCredentials / findById / findByAccount
 * and the authTime claim that has to survive a refresh.
 */

const ACCESS_TOKEN_SECRET = 'access-secret';
const REFRESH_TOKEN_SECRET = 'refresh-secret';
const LOGIN_FAILED_BAN_THRESHOLD = 5;
const CORRECT_PASSWORD = 'CorrectPassw0rd!';

type WhereClause = Partial<Record<keyof BaseMemberEntity, unknown>>;

interface Harness {
  readonly service: MemberBaseService;
  readonly member: BaseMemberEntity;
  readonly loginLogRepo: { save: jest.Mock; findOne: jest.Mock };
}

let cachedPasswordHash: string | null = null;

const getPasswordHash = async (): Promise<string> => {
  if (!cachedPasswordHash) {
    cachedPasswordHash = await hash(CORRECT_PASSWORD);
  }

  return cachedPasswordHash;
};

const matchesWhere = (member: BaseMemberEntity, where: WhereClause): boolean =>
  Object.entries(where).every(([key, value]) => (member as unknown as Record<string, unknown>)[key] === value);

const buildHarness = async (): Promise<Harness> => {
  const member = new BaseMemberEntity();

  member.id = '00000000-0000-0000-0000-000000000001';
  member.account = 'member';
  member.password = await getPasswordHash();
  member.passwordChangedAt = new Date('2024-01-01T00:00:00.000Z');
  member.resetPasswordRequestedAt = null;
  member.loginFailedCounter = 0;
  member.shouldUpdatePassword = false;

  const memberRepo = {
    findOne: jest.fn(async ({ where }: { where: WhereClause }) => (matchesWhere(member, where) ? member : null)),
    save: jest.fn(async (entity: BaseMemberEntity) => entity),
  } as unknown as Repository<BaseMemberEntity>;

  const loginLogRepo = {
    findOne: jest.fn(async () => null),
    save: jest.fn(async (entity: unknown) => entity),
    create: jest.fn((entity: unknown) => entity),
  };

  const passwordValidatorService = {
    validatePassword: jest.fn(async () => true),
    shouldUpdatePassword: jest.fn(() => false),
  } as unknown as PasswordValidatorService;

  const customizedJwtPayload = (m: BaseMemberEntity): AuthTokenPayloadBase => ({
    id: m.id,
    account: m.account,
  });

  const service = new MemberBaseService(
    undefined,
    memberRepo,
    loginLogRepo as unknown as Repository<MemberLoginLogEntity>,
    LOGIN_FAILED_BAN_THRESHOLD,
    60 * 60,
    'reset-secret',
    ACCESS_TOKEN_SECRET,
    60 * 15,
    REFRESH_TOKEN_SECRET,
    60 * 60 * 24,
    false,
    loginLogRepo as never,
    undefined,
    false,
    passwordValidatorService,
    customizedJwtPayload,
    null,
  );

  return { service, member, loginLogRepo };
};

const decode = (token: string, secret: string): Record<string, unknown> =>
  verifyJWT(token, secret) as Record<string, unknown>;

describe('MemberBaseService.verifyCredentials', () => {
  it('should return the member without issuing tokens', async () => {
    const { service, member } = await buildHarness();

    const result = await service.verifyCredentials('member', CORRECT_PASSWORD);

    expect(result.id).toBe(member.id);
    expect(result).not.toHaveProperty('accessToken');
  });

  it('should reset the failure counter and write a success log like login does', async () => {
    const { service, member, loginLogRepo } = await buildHarness();

    member.loginFailedCounter = 3;

    await service.verifyCredentials('member', CORRECT_PASSWORD, { ip: '10.0.0.9' });

    expect(member.loginFailedCounter).toBe(0);
    expect(loginLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: member.id, success: true, ip: '10.0.0.9/32' }),
    );
  });

  it('should increment the failure counter and throw InvalidPasswordError on a wrong password', async () => {
    const { service, member, loginLogRepo } = await buildHarness();

    await expect(service.verifyCredentials('member', 'Nope!')).rejects.toBeInstanceOf(InvalidPasswordError);

    expect(member.loginFailedCounter).toBe(1);
    expect(loginLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('should honour the ban threshold', async () => {
    const { service, member } = await buildHarness();

    member.loginFailedCounter = LOGIN_FAILED_BAN_THRESHOLD;

    await expect(service.verifyCredentials('member', CORRECT_PASSWORD)).rejects.toBeInstanceOf(MemberBannedError);
  });

  it('should throw MemberNotFoundError for an unknown account', async () => {
    const { service } = await buildHarness();

    await expect(service.verifyCredentials('ghost', CORRECT_PASSWORD)).rejects.toBeInstanceOf(MemberNotFoundError);
  });
});

describe('MemberBaseService lookups', () => {
  it('should find a member by id', async () => {
    const { service, member } = await buildHarness();

    await expect(service.findById(member.id)).resolves.toMatchObject({ id: member.id });
  });

  it('should find a member by account', async () => {
    const { service, member } = await buildHarness();

    await expect(service.findByAccount('member')).resolves.toMatchObject({ account: member.account });
  });

  it('should resolve null when nothing matches', async () => {
    const { service } = await buildHarness();

    await expect(service.findById('ffffffff-ffff-ffff-ffff-ffffffffffff')).resolves.toBeNull();
    await expect(service.findByAccount('ghost')).resolves.toBeNull();
  });
});

describe('authTime claim', () => {
  it('should stamp both tokens with the current time on login', async () => {
    const { service } = await buildHarness();

    const before = Math.floor(Date.now() / 1000);
    const { accessToken, refreshToken } = await service.login('member', CORRECT_PASSWORD);
    const after = Math.floor(Date.now() / 1000);

    const accessAuthTime = decode(accessToken, ACCESS_TOKEN_SECRET).authTime as number;
    const refreshAuthTime = decode(refreshToken, REFRESH_TOKEN_SECRET).authTime as number;

    expect(accessAuthTime).toBeGreaterThanOrEqual(before);
    expect(accessAuthTime).toBeLessThanOrEqual(after);
    expect(refreshAuthTime).toBeGreaterThanOrEqual(before);
  });

  it('should accept an explicit authTime when signing', async () => {
    const { service, member } = await buildHarness();

    const token = service.signAccessToken(member, undefined, { authTime: 1_700_000_000 });

    expect(decode(token, ACCESS_TOKEN_SECRET).authTime).toBe(1_700_000_000);
  });

  // The whole point of the claim: a refresh must not make an old session look
  // freshly authenticated, otherwise max_age / prompt=login can never bite.
  it('should carry the original authTime through a refresh instead of restamping it', async () => {
    const { service, member } = await buildHarness();

    const originalAuthTime = 1_700_000_000;
    const refreshToken = service.signRefreshToken(member, undefined, { authTime: originalAuthTime });

    const pair = await service.refreshToken(refreshToken);

    expect(decode(pair.accessToken, ACCESS_TOKEN_SECRET).authTime).toBe(originalAuthTime);
    expect(decode(pair.refreshToken, REFRESH_TOKEN_SECRET).authTime).toBe(originalAuthTime);
  });

  it('should leave authTime undefined when refreshing a legacy token that has none', async () => {
    const { service, member } = await buildHarness();

    // Legacy refresh tokens issued before this release carry no authTime; the
    // refresh must not invent one, so downstream max_age checks fail closed.
    const legacyToken = (await import('jsonwebtoken')).sign(
      {
        id: member.id,
        account: member.account,
        passwordChangedAt: member.passwordChangedAt.getTime(),
      },
      REFRESH_TOKEN_SECRET,
      { expiresIn: 3600 },
    );

    const pair = await service.refreshToken(legacyToken);

    expect(decode(pair.accessToken, ACCESS_TOKEN_SECRET).authTime).toBeUndefined();
  });
});
