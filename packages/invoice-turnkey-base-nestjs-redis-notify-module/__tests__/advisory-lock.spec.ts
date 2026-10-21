import type { DataSource, QueryRunner } from 'typeorm';
import { PgAdvisoryLock } from '../src/utils/advisory-lock';

interface FakeRunner {
  readonly runner: QueryRunner;
  readonly released: () => boolean;
}

const fakeRunner = (pingFails: () => boolean): FakeRunner => {
  const state = { released: false };
  const runner = {
    connect: jest.fn(async (): Promise<void> => undefined),
    release: jest.fn(async (): Promise<void> => {
      state.released = true;
    }),
    query: jest.fn(async (sql: string): Promise<unknown> => {
      if (sql === 'SELECT 1' && pingFails()) throw new Error('Connection terminated');

      return [{ locked: true }];
    }),
  } as unknown as QueryRunner;

  return { runner, released: (): boolean => state.released };
};

describe('PgAdvisoryLock', () => {
  it('keeps the lock while its session is alive', async () => {
    const first = fakeRunner(() => false);
    const createQueryRunner = jest.fn((): QueryRunner => first.runner);
    const lock = new PgAdvisoryLock({ createQueryRunner } as Pick<DataSource, 'createQueryRunner'>, 1);

    expect(await lock.acquire()).toBe(true);
    expect(await lock.acquire()).toBe(true);
    expect(createQueryRunner).toHaveBeenCalledTimes(1);
  });

  it('takes the lock again on a new session when the old connection is gone', async () => {
    const dead = { value: false };
    const first = fakeRunner(() => dead.value);
    const second = fakeRunner(() => false);
    const createQueryRunner = jest
      .fn<QueryRunner, []>()
      .mockReturnValueOnce(first.runner)
      .mockReturnValueOnce(second.runner);

    const lock = new PgAdvisoryLock({ createQueryRunner } as Pick<DataSource, 'createQueryRunner'>, 1);

    expect(await lock.acquire()).toBe(true);

    dead.value = true;

    expect(await lock.acquire()).toBe(true);
    expect(createQueryRunner).toHaveBeenCalledTimes(2);
    expect(first.released()).toBe(true);
  });
});
