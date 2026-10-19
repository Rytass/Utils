import { hash } from 'argon2';
import { DataSource, EntityManager, getMetadataArgsStorage, Repository } from 'typeorm';
import { MemberBaseService } from '../src/services/member-base.service';
import { MemberBaseAdminService } from '../src/services/member-base-admin.service';
import { PasswordValidatorService } from '../src/services/password-validator.service';
import { BaseMemberEntity } from '../src/models/base-member.entity';
import { MemberLoginLogEntity } from '../src/models/member-login-log.entity';
import { MemberPasswordHistoryEntity } from '../src/models/member-password-history.entity';
import { MemberOAuthRecordEntity } from '../src/models/member-oauth-record.entity';
import {
  InvalidPasswordError,
  MemberBannedError,
  PasswordShouldUpdatePasswordError,
} from '../src/constants/errors/base.error';
import { asSessionService, createFakeSessionService } from './__utils__/fake-session-service';

/**
 * The failed-login counter against a real database.
 *
 * A repository double hands every caller the same object, so concurrent
 * attempts all bump one counter in memory and a lost update never shows. Here
 * each read is its own row, as in production: concurrent attempts each read the
 * counter, and whatever they write races the others.
 */

const THRESHOLD = 5;
const PASSWORD = 'Passw0rd-one';
const WRONG_PASSWORD = 'Wrong-passw0rd';

/**
 * The shipped entities declare Postgres column types and a `now()` default,
 * which sqlite refuses. Swap just those, in this file's module registry — the
 * entities, their column names and every query run against them stay the
 * shipped ones.
 */
const SQLITE_TYPES: Record<string, string> = { timestamptz: 'datetime', cidr: 'varchar', int2: 'integer' };

for (const column of getMetadataArgsStorage().columns) {
  if (typeof column.options.type === 'string') {
    column.options.type = (SQLITE_TYPES[column.options.type] ?? column.options.type) as typeof column.options.type;
  }

  if (column.options.default === 'now()') {
    column.options.default = (): string => 'CURRENT_TIMESTAMP';
  }
}

interface Harness {
  readonly dataSource: DataSource;
  readonly memberRepo: Repository<BaseMemberEntity>;
  readonly loginLogRepo: Repository<MemberLoginLogEntity>;
  readonly service: MemberBaseService;
  readonly admin: MemberBaseAdminService;
  readonly member: BaseMemberEntity;
}

interface HarnessOptions {
  readonly loginFailedAutoUnlockSeconds?: number | null;
  readonly shouldUpdatePassword?: boolean;
}

let passwordHash: string | null = null;

const createHarness = async (options: HarnessOptions = {}): Promise<Harness> => {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: ':memory:',
    entities: [BaseMemberEntity, MemberLoginLogEntity, MemberPasswordHistoryEntity, MemberOAuthRecordEntity],
    synchronize: true,
  });

  await dataSource.initialize();

  // sqlite runs every query on its one connection and refuses a transaction
  // inside another. Postgres runs them side by side and serializes the ones
  // that update the same member on its row lock; queue them instead.
  const transaction = dataSource.manager.transaction.bind(dataSource.manager) as (
    run: (manager: EntityManager) => Promise<unknown>,
  ) => Promise<unknown>;

  let queue: Promise<unknown> = Promise.resolve();

  jest.spyOn(dataSource.manager, 'transaction').mockImplementation(((
    run: (manager: EntityManager) => Promise<unknown>,
  ): Promise<unknown> => {
    const next = queue.then(() => transaction(run));

    queue = next.catch(() => undefined);

    return next;
  }) as never);

  const memberRepo = dataSource.getRepository(BaseMemberEntity);
  const loginLogRepo = dataSource.getRepository(MemberLoginLogEntity);
  const historyRepo = dataSource.getRepository(MemberPasswordHistoryEntity);

  passwordHash ??= await hash(PASSWORD);

  const member = await memberRepo.save(
    memberRepo.create({
      account: 'alice',
      password: passwordHash,
      passwordChangedAt: new Date('2026-01-01T00:00:00.000Z'),
      resetPasswordRequestedAt: null,
      loginFailedCounter: 0,
      shouldUpdatePassword: options.shouldUpdatePassword ?? false,
    }),
  );

  const passwordValidator = {
    validatePassword: async (): Promise<boolean> => true,
    shouldUpdatePassword: (): boolean => false,
  } as unknown as PasswordValidatorService;

  const sessions = asSessionService(createFakeSessionService());

  const service = new MemberBaseService(
    undefined,
    memberRepo,
    loginLogRepo,
    THRESHOLD,
    60 * 60,
    'reset-secret',
    'access-secret',
    60 * 15,
    'refresh-secret',
    60 * 60 * 24,
    false,
    historyRepo,
    undefined,
    false,
    passwordValidator,
    (m: BaseMemberEntity) => ({ id: m.id, account: m.account }),
    options.loginFailedAutoUnlockSeconds ?? null,
    {},
    true,
    false,
    sessions,
  );

  const admin = new MemberBaseAdminService(memberRepo, passwordValidator, historyRepo, {}, sessions);

  return { dataSource, memberRepo, loginLogRepo, service, admin, member };
};

const counterOf = async (harness: Harness): Promise<number> =>
  (await harness.memberRepo.findOneByOrFail({ id: harness.member.id })).loginFailedCounter;

const setCounter = async (harness: Harness, value: number): Promise<void> => {
  await harness.memberRepo.update({ id: harness.member.id }, { loginFailedCounter: value });
};

/** Settle every attempt and tally how each one was answered. */
const attempt = async (
  harness: Harness,
  passwords: readonly string[],
): Promise<{ invalid: number; banned: number; succeeded: number; other: number }> => {
  const results = await Promise.allSettled(passwords.map(password => harness.service.login('alice', password)));

  return results.reduce(
    (tally, result) => {
      if (result.status === 'fulfilled') return { ...tally, succeeded: tally.succeeded + 1 };

      if (result.reason instanceof InvalidPasswordError) return { ...tally, invalid: tally.invalid + 1 };

      if (result.reason instanceof MemberBannedError) return { ...tally, banned: tally.banned + 1 };

      return { ...tally, other: tally.other + 1 };
    },
    { invalid: 0, banned: 0, succeeded: 0, other: 0 },
  );
};

const wrong = (count: number): string[] => Array.from({ length: count }, () => WRONG_PASSWORD);

describe('failed login counter, against a real database', () => {
  let harness: Harness;

  afterEach(async () => {
    jest.restoreAllMocks();
    await harness.dataSource.destroy();
  });

  describe('concurrent wrong passwords', () => {
    beforeEach(async () => {
      harness = await createHarness();
    });

    it('should count every one of N concurrent failures below the threshold', async () => {
      const tally = await attempt(harness, wrong(THRESHOLD - 1));

      expect(tally).toEqual({ invalid: THRESHOLD - 1, banned: 0, succeeded: 0, other: 0 });
      expect(await counterOf(harness)).toBe(THRESHOLD - 1);

      // Still one attempt short of the lock: the right password gets in and clears it.
      await expect(harness.service.login('alice', PASSWORD)).resolves.toEqual(
        expect.objectContaining({ accessToken: expect.any(String) }),
      );

      expect(await counterOf(harness)).toBe(0);
    });

    it('should lock the member after sequential failures followed by a concurrent burst', async () => {
      await attempt(harness, wrong(1));
      await attempt(harness, wrong(1));
      await attempt(harness, wrong(1));

      await attempt(harness, wrong(4));

      expect(await counterOf(harness)).toBe(THRESHOLD);
      await expect(harness.service.login('alice', PASSWORD)).rejects.toBeInstanceOf(MemberBannedError);
    });

    it('should verify no more passwords in a burst than the threshold allows', async () => {
      const tally = await attempt(harness, wrong(20));

      // An InvalidPasswordError is only ever thrown after a password was checked:
      // the attempts past the threshold are refused without being tried.
      expect(tally).toEqual({ invalid: THRESHOLD, banned: 20 - THRESHOLD, succeeded: 0, other: 0 });
      expect(await counterOf(harness)).toBe(THRESHOLD);
    });

    it('should refuse even the right password once a burst has taken the last attempt', async () => {
      await setCounter(harness, THRESHOLD - 1);

      const tally = await attempt(harness, [...wrong(3), PASSWORD]);

      expect(tally.succeeded + tally.invalid).toBe(1);
      expect(tally.banned).toBe(3);
      expect(tally.other).toBe(0);
    });
  });

  describe('auto unlock', () => {
    beforeEach(async () => {
      harness = await createHarness({ loginFailedAutoUnlockSeconds: 300 });
      await setCounter(harness, THRESHOLD);
      await harness.loginLogRepo.save(
        harness.loginLogRepo.create({
          memberId: harness.member.id,
          success: false,
          ip: null,
          createdAt: new Date(Date.now() - 600 * 1000),
        }),
      );
    });

    it('should give a burst one attempt once the window has elapsed, not one each', async () => {
      const tally = await attempt(harness, wrong(10));

      expect(tally).toEqual({ invalid: 1, banned: 9, succeeded: 0, other: 0 });
      expect(await counterOf(harness)).toBe(THRESHOLD + 1);
    });

    it('should clear the counter when that one attempt has the right password', async () => {
      await expect(harness.service.login('alice', PASSWORD)).resolves.toEqual(
        expect.objectContaining({ accessToken: expect.any(String) }),
      );

      expect(await counterOf(harness)).toBe(0);
    });

    it('should record that attempt once, as a success when the password is right', async () => {
      await harness.service.login('alice', PASSWORD);

      // The success is written without the login waiting on it.
      const successRecorded = async (): Promise<boolean> => (await harness.loginLogRepo.countBy({ success: true })) > 0;

      for (let tries = 0; tries < 50 && !(await successRecorded()); tries += 1) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const rows = await harness.loginLogRepo.find({ order: { createdAt: 'ASC' } });

      expect(rows.map(row => row.success)).toEqual([false, true]);
    });

    /**
     * The attempt that took the window is still being checked — its failure not
     * yet in the log — when the next one arrives. Holding back the log write
     * the service does not wait for puts the next attempt exactly there.
     */
    it('should refuse an attempt that arrives while the one that took the window is unrecorded', async () => {
      jest.spyOn(harness.loginLogRepo, 'save').mockImplementation(() => new Promise<never>(() => undefined));

      await expect(harness.service.login('alice', WRONG_PASSWORD)).rejects.toBeInstanceOf(InvalidPasswordError);
      await expect(harness.service.login('alice', WRONG_PASSWORD)).rejects.toBeInstanceOf(MemberBannedError);
      await expect(harness.service.login('alice', PASSWORD)).rejects.toBeInstanceOf(MemberBannedError);

      expect(await counterOf(harness)).toBe(THRESHOLD + 1);
    });

    it('should refuse an attempt that arrives just after the threshold was crossed', async () => {
      await setCounter(harness, THRESHOLD - 1);

      jest.spyOn(harness.loginLogRepo, 'save').mockImplementation(() => new Promise<never>(() => undefined));

      // The last failure on record is older than the window: only the attempt
      // that crossed the threshold can say the lock has just started.
      await expect(harness.service.login('alice', WRONG_PASSWORD)).rejects.toBeInstanceOf(InvalidPasswordError);
      await expect(harness.service.login('alice', WRONG_PASSWORD)).rejects.toBeInstanceOf(MemberBannedError);

      expect(await counterOf(harness)).toBe(THRESHOLD);
    });

    it('should give the attempt back, and leave no record of it, when the password could not be used', async () => {
      await harness.memberRepo.update({ id: harness.member.id }, { shouldUpdatePassword: true });

      await expect(harness.service.login('alice', PASSWORD)).rejects.toBeInstanceOf(PasswordShouldUpdatePasswordError);

      expect(await counterOf(harness)).toBe(THRESHOLD);
      expect(await harness.loginLogRepo.count()).toBe(1);
    });
  });

  describe('a member who must change their password', () => {
    beforeEach(async () => {
      harness = await createHarness({ shouldUpdatePassword: true });
    });

    it('should leave the counter where it was when the password is right', async () => {
      await setCounter(harness, 2);

      await expect(harness.service.login('alice', PASSWORD)).rejects.toBeInstanceOf(PasswordShouldUpdatePasswordError);

      expect(await counterOf(harness)).toBe(2);
    });

    it('should still count a wrong password', async () => {
      await expect(harness.service.login('alice', WRONG_PASSWORD)).rejects.toBeInstanceOf(InvalidPasswordError);

      expect(await counterOf(harness)).toBe(1);
    });
  });

  describe('writes made between reading the member and writing it back', () => {
    beforeEach(async () => {
      harness = await createHarness();
    });

    /**
     * Land a write on the row right after the service has read it, which is
     * where a concurrent admin action falls when it races a login.
     */
    const afterNextRead = (write: () => Promise<unknown>): void => {
      const findOne = harness.memberRepo.findOne.bind(harness.memberRepo);

      jest.spyOn(harness.memberRepo, 'findOne').mockImplementationOnce(async options => {
        const found = await findOne(options);

        await write();

        return found;
      });
    };

    it('should not write back the password a successful login read', async () => {
      const resetHash = await hash('Passw0rd-two');

      afterNextRead(() => harness.memberRepo.update({ id: harness.member.id }, { password: resetHash }));

      await harness.service.login('alice', PASSWORD);

      const row = await harness.memberRepo.findOneByOrFail({ id: harness.member.id });

      expect(row.password).toBe(resetHash);
    });

    it('should not write back the flags a failed login read', async () => {
      afterNextRead(() => harness.memberRepo.update({ id: harness.member.id }, { shouldUpdatePassword: true }));

      await expect(harness.service.login('alice', WRONG_PASSWORD)).rejects.toBeInstanceOf(InvalidPasswordError);

      const row = await harness.memberRepo.findOneByOrFail({ id: harness.member.id });

      expect(row.shouldUpdatePassword).toBe(true);
      expect(row.loginFailedCounter).toBe(1);
    });

    it('should not write back the password when an admin resets the counter', async () => {
      await setCounter(harness, THRESHOLD);

      afterNextRead(() => harness.memberRepo.update({ id: harness.member.id }, { password: 'changed-elsewhere' }));

      await harness.service.resetLoginFailedCounter(harness.member.id);

      const row = await harness.memberRepo.findOneByOrFail({ id: harness.member.id });

      expect(row.loginFailedCounter).toBe(0);
      expect(row.password).toBe('changed-elsewhere');
    });
  });
});
