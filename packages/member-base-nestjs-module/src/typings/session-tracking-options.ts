import type { MemberSessionEntity } from '../models/member-session.entity';

export interface SessionTrackingOptions {
  /**
   * How long the refresh token that was just rotated away keeps working.
   *
   * default: 10. Two tabs, or two requests fired together, present the same
   * refresh token moments apart; without a window the slower one would look
   * like a stolen token and take the whole session down with it. Inside the
   * window it is handed the pair the faster one already rotated to.
   *
   * 0 turns the window off: the second of two concurrent refreshes then revokes
   * the session.
   */
  rotationGraceSeconds?: number;
  /**
   * Entity backing the session table.
   *
   * default: `MemberSessionEntity`, mapped to `member_sessions`. Subclass it
   * with `@Entity('another_table')` to keep sessions in a table of your own,
   * with extra columns if you need them, and register the subclass on the
   * DataSource.
   *
   * This does not rename the default table. The module registers the base
   * entity regardless, so with `autoLoadEntities` `member_sessions` is still
   * created next to yours, and stays empty.
   */
  sessionEntity?: new () => MemberSessionEntity;
  /**
   * Store the user agent a session was opened from.
   * default: false — it is personal data, and nothing in this module reads it.
   */
  recordUserAgent?: boolean;
  /**
   * Store the IP a session was opened from.
   * default: false, for the same reason.
   */
  recordIp?: boolean;
}

/** Ambient request details stored on a session when it is opened. */
export interface SessionContext {
  domain?: string;
  ip?: string;
  userAgent?: string;
}

/** The `sid` and `jti` claims a refresh token carries. */
export interface SessionTokenBinding {
  readonly sessionId: string;
  readonly tokenId: string;
}
