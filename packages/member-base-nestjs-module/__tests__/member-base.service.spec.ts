import { hash } from 'argon2';
import { sign } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { MemberBaseService } from '../src/services/member-base.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { MemberBannedError, InvalidToken } from '../src/constants/errors/base.error';
import type { AuthTokenPayloadBase } from '../src/typings/auth-token-payload';

const RESET_PASSWORD_TOKEN_SECRET = 'reset-password-secret';
const LOGIN_FAILED_BAN_THRESHOLD = 5;

type WhereClause = Partial<Record<keyof BaseMemberEntity, unknown>>;

const matchesWhere = (member: BaseMemberEntity, where: WhereClause): boolean =>
  Object.entries(where).every(([key, value]) => {
    const actual = (member as unknown as Record<string, unknown>)[key];

    if (value instanceof Date) {
      return actual instanceof Date && actual.getTime() === value.getTime();
    }

    return actual === value;
  });

// Minimal in-memory member repository so the full reset -> login flow can be
// exercised without a database. findOne matches the exact where clauses the
// service uses (by account, and by id + resetPasswordRequestedAt).
const createMemberRepo = (member: BaseMemberEntity): Repository<BaseMemberEntity> => {
  const repo = {
    findOne: jest.fn(async ({ where }: { where: WhereClause }) => (matchesWhere(member, where) ? member : null)),
    save: jest.fn(async (entity: BaseMemberEntity) => entity),
  };

  return repo as unknown as Repository<BaseMemberEntity>;
};

const createNoopRepo = <T>(): Repository<T> =>
  ({
    findOne: jest.fn(async () => null),
    save: jest.fn(async (entity: T) => entity),
    create: jest.fn((entity: T) => entity),
  }) as unknown as Repository<T>;

const buildService = (
  member: BaseMemberEntity,
): { service: MemberBaseService; memberRepo: Repository<BaseMemberEntity> } => {
  const memberRepo = createMemberRepo(member);

  const passwordValidatorService = {
    validatePassword: jest.fn(async () => true),
    shouldUpdatePassword: jest.fn(() => false),
  } as unknown as PasswordValidatorService;

  const customizedJwtPayload = (m: BaseMemberEntity): AuthTokenPayloadBase => ({
    id: m.id,
    account: m.account,
  });

  const service = new MemberBaseService(
    undefined, // originalProvidedOptions
    memberRepo, // baseMemberRepo
    createNoopRepo(), // memberLoginLogRepo
    LOGIN_FAILED_BAN_THRESHOLD, // loginFailedBanThreshold
    60 * 60, // resetPasswordTokenExpiration
    RESET_PASSWORD_TOKEN_SECRET, // resetPasswordTokenSecret
    'access-secret', // accessTokenSecret
    60 * 15, // accessTokenExpiration
    'refresh-secret', // refreshTokenSecret
    60 * 60 * 24, // refreshTokenExpiration
    false, // onlyResetRefreshTokenExpirationByPassword
    createNoopRepo(), // memberPasswordHistoryRepo
    undefined, // passwordAgeLimitInDays
    false, // forceRejectLoginOnPasswordExpired
    passwordValidatorService,
    customizedJwtPayload,
    null, // loginFailedAutoUnlockSeconds
  );

  return { service, memberRepo };
};

const createBannedMember = async (): Promise<BaseMemberEntity> => {
  const member = new BaseMemberEntity();

  member.id = '00000000-0000-0000-0000-000000000001';
  member.account = 'locked-user';
  member.password = await hash('OldPassw0rd!');
  member.passwordChangedAt = new Date('2020-01-01T00:00:00.000Z');
  member.resetPasswordRequestedAt = null;
  member.loginFailedCounter = LOGIN_FAILED_BAN_THRESHOLD;
  member.shouldUpdatePassword = false;

  return member;
};

describe('MemberBaseService account lockout self-recovery', () => {
  it('should unlock a banned member after a successful password reset via token', async () => {
    const member = await createBannedMember();
    const { service } = buildService(member);

    // Sanity: while banned, even the correct current password is rejected
    // before argon2 verification runs.
    await expect(service.login('locked-user', 'OldPassw0rd!')).rejects.toBeInstanceOf(MemberBannedError);

    // Walk the self-service reset flow end to end.
    const token = await service.getResetPasswordToken('locked-user');

    await service.changePasswordWithToken(token, 'BrandNewPassw0rd!');

    // The reset must clear the login failure lock in the same save.
    expect(member.loginFailedCounter).toBe(0);

    // The member can now log in with the new password.
    const tokenPair = await service.login('locked-user', 'BrandNewPassw0rd!');

    expect(tokenPair.accessToken).toEqual(expect.any(String));
    expect(tokenPair.refreshToken).toEqual(expect.any(String));
  });

  it('should reject an invalid token with InvalidToken and keep the failure counter untouched', async () => {
    const member = await createBannedMember();
    const { service } = buildService(member);

    const forgedToken = sign({ id: member.id, requestedOn: Date.now() }, 'wrong-secret', { expiresIn: 60 * 60 });

    await expect(service.changePasswordWithToken(forgedToken, 'BrandNewPassw0rd!')).rejects.toBeInstanceOf(
      InvalidToken,
    );

    expect(member.loginFailedCounter).toBe(LOGIN_FAILED_BAN_THRESHOLD);
  });

  it('should reject an expired token with InvalidToken and keep the failure counter untouched', async () => {
    const member = await createBannedMember();
    const { service } = buildService(member);

    const expiredToken = sign({ id: member.id, requestedOn: Date.now() }, RESET_PASSWORD_TOKEN_SECRET, {
      expiresIn: -10,
    });

    await expect(service.changePasswordWithToken(expiredToken, 'BrandNewPassw0rd!')).rejects.toBeInstanceOf(
      InvalidToken,
    );

    expect(member.loginFailedCounter).toBe(LOGIN_FAILED_BAN_THRESHOLD);
  });

  it('should reject a reused token with InvalidToken and not reset the counter again', async () => {
    const member = await createBannedMember();
    const { service } = buildService(member);

    const token = await service.getResetPasswordToken('locked-user');

    await service.changePasswordWithToken(token, 'BrandNewPassw0rd!');
    expect(member.loginFailedCounter).toBe(0);

    // Simulate the member getting locked again, then replaying the used token.
    member.loginFailedCounter = LOGIN_FAILED_BAN_THRESHOLD;

    await expect(service.changePasswordWithToken(token, 'AnotherPassw0rd!')).rejects.toBeInstanceOf(InvalidToken);

    expect(member.loginFailedCounter).toBe(LOGIN_FAILED_BAN_THRESHOLD);
  });
});
