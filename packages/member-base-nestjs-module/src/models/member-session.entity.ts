import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const MemberSessionRepo = Symbol('MemberSessionRepo');

/**
 * Why a session stopped being usable.
 *
 * `expired` is written when a refresh arrives for a session whose lifetime has
 * already run out; a session nobody ever comes back to keeps a null reason and
 * is only ever seen by `purgeExpiredSessions`.
 */
export type MemberSessionRevokedReason = 'logout' | 'reuse_detected' | 'password_changed' | 'admin' | 'expired';

export const MEMBER_SESSION_REVOKED_REASONS: readonly MemberSessionRevokedReason[] = [
  'logout',
  'reuse_detected',
  'password_changed',
  'admin',
  'expired',
];

/**
 * One login on one device or browser.
 *
 * Every refresh token is bound to a row here by its `sid` claim, and to a single
 * position in that row's rotation by its `jti` claim. Revoking the row is what
 * makes a logout mean something on the server: the refresh token is still a
 * validly signed JWT, it just no longer refreshes.
 *
 * There is deliberately no relation to the member entity. Nothing here is ever
 * joined, and a relation would oblige every DataSource that loads this entity to
 * load the member graph with it.
 */
@Entity('member_sessions')
export class MemberSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  memberId: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column('timestamptz')
  lastRefreshedAt: Date;

  /** Moves forward on every rotation, in step with the refresh token it issued. */
  @Column('timestamptz')
  @Index()
  expiresAt: Date;

  /** The only `jti` that rotates this session. */
  @Column('uuid')
  currentTokenId: string;

  /**
   * The `jti` rotated away most recently, kept so that requests already in
   * flight when the rotation happened are not mistaken for theft.
   */
  @Column('uuid', { nullable: true })
  previousTokenId: string | null;

  @Column('timestamptz', { nullable: true })
  previousRotatedAt: Date | null;

  /** Soft: a revoked session is kept, so a later reuse can still be told apart. */
  @Column('timestamptz', { nullable: true })
  revokedAt: Date | null;

  @Column('varchar', { nullable: true })
  revokedReason: MemberSessionRevokedReason | null;

  /**
   * The member's `passwordChangedAt` that this session's tokens were issued
   * under. A refresh token embeds the same value, and a refresh refuses it once
   * the member's differs; this column lets the session itself be judged the
   * same way, without a token in hand — compared by equality against one
   * clock, the member row's, rather than against a time of this module's own.
   */
  @Column('timestamptz', { nullable: true })
  passwordChangedAt: Date | null;

  @Column('varchar', { nullable: true })
  domain: string | null;

  /** Recorded only when `sessionTracking.recordUserAgent` is on. */
  @Column('varchar', { nullable: true })
  userAgent: string | null;

  /** Recorded only when `sessionTracking.recordIp` is on. */
  @Column('cidr', { nullable: true })
  ip: string | null;
}
