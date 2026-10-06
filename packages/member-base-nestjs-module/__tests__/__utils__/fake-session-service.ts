import { randomUUID } from 'node:crypto';
import type { MemberSessionEntity, MemberSessionRevokedReason } from '../../src/models/member-session.entity';
import type {
  MemberSessionService,
  RevokeAllSessionsOptions,
  SessionOwner,
} from '../../src/services/member-session.service';
import type { SessionContext, SessionTokenBinding } from '../../src/typings/session-tracking-options';

export type FakeSessionService = jest.Mocked<
  Pick<
    MemberSessionService,
    | 'openSession'
    | 'openSessionDetached'
    | 'findSession'
    | 'rotate'
    | 'rotateUnconditionally'
    | 'adoptPassword'
    | 'revokeSession'
    | 'revokeAllSessions'
    | 'purgeExpiredSessions'
  >
>;

/**
 * A session service that accepts everything, for specs whose subject is
 * something other than sessions.
 *
 * It keeps no state: every token rotates, nothing is ever revoked. The real
 * behaviour is covered against a database in `member-session.integration.spec.ts`.
 */
export const createFakeSessionService = (): FakeSessionService => {
  const binding = (): SessionTokenBinding => ({ sessionId: randomUUID(), tokenId: randomUUID() });

  return {
    openSession: jest.fn(async (_owner: SessionOwner, _context?: SessionContext) => binding()),
    openSessionDetached: jest.fn((_owner: SessionOwner, _context?: SessionContext) => binding()),
    findSession: jest.fn(async (_sessionId: string): Promise<MemberSessionEntity | null> => null),
    rotate: jest.fn(
      async ({ sessionId }: SessionTokenBinding, _memberId: string, beforeRotate?: () => Promise<void>) => {
        await beforeRotate?.();

        return { sessionId, tokenId: randomUUID() };
      },
    ),
    rotateUnconditionally: jest.fn(async (_owner: SessionOwner, sessionId: string) => ({
      sessionId,
      tokenId: randomUUID(),
    })),
    adoptPassword: jest.fn(async (_owner: SessionOwner, _sessionId: string): Promise<boolean> => true),
    revokeSession: jest.fn(async (_sessionId: string, _reason: MemberSessionRevokedReason): Promise<boolean> => true),
    revokeAllSessions: jest.fn(async (_memberId: string, _options: RevokeAllSessionsOptions) => 0),
    purgeExpiredSessions: jest.fn(async () => 0),
  };
};

/** Cast for constructors that take the concrete class. */
export const asSessionService = (fake: FakeSessionService): MemberSessionService =>
  fake as unknown as MemberSessionService;
