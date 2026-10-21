import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import type { TurnkeyBaseModuleOptions } from '../typings/turnkey-base-module-options';
import { TURNKEY_BASE_MODULE_OPTIONS } from '../typings/turnkey-base-providers';
import path from 'path';
import { DEFAULT_INBOUND_ARCHIVE_DIRECTORY, scanInbound } from '../inbound/inbound-watcher';
import { TurnkeyInboundService } from '../inbound/turnkey-inbound.service';
import { TurnkeyMaintenanceService } from '../services/turnkey-maintenance.service';
import { TurnkeyReconciliationService } from '../services/turnkey-reconciliation.service';
import { TurnkeySubmissionWorker } from './turnkey-submission.worker';

/** 背景工作的 session advisory lock key；同一個 DB 只有一個實例會跑背景工作 */
export const TURNKEY_WORKER_LOCK_KEY = 7_308_640_002;

/** 例行維護（冪等 key 清除、憑證到期檢查）的間隔 */
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class TurnkeyWorkerRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TurnkeyWorkerRunner.name);
  private timer: NodeJS.Timeout | null = null;
  private lockRunner: QueryRunner | null = null;
  private running = false;
  private lastMaintenanceAt = 0;

  constructor(
    @Inject(TURNKEY_BASE_MODULE_OPTIONS)
    private readonly options: TurnkeyBaseModuleOptions,
    private readonly dataSource: DataSource,
    private readonly worker: TurnkeySubmissionWorker,
    private readonly inboundService: TurnkeyInboundService,
    private readonly maintenanceService: TurnkeyMaintenanceService,
    private readonly reconciliationService: TurnkeyReconciliationService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.options.workers?.enabled === false) return;

    const interval = this.options.workers?.pollIntervalMs ?? 10_000;

    this.timer = setInterval(() => void this.tick(), interval);
    void this.tick();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);

    if (this.lockRunner) {
      await this.lockRunner.query('SELECT pg_advisory_unlock($1)', [TURNKEY_WORKER_LOCK_KEY]).catch(() => undefined);

      await this.lockRunner.release();
      this.lockRunner = null;
    }
  }

  /** 一輪：先寫檔，再輪詢結果。上一輪還沒跑完就跳過 */
  async tick(): Promise<void> {
    if (this.running) return;

    this.running = true;

    try {
      if (!(await this.holdLock())) return;

      await this.worker.writePending();
      await this.worker.pollWritten();

      if (this.options.workers?.inbound !== false) await this.scanInbound();

      await this.maintain();
    } catch (error) {
      this.logger.error(`Turnkey worker tick failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /** 每小時最多一次；憑證通知以台北日去重、對帳以日期去重，重啟不會重複發 */
  private async maintain(): Promise<void> {
    if (Date.now() - this.lastMaintenanceAt < MAINTENANCE_INTERVAL_MS) return;

    this.lastMaintenanceAt = Date.now();

    const result = await this.maintenanceService.run();

    if (result.certificateEvents.length) {
      this.logger.warn(
        `Certificates expiring: ${result.certificateEvents.map(event => event.companyTaxId).join(', ')}`,
      );
    }
  }

  async scanInbound(): Promise<void> {
    const archivePath =
      this.options.workers?.inboundArchivePath ?? path.join(this.options.dataPath, DEFAULT_INBOUND_ARCHIVE_DIRECTORY);

    const results = await scanInbound(this.options.dataPath, archivePath, (message, fileName) =>
      this.inboundService.process(message, fileName),
    );

    results
      .filter(result => result.outcome === 'ERROR' || result.outcome === 'UNRECOGNIZED')
      .forEach(result =>
        this.logger.warn(`Inbound ${result.fileName}: ${result.outcome}${result.error ? ` (${result.error})` : ''}`),
      );
  }

  private async holdLock(): Promise<boolean> {
    if (this.lockRunner) return true;

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();

    const [row] = (await runner.query('SELECT pg_try_advisory_lock($1) AS locked', [TURNKEY_WORKER_LOCK_KEY])) as {
      locked: boolean;
    }[];

    if (!row?.locked) {
      await runner.release();

      return false;
    }

    this.lockRunner = runner;

    return true;
  }
}
