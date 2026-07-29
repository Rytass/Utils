import { hash } from 'argon2';
import { verify as verifyJWT } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { MemberBaseService } from '../src/services/member-base.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { MemberLoginLogEntity } from '../src/models/member-login-log.entity';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import {
  InvalidPasswordError,
  MemberBannedError,
  MemberNotFoundError,
  PasswordExpiredError,
  PasswordShouldUpdatePasswordError,
  PasswordValidationError,
} from '../src/constants/errors/base.error';
import type { AuthTokenPayloadBase } from '../src/typings/auth-token-payload';

/**
 * Characterization tests for MemberBaseService.login().
 *
 * These lock down the *current* observable behaviour (including quirks) so the
 * upcoming extraction of an authenticateMember() helper can be verified as a
 * pure refactor. They deliberately assert on the existing error taxonomy —
 * notably that any non-BadRequestException raised inside the credential block
 * surfaces as PasswordValidationError (a 500), which is easy to lose when the
 * try/catch is moved.
 */

const ACCESS_TOKEN_SECRET = 'access-secret';
const REFRESH_TOKEN_SECRET = 'refresh-secret';
const LOGIN_FAILED_BAN_THRESHOLD = 5;
const CORRECT_PASSWORD = 'CorrectPassw0rd!';
const WRONG_PASSWORD = 'WrongPassw0rd!';

type WhereClause = Partial<Record<keyof BaseMemberEntity, unknown>>;

interface BuildOptions {
  readonly loginFailedAutoUnlockSeconds?: number | null;
  readonly passwordAgeLimitInDays?: number;
  readonly forceRejectLoginOnPasswordExpired?: boolean;
  readonly shouldUpdatePassword?: boolean;
  readonly latestFailedLog?: MemberLoginLogEntity | null;
  readonly onMemberSave?: (member: BaseMemberEntity) => void;
}

interface BuiltService {
  readonly service: MemberBaseService;
  readonly member: BaseMemberEntity;
  readonly memberRepo: Repository<BaseMemberEntity>;
  readonly loginLogRepo: Repository<MemberLoginLogEntity>;
}

// argon2 hashing dominates the runtime of this suite; hash the fixture password
// once and share it across every test.
let cachedPasswordHash: string | null = null;

const getPasswordHash = async (): Promise<string> => {
  if (!cachedPasswordHash) {
    cachedPasswordHash = await hash(CORRECT_PASSWORD);
  }

  return cachedPasswordHash;
};

const matchesWhere = (member: BaseMemberEntity, where: WhereClause): boolean =>
  Object.entries(where).every(([key, value]) => (member as unknown as Record<string, unknown>)[key] === value);

const buildService = async (options: BuildOptions = {}): Promise<BuiltService> => {
  const member = new BaseMemberEntity();

  member.id = '00000000-0000-0000-0000-000000000001';
  member.account = 'member';
  member.password = await getPasswordHash();
  member.passwordChangedAt = new Date('2024-01-01T00:00:00.000Z');
  member.resetPasswordRequestedAt = null;
  member.loginFailedCounter = 0;
  member.shouldUpdatePassword = options.shouldUpdatePassword ?? false;

  const memberRepo = {
    findOne: jest.fn(async ({ where }: { where: WhereClause }) => (matchesWhere(member, where) ? member : null)),
    save: jest.fn(async (entity: BaseMemberEntity) => {
      options.onMemberSave?.(entity);

      return entity;
    }),
  } as unknown as Repository<BaseMemberEntity>;

  const loginLogRepo = {
    findOne: jest.fn(async () => options.latestFailedLog ?? null),
    save: jest.fn(async (entity: Partial<MemberLoginLogEntity>) => entity),
    create: jest.fn((entity: Partial<MemberLoginLogEntity>) => entity),
  } as unknown as Repository<MemberLoginLogEntity>;

  const passwordValidatorService = {
    validatePassword: jest.fn(async () => true),
    shouldUpdatePassword: jest.fn(() => options.shouldUpdatePassword ?? false),
  } as unknown as PasswordValidatorService;

  const customizedJwtPayload = (m: BaseMemberEntity): AuthTokenPayloadBase => ({
    id: m.id,
    account: m.account,
  });

  const service = new MemberBaseService(
    undefined,
    memberRepo,
    loginLogRepo,
    LOGIN_FAILED_BAN_THRESHOLD,
    60 * 60,
    'reset-secret',
    ACCESS_TOKEN_SECRET,
    60 * 15,
    REFRESH_TOKEN_SECRET,
    60 * 60 * 24,
    false,
    { findOne: jest.fn(), save: jest.fn(), create: jest.fn() } as never,
    options.passwordAgeLimitInDays,
    options.forceRejectLoginOnPasswordExpired ?? false,
    passwordValidatorService,
    customizedJwtPayload,
    options.loginFailedAutoUnlockSeconds ?? null,
  );

  return { service, member, memberRepo, loginLogRepo };
};

const decode = (token: string, secret: string): Record<string, unknown> =>
  verifyJWT(token, secret) as Record<string, unknown>;

describe('MemberBaseService.login characterization', () => {
  describe('successful login', () => {
    it('should return a token pair, reset the failure counter and write a success log', async () => {
      const { service, member, loginLogRepo } = await buildService();

      member.loginFailedCounter = 3;

      const tokenPair = await service.login('member', CORRECT_PASSWORD);

      expect(tokenPair.accessToken).toEqual(expect.any(String));
      expect(tokenPair.refreshToken).toEqual(expect.any(String));
      expect(member.loginFailedCounter).toBe(0);
      expect(loginLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: member.id, success: true, ip: null }),
      );
    });

    it('should sign an access token carrying the customized payload', async () => {
      const { service, member } = await buildService();

      const { accessToken } = await service.login('member', CORRECT_PASSWORD);
      const payload = decode(accessToken, ACCESS_TOKEN_SECRET);

      expect(payload.id).toBe(member.id);
      expect(payload.account).toBe(member.account);
    });

    it('should sign a refresh token carrying passwordChangedAt', async () => {
      const { service, member } = await buildService();

      const { refreshToken } = await service.login('member', CORRECT_PASSWORD);
      const payload = decode(refreshToken, REFRESH_TOKEN_SECRET);

      expect(payload.passwordChangedAt).toBe(member.passwordChangedAt.getTime());
    });

    it('should propagate the domain option into both tokens', async () => {
      const { service } = await buildService();

      const { accessToken, refreshToken } = await service.login('member', CORRECT_PASSWORD, { domain: 'tenant-a' });

      expect(decode(accessToken, ACCESS_TOKEN_SECRET).domain).toBe('tenant-a');
      expect(decode(refreshToken, REFRESH_TOKEN_SECRET).domain).toBe('tenant-a');
    });

    it('should omit password age fields when passwordAgeLimitInDays is not configured', async () => {
      const { service } = await buildService();

      const tokenPair = await service.login('member', CORRECT_PASSWORD);

      expect(tokenPair).not.toHaveProperty('shouldUpdatePassword');
      expect(tokenPair).not.toHaveProperty('passwordChangedAt');
    });
  });

  describe('ip logging', () => {
    it('should accept a bare ip string as the third argument and store it as a /32 cidr', async () => {
      const { service, loginLogRepo } = await buildService();

      await service.login('member', CORRECT_PASSWORD, '10.0.0.1');

      expect(loginLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ ip: '10.0.0.1/32', success: true }));
    });

    it('should accept ip through the options object', async () => {
      const { service, loginLogRepo } = await buildService();

      await service.login('member', CORRECT_PASSWORD, { ip: '10.0.0.2' });

      expect(loginLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ ip: '10.0.0.2/32', success: true }));
    });
  });

  describe('rejections', () => {
    it('should throw MemberNotFoundError for an unknown account', async () => {
      const { service } = await buildService();

      await expect(service.login('ghost', CORRECT_PASSWORD)).rejects.toBeInstanceOf(MemberNotFoundError);
    });

    it('should throw InvalidPasswordError, increment the counter and log the failure', async () => {
      const { service, member, loginLogRepo } = await buildService();

      await expect(service.login('member', WRONG_PASSWORD)).rejects.toBeInstanceOf(InvalidPasswordError);

      expect(member.loginFailedCounter).toBe(1);
      expect(loginLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: member.id, success: false, ip: null }),
      );
    });

    it('should throw PasswordShouldUpdatePasswordError when the member must rotate its password', async () => {
      const { service } = await buildService({ shouldUpdatePassword: true });

      await expect(service.login('member', CORRECT_PASSWORD)).rejects.toBeInstanceOf(PasswordShouldUpdatePasswordError);
    });

    it('should throw PasswordExpiredError before verifying the password when rejection is forced', async () => {
      const { service } = await buildService({
        passwordAgeLimitInDays: 90,
        forceRejectLoginOnPasswordExpired: true,
        shouldUpdatePassword: true,
      });

      await expect(service.login('member', CORRECT_PASSWORD)).rejects.toBeInstanceOf(PasswordExpiredError);
    });
  });

  describe('lockout', () => {
    it('should throw MemberBannedError once the threshold is reached without auto unlock', async () => {
      const { service, member } = await buildService();

      member.loginFailedCounter = LOGIN_FAILED_BAN_THRESHOLD;

      await expect(service.login('member', CORRECT_PASSWORD)).rejects.toBeInstanceOf(MemberBannedError);
    });

    it('should keep the member banned while the auto unlock window has not elapsed', async () => {
      const recentFailure = { createdAt: new Date(Date.now() - 10 * 1000) } as MemberLoginLogEntity;
      const { service, member } = await buildService({
        loginFailedAutoUnlockSeconds: 300,
        latestFailedLog: recentFailure,
      });

      member.loginFailedCounter = LOGIN_FAILED_BAN_THRESHOLD;

      await expect(service.login('member', CORRECT_PASSWORD)).rejects.toBeInstanceOf(MemberBannedError);
    });

    it('should allow login once the auto unlock window has elapsed', async () => {
      const oldFailure = { createdAt: new Date(Date.now() - 600 * 1000) } as MemberLoginLogEntity;
      const { service, member } = await buildService({
        loginFailedAutoUnlockSeconds: 300,
        latestFailedLog: oldFailure,
      });

      member.loginFailedCounter = LOGIN_FAILED_BAN_THRESHOLD;

      const tokenPair = await service.login('member', CORRECT_PASSWORD);

      expect(tokenPair.accessToken).toEqual(expect.any(String));
      expect(member.loginFailedCounter).toBe(0);
    });

    it('should stay banned when auto unlock is enabled but no failure log exists', async () => {
      const { service, member } = await buildService({
        loginFailedAutoUnlockSeconds: 300,
        latestFailedLog: null,
      });

      member.loginFailedCounter = LOGIN_FAILED_BAN_THRESHOLD;

      await expect(service.login('member', CORRECT_PASSWORD)).rejects.toBeInstanceOf(MemberBannedError);
    });
  });

  describe('error taxonomy', () => {
    // The credential block wraps everything (including token signing) in a
    // try/catch that rethrows BadRequestException as-is and converts anything
    // else into PasswordValidationError (an InternalServerErrorException).
    // Any refactor must preserve this mapping.
    it('should convert a non-BadRequestException failure into PasswordValidationError', async () => {
      const { service } = await buildService({
        onMemberSave: () => {
          throw new Error('database is on fire');
        },
      });

      await expect(service.login('member', CORRECT_PASSWORD)).rejects.toBeInstanceOf(PasswordValidationError);
    });

    it('should let MemberNotFoundError escape without being converted', async () => {
      const { service } = await buildService();

      await expect(service.login('ghost', CORRECT_PASSWORD)).rejects.toBeInstanceOf(MemberNotFoundError);
    });
  });
});
