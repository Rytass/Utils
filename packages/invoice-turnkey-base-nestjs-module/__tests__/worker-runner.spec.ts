/**
 * @jest-environment node
 */

import type { DataSource, QueryRunner } from 'typeorm';
import type { TurnkeyInboundService } from '../src/inbound/turnkey-inbound.service';
import type { TurnkeyMaintenanceService } from '../src/services/turnkey-maintenance.service';
import type { TurnkeyReconciliationService } from '../src/services/turnkey-reconciliation.service';
import type { TurnkeyBaseModuleOptions } from '../src/typings/turnkey-base-module-options';
import type { TurnkeySubmissionWorker } from '../src/workers/turnkey-submission.worker';
import { TurnkeyWorkerRunner } from '../src/workers/turnkey-worker.runner';

interface Harness {
  readonly runner: TurnkeyWorkerRunner;
  readonly calls: string[];
  readonly released: jest.Mock;
}

const createHarness = (options: {
  readonly lockQuery: (sql: string) => Promise<unknown>;
  readonly writePending?: () => Promise<number>;
}): Harness => {
  const calls: string[] = [];
  const released = jest.fn(async (): Promise<void> => undefined);
  const queryRunner = {
    connect: jest.fn(async (): Promise<void> => undefined),
    query: jest.fn(options.lockQuery),
    release: released,
  } as unknown as QueryRunner;

  const dataSource = { createQueryRunner: (): QueryRunner => queryRunner } as unknown as DataSource;

  const worker = {
    writePending: jest.fn(
      options.writePending ??
        (async (): Promise<number> => {
          calls.push('writePending');

          return 0;
        }),
    ),
    pollWritten: jest.fn(async (): Promise<number> => {
      calls.push('pollWritten');

      return 0;
    }),
  } as unknown as TurnkeySubmissionWorker;

  const maintenance = {
    run: jest.fn(async (): Promise<{ certificateEvents: [] }> => {
      calls.push('maintenance');

      return { certificateEvents: [] };
    }),
  } as unknown as TurnkeyMaintenanceService;

  const reconciliation = {
    reconcileYesterdayIfDue: jest.fn(async (): Promise<null> => null),
  } as unknown as TurnkeyReconciliationService;

  const moduleOptions = {
    dataPath: '/nonexistent-turnkey-data',
    workers: { inbound: false },
  } as unknown as TurnkeyBaseModuleOptions;

  const runner = new TurnkeyWorkerRunner(
    moduleOptions,
    dataSource,
    worker,
    {} as TurnkeyInboundService,
    maintenance,
    reconciliation,
  );

  return { runner, calls, released };
};

describe('TurnkeyWorkerRunner tick', () => {
  it('keeps running later steps when one step fails', async (): Promise<void> => {
    const { runner, calls } = createHarness({
      lockQuery: async (): Promise<unknown> => [{ locked: true }],
      writePending: async (): Promise<number> => {
        throw new Error('disk full');
      },
    });

    await runner.tick();

    expect(calls).toEqual(['pollWritten', 'maintenance']);
  });

  it('releases the query runner when taking the lock fails', async (): Promise<void> => {
    const { runner, calls, released } = createHarness({
      lockQuery: async (): Promise<unknown> => {
        throw new Error('Connection terminated');
      },
    });

    await runner.tick();

    expect(released).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
  });
});
