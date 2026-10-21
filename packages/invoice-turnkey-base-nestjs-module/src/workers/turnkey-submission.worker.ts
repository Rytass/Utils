import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { TurnkeyAllowanceEntity } from '../models/turnkey-allowance.entity';
import { BaseTurnkeyInvoiceEntity } from '../models/turnkey-invoice.entity';
import { TurnkeySubmissionEntity, TurnkeySubmissionRepo } from '../models/turnkey-submission.entity';
import { TurnkeyEventService } from '../services/turnkey-event.service';
import { TurnkeyInvoiceTrackService } from '../services/turnkey-invoice-track.service';
import type { TurnkeyBaseModuleOptions } from '../typings/turnkey-base-module-options';
import { TURNKEY_BASE_MODULE_OPTIONS, TURNKEY_LOG_READER } from '../typings/turnkey-base-providers';
import {
  TurnkeyAllowanceStatus,
  TurnkeyInvoiceStatus,
  TurnkeyMigMessageType,
  TurnkeyNumberStatus,
  TurnkeySubmissionStatus,
} from '../typings/turnkey-enums';
import { TurnkeyEvent, TurnkeyEvents } from '../typings/turnkey-events';
import { resolveSubmissionResult, SubmissionResult } from './resolve-submission-result';
import { writeSubmissionFile } from './submission-writer';
import type { TurnkeyLogReader } from './turnkey-log-reader';

const INVOICE_ISSUE_TYPES: ReadonlySet<TurnkeyMigMessageType> = new Set([
  TurnkeyMigMessageType.F0401,
  TurnkeyMigMessageType.A0101,
]);

const SUBMISSION_EVENT: Readonly<Record<SubmissionResult['status'], TurnkeyEvents>> = {
  [TurnkeySubmissionStatus.ACCEPTED]: TurnkeyEvents.SUBMISSION_ACCEPTED,
  [TurnkeySubmissionStatus.REJECTED]: TurnkeyEvents.SUBMISSION_REJECTED,
  [TurnkeySubmissionStatus.FAILED]: TurnkeyEvents.SUBMISSION_FAILED,
};

/** SubmissionWriter 與 StatusPoller；由 TurnkeyWorkerRunner 在取得 advisory lock 的實例上定期呼叫 */
@Injectable()
export class TurnkeySubmissionWorker {
  private readonly logger = new Logger(TurnkeySubmissionWorker.name);

  constructor(
    @Inject(TURNKEY_BASE_MODULE_OPTIONS)
    private readonly options: TurnkeyBaseModuleOptions,
    @Inject(TurnkeySubmissionRepo)
    private readonly submissionRepo: Repository<TurnkeySubmissionEntity>,
    @Inject(TURNKEY_LOG_READER)
    private readonly logReader: TurnkeyLogReader,
    private readonly dataSource: DataSource,
    private readonly trackService: TurnkeyInvoiceTrackService,
    private readonly eventService: TurnkeyEventService,
  ) {}

  /** 把 PENDING 的 submission 寫進 UpCast；回傳寫出的筆數 */
  async writePending(limit = 50): Promise<number> {
    const pending = await this.submissionRepo.find({
      where: { status: TurnkeySubmissionStatus.PENDING },
      order: { createdAt: 'ASC' },
      take: limit,
    });

    const written = await pending.reduce<Promise<number>>(async (countPromise, submission) => {
      const count = await countPromise;

      try {
        await writeSubmissionFile(this.options.dataPath, submission);
      } catch (error) {
        this.logger.error(`Cannot write ${submission.fileName}: ${(error as Error).message}`);

        return count;
      }

      // rename 之後才改狀態；若在這之間當掉，下一輪會用同檔名重寫，平台以 E0201（重複）回覆，視為已收
      await this.dataSource.transaction(async manager => {
        await manager.update(TurnkeySubmissionEntity, submission.id, {
          status: TurnkeySubmissionStatus.WRITTEN,
          writtenAt: new Date(),
        });

        if (INVOICE_ISSUE_TYPES.has(submission.messageType)) {
          await this.trackService.setStatus(
            manager,
            submission.companyTaxId,
            submission.documentNumber,
            TurnkeyNumberStatus.SUBMITTED,
          );
        }
      });

      return count + 1;
    }, Promise.resolve(0));

    return written;
  }

  /** 讀 Turnkey DB 更新 WRITTEN 的 submission；回傳有結果的筆數 */
  async pollWritten(limit = 200): Promise<number> {
    const written = await this.submissionRepo.find({
      where: { status: TurnkeySubmissionStatus.WRITTEN },
      order: { writtenAt: 'ASC' },
      take: limit,
    });

    const resolved = await written.reduce<Promise<number>>(async (countPromise, submission) => {
      const count = await countPromise;
      const record = await this.logReader.findByUpCastFileName(submission.fileName);
      const result = resolveSubmissionResult(record);

      if (!result) {
        await this.notifyIfStalled(submission);

        return count;
      }

      const events = await this.dataSource.transaction(manager =>
        this.applyResult(manager, submission, result, record?.uuid ?? null),
      );

      this.eventService.publish(events);

      return count + 1;
    }, Promise.resolve(0));

    return resolved;
  }

  /**
   * 長時間沒有結果時只通知、不改狀態：平台可能稍後才收下，自動標失敗再重送會重複開立。
   * 這段期間同一文件的作廢、註銷與空白申報仍會被擋，需人工到 Turnkey 確認。
   */
  private async notifyIfStalled(submission: TurnkeySubmissionEntity): Promise<void> {
    const thresholdMs = (this.options.workers?.stalledAfterMinutes ?? 120) * 60_000;

    if (submission.stalledNotifiedAt || !submission.writtenAt) return;

    if (Date.now() - submission.writtenAt.getTime() < thresholdMs) return;

    const events = await this.dataSource.transaction(async manager => {
      const updated = await manager
        .createQueryBuilder()
        .update(TurnkeySubmissionEntity)
        .set({ stalledNotifiedAt: () => 'now()' })
        .where('id = :id AND "stalledNotifiedAt" IS NULL AND status = :status', {
          id: submission.id,
          status: TurnkeySubmissionStatus.WRITTEN,
        })
        .execute();

      if (!updated.affected) return [];

      return [
        await this.eventService.append(manager, TurnkeyEvents.SUBMISSION_STALLED, submission.companyTaxId, {
          submissionId: submission.id,
          messageType: submission.messageType,
          documentNumber: submission.documentNumber,
          fileName: submission.fileName,
          writtenAt: submission.writtenAt?.toISOString() ?? null,
        }),
      ];
    });

    this.eventService.publish(events);
  }

  private async applyResult(
    manager: EntityManager,
    submission: TurnkeySubmissionEntity,
    result: SubmissionResult,
    turnkeyUuid: string | null,
  ): Promise<readonly TurnkeyEvent[]> {
    // 只更新仍是 WRITTEN 的列，避免兩個實例重複套用
    const updated = await manager.update(
      TurnkeySubmissionEntity,
      { id: submission.id, status: In([TurnkeySubmissionStatus.WRITTEN]) },
      {
        status: result.status,
        resultCode: result.code,
        resultMessage: result.message,
        turnkeyUuid,
        resolvedAt: new Date(),
      },
    );

    if (!updated.affected) return [];

    const submissionEvent = await this.eventService.append(
      manager,
      SUBMISSION_EVENT[result.status],
      submission.companyTaxId,
      {
        submissionId: submission.id,
        messageType: submission.messageType,
        documentNumber: submission.documentNumber,
        code: result.code,
        message: result.message,
      },
    );

    const follow = await this.applyDocumentResult(
      manager,
      submission,
      result.status === TurnkeySubmissionStatus.ACCEPTED,
    );

    return [submissionEvent, ...follow];
  }

  /** 依訊息類型更新發票狀態與號碼，回傳額外的事件 */
  private async applyDocumentResult(
    manager: EntityManager,
    submission: TurnkeySubmissionEntity,
    accepted: boolean,
  ): Promise<readonly TurnkeyEvent[]> {
    const { companyTaxId, documentNumber: invoiceNumber, messageType } = submission;
    const where = { companyTaxId, invoiceNumber };

    switch (messageType) {
      case TurnkeyMigMessageType.F0401:
      case TurnkeyMigMessageType.A0101: {
        await this.trackService.setStatus(
          manager,
          companyTaxId,
          invoiceNumber,
          accepted ? TurnkeyNumberStatus.USED : TurnkeyNumberStatus.RETURNED,
        );

        await manager.update(BaseTurnkeyInvoiceEntity, where, {
          status: accepted ? TurnkeyInvoiceStatus.ISSUED : TurnkeyInvoiceStatus.FAILED,
        });

        return accepted
          ? [
              await this.eventService.append(manager, TurnkeyEvents.INVOICE_ISSUED, companyTaxId, {
                invoiceNumber,
                messageType,
              }),
            ]
          : [];
      }

      case TurnkeyMigMessageType.F0501: {
        if (!accepted) {
          // 作廢沒被收下：發票維持原狀態，清掉作廢資訊讓呼叫端可以重送
          await manager.update(BaseTurnkeyInvoiceEntity, where, { voidedAt: null, voidReason: null });

          return [];
        }

        await manager.update(BaseTurnkeyInvoiceEntity, where, { status: TurnkeyInvoiceStatus.VOIDED });

        return [await this.eventService.append(manager, TurnkeyEvents.INVOICE_VOIDED, companyTaxId, { invoiceNumber })];
      }

      case TurnkeyMigMessageType.F0701: {
        if (!accepted) {
          // 註銷沒被收下：清掉註銷資訊，發票維持 ISSUED，可再呼叫 annul()
          await manager.update(BaseTurnkeyInvoiceEntity, where, { annulledAt: null, annulReason: null });

          return [];
        }

        // 號碼維持 USED，之後以原號碼重開
        await manager.update(BaseTurnkeyInvoiceEntity, where, { status: TurnkeyInvoiceStatus.ANNULLED });

        return [
          await this.eventService.append(manager, TurnkeyEvents.INVOICE_ANNULLED, companyTaxId, { invoiceNumber }),
        ];
      }

      case TurnkeyMigMessageType.A0201: {
        await manager.update(
          BaseTurnkeyInvoiceEntity,
          where,
          accepted ? { status: TurnkeyInvoiceStatus.VOID_PENDING } : { voidedAt: null, voidReason: null },
        );

        return [];
      }

      case TurnkeyMigMessageType.A0302: {
        if (!accepted) return [];

        await manager.update(
          BaseTurnkeyInvoiceEntity,
          { ...where, status: TurnkeyInvoiceStatus.REJECTED },
          { status: TurnkeyInvoiceStatus.REJECTION_ACKNOWLEDGED },
        );

        return [];
      }

      case TurnkeyMigMessageType.G0401:
      case TurnkeyMigMessageType.B0101: {
        await manager.update(
          TurnkeyAllowanceEntity,
          { companyTaxId, allowanceNumber: invoiceNumber },
          { status: accepted ? TurnkeyAllowanceStatus.ISSUED : TurnkeyAllowanceStatus.FAILED },
        );

        return accepted
          ? [
              await this.eventService.append(manager, TurnkeyEvents.ALLOWANCE_ISSUED, companyTaxId, {
                allowanceNumber: invoiceNumber,
                messageType,
              }),
            ]
          : [];
      }

      case TurnkeyMigMessageType.G0501:
      case TurnkeyMigMessageType.B0201: {
        const allowanceWhere = { companyTaxId, allowanceNumber: invoiceNumber };

        if (!accepted) {
          await manager.update(TurnkeyAllowanceEntity, allowanceWhere, { voidedAt: null, voidReason: null });

          return [];
        }

        if (messageType === TurnkeyMigMessageType.B0201) {
          await manager.update(TurnkeyAllowanceEntity, allowanceWhere, { status: TurnkeyAllowanceStatus.VOID_PENDING });

          return [];
        }

        await manager.update(TurnkeyAllowanceEntity, allowanceWhere, { status: TurnkeyAllowanceStatus.VOIDED });

        return [
          await this.eventService.append(manager, TurnkeyEvents.ALLOWANCE_VOIDED, companyTaxId, {
            allowanceNumber: invoiceNumber,
          }),
        ];
      }

      default:
        return [];
    }
  }
}
