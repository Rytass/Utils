import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { DataSource, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { BaseTurnkeyCompanyEntity } from '../models/turnkey-company.entity';
import { TurnkeyEventEntity } from '../models/turnkey-event.entity';
import type { TurnkeyBaseModuleOptions } from '../typings/turnkey-base-module-options';
import { TURNKEY_BASE_MODULE_OPTIONS } from '../typings/turnkey-base-providers';
import { TurnkeyEvent, TurnkeyEvents } from '../typings/turnkey-events';
import { TurnkeyEventService } from './turnkey-event.service';
import { TurnkeyIdempotencyService } from './turnkey-idempotency.service';

export const DEFAULT_CERTIFICATE_EXPIRY_NOTICE_DAYS = 30;

export interface TurnkeyMaintenanceResult {
  readonly purgedIdempotencyKeys: number;
  readonly certificateEvents: readonly TurnkeyEvent[];
}

/** 背景例行工作：清過期的冪等 key、檢查憑證到期（同一營業人每個台北日最多一筆 certificate.expiring） */
@Injectable()
export class TurnkeyMaintenanceService {
  constructor(
    @Inject(TURNKEY_BASE_MODULE_OPTIONS)
    private readonly options: TurnkeyBaseModuleOptions,
    private readonly dataSource: DataSource,
    private readonly eventService: TurnkeyEventService,
    private readonly idempotencyService: TurnkeyIdempotencyService,
  ) {}

  async run(now: Date = new Date()): Promise<TurnkeyMaintenanceResult> {
    const purgedIdempotencyKeys = await this.idempotencyService.purgeExpired(now);
    const certificateEvents = await this.checkCertificates(now);

    this.eventService.publish(certificateEvents);

    return { purgedIdempotencyKeys, certificateEvents };
  }

  /** 憑證到期日落在提前通知天數內（含已過期）的營業人，各發一筆 certificate.expiring */
  async checkCertificates(now: Date = new Date()): Promise<readonly TurnkeyEvent[]> {
    const noticeDays =
      this.options.notifications?.certificateExpiryNoticeDays ?? DEFAULT_CERTIFICATE_EXPIRY_NOTICE_DAYS;

    const today = DateTime.fromJSDate(now, { zone: 'Asia/Taipei' }).startOf('day');

    const companies = await this.dataSource.getRepository(BaseTurnkeyCompanyEntity).find({
      select: { taxId: true, certificateExpiresAt: true },
      where: {
        // NULL（未登錄到期日）不會符合比較條件
        certificateExpiresAt: LessThanOrEqual(today.plus({ days: noticeDays }).endOf('day').toJSDate()),
      },
    });

    return companies.reduce<Promise<readonly TurnkeyEvent[]>>(async (eventsPromise, company) => {
      const events = await eventsPromise;
      const expiresAt = company.certificateExpiresAt as Date;

      const event = await this.dataSource.transaction(async manager => {
        const notified = await manager.count(TurnkeyEventEntity, {
          where: {
            type: TurnkeyEvents.CERTIFICATE_EXPIRING,
            companyTaxId: company.taxId,
            createdAt: MoreThanOrEqual(today.toJSDate()),
          },
        });

        if (notified > 0) return null;

        const daysLeft = Math.floor(
          DateTime.fromJSDate(expiresAt, { zone: 'Asia/Taipei' }).startOf('day').diff(today, 'days').days,
        );

        return this.eventService.append(manager, TurnkeyEvents.CERTIFICATE_EXPIRING, company.taxId, {
          expiresAt: expiresAt.toISOString(),
          daysLeft,
        });
      });

      return event ? [...events, event] : events;
    }, Promise.resolve([]));
  }
}
