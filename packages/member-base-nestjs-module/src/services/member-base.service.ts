import { BadRequestException, Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DeepPartial, FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import { hash, verify } from 'argon2';
import { BaseMemberEntity } from '../models/base-member.entity';
import {
  ACCESS_TOKEN_EXPIRATION,
  ACCESS_TOKEN_SECRET,
  CUSTOMIZED_JWT_PAYLOAD,
  FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED,
  LOGIN_FAILED_AUTO_UNLOCK_SECONDS,
  LOGIN_FAILED_BAN_THRESHOLD,
  LOGIN_LOG_ENABLED,
  LOGIN_LOG_RECORD_IP,
  MEMBER_BASE_MODULE_OPTIONS,
  PASSWORD_HASH_OPTIONS,
  ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD,
  PASSWORD_AGE_LIMIT_IN_DAYS,
  REFRESH_TOKEN_EXPIRATION,
  REFRESH_TOKEN_SECRET,
  RESET_PASSWORD_TOKEN_EXPIRATION,
  RESET_PASSWORD_TOKEN_SECRET,
  RESOLVED_MEMBER_REPO,
} from '../typings/member-base.tokens';
import jwt from 'jsonwebtoken';
import type { AuthTokenPayloadBase } from '../typings/auth-token-payload';
import type { SignTokenOptions } from '../typings/sign-token-options';
import { currentEpochSeconds } from '../utils/current-epoch-seconds';
import { toStorableCidr } from '../utils/to-inet-cidr';
import type { PasswordHashOptions } from '../typings/password-hash-options';
import { MemberLoginLogEntity, MemberLoginLogRepo } from '../models/member-login-log.entity';
import { TokenPairDto } from '../dto/token-pair.dto';
import { MemberBaseModuleOptionsDTO } from '../typings/member-base-module-options.dto';
import { PasswordValidatorService } from './password-validator.service';
import { MemberSessionService, type RevokeAllSessionsOptions } from './member-session.service';
import type { MemberSessionEntity, MemberSessionRevokedReason } from '../models/member-session.entity';
import type { SessionContext } from '../typings/session-tracking-options';
import { MemberPasswordHistoryEntity, MemberPasswordHistoryRepo } from '../models/member-password-history.entity';
import {
  InvalidPasswordError,
  InvalidToken,
  MemberAlreadyExistedError,
  MemberBannedError,
  MemberNotFoundError,
  PasswordChangedError,
  PasswordDoesNotMeetPolicyError,
  PasswordExpiredError,
  PasswordShouldUpdatePasswordError,
  PasswordValidationError,
  SessionNotFoundError,
} from '../constants/errors/base.error';

/**
 * Resolve the authTime claim fragment for a token payload.
 *
 * Omitted options mean "authenticating right now"; an explicit null means the
 * authentication time is unknown (a refresh of a token issued before the claim
 * existed) and the claim must stay absent rather than be invented.
 */
/** A timestamp column as epoch milliseconds, or null; tolerant of string-typed parsers. */
const epochMsOrNull = (value: Date | string | null | undefined): number | null =>
  value === null || value === undefined ? null : new Date(value).getTime();

const resolveAuthTimeClaim = (options?: SignTokenOptions): { authTime?: number } =>
  options?.authTime === null ? {} : { authTime: options?.authTime ?? currentEpochSeconds() };

export interface IssueTokenPairOptions extends SessionContext {
  /** See `SignTokenOptions.authTime`. */
  authTime?: number | null;
}

export interface ReissueSessionTokensOptions {
  /** Casbin domain for the new pair. default: the one the session was opened with. */
  domain?: string;
  /**
   * `authTime` to stamp on the new pair.
   *
   * default: none — the claim is left off, so anything that depends on a known
   * authentication time fails closed. Pass the moment the member actually
   * authenticated, when you know it: the instant they confirmed their old
   * password, for instance.
   *
   * Every later refresh carries this value forward, so leaving it off is not
   * a one-off: until the member signs in again, nothing that requires a known
   * authentication time (`max_age`, step-up checks) will accept this device.
   */
  authTime?: number | null;
}

export interface ChangePasswordOptions {
  /**
   * The session the member is changing the password from. Every other session
   * is revoked; this one is marked as belonging to the new password and left
   * open, so it stays active.
   *
   * The refresh token that device holds still stops refreshing — it embeds the
   * old `passwordChangedAt` — so follow up, in the same request, with
   * `reissueSessionTokens(id, keepSessionId)` and hand the client the new pair.
   * If the session could not be marked it is not spared — it goes with the
   * others — and that call fails with a refusal: the password has changed, and
   * the device signs in again.
   *
   * Only this member's own open sessions can be kept: any other id spares
   * nothing, and revokes nothing of anyone else's.
   */
  keepSessionId?: string;
}

interface RefreshTokenClaims {
  id: string;
  account: string;
  passwordChangedAt: number | null;
  exp: number;
  domain?: string;
  authTime?: number;
  sid?: string;
  jti?: string;
}

@Injectable()
export class MemberBaseService<
  MemberEntity extends BaseMemberEntity = BaseMemberEntity,
> implements OnApplicationBootstrap {
  constructor(
    @Inject(MEMBER_BASE_MODULE_OPTIONS)
    private readonly originalProvidedOptions: MemberBaseModuleOptionsDTO | undefined,
    @Inject(RESOLVED_MEMBER_REPO)
    private readonly baseMemberRepo: Repository<BaseMemberEntity>,
    @Inject(MemberLoginLogRepo)
    private readonly memberLoginLogRepo: Repository<MemberLoginLogEntity>,
    @Inject(LOGIN_FAILED_BAN_THRESHOLD)
    private readonly loginFailedBanThreshold: number,
    @Inject(RESET_PASSWORD_TOKEN_EXPIRATION)
    private readonly resetPasswordTokenExpiration: number,
    @Inject(RESET_PASSWORD_TOKEN_SECRET)
    private readonly resetPasswordTokenSecret: string,
    @Inject(ACCESS_TOKEN_SECRET)
    private readonly accessTokenSecret: string,
    @Inject(ACCESS_TOKEN_EXPIRATION)
    private readonly accessTokenExpiration: number,
    @Inject(REFRESH_TOKEN_SECRET)
    private readonly refreshTokenSecret: string,
    @Inject(REFRESH_TOKEN_EXPIRATION)
    private readonly refreshTokenExpiration: number,
    @Inject(ONLY_RESET_REFRESH_TOKEN_EXPIRATION_BY_PASSWORD)
    private readonly onlyResetRefreshTokenExpirationByPassword: boolean,
    @Inject(MemberPasswordHistoryRepo)
    private readonly memberPasswordHistoryRepo: Repository<MemberPasswordHistoryEntity>,
    @Inject(PASSWORD_AGE_LIMIT_IN_DAYS)
    private readonly passwordAgeLimitInDays: number | undefined,
    @Inject(FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED)
    private readonly forceRejectLoginOnPasswordExpired: boolean,
    @Inject(PasswordValidatorService)
    private readonly passwordValidatorService: PasswordValidatorService,
    @Inject(CUSTOMIZED_JWT_PAYLOAD)
    private readonly customizedJwtPayload: (member: MemberEntity) => AuthTokenPayloadBase,
    @Inject(LOGIN_FAILED_AUTO_UNLOCK_SECONDS)
    private readonly loginFailedAutoUnlockSeconds: number | null,
    @Inject(PASSWORD_HASH_OPTIONS)
    private readonly passwordHashOptions: PasswordHashOptions,
    @Inject(LOGIN_LOG_ENABLED)
    private readonly loginLogEnabled: boolean,
    @Inject(LOGIN_LOG_RECORD_IP)
    private readonly loginLogRecordIp: boolean,
    @Inject(MemberSessionService)
    private readonly memberSessionService: MemberSessionService,
  ) {}

  private readonly logger = new Logger(MemberBaseService.name);

  /**
   * Deliberately not awaited: an attempt is recorded alongside the login, not
   * as a step the caller waits on. Its failure is therefore logged here — left
   * unhandled, a rejected write would take the whole process down.
   */
  private recordLoginAttempt(memberId: string, success: boolean, ip?: string): void {
    if (!this.loginLogEnabled) return;

    Promise.resolve(
      this.memberLoginLogRepo.save({
        memberId,
        success,
        ip: this.loginLogRecordIp ? toStorableCidr(ip) : null,
      }),
    ).catch((error: unknown) => {
      this.logger.error(
        `Failed to record a login attempt of member ${memberId}: ${error instanceof Error ? error.message : error}`,
      );
    });
  }

  /**
   * Read a member from the primary.
   *
   * For the reads that are compared with a write made a moment earlier — the
   * `passwordChangedAt` a refresh checks, the one a reissue signs into its
   * token. With TypeORM replication a plain read goes to a replica, and one
   * that is a second behind would sign a token carrying the old value, which
   * the next refresh then refuses.
   */
  private async findMemberOnPrimary(where: FindOptionsWhere<BaseMemberEntity>): Promise<BaseMemberEntity | null> {
    const runner = this.baseMemberRepo.manager.connection.createQueryRunner('master');

    try {
      return await runner.manager.findOne(this.baseMemberRepo.target, { where });
    } finally {
      await runner.release();
    }
  }

  onApplicationBootstrap(): void {
    if (!this.originalProvidedOptions?.accessTokenSecret || !this.originalProvidedOptions?.refreshTokenSecret) {
      this.logger.warn('No access token secret or refresh token secret provided, using random secret');
    }

    // Auto-unlock reads the timestamp of the last failed attempt out of the
    // login log, so turning the log off silently disables it. Say so rather
    // than leave an account locked until someone works out why.
    if (!this.loginLogEnabled && this.loginFailedAutoUnlockSeconds) {
      this.logger.warn(
        'loginFailedAutoUnlockSeconds is set but loginLogEnabled is false; auto unlock reads the last failed ' +
          'attempt from member_login_logs and cannot work without it. A banned account will stay banned until ' +
          'its loginFailedCounter is reset.',
      );
    }
  }

  /**
   * Sign a refresh token bound to a session.
   *
   * Pass `options.session` to bind it to one that already exists. Without it a
   * session is opened for the token — and because this method is synchronous,
   * that insert is not awaited: a failure is logged, and surfaces only when the
   * token is refused at its first refresh. `issueTokenPair` awaits the insert
   * and puts the same `sid` on the access token; prefer it.
   */
  signRefreshToken(member: MemberEntity, domain?: string, options?: SignTokenOptions): string {
    const session =
      options?.session ?? this.memberSessionService.openSessionDetached(member, { ...options?.sessionContext, domain });

    return jwt.sign(
      {
        ...this.customizedJwtPayload(member),
        passwordChangedAt: epochMsOrNull(member.passwordChangedAt),
        ...resolveAuthTimeClaim(options),
        ...(domain ? { domain } : {}),
        sid: session.sessionId,
        jti: session.tokenId,
      },
      this.refreshTokenSecret,
      {
        expiresIn: this.validateExpiration(this.refreshTokenExpiration, 'REFRESH_TOKEN_EXPIRATION'),
      },
    );
  }

  signAccessToken(member: MemberEntity, domain?: string, options?: SignTokenOptions): string {
    return jwt.sign(
      {
        ...this.customizedJwtPayload(member),
        ...resolveAuthTimeClaim(options),
        ...(domain ? { domain } : {}),
        ...(options?.session ? { sid: options.session.sessionId } : {}),
      },
      this.accessTokenSecret,
      {
        expiresIn: this.validateExpiration(this.accessTokenExpiration, 'ACCESS_TOKEN_EXPIRATION'),
      },
    );
  }

  /**
   * Open a session and sign the pair that belongs to it.
   *
   * Every login path in this package ends here. An application that issues
   * tokens itself — after its own verification step, say — should too.
   */
  async issueTokenPair(member: MemberEntity, options?: IssueTokenPairOptions): Promise<TokenPairDto> {
    const session = await this.memberSessionService.openSession(member, {
      domain: options?.domain,
      ip: options?.ip,
      userAgent: options?.userAgent,
    });

    const signOptions: SignTokenOptions = {
      session,
      ...(options?.authTime === undefined ? {} : { authTime: options.authTime }),
    };

    return {
      accessToken: this.signAccessToken(member, options?.domain, signOptions),
      refreshToken: this.signRefreshToken(member, options?.domain, signOptions),
    };
  }

  /**
   * `issueTokenPair` for a caller that cannot await.
   *
   * Both tokens name the same session, but its row is written in the
   * background: see `signRefreshToken` for what that costs. It exists so that
   * synchronous code which used to call the two sign methods one after the
   * other has a drop-in that still puts a `sid` on the access token.
   */
  issueTokenPairDetached(member: MemberEntity, options?: IssueTokenPairOptions): TokenPairDto {
    const session = this.memberSessionService.openSessionDetached(member, {
      domain: options?.domain,
      ip: options?.ip,
      userAgent: options?.userAgent,
    });

    const signOptions: SignTokenOptions = {
      session,
      ...(options?.authTime === undefined ? {} : { authTime: options.authTime }),
    };

    return {
      accessToken: this.signAccessToken(member, options?.domain, signOptions),
      refreshToken: this.signRefreshToken(member, options?.domain, signOptions),
    };
  }

  /**
   * Sign a fresh pair for one of a member's own sessions, rotating its token.
   *
   * The companion to `changePassword(..., { keepSessionId })`, and meant to be
   * called right after it, in the same request. A session from before a
   * password change that was not kept by it is refused with
   * `PasswordChangedError`. It performs no authentication of its own, so it takes the member as well as the session
   * and refuses a session that is not that member's: a session id alone — the
   * `sid` of some token, a value a client sent — must never be enough to be
   * handed tokens for whoever owns it. Pass the member id your guard
   * authenticated, not one read from the request body.
   */
  async reissueSessionTokens(
    memberId: string,
    sessionId: string,
    options?: ReissueSessionTokensOptions,
  ): Promise<TokenPairDto> {
    const session = await this.memberSessionService.findSession(sessionId);

    // Someone else's session is reported exactly like a missing one.
    if (!session || session.memberId !== memberId) throw new SessionNotFoundError();

    const member = await this.findMemberOnPrimary({ id: memberId });

    if (!member) throw new MemberNotFoundError();

    // A session from before a password change is reissued only if that change
    // kept it (`changePassword(..., { keepSessionId })` marks it). Otherwise a
    // session that merely outlived a failed revocation could be turned, by
    // anything holding its access token, into tokens under the new password.
    if (epochMsOrNull(session.passwordChangedAt) !== epochMsOrNull(member.passwordChangedAt)) {
      throw new PasswordChangedError();
    }

    const binding = await this.memberSessionService.rotateUnconditionally(member, sessionId);
    const domain = options?.domain ?? session.domain ?? undefined;
    // Not "now": this method authenticates nobody, so it must not let a token
    // claim a fresh authentication it never saw.
    const signOptions: SignTokenOptions = { session: binding, authTime: options?.authTime ?? null };

    return {
      accessToken: this.signAccessToken(member as MemberEntity, domain, signOptions),
      refreshToken: this.signRefreshToken(member as MemberEntity, domain, signOptions),
    };
  }

  /**
   * End one session, whoever it belongs to. Returns false when it was already
   * ended or never existed.
   *
   * For administrative use. A route acting for a signed-in member — "sign out
   * that device" — must use `revokeMemberSession`, or a session id taken from
   * the request would let anyone sign anyone else out.
   */
  revokeSession(sessionId: string, reason: MemberSessionRevokedReason): Promise<boolean> {
    return this.memberSessionService.revokeSession(sessionId, reason);
  }

  /**
   * End one of a member's own sessions. Returns false when the session is not
   * that member's, does not exist, or was already ended.
   */
  revokeMemberSession(
    memberId: string,
    sessionId: string,
    reason: MemberSessionRevokedReason = 'logout',
  ): Promise<boolean> {
    return this.memberSessionService.revokeMemberSession(memberId, sessionId, reason);
  }

  /**
   * Whether a session is the member's, has not been ended, and was issued
   * under the member's current password.
   *
   * The last part is what makes it more than the row's own state: a session
   * from before a password change is false here even when revoking it failed,
   * unless that change kept it (`changePassword(..., { keepSessionId })`).
   *
   * The guard never asks this — access tokens stay stateless — but a route that
   * hands out something longer-lived on the strength of an access token should.
   */
  async isSessionActive(memberId: string, sessionId: string): Promise<boolean> {
    // One read of the session, so that what is judged is a single state of it.
    const session = await this.memberSessionService.findOpenSession(memberId, sessionId);

    if (!session) return false;

    const member = await this.findMemberOnPrimary({ id: memberId });

    if (!member) return false;

    // A password change revokes the member's sessions, but that write can fail
    // and is only logged (see revokeAfterPasswordChange). The backstop is the
    // same test a refresh applies to its token: the session was issued under
    // the member's current password, or it is over. Equality, against one
    // clock — no time of this module's own is compared with the database's.
    // A session a change was told to keep is marked with the new value by it.
    return epochMsOrNull(session.passwordChangedAt) === epochMsOrNull(member.passwordChangedAt);
  }

  /** End every live session of a member. Returns how many were ended. */
  revokeAllSessions(memberId: string, options: RevokeAllSessionsOptions): Promise<number> {
    return this.memberSessionService.revokeAllSessions(memberId, options);
  }

  /**
   * The session a refresh token is bound to, or null.
   *
   * The signature is checked; the expiry is not, because the use for this is
   * logging out, and a browser that sat closed past the token's lifetime should
   * still be able to end its session rather than be told the token is invalid.
   * Do not treat a non-null answer as proof the token can still refresh.
   */
  async getSessionFromRefreshToken(refreshToken: string): Promise<MemberSessionEntity | null> {
    let claims: RefreshTokenClaims;

    try {
      claims = jwt.verify(refreshToken, this.refreshTokenSecret, { ignoreExpiration: true }) as RefreshTokenClaims;
    } catch {
      return null;
    }

    if (typeof claims.sid !== 'string') return null;

    const session = await this.memberSessionService.findSession(claims.sid);

    return session && session.memberId === claims.id ? session : null;
  }

  /**
   * Log out: end the session a refresh token belongs to.
   *
   * Returns false when the token is not one of ours, is past its own expiry
   * with no session left, or its session was already ended — none of those is
   * an error for a logout, so none of them throws. A database failure does
   * throw: the session may still be open, and the caller should know.
   */
  async revokeSessionByRefreshToken(
    refreshToken: string,
    reason: MemberSessionRevokedReason = 'logout',
  ): Promise<boolean> {
    const session = await this.getSessionFromRefreshToken(refreshToken);

    return session ? this.memberSessionService.revokeSession(session.id, reason) : false;
  }

  async getResetPasswordToken(account: string): Promise<string> {
    const member = await this.baseMemberRepo.findOne({
      where: { account },
    });

    if (!member) {
      throw new MemberNotFoundError();
    }

    const requestedOn = new Date();

    member.resetPasswordRequestedAt = requestedOn;

    await this.baseMemberRepo.save(member);

    const token = jwt.sign(
      {
        id: member.id,
        requestedOn: requestedOn.getTime(),
      },
      this.resetPasswordTokenSecret,
      {
        expiresIn: this.validateExpiration(this.resetPasswordTokenExpiration, 'RESET_PASSWORD_TOKEN_EXPIRATION'),
      },
    );

    return token;
  }

  async changePassword<T extends MemberEntity = MemberEntity>(
    id: string,
    originPassword: string,
    newPassword: string,
    options?: ChangePasswordOptions,
  ): Promise<T> {
    if (!(await this.passwordValidatorService.validatePassword(newPassword, id))) {
      throw new PasswordDoesNotMeetPolicyError();
    }

    const member = await this.baseMemberRepo.findOne({ where: { id } });

    if (!member) {
      throw new MemberNotFoundError();
    }

    try {
      if (await verify(member.password, originPassword)) {
        member.password = await hash(newPassword, this.passwordHashOptions);
        member.passwordChangedAt = new Date();
        member.shouldUpdatePassword = false;

        await this.baseMemberRepo.save(member);

        await this.memberPasswordHistoryRepo.save(
          this.memberPasswordHistoryRepo.create({
            memberId: member.id,
            password: member.password,
          }),
        );
      } else {
        throw new InvalidPasswordError();
      }
    } catch (_err) {
      throw new PasswordValidationError();
    }

    await this.revokeAfterPasswordChange(member, options?.keepSessionId);

    return member as T;
  }

  async changePasswordWithToken<T extends MemberEntity = MemberEntity>(token: string, newPassword: string): Promise<T> {
    const member = await this.applyPasswordReset(token, newPassword);

    // A reset is what someone does after losing control of the account, so
    // nothing is kept: whoever else is signed in is signed out.
    await this.revokeAfterPasswordChange(member);

    return member as T;
  }

  /**
   * End a member's sessions once their password has changed.
   *
   * By the time this runs the password has been written, so a failure here
   * must not be reported as a failed change — the member would retry with a
   * password that is no longer theirs, or be told a reset link was invalid.
   * Nothing is left open by it either: every refresh token issued before the
   * change embeds the old `passwordChangedAt` and is refused on that alone.
   * The sessions just stay marked as open, which is logged.
   */
  private async revokeAfterPasswordChange(member: BaseMemberEntity, keepSessionId?: string): Promise<void> {
    const memberId = member.id;

    // Before the others are revoked, and on its own. A session is spared from
    // the revocation below only if it was actually marked as kept: if marking
    // it fails, or it is not an open session of this member, it is revoked with
    // the rest and the device signs in again — the safe way for it to go wrong,
    // and the row then says so instead of being left looking open.
    let kept = false;

    if (keepSessionId) {
      try {
        kept = await this.memberSessionService.adoptPassword(member, keepSessionId);
      } catch (error) {
        this.logger.error(
          `Password of member ${memberId} changed but session ${keepSessionId} could not be kept through it; ` +
            `that device will have to sign in again. ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    try {
      await this.memberSessionService.revokeAllSessions(memberId, {
        reason: 'password_changed',
        exceptSessionId: kept ? keepSessionId : undefined,
      });
    } catch (error) {
      this.logger.error(
        `Password of member ${memberId} changed but its sessions could not be revoked; their refresh tokens are ` +
          `still refused by the passwordChangedAt check. ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async applyPasswordReset(token: string, newPassword: string): Promise<BaseMemberEntity> {
    try {
      const { id, requestedOn } = jwt.verify(token, this.resetPasswordTokenSecret) as {
        id: string;
        requestedOn: number;
      };

      if (!(await this.passwordValidatorService.validatePassword(newPassword, id))) {
        throw new PasswordDoesNotMeetPolicyError();
      }

      const member = await this.baseMemberRepo.findOne({
        where: {
          id,
          resetPasswordRequestedAt: new Date(requestedOn),
        },
      });

      if (!member) {
        throw new InvalidToken();
      }

      member.password = await hash(newPassword, this.passwordHashOptions);
      member.passwordChangedAt = new Date();
      member.shouldUpdatePassword = false;
      member.resetPasswordRequestedAt = null;
      // Completing the reset-token flow proves email ownership, so clear the
      // login failure lock to keep a self-service recovery path for banned members.
      member.loginFailedCounter = 0;

      await this.baseMemberRepo.save(member);

      await this.memberPasswordHistoryRepo.save(
        this.memberPasswordHistoryRepo.create({
          memberId: member.id,
          password: member.password,
        }),
      );

      return member;
    } catch (_ex) {
      throw new InvalidToken();
    }
  }

  async register<T extends MemberEntity = MemberEntity>(
    account: string,
    password: string,
    memberOptions?: DeepPartial<Omit<T, 'account' | 'password'>>,
  ): Promise<T> {
    if (!(await this.passwordValidatorService.validatePassword(password))) {
      throw new PasswordDoesNotMeetPolicyError();
    }

    let member = this.baseMemberRepo.create({ account });

    member.password = await hash(password, this.passwordHashOptions);

    try {
      member = await this.baseMemberRepo.save({
        ...memberOptions,
        account: member.account,
        password: member.password,
      });

      await this.memberPasswordHistoryRepo.save(
        this.memberPasswordHistoryRepo.create({
          memberId: member.id,
          password: member.password,
        }),
      );
    } catch (ex) {
      if (/unique/.test((ex as QueryFailedError).message)) {
        throw new MemberAlreadyExistedError();
      }
    }

    return member as T;
  }

  async registerWithoutPassword<T extends MemberEntity = MemberEntity>(
    account: string,
    memberOptions?: DeepPartial<Omit<T, 'account' | 'password'>>,
  ): Promise<[T, string]> {
    const password = this.passwordValidatorService.generateValidPassword();

    let member = this.baseMemberRepo.create({ account });

    member.password = await hash(password, this.passwordHashOptions);

    try {
      member = await this.baseMemberRepo.save({
        shouldUpdatePassword: true,
        ...memberOptions,
        account: member.account,
        password: member.password,
      });

      await this.memberPasswordHistoryRepo.save(
        this.memberPasswordHistoryRepo.create({
          memberId: member.id,
          password: member.password,
        }),
      );
    } catch (ex) {
      if (/unique/.test((ex as QueryFailedError).message)) {
        throw new MemberAlreadyExistedError();
      }
    }

    return [member as T, password];
  }

  /**
   * Exchange a refresh token for a new pair, rotating the token.
   *
   * The token presented stops working as soon as this returns, apart from the
   * grace window. Presenting one that has already been rotated away, outside
   * that window, revokes the session.
   *
   * Three kinds of failure, and a client must tell them apart:
   *   - `InvalidToken` — not a refresh token of ours, past its own expiry, or
   *     issued before sessions existed (no `sid`), exactly as 0.14 answered it.
   *   - a `SessionRejectedError` subclass, `PasswordChangedError`,
   *     `MemberNotFoundError` — the server has refused this credential and will
   *     keep refusing it. Sign the user out.
   *   - anything else (a database error, a timeout) — nothing was decided.
   *     Keep the credential and retry.
   */
  async refreshToken(refreshToken: string, options?: { domain?: string }): Promise<TokenPairDto> {
    let claims: RefreshTokenClaims;

    try {
      claims = jwt.verify(refreshToken, this.refreshTokenSecret) as RefreshTokenClaims;
    } catch {
      throw new InvalidToken();
    }

    const { id, account, passwordChangedAt, domain, authTime, sid, jti } = claims;

    // A token from before sessions existed. There is no session to check it
    // against, and therefore no way to ever revoke it: it is refused — as the
    // plain InvalidToken (104, "Invalid token") that 0.14 answered a bad token
    // with, so that every client's existing "sign the user out" handling
    // applies to it unchanged, whatever it keys on.
    if (typeof sid !== 'string' || typeof jti !== 'string') {
      throw new InvalidToken();
    }

    const loaded: { member?: BaseMemberEntity } = {};

    const session = await this.memberSessionService.rotate({ sessionId: sid, tokenId: jti }, id, async () => {
      const member = await this.findMemberOnPrimary({ id, account });

      if (!member) {
        throw new MemberNotFoundError();
      }

      if (epochMsOrNull(member.passwordChangedAt) !== passwordChangedAt) {
        throw new PasswordChangedError();
      }

      loaded.member = member;
    });

    // Carry the original authentication time forward. Re-stamping it here
    // would make every refresh look like a fresh login to anything that
    // relies on authTime (OIDC max_age / prompt=login, step-up auth).
    // Tokens issued before the claim existed resolve to null so the claim is
    // omitted rather than fabricated.
    const signOptions: SignTokenOptions = { authTime: authTime ?? null, session };
    const resolvedDomain = options?.domain ?? domain ?? undefined;
    const member = loaded.member as MemberEntity;

    return {
      accessToken: this.signAccessToken(member, resolvedDomain, signOptions),
      refreshToken: this.signRefreshToken(member, resolvedDomain, signOptions),
    };
  }

  async login(
    account: string,
    password: string,
    ip?: string, // IP address as string
  ): Promise<TokenPairDto>;
  async login(
    account: string,
    password: string,
    options?: {
      domain?: string;
      ip?: string;
      userAgent?: string;
    },
  ): Promise<TokenPairDto>;
  async login(
    account: string,
    password: string,
    options?:
      | {
          domain?: string;
          ip?: string;
          userAgent?: string;
        }
      | string,
  ): Promise<TokenPairDto> {
    const { member, isPasswordExpired } = await this.authenticateMember(account, password, options);

    const domain = typeof options === 'string' ? undefined : (options?.domain ?? undefined);

    // Token signing stays inside an identical try/catch so the error taxonomy
    // is unchanged: BadRequestException passes through, anything else is
    // reported as PasswordValidationError.
    try {
      const tokenPair = await this.issueTokenPair(member, {
        domain,
        ip: typeof options === 'string' ? options : options?.ip,
        userAgent: typeof options === 'string' ? undefined : options?.userAgent,
      });

      return {
        ...tokenPair,
        ...(this.passwordAgeLimitInDays
          ? {
              shouldUpdatePassword: isPasswordExpired,
              passwordChangedAt: member.passwordChangedAt
                ? new Date(member.passwordChangedAt).toISOString()
                : undefined,
            }
          : {}),
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;

      // Reported to the client as it always was, but not swallowed: since a
      // login also opens a session, a missing table or an unregistered entity
      // fails here, and PasswordValidationError alone would name neither.
      this.logger.error(
        `Login of member ${member.id} failed after its credentials were verified: ${
          err instanceof Error ? (err.stack ?? err.message) : String(err)
        }`,
      );

      throw new PasswordValidationError();
    }
  }

  /**
   * Verify a member's credentials without issuing any token.
   *
   * Runs the exact same checks as login (ban threshold with optional auto
   * unlock, password expiry, argon2 verification) and keeps the same side
   * effects (failure counter, login log). Intended for flows that own their own
   * session mechanics — an OIDC provider interaction, for example — where the
   * member-base token pair would be discarded anyway.
   */
  async verifyCredentials<T extends MemberEntity = MemberEntity>(
    account: string,
    password: string,
    options?: { ip?: string },
  ): Promise<T> {
    const { member } = await this.authenticateMember(account, password, options);

    return member as T;
  }

  async findById<T extends MemberEntity = MemberEntity>(id: string): Promise<T | null> {
    const member = await this.baseMemberRepo.findOne({ where: { id } });

    return (member as T) ?? null;
  }

  async findByAccount<T extends MemberEntity = MemberEntity>(account: string): Promise<T | null> {
    const member = await this.baseMemberRepo.findOne({ where: { account } });

    return (member as T) ?? null;
  }

  private async authenticateMember(
    account: string,
    password: string,
    options?:
      | {
          domain?: string;
          ip?: string;
        }
      | string,
  ): Promise<{ member: MemberEntity; isPasswordExpired: boolean }> {
    const member = await this.baseMemberRepo.findOne({
      where: { account },
    });

    if (!member) {
      throw new MemberNotFoundError();
    }

    if (member.loginFailedCounter >= this.loginFailedBanThreshold) {
      if (this.loginFailedAutoUnlockSeconds) {
        const latestFailedRecord = await this.memberLoginLogRepo.findOne({
          order: {
            createdAt: 'DESC',
          },
          where: {
            memberId: member.id,
            success: false,
          },
        });

        if (
          !latestFailedRecord ||
          latestFailedRecord.createdAt.getTime() + this.loginFailedAutoUnlockSeconds * 1000 > Date.now()
        ) {
          throw new MemberBannedError();
        }
      } else {
        throw new MemberBannedError();
      }
    }

    const isPasswordExpired = this.passwordAgeLimitInDays
      ? this.passwordValidatorService.shouldUpdatePassword(member)
      : false;

    if (isPasswordExpired && this.forceRejectLoginOnPasswordExpired) {
      throw new PasswordExpiredError();
    }

    const ip = typeof options === 'string' ? options : (options?.ip ?? undefined);

    try {
      if (await verify(member.password, password)) {
        if (member.shouldUpdatePassword) {
          throw new PasswordShouldUpdatePasswordError();
        }

        member.loginFailedCounter = 0;

        await this.baseMemberRepo.save(member);

        this.recordLoginAttempt(member.id, true, ip);

        return { member: member as MemberEntity, isPasswordExpired };
      }

      member.loginFailedCounter += 1;

      await this.baseMemberRepo.save(member);

      this.recordLoginAttempt(member.id, false, ip);

      throw new InvalidPasswordError();
    } catch (err) {
      if (err instanceof BadRequestException) throw err;

      throw new PasswordValidationError();
    }
  }

  async resetLoginFailedCounter<T extends MemberEntity = MemberEntity>(id: string): Promise<T> {
    const member = await this.baseMemberRepo.findOne({ where: { id } });

    if (!member) {
      throw new MemberNotFoundError();
    }

    member.loginFailedCounter = 0;

    await this.baseMemberRepo.save(member);

    return member as T;
  }

  private validateExpiration(source: unknown, tokenName: string): number {
    if (typeof source !== 'number' || Number.isNaN(source)) {
      throw new BadRequestException(`[${tokenName}] must be a number (in seconds), but got: ${source}`);
    }

    return source;
  }
}
