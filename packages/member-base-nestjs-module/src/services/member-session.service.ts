import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { LessThan, Repository } from 'typeorm';
import { MemberSessionEntity, type MemberSessionRevokedReason } from '../models/member-session.entity';
import {
  REFRESH_TOKEN_EXPIRATION,
  RESOLVED_MEMBER_SESSION_REPO,
  SESSION_RECORD_IP,
  SESSION_RECORD_USER_AGENT,
  SESSION_ROTATION_GRACE_SECONDS,
} from '../typings/member-base.tokens';
import type { SessionContext, SessionTokenBinding } from '../typings/session-tracking-options';
import {
  RefreshTokenReuseDetectedError,
  SessionExpiredError,
  SessionNotFoundError,
  SessionRevokedError,
  SessionRotationConflictError,
} from '../constants/errors/base.error';
import { toStorableCidr } from '../utils/to-inet-cidr';

/**
 * How many rows a write touched.
 *
 * Every decision in this file — who won a rotation, whether a revocation took —
 * is read off this number. A driver that does not report it would make each of
 * them silently come out as "lost", so that is refused loudly instead.
 */
const affectedRows = (result: { affected?: number | null }): number => {
  if (typeof result.affected !== 'number') {
    throw new Error(
      '[MemberBase] The database driver did not report how many rows a session update affected, so the outcome ' +
        'of a token rotation cannot be determined. Session tracking needs a driver that fills UpdateResult.affected.',
    );
  }

  return result.affected;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every id this service is handed ends up compared against a `uuid` column, and
 * Postgres answers a malformed one with a type error — a 500 carrying SQL in
 * its message. An id that cannot be a session's is treated as one that is not.
 */
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID_PATTERN.test(value);

/**
 * Milliseconds since the epoch of a timestamp column.
 *
 * `Date` normally, but a pg type parser registered by the application can hand
 * back strings; comparing on whatever arrives keeps that from becoming a 500.
 * `MemberBaseService` reads the member's `passwordChangedAt` the same way.
 */
const timeOf = (value: Date | string): number => new Date(value).getTime();

/** The member a session is opened for, as far as a session needs to know. */
export interface SessionOwner {
  readonly id: string;
  readonly passwordChangedAt?: Date | null;
}

/** What presenting a `jti` to a session amounts to. */
type TokenStanding = 'current' | 'grace' | 'reused';

export interface RevokeAllSessionsOptions {
  /** Leave this one session alone — the device the member is acting from. */
  exceptSessionId?: string;
  reason: MemberSessionRevokedReason;
}

export interface PurgeSessionsOptions {
  /**
   * Remove sessions that expired, or were revoked, before this moment.
   * default: now. Pass an earlier date to keep ended sessions around for
   * audit before they are deleted.
   */
  before?: Date;
}

/**
 * Owns the `member_sessions` table: opening a session, rotating the token bound
 * to it, and ending it.
 *
 * It knows nothing about JWTs. `MemberBaseService` signs and verifies; this
 * class decides whether the `sid` / `jti` pair a token carries is still good.
 *
 * Every read goes to the primary. Each decision here compares what was just
 * read against what was just written — whether this token is still current,
 * whether the session was revoked a moment ago — and a replica that is even a
 * second behind would turn an ordinary refresh into a detected reuse.
 */
@Injectable()
export class MemberSessionService {
  private readonly logger = new Logger(MemberSessionService.name);

  /**
   * Sessions whose insert was started by a synchronous caller and has not
   * landed yet. See `openSessionDetached`.
   */
  private readonly pendingInserts = new Map<string, Promise<void>>();

  constructor(
    @Inject(RESOLVED_MEMBER_SESSION_REPO)
    private readonly sessionRepo: Repository<MemberSessionEntity>,
    @Inject(REFRESH_TOKEN_EXPIRATION)
    private readonly refreshTokenExpiration: number,
    @Inject(SESSION_ROTATION_GRACE_SECONDS)
    private readonly rotationGraceSeconds: number,
    @Inject(SESSION_RECORD_USER_AGENT)
    private readonly recordUserAgent: boolean,
    @Inject(SESSION_RECORD_IP)
    private readonly recordIp: boolean,
  ) {}

  /** Open a session for a login and return the claims its refresh token carries. */
  async openSession(owner: SessionOwner, context?: SessionContext): Promise<SessionTokenBinding> {
    const row = this.buildRow(owner, context);

    await this.sessionRepo.insert(row);

    return { sessionId: row.id, tokenId: row.currentTokenId };
  }

  /**
   * Open a session without waiting for the insert.
   *
   * Exists for `signRefreshToken`, which is synchronous and public: code that
   * signs a refresh token directly keeps working, and the token it gets is a
   * tracked one. The cost is that a failed insert is only logged, and leaves a
   * refresh token that will be refused as `SessionNotFoundError` the first time
   * it is used. Anything that can await should call `openSession` instead.
   * (A session entity that is not registered on the DataSource is not a failed
   * insert: building the row needs its metadata, so that throws here, at once.)
   *
   * A refresh arriving in the same process before the insert lands waits for
   * it; see `settle`. One arriving at another instance of the application in
   * that moment does not, and finds no session.
   */
  openSessionDetached(owner: SessionOwner, context?: SessionContext): SessionTokenBinding {
    const row = this.buildRow(owner, context);

    const pending = this.sessionRepo
      .insert(row)
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to store session ${row.id} for member ${owner.id}; its refresh token will not refresh. ` +
            `Use issueTokenPair() to have the failure raised instead. ${error instanceof Error ? error.message : error}`,
        );
      })
      .finally(() => this.pendingInserts.delete(row.id));

    this.pendingInserts.set(row.id, pending);

    return { sessionId: row.id, tokenId: row.currentTokenId };
  }

  async findSession(sessionId: string): Promise<MemberSessionEntity | null> {
    if (!isUuid(sessionId)) return null;

    await this.settle(sessionId);

    // Pinned to the primary; see the class comment.
    const runner = this.sessionRepo.manager.connection.createQueryRunner('master');

    try {
      return await this.sessionRepo
        .createQueryBuilder('session', runner)
        .where('session.id = :id', { id: sessionId })
        .getOne();
    } finally {
      await runner.release();
    }
  }

  /**
   * The session, if it is the member's, not revoked and not expired; else null.
   *
   * This is the row's own state only. It does not know about the member's
   * password: a session whose revocation failed after a password change still
   * comes back from here. For "may this access token be trusted",
   * `MemberBaseService.isSessionActive` is the check — it adds that.
   */
  async findOpenSession(memberId: string, sessionId: string): Promise<MemberSessionEntity | null> {
    const session = await this.findSession(sessionId);

    const open =
      session !== null &&
      session.memberId === memberId &&
      session.revokedAt === null &&
      timeOf(session.expiresAt) > Date.now();

    return open ? session : null;
  }

  /**
   * Decide what a presented refresh token is worth, and rotate if it is the
   * current one.
   *
   * `beforeRotate` runs once the session and token have been accepted and
   * before anything is written, so the caller's own checks (the member still
   * exists, the password has not changed) can refuse without consuming the
   * token.
   *
   * The rotation is one conditional UPDATE keyed on the token being replaced.
   * Two refreshes racing with the same token both reach it; the database lets
   * exactly one match, and the other re-reads the row and is treated as what it
   * now is — a request for the token that was just rotated away.
   */
  async rotate(
    binding: SessionTokenBinding,
    memberId: string,
    beforeRotate?: () => Promise<void>,
  ): Promise<SessionTokenBinding> {
    const session = await this.loadUsable(binding.sessionId, memberId);
    const standing = this.standingOf(session, binding.tokenId);

    if (standing === 'reused') return this.rejectReuse(session.id);

    await beforeRotate?.();

    if (standing === 'grace') return { sessionId: session.id, tokenId: session.currentTokenId };

    const nextTokenId = randomUUID();

    if (await this.replaceToken(session.id, binding.tokenId, nextTokenId)) {
      return { sessionId: session.id, tokenId: nextTokenId };
    }

    // Lost the race: someone rotated, or revoked, between the read and the
    // write. The row now says which.
    const latest = await this.loadUsable(binding.sessionId, memberId);
    const latestStanding = this.standingOf(latest, binding.tokenId);

    if (latestStanding === 'grace') {
      // Whatever won may have been a reissue after a password change. The
      // caller's checks were made before the race; make them again before
      // handing this request the pair that came out of it.
      await beforeRotate?.();

      return { sessionId: latest.id, tokenId: latest.currentTokenId };
    }

    // The UPDATE did not match this token, yet the row still names it as
    // current. Nothing that happened can be called reuse; the two answers just
    // disagree, so nothing is decided and the client retries.
    if (latestStanding === 'current') throw new SessionRotationConflictError();

    return this.rejectReuse(latest.id);
  }

  /**
   * Replace a session's token outside of a refresh, for a caller that has
   * already established who is asking.
   *
   * Used after a password change that keeps the current session: the tokens the
   * client holds embed the old `passwordChangedAt` and can no longer refresh, so
   * it needs a pair that can.
   */
  async rotateUnconditionally(owner: SessionOwner, sessionId: string): Promise<SessionTokenBinding> {
    const memberId = owner.id;
    const session = await this.loadUsable(sessionId, memberId);
    const nextTokenId = randomUUID();

    // Which password the session belongs to is not written here. The caller
    // has checked that it is the member's current one, and only
    // `adoptPassword` changes it: writing the value this request read would
    // undo a `changePassword(..., { keepSessionId })` that landed in between.
    if (await this.replaceToken(session.id, session.currentTokenId, nextTokenId)) {
      return { sessionId: session.id, tokenId: nextTokenId };
    }

    // Something rotated or revoked it in between. If it was ended, say so;
    // loadUsable throws the matching refusal. If it is merely busy — the same
    // device refreshing in another tab — that is not a refusal, and the caller
    // can try again.
    await this.loadUsable(sessionId, memberId);

    throw new SessionRotationConflictError();
  }

  /**
   * Record that one of a member's open sessions now belongs to the member's
   * current password. Returns false when the session is not theirs, revoked,
   * or does not exist.
   *
   * This is what "keep this session through the password change" means on the
   * row. Only a session marked this way can be reissued afterwards, which is
   * what tells a session that was deliberately kept apart from one that is
   * merely still there because revoking it failed.
   */
  async adoptPassword(owner: SessionOwner, sessionId: string): Promise<boolean> {
    if (!isUuid(owner.id) || !isUuid(sessionId)) return false;

    await this.settle(sessionId);

    const affected = affectedRows(
      await this.sessionRepo
        .createQueryBuilder()
        .update()
        .set({ passwordChangedAt: owner.passwordChangedAt ?? null })
        .where('id = :id', { id: sessionId })
        .andWhere('memberId = :memberId', { memberId: owner.id })
        .andWhere('revokedAt IS NULL')
        .execute(),
    );

    return affected === 1;
  }

  /**
   * End one session, whoever it belongs to. Returns false when there was
   * nothing to end — no such session, or one already revoked, whose original
   * reason is kept.
   *
   * Takes no member: it is for administrative use. A route acting for a signed
   * in member must use `revokeMemberSession`.
   */
  async revokeSession(sessionId: string, reason: MemberSessionRevokedReason): Promise<boolean> {
    return this.revokeWhere(sessionId, null, reason);
  }

  /**
   * End one of a member's own sessions. Returns false when the session is not
   * that member's, does not exist, or was already ended.
   */
  async revokeMemberSession(memberId: string, sessionId: string, reason: MemberSessionRevokedReason): Promise<boolean> {
    if (!isUuid(memberId)) return false;

    return this.revokeWhere(sessionId, memberId, reason);
  }

  /** End every live session of a member. Returns how many were ended. */
  async revokeAllSessions(memberId: string, options: RevokeAllSessionsOptions): Promise<number> {
    if (!isUuid(memberId)) return 0;

    await Promise.all([...this.pendingInserts.values()]);

    const query = this.sessionRepo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date(), revokedReason: options.reason })
      .where('memberId = :memberId', { memberId })
      .andWhere('revokedAt IS NULL');

    // An id that cannot be a session spares nothing, which is what it would do
    // if it were simply someone else's.
    if (isUuid(options.exceptSessionId)) {
      query.andWhere('id != :exceptSessionId', { exceptSessionId: options.exceptSessionId });
    }

    return affectedRows(await query.execute());
  }

  /**
   * Delete sessions that can no longer be used: expired, or revoked.
   *
   * Never called by the module. Revoked rows are what make a later reuse
   * recognisable as reuse rather than as an unknown session, so how long to
   * keep them — and whether to run this at all — is the application's call.
   */
  async purgeExpiredSessions(options?: PurgeSessionsOptions): Promise<number> {
    const before = options?.before ?? new Date();

    return affectedRows(
      await this.sessionRepo.delete([{ expiresAt: LessThan(before) }, { revokedAt: LessThan(before) }]),
    );
  }

  private async revokeWhere(
    sessionId: string,
    memberId: string | null,
    reason: MemberSessionRevokedReason,
  ): Promise<boolean> {
    if (!isUuid(sessionId)) return false;

    await this.settle(sessionId);

    const query = this.sessionRepo
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where('id = :id', { id: sessionId })
      .andWhere('revokedAt IS NULL');

    if (memberId !== null) query.andWhere('memberId = :memberId', { memberId });

    return affectedRows(await query.execute()) === 1;
  }

  /** The conditional UPDATE every rotation goes through. True when it matched. */
  private async replaceToken(sessionId: string, fromTokenId: string, toTokenId: string): Promise<boolean> {
    const now = new Date();

    const affected = affectedRows(
      await this.sessionRepo
        .createQueryBuilder()
        .update()
        .set({
          currentTokenId: toTokenId,
          previousTokenId: fromTokenId,
          previousRotatedAt: now,
          lastRefreshedAt: now,
          expiresAt: this.expiryFrom(now),
        })
        .where('id = :id', { id: sessionId })
        .andWhere('currentTokenId = :tokenId', { tokenId: fromTokenId })
        .andWhere('revokedAt IS NULL')
        .execute(),
    );

    return affected === 1;
  }

  private async loadUsable(sessionId: string, memberId: string): Promise<MemberSessionEntity> {
    const session = await this.findSession(sessionId);

    // A session belonging to someone else is reported exactly like a missing
    // one: the token's `sid` and its member do not go together.
    if (!session || session.memberId !== memberId) throw new SessionNotFoundError();

    if (!session.revokedAt && timeOf(session.expiresAt) <= Date.now()) {
      // Recorded so the row says why it stopped, but the refusal does not wait
      // on, or depend on, that write.
      await this.revokeSession(session.id, 'expired').catch(() => undefined);

      throw new SessionExpiredError();
    }

    this.assertUsable(session);

    return session;
  }

  private assertUsable(session: MemberSessionEntity): void {
    if (session.revokedAt) {
      if (session.revokedReason === 'expired') throw new SessionExpiredError();

      throw new SessionRevokedError(session.revokedReason);
    }

    if (timeOf(session.expiresAt) <= Date.now()) throw new SessionExpiredError();
  }

  private standingOf(session: MemberSessionEntity, tokenId: string): TokenStanding {
    if (tokenId === session.currentTokenId) return 'current';

    const withinGrace =
      tokenId === session.previousTokenId &&
      session.previousRotatedAt !== null &&
      Date.now() - timeOf(session.previousRotatedAt) < this.rotationGraceSeconds * 1000;

    return withinGrace ? 'grace' : 'reused';
  }

  private async rejectReuse(sessionId: string): Promise<never> {
    await this.revokeSession(sessionId, 'reuse_detected');

    throw new RefreshTokenReuseDetectedError();
  }

  private buildRow(owner: SessionOwner, context?: SessionContext): MemberSessionEntity {
    const now = new Date();

    return this.sessionRepo.create({
      id: randomUUID(),
      memberId: owner.id,
      passwordChangedAt: owner.passwordChangedAt ?? null,
      lastRefreshedAt: now,
      expiresAt: this.expiryFrom(now),
      currentTokenId: randomUUID(),
      previousTokenId: null,
      previousRotatedAt: null,
      revokedAt: null,
      revokedReason: null,
      domain: context?.domain ?? null,
      userAgent: this.recordUserAgent ? (context?.userAgent ?? null) : null,
      ip: this.recordIp ? toStorableCidr(context?.ip) : null,
    });
  }

  private expiryFrom(from: Date): Date {
    return new Date(from.getTime() + this.refreshTokenExpiration * 1000);
  }

  /** Wait for a detached insert of this session, if one is still in flight. */
  private async settle(sessionId: string): Promise<void> {
    await this.pendingInserts.get(sessionId);
  }
}
