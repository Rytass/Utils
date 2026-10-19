import { FindOperator, type UpdateResult } from 'typeorm';
import type { BaseMemberEntity } from '../../src/models/base-member.entity';

type Where = Record<string, unknown>;

const matches = (member: BaseMemberEntity, where: Where): boolean =>
  Object.entries(where).every(([key, expected]) => {
    const actual = (member as unknown as Record<string, unknown>)[key];

    if (expected instanceof FindOperator) {
      switch (expected.type) {
        case 'lessThan':
          return (actual as number) < (expected.value as number);

        case 'moreThan':
          return (actual as number) > (expected.value as number);

        default:
          throw new Error(`Unsupported find operator in a member write: ${expected.type}`);
      }
    }

    return actual === expected;
  });

const result = (affected: number): UpdateResult => ({ affected, raw: [], generatedMaps: [] });

/**
 * The column writes `MemberBaseService` makes to a member — `update`,
 * `increment`, `decrement` — for a hand-rolled repository double, applied to
 * the member objects the double holds. Each reports how many rows it touched,
 * which is what a conditional increment is judged by.
 *
 * `onWrite` runs before every write, so a spec can make the database fail.
 */
export const memberRepoWrites = (
  members: () => Iterable<BaseMemberEntity>,
  onWrite?: () => void,
): {
  update: jest.Mock;
  increment: jest.Mock;
  decrement: jest.Mock;
} => {
  const apply = (where: Where, change: (member: BaseMemberEntity) => void): UpdateResult => {
    onWrite?.();

    const touched = [...members()].filter(member => matches(member, where));

    touched.forEach(change);

    return result(touched.length);
  };

  const step =
    (sign: 1 | -1): ((where: Where, property: string, value: number) => Promise<UpdateResult>) =>
    async (where: Where, property: string, value: number): Promise<UpdateResult> =>
      apply(where, member => {
        const record = member as unknown as Record<string, number>;

        record[property] += sign * value;
      });

  return {
    update: jest.fn(
      async (where: Where, changes: Partial<BaseMemberEntity>): Promise<UpdateResult> =>
        apply(where, member => Object.assign(member, changes)),
    ),
    increment: jest.fn(step(1)),
    decrement: jest.fn(step(-1)),
  };
};

/**
 * A member as a read hands it out: a copy of the row, as a database would.
 * Handing out the row itself would let the service's in-memory bookkeeping
 * land on it a second time, after the write it just made.
 */
export const readCopy = <T extends BaseMemberEntity>(member: T): T =>
  Object.assign(Object.create(Object.getPrototypeOf(member) as object) as T, member);

type RepoMethod = (...args: unknown[]) => Promise<unknown>;

/**
 * Give a member repository double the two paths auto unlock takes through its
 * manager: the last failed login read from the primary, and the transaction a
 * login attempt is counted in together with the failure it logs. Both land on
 * the doubles' own methods; a logged failure goes through the login log's
 * `save`, and its id is the one that call returns.
 */
export const withLoginLogTransactions = (memberRepo: object, loginLogRepo: object): void => {
  const members = memberRepo as Record<string, RepoMethod>;
  const logs = loginLogRepo as Record<string, RepoMethod>;
  const memberTarget = 'BaseMemberEntity';
  const logTarget = 'MemberLoginLogEntity';

  const routed = (target: unknown): Record<string, RepoMethod> => {
    if (target === memberTarget) return members;

    if (target === logTarget) return logs;

    throw new Error(`Write to an unexpected target: ${String(target)}`);
  };

  const manager = {
    increment: (target: unknown, ...args: unknown[]): Promise<unknown> => routed(target).increment(...args),
    decrement: (target: unknown, ...args: unknown[]): Promise<unknown> => routed(target).decrement(...args),
    delete: (target: unknown, ...args: unknown[]): Promise<unknown> => routed(target).delete(...args),
    insert: async (target: unknown, values: unknown): Promise<unknown> => {
      const saved = (await routed(target).save(values)) as { id?: string };

      return { identifiers: [{ id: saved.id ?? 'logged-attempt' }] };
    },
  };

  Object.assign(memberRepo, {
    target: memberTarget,
    manager: {
      transaction: (run: (transactional: typeof manager) => Promise<unknown>): Promise<unknown> => run(manager),
      connection: {
        createQueryRunner: (): unknown => ({
          manager: {
            findOne: (target: unknown, options: unknown): Promise<unknown> => routed(target).findOne(options),
          },
          release: async (): Promise<void> => undefined,
        }),
      },
    },
  });

  Object.assign(loginLogRepo, {
    target: logTarget,
    delete: logs.delete ?? jest.fn(async () => ({ affected: 1, raw: [] })),
    update: logs.update ?? jest.fn(async () => ({ affected: 1, raw: [], generatedMaps: [] })),
  });
};
