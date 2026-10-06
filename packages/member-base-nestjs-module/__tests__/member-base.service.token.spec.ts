import { randomUUID } from 'node:crypto';
import { sign, verify as verifyJWT } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { MemberBaseService } from '../src/services/member-base.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { MemberLoginLogEntity } from '../src/models/member-login-log.entity';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { InvalidToken, MemberNotFoundError, PasswordChangedError } from '../src/constants/errors/base.error';
import type { AuthTokenPayloadBase } from '../src/typings/auth-token-payload';
import { asSessionService, createFakeSessionService, type FakeSessionService } from './__utils__/fake-session-service';
import { withPrimaryReads } from './__utils__/with-primary-reads';

/**
 * Characterization tests for token signing and the refresh flow.
 *
 * Phase 1 adds an authTime claim; these tests pin down the current payload
 * shape and the refresh semantics (notably that refreshToken() re-signs from
 * the member entity, so any claim not carried over explicitly is regenerated).
 */

const ACCESS_TOKEN_SECRET = 'access-secret';
const REFRESH_TOKEN_SECRET = 'refresh-secret';

type WhereClause = Partial<Record<keyof BaseMemberEntity, unknown>>;

interface BuiltService {
  readonly service: MemberBaseService;
  readonly member: BaseMemberEntity;
  readonly sessions: FakeSessionService;
}

const matchesWhere = (member: BaseMemberEntity, where: WhereClause): boolean =>
  Object.entries(where).every(([key, value]) => (member as unknown as Record<string, unknown>)[key] === value);

const buildService = (overrides?: { accessTokenExpiration?: unknown }): BuiltService => {
  const member = new BaseMemberEntity();

  member.id = '00000000-0000-0000-0000-000000000001';
  member.account = 'member';
  member.password = 'irrelevant';
  member.passwordChangedAt = new Date('2024-01-01T00:00:00.000Z');
  member.resetPasswordRequestedAt = null;
  member.loginFailedCounter = 0;
  member.shouldUpdatePassword = false;

  const memberRepo = {
    findOne: jest.fn(async ({ where }: { where: WhereClause }) => (matchesWhere(member, where) ? member : null)),
    save: jest.fn(async (entity: BaseMemberEntity) => entity),
  } as unknown as Repository<BaseMemberEntity>;

  withPrimaryReads(memberRepo);

  const noopRepo = {
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

  const sessions = createFakeSessionService();

  const service = new MemberBaseService(
    undefined,
    memberRepo,
    noopRepo as unknown as Repository<MemberLoginLogEntity>,
    5,
    60 * 60,
    'reset-secret',
    ACCESS_TOKEN_SECRET,
    (overrides?.accessTokenExpiration ?? 60 * 15) as number,
    REFRESH_TOKEN_SECRET,
    60 * 60 * 24,
    false,
    noopRepo as never,
    undefined,
    false,
    passwordValidatorService,
    customizedJwtPayload,
    null,
    {},
    true,
    true,
    asSessionService(sessions),
  );

  return { service, member, sessions };
};

const decode = (token: string, secret: string): Record<string, unknown> =>
  verifyJWT(token, secret) as Record<string, unknown>;

describe('MemberBaseService token signing characterization', () => {
  it('should sign an access token from the customized payload without passwordChangedAt', () => {
    const { service, member } = buildService();

    const payload = decode(service.signAccessToken(member), ACCESS_TOKEN_SECRET);

    expect(payload.id).toBe(member.id);
    expect(payload.account).toBe(member.account);
    expect(payload).not.toHaveProperty('passwordChangedAt');
    expect(payload).not.toHaveProperty('sid');
    expect(payload.exp).toEqual(expect.any(Number));
  });

  it('should sign a refresh token including passwordChangedAt', () => {
    const { service, member } = buildService();

    const payload = decode(service.signRefreshToken(member), REFRESH_TOKEN_SECRET);

    expect(payload.passwordChangedAt).toBe(member.passwordChangedAt.getTime());
    expect(payload.sid).toEqual(expect.any(String));
    expect(payload.jti).toEqual(expect.any(String));
  });

  it('should bind a refresh token to a session through sid and jti', () => {
    const { service, member, sessions } = buildService();

    const payload = decode(service.signRefreshToken(member, 'tenant-a'), REFRESH_TOKEN_SECRET);
    const opened = sessions.openSessionDetached.mock.results[0].value as { sessionId: string; tokenId: string };

    expect(sessions.openSessionDetached).toHaveBeenCalledTimes(1);
    expect(sessions.openSessionDetached).toHaveBeenCalledWith(member, { domain: 'tenant-a' });
    expect(payload.sid).toBe(opened.sessionId);
    expect(payload.jti).toBe(opened.tokenId);
  });

  it('should sign for an existing session instead of opening one when a session is supplied', () => {
    const { service, member, sessions } = buildService();
    const session = { sessionId: randomUUID(), tokenId: randomUUID() };

    const refreshPayload = decode(service.signRefreshToken(member, undefined, { session }), REFRESH_TOKEN_SECRET);
    const accessPayload = decode(service.signAccessToken(member, undefined, { session }), ACCESS_TOKEN_SECRET);

    expect(sessions.openSessionDetached).not.toHaveBeenCalled();
    expect(refreshPayload.sid).toBe(session.sessionId);
    expect(refreshPayload.jti).toBe(session.tokenId);
    expect(accessPayload.sid).toBe(session.sessionId);
    expect(accessPayload).not.toHaveProperty('jti');
  });

  it('should emit a null passwordChangedAt when the member has none', () => {
    const { service, member } = buildService();

    (member as { passwordChangedAt: Date | null }).passwordChangedAt = null;

    const payload = decode(service.signRefreshToken(member), REFRESH_TOKEN_SECRET);

    expect(payload.passwordChangedAt).toBeNull();
    expect(payload.sid).toEqual(expect.any(String));
    expect(payload.jti).toEqual(expect.any(String));
  });

  it('should include the domain claim only when a domain is supplied', () => {
    const { service, member } = buildService();

    expect(decode(service.signAccessToken(member), ACCESS_TOKEN_SECRET)).not.toHaveProperty('domain');
    expect(decode(service.signAccessToken(member, 'tenant-a'), ACCESS_TOKEN_SECRET).domain).toBe('tenant-a');
  });

  it('should reject a non numeric expiration with BadRequestException', () => {
    const { service, member } = buildService({ accessTokenExpiration: 'fifteen-minutes' });

    expect(() => service.signAccessToken(member)).toThrow(BadRequestException);
  });
});

describe('MemberBaseService.refreshToken characterization', () => {
  it('should issue a fresh token pair for a valid refresh token', async () => {
    const { service, member, sessions } = buildService();

    const refreshToken = service.signRefreshToken(member);
    const presented = decode(refreshToken, REFRESH_TOKEN_SECRET);
    const pair = await service.refreshToken(refreshToken);

    const access = decode(pair.accessToken, ACCESS_TOKEN_SECRET);
    const refreshed = decode(pair.refreshToken, REFRESH_TOKEN_SECRET);

    expect(access.id).toBe(member.id);
    expect(refreshed.id).toBe(member.id);

    // The pair stays on the session the presented token named, with a new
    // token id, and the refresh opens no session of its own.
    expect(sessions.rotate).toHaveBeenCalledTimes(1);
    expect(sessions.rotate).toHaveBeenCalledWith(
      { sessionId: presented.sid, tokenId: presented.jti },
      member.id,
      expect.any(Function),
    );

    expect(access.sid).toBe(presented.sid);
    expect(refreshed.sid).toBe(presented.sid);
    expect(refreshed.jti).toEqual(expect.any(String));
    expect(refreshed.jti).not.toBe(presented.jti);
    expect(sessions.openSessionDetached).toHaveBeenCalledTimes(1);
    expect(sessions.openSession).not.toHaveBeenCalled();
  });

  it('should carry the domain claim from the incoming refresh token', async () => {
    const { service, member } = buildService();

    const refreshToken = service.signRefreshToken(member, 'tenant-a');
    const pair = await service.refreshToken(refreshToken);

    expect(decode(pair.accessToken, ACCESS_TOKEN_SECRET).domain).toBe('tenant-a');
  });

  it('should let an explicit domain option win over the token claim', async () => {
    const { service, member } = buildService();

    const refreshToken = service.signRefreshToken(member, 'tenant-a');
    const pair = await service.refreshToken(refreshToken, { domain: 'tenant-b' });

    expect(decode(pair.accessToken, ACCESS_TOKEN_SECRET).domain).toBe('tenant-b');
  });

  it('should throw PasswordChangedError when passwordChangedAt no longer matches', async () => {
    const { service, member } = buildService();

    const refreshToken = service.signRefreshToken(member);

    member.passwordChangedAt = new Date('2025-06-01T00:00:00.000Z');

    await expect(service.refreshToken(refreshToken)).rejects.toBeInstanceOf(PasswordChangedError);
  });

  it('should throw MemberNotFoundError when the member no longer exists', async () => {
    const { service, member } = buildService();

    const refreshToken = sign(
      {
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        account: member.account,
        passwordChangedAt: null,
        sid: randomUUID(),
        jti: randomUUID(),
      },
      REFRESH_TOKEN_SECRET,
      { expiresIn: 3600 },
    );

    await expect(service.refreshToken(refreshToken)).rejects.toBeInstanceOf(MemberNotFoundError);
  });

  it('should throw InvalidToken for a token signed with the wrong secret', async () => {
    const { service, member } = buildService();

    const forged = sign({ id: member.id, account: member.account, passwordChangedAt: null }, 'wrong-secret', {
      expiresIn: 3600,
    });

    await expect(service.refreshToken(forged)).rejects.toBeInstanceOf(InvalidToken);
  });

  it('should throw InvalidToken for an expired refresh token', async () => {
    const { service, member } = buildService();

    const expired = sign(
      { id: member.id, account: member.account, passwordChangedAt: member.passwordChangedAt.getTime() },
      REFRESH_TOKEN_SECRET,
      { expiresIn: -10 },
    );

    await expect(service.refreshToken(expired)).rejects.toBeInstanceOf(InvalidToken);
  });
});
