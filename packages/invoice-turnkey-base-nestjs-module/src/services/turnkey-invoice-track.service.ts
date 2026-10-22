import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { TurnkeyInvoiceNumberEntity, TurnkeyInvoiceNumberRepo } from '../models/turnkey-invoice-number.entity';
import { TurnkeyInvoiceTrackEntity } from '../models/turnkey-invoice-track.entity';
import type { TurnkeyBaseModuleOptions } from '../typings/turnkey-base-module-options';
import { TURNKEY_BASE_MODULE_OPTIONS } from '../typings/turnkey-base-providers';
import { TurnkeyMigMessageType, TurnkeyNumberStatus } from '../typings/turnkey-enums';
import { TurnkeyBlankNumberRange } from '../typings/turnkey-invoice.types';
import { TurnkeyEvent, TurnkeyEvents } from '../typings/turnkey-events';
import { isTurnkeyPeriod } from '../utils/taipei-time';
import { TurnkeyValidationCode, TurnkeyValidationError } from '../validation/turnkey-validation-error';
import { TurnkeyEventService } from './turnkey-event.service';
import { TurnkeySubmissionService } from './turnkey-submission.service';

export interface TurnkeyTrackRegisterInput {
  readonly companyTaxId: string;
  /** 11510 */
  readonly period: string;
  /** LP */
  readonly track: string;
  readonly beginNumber: string;
  readonly endNumber: string;
}

export interface TurnkeyAllocation {
  readonly invoiceNumber: string;
  readonly remaining: number;
  readonly events: readonly TurnkeyEvent[];
}

export interface TurnkeyTrackSummary {
  readonly track: TurnkeyInvoiceTrackEntity;
  /** 這條字軌尚未取號的數量 */
  readonly trackRemaining: number;
  /** 同期別所有字軌尚未取號的數量（與登錄字軌時回傳的 remaining 同義） */
  readonly periodRemaining: number;
}

export interface TurnkeyBlankNumberReport {
  readonly track: string;
  readonly submissionId: string;
  readonly ranges: readonly TurnkeyBlankNumberRange[];
}

/** 期別（民國年 3 碼＋雙數月）結束的時間點：下一期第一天 00:00（台北） */
export const periodEndsAt = (period: string): Date =>
  DateTime.fromObject(
    { year: Number(period.slice(0, 3)) + 1911, month: Number(period.slice(3)), day: 1 },
    { zone: 'Asia/Taipei' },
  )
    .plus({ months: 1 })
    .toJSDate();

/** 已排序的 8 碼號碼併成連續區間 */
export const toBlankRanges = (numbers: readonly string[]): readonly TurnkeyBlankNumberRange[] =>
  numbers.reduce<readonly TurnkeyBlankNumberRange[]>((ranges, number) => {
    const last = ranges[ranges.length - 1];

    return last && Number(last.end) + 1 === Number(number)
      ? [...ranges.slice(0, -1), { begin: last.begin, end: number }]
      : [...ranges, { begin: number, end: number }];
  }, []);

const invalidTrack = (message: string): TurnkeyValidationError =>
  new TurnkeyValidationError([{ code: TurnkeyValidationCode.INVALID_TRACK, message }]);

@Injectable()
export class TurnkeyInvoiceTrackService {
  constructor(
    @Inject(TURNKEY_BASE_MODULE_OPTIONS)
    private readonly options: TurnkeyBaseModuleOptions,
    @Inject(TurnkeyInvoiceNumberRepo)
    private readonly numberRepo: Repository<TurnkeyInvoiceNumberEntity>,
    private readonly dataSource: DataSource,
    private readonly eventService: TurnkeyEventService,
    private readonly submissionService: TurnkeySubmissionService,
  ) {}

  /** 登錄平台配發的字軌區間，展開成逐號紀錄 */
  async register(input: TurnkeyTrackRegisterInput): Promise<TurnkeyInvoiceTrackEntity> {
    const fields = [input.period, input.track, input.beginNumber, input.endNumber];

    if (!fields.every(field => typeof field === 'string')) throw invalidTrack('期別、字軌、起訖號需為字串');

    if (!/^\d{3}(0[2468]|1[02])$/.test(input.period)) throw invalidTrack('期別需為民國年 3 碼＋雙數月');

    if (!/^[A-Z]{2}$/.test(input.track)) throw invalidTrack('字軌需為 2 碼大寫英文');

    if (!/^\d{8}$/.test(input.beginNumber) || !/^\d{8}$/.test(input.endNumber)) {
      throw invalidTrack('起訖號需為 8 碼數字');
    }

    const begin = Number(input.beginNumber);
    const end = Number(input.endNumber);

    if (end < begin || end - begin >= 10000) throw invalidTrack('起訖號範圍錯誤');

    return this.dataSource.transaction(async manager => {
      // 只取白名單欄位並用 insert：呼叫端多帶 id 也不會變成 UPDATE 改到別家的字軌
      const track = manager.create(TurnkeyInvoiceTrackEntity, {
        companyTaxId: input.companyTaxId,
        period: input.period,
        track: input.track,
        beginNumber: input.beginNumber,
        endNumber: input.endNumber,
      });

      await manager.insert(TurnkeyInvoiceTrackEntity, track).catch((error: unknown) => {
        // 唯一鍵（統編, 期別, 字軌, 起號）：同一區間重複登錄
        if ((error as { code?: string }).code === '23505') throw invalidTrack('此字軌區間已登錄');

        throw error;
      });

      const numbers = Array.from({ length: end - begin + 1 }, (_, index) =>
        manager.create(TurnkeyInvoiceNumberEntity, {
          companyTaxId: input.companyTaxId,
          trackId: track.id,
          period: input.period,
          invoiceNumber: `${input.track}${String(begin + index).padStart(8, '0')}`,
          status: TurnkeyNumberStatus.AVAILABLE,
        }),
      );

      await manager.insert(TurnkeyInvoiceNumberEntity, numbers).catch((error: unknown) => {
        // 號碼唯一鍵（統編, 號碼）：與已登錄的區間重疊；整筆交易回滾，字軌列也不會留下
        if ((error as { code?: string }).code === '23505') throw invalidTrack('與已登錄的字軌區間重疊');

        throw error;
      });

      return track;
    });
  }

  /**
   * 在呼叫端的交易內取下一個號碼。先鎖住該期所有字軌列，讓取號序列化，
   * 號碼一定由小到大配發（同字軌的日期順序才不會亂）。
   */
  async allocate(manager: EntityManager, companyTaxId: string, period: string): Promise<TurnkeyAllocation> {
    await manager
      .createQueryBuilder(TurnkeyInvoiceTrackEntity, 'track')
      .setLock('pessimistic_write')
      .where('track.companyTaxId = :companyTaxId AND track.period = :period', { companyTaxId, period })
      .getMany();

    const next = await manager.findOne(TurnkeyInvoiceNumberEntity, {
      where: { companyTaxId, period, status: TurnkeyNumberStatus.AVAILABLE },
      order: { invoiceNumber: 'ASC' },
    });

    if (!next) {
      throw new TurnkeyValidationError([
        { code: TurnkeyValidationCode.NO_AVAILABLE_NUMBER, message: `${period} 期沒有可用號碼` },
      ]);
    }

    await manager.update(TurnkeyInvoiceNumberEntity, next.id, { status: TurnkeyNumberStatus.ALLOCATED });

    const remaining = await manager.count(TurnkeyInvoiceNumberEntity, {
      where: { companyTaxId, period, status: TurnkeyNumberStatus.AVAILABLE },
    });

    const threshold = this.options.notifications?.invoiceTrackRunningLowThreshold ?? 50;

    // 跨過門檻時與用完時各通知一次，不是每次取號都發
    const events =
      remaining === threshold - 1 || remaining === 0
        ? [
            await this.eventService.append(manager, TurnkeyEvents.INVOICE_TRACK_RUNNING_LOW, companyTaxId, {
              period,
              remaining,
            }),
          ]
        : [];

    return { invoiceNumber: next.invoiceNumber, remaining, events };
  }

  async setStatus(
    manager: EntityManager,
    companyTaxId: string,
    invoiceNumber: string,
    status: TurnkeyNumberStatus,
  ): Promise<void> {
    await manager.update(TurnkeyInvoiceNumberEntity, { companyTaxId, invoiceNumber }, { status });
  }

  /** 本機或平台退件、決定不再使用的號碼（RETURNED → ABANDONED），期末以 E0402 申報空白 */
  async abandon(companyTaxId: string, invoiceNumber: string): Promise<TurnkeyInvoiceNumberEntity> {
    const result = await this.numberRepo.update(
      { companyTaxId, invoiceNumber, status: TurnkeyNumberStatus.RETURNED },
      { status: TurnkeyNumberStatus.ABANDONED },
    );

    if (!result.affected) {
      const exists = (await this.numberRepo.count({ where: { companyTaxId, invoiceNumber } })) > 0;

      if (!exists) {
        throw new TurnkeyValidationError([
          {
            code: TurnkeyValidationCode.NUMBER_OUT_OF_TRACK,
            message: '此號碼不在營業人登錄的字軌內',
            field: 'invoiceNumber',
          },
        ]);
      }

      throw new TurnkeyValidationError([
        {
          code: TurnkeyValidationCode.INVALID_STATE,
          message: '只有退件（RETURNED）的號碼可以放棄',
          field: 'invoiceNumber',
        },
      ]);
    }

    return (await this.numberRepo.findOne({ where: { companyTaxId, invoiceNumber } })) as TurnkeyInvoiceNumberEntity;
  }

  /**
   * 期末空白號碼申報（E0402）：該期 AVAILABLE 與 ABANDONED 的號碼，每個字軌一筆，連續號碼併成區間。
   * 期別結束後才能申報；還有送件中或退件未處理（ALLOCATED、SUBMITTED、RETURNED）的號碼時拒絕。
   * 申報後 AVAILABLE 改為 ABANDONED；同一字軌已有進行中或已收下的申報時拒絕（平台不判重複）。
   */
  async reportBlankNumbers(
    companyTaxId: string,
    period: string,
    now: Date = new Date(),
  ): Promise<readonly TurnkeyBlankNumberReport[]> {
    if (!isTurnkeyPeriod(period)) throw invalidTrack('期別需為民國年 3 碼＋雙數月');

    if (now < periodEndsAt(period)) throw invalidTrack(`${period} 期尚未結束，不能申報空白號碼`);

    return this.dataSource.transaction(async manager => {
      await manager
        .createQueryBuilder(TurnkeyInvoiceTrackEntity, 'track')
        .setLock('pessimistic_write')
        .where('track.companyTaxId = :companyTaxId AND track.period = :period', { companyTaxId, period })
        .getMany();

      const pending = await manager.find(TurnkeyInvoiceNumberEntity, {
        select: { invoiceNumber: true, status: true },
        where: {
          companyTaxId,
          period,
          status: In([TurnkeyNumberStatus.ALLOCATED, TurnkeyNumberStatus.SUBMITTED, TurnkeyNumberStatus.RETURNED]),
        },
        order: { invoiceNumber: 'ASC' },
      });

      if (pending.length) {
        throw invalidTrack(
          `尚有未結案的號碼：${pending.map(number => `${number.invoiceNumber}(${number.status})`).join(', ')}`,
        );
      }

      const blanks = await manager.find(TurnkeyInvoiceNumberEntity, {
        select: { id: true, invoiceNumber: true },
        where: { companyTaxId, period, status: In([TurnkeyNumberStatus.AVAILABLE, TurnkeyNumberStatus.ABANDONED]) },
        order: { invoiceNumber: 'ASC' },
      });

      const tracks = [...new Set(blanks.map(number => number.invoiceNumber.slice(0, 2)))];

      const reports = await tracks.reduce<Promise<readonly TurnkeyBlankNumberReport[]>>(
        async (reportsPromise, track) => {
          const done = await reportsPromise;
          const documentNumber = `${track}${period}`;

          if (
            await this.submissionService.hasActive(manager, companyTaxId, documentNumber, TurnkeyMigMessageType.E0402)
          ) {
            throw new TurnkeyValidationError([
              {
                code: TurnkeyValidationCode.NUMBER_ALREADY_REPORTED_BLANK,
                message: `${documentNumber} 已申報過空白號碼`,
              },
            ]);
          }

          const ranges = toBlankRanges(
            blanks
              .filter(number => number.invoiceNumber.startsWith(track))
              .map(number => number.invoiceNumber.slice(2)),
          );

          const submission = await this.submissionService.enqueue(manager, companyTaxId, documentNumber, {
            messageType: TurnkeyMigMessageType.E0402,
            headTaxId: companyTaxId,
            branchTaxId: companyTaxId,
            period,
            track,
            ranges,
          });

          return [...done, { track, submissionId: submission.id, ranges }];
        },
        Promise.resolve([]),
      );

      await manager.update(
        TurnkeyInvoiceNumberEntity,
        { companyTaxId, period, status: TurnkeyNumberStatus.AVAILABLE },
        { status: TurnkeyNumberStatus.ABANDONED },
      );

      return reports;
    });
  }

  /** 已登錄的字軌，新期別在前；帶 period 時只列該期 */
  async list(companyTaxId: string, period?: string): Promise<readonly TurnkeyTrackSummary[]> {
    if (period !== undefined && !isTurnkeyPeriod(period)) {
      throw new TurnkeyValidationError([
        {
          code: TurnkeyValidationCode.INVALID_PERIOD,
          message: '期別格式為民國年 3 碼＋雙數月，例如 11510',
          field: 'period',
        },
      ]);
    }

    const tracks = await this.dataSource.getRepository(TurnkeyInvoiceTrackEntity).find({
      where: { companyTaxId, ...(period ? { period } : {}) },
      order: { period: 'DESC', track: 'ASC', beginNumber: 'ASC' },
    });

    if (!tracks.length) return [];

    const counts = await this.numberRepo
      .createQueryBuilder('number')
      .select('number.trackId', 'trackId')
      .addSelect('COUNT(*)', 'count')
      .where('number.companyTaxId = :companyTaxId', { companyTaxId })
      .andWhere('number.status = :status', { status: TurnkeyNumberStatus.AVAILABLE })
      .andWhere('number.trackId IN (:...trackIds)', { trackIds: tracks.map(track => track.id) })
      .groupBy('number.trackId')
      .getRawMany<{ trackId: string; count: string }>();

    const byTrack = new Map(counts.map(row => [row.trackId, Number(row.count)]));
    const trackRemaining = (track: TurnkeyInvoiceTrackEntity): number => byTrack.get(track.id) ?? 0;
    const periodRemaining = (period: string): number =>
      tracks.filter(track => track.period === period).reduce((sum, track) => sum + trackRemaining(track), 0);

    return tracks.map(track => ({
      track,
      trackRemaining: trackRemaining(track),
      periodRemaining: periodRemaining(track.period),
    }));
  }

  /** 單一字軌尚未取號的數量 */
  trackRemaining(companyTaxId: string, trackId: string): Promise<number> {
    return this.numberRepo.count({ where: { companyTaxId, trackId, status: TurnkeyNumberStatus.AVAILABLE } });
  }

  remaining(companyTaxId: string, period: string): Promise<number> {
    return this.numberRepo.count({ where: { companyTaxId, period, status: TurnkeyNumberStatus.AVAILABLE } });
  }
}
