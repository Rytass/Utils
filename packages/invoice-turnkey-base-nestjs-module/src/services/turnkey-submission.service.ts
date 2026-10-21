import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { buildMigXml } from '../mig/mig-builder';
import { TurnkeyAllowanceEntity } from '../models/turnkey-allowance.entity';
import { TurnkeyInvoiceNumberEntity } from '../models/turnkey-invoice-number.entity';
import { BaseTurnkeyInvoiceEntity } from '../models/turnkey-invoice.entity';
import { TurnkeySubmissionEntity, TurnkeySubmissionRepo } from '../models/turnkey-submission.entity';
import type { TurnkeyBaseModuleOptions } from '../typings/turnkey-base-module-options';
import { TURNKEY_BASE_MODULE_OPTIONS } from '../typings/turnkey-base-providers';
import {
  TurnkeyAllowanceStatus,
  TurnkeyInvoiceStatus,
  TurnkeyMessageCategory,
  TurnkeyMigMessageType,
  TurnkeyNumberStatus,
  TurnkeySubmissionStatus,
} from '../typings/turnkey-enums';
import { TurnkeyOutboundDocument } from '../typings/turnkey-invoice.types';
import { TurnkeyValidationCode, TurnkeyValidationError } from '../validation/turnkey-validation-error';
import { upCastSourceDirectory } from '../workers/submission-writer';

export const MESSAGE_CATEGORY: Readonly<Record<TurnkeyMigMessageType, TurnkeyMessageCategory>> = {
  [TurnkeyMigMessageType.F0401]: TurnkeyMessageCategory.B2SSTORAGE,
  [TurnkeyMigMessageType.F0501]: TurnkeyMessageCategory.B2SSTORAGE,
  [TurnkeyMigMessageType.F0701]: TurnkeyMessageCategory.B2SSTORAGE,
  [TurnkeyMigMessageType.G0401]: TurnkeyMessageCategory.B2SSTORAGE,
  [TurnkeyMigMessageType.G0501]: TurnkeyMessageCategory.B2SSTORAGE,
  [TurnkeyMigMessageType.A0101]: TurnkeyMessageCategory.B2BEXCHANGE,
  [TurnkeyMigMessageType.A0102]: TurnkeyMessageCategory.B2BEXCHANGE,
  [TurnkeyMigMessageType.A0201]: TurnkeyMessageCategory.B2BEXCHANGE,
  [TurnkeyMigMessageType.A0202]: TurnkeyMessageCategory.B2BEXCHANGE,
  [TurnkeyMigMessageType.A0301]: TurnkeyMessageCategory.B2BEXCHANGE,
  [TurnkeyMigMessageType.A0302]: TurnkeyMessageCategory.B2BEXCHANGE,
  [TurnkeyMigMessageType.B0101]: TurnkeyMessageCategory.B2BEXCHANGE,
  [TurnkeyMigMessageType.B0102]: TurnkeyMessageCategory.B2BEXCHANGE,
  [TurnkeyMigMessageType.B0201]: TurnkeyMessageCategory.B2BEXCHANGE,
  [TurnkeyMigMessageType.B0202]: TurnkeyMessageCategory.B2BEXCHANGE,
  [TurnkeyMigMessageType.E0402]: TurnkeyMessageCategory.B2PMESSAGE,
};

/** 本機退件（ERR）的舊檔重送前搬到這裡，避免和新檔混在一起 */
export const RETRIED_ARCHIVE_DIRECTORY = 'sidecar/retried';

/** 作廢、註銷沒被收下時發票或折讓已回到原狀態，直接再呼叫一次即可，不走 retry */
const VOID_TYPES: ReadonlySet<TurnkeyMigMessageType> = new Set([
  TurnkeyMigMessageType.F0501,
  TurnkeyMigMessageType.F0701,
  TurnkeyMigMessageType.A0201,
  TurnkeyMigMessageType.G0501,
  TurnkeyMigMessageType.B0201,
]);

const fail = (code: TurnkeyValidationCode, message: string, field?: string): TurnkeyValidationError =>
  new TurnkeyValidationError([{ code, message, field }]);

@Injectable()
export class TurnkeySubmissionService {
  private readonly logger = new Logger(TurnkeySubmissionService.name);

  constructor(
    @Inject(TurnkeySubmissionRepo)
    private readonly submissionRepo: Repository<TurnkeySubmissionEntity>,
    @Inject(TURNKEY_BASE_MODULE_OPTIONS)
    private readonly options: TurnkeyBaseModuleOptions,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 以同一份 XML 重送失敗的送件（新檔名，previousSubmissionId 指向這筆）。
   * 只接受最新一次、狀態 FAILED 或 REJECTED 的送件；E0201（重複）已在結果判讀時視為收下，不會走到這裡。
   * 開立類（F0401、A0101、G0401、B0101）把發票或折讓拉回 SUBMITTED；號碼已 ABANDONED 的不重送。
   * 作廢類請重新呼叫作廢；E0402 已成功的不再送（平台不判重複）。
   */
  async retry(companyTaxId: string, submissionId: string): Promise<TurnkeySubmissionEntity> {
    const { previous, next } = await this.dataSource.transaction(async manager => {
      const submission = await manager
        .createQueryBuilder(TurnkeySubmissionEntity, 'submission')
        .setLock('pessimistic_write')
        .where('submission.id = :submissionId AND submission.companyTaxId = :companyTaxId', {
          submissionId,
          companyTaxId,
        })
        .getOne();

      if (!submission) throw fail(TurnkeyValidationCode.SUBMISSION_NOT_FOUND, '找不到送件紀錄', 'submissionId');

      if (
        submission.status !== TurnkeySubmissionStatus.FAILED &&
        submission.status !== TurnkeySubmissionStatus.REJECTED
      ) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, `送件狀態 ${submission.status} 不能重送`, 'submissionId');
      }

      if (VOID_TYPES.has(submission.messageType)) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, '作廢或註銷沒被收下時請重新呼叫作廢或註銷', 'submissionId');
      }

      const retried = await manager.count(TurnkeySubmissionEntity, { where: { previousSubmissionId: submission.id } });

      if (retried > 0) throw fail(TurnkeyValidationCode.INVALID_STATE, '這筆送件已經重送過', 'submissionId');

      if (await this.hasActive(manager, companyTaxId, submission.documentNumber, submission.messageType)) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, '同一份文件已有進行中或已收下的送件', 'submissionId');
      }

      await this.reopenDocument(manager, submission);

      const id = randomUUID();

      const saved = await manager.save(
        manager.create(TurnkeySubmissionEntity, {
          id,
          companyTaxId,
          messageType: submission.messageType,
          category: submission.category,
          documentNumber: submission.documentNumber,
          fileName: `${id}.xml`,
          xml: submission.xml,
          previousSubmissionId: submission.id,
        }),
      );

      return { previous: submission, next: saved };
    });

    await this.archiveLocalError(previous);

    return next;
  }

  /** 開立類訊息重送前把文件拉回 SUBMITTED */
  private async reopenDocument(manager: EntityManager, submission: TurnkeySubmissionEntity): Promise<void> {
    const { companyTaxId, documentNumber, messageType } = submission;

    if (messageType === TurnkeyMigMessageType.F0401 || messageType === TurnkeyMigMessageType.A0101) {
      // 條件式更新：和 abandon（RETURNED → ABANDONED）互斥，先拿到列鎖的一方生效
      const reclaimed = await manager.update(
        TurnkeyInvoiceNumberEntity,
        { companyTaxId, invoiceNumber: documentNumber, status: TurnkeyNumberStatus.RETURNED },
        { status: TurnkeyNumberStatus.ALLOCATED },
      );

      if (!reclaimed.affected) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, '號碼不是退件（RETURNED）狀態，不能重送', 'submissionId');
      }

      const result = await manager.update(
        BaseTurnkeyInvoiceEntity,
        { companyTaxId, invoiceNumber: documentNumber, status: TurnkeyInvoiceStatus.FAILED },
        { status: TurnkeyInvoiceStatus.SUBMITTED },
      );

      if (!result.affected)
        throw fail(TurnkeyValidationCode.INVALID_STATE, '發票不是 FAILED，不能重送', 'submissionId');

      return;
    }

    if (messageType === TurnkeyMigMessageType.G0401 || messageType === TurnkeyMigMessageType.B0101) {
      const allowance = await manager.findOne(TurnkeyAllowanceEntity, {
        where: { companyTaxId, allowanceNumber: documentNumber, status: TurnkeyAllowanceStatus.FAILED },
      });

      if (!allowance) throw fail(TurnkeyValidationCode.INVALID_STATE, '折讓不是 FAILED，不能重送', 'submissionId');

      await this.assertAllowanceStillValid(manager, allowance);

      await manager.update(TurnkeyAllowanceEntity, allowance.id, { status: TurnkeyAllowanceStatus.SUBMITTED });
    }
  }

  /**
   * 折讓失敗期間原發票可能已被作廢、註銷或再開了別的折讓：鎖住原發票，重驗狀態與累計上限
   * （與開立折讓、作廢、註銷用同一把發票列鎖）。
   */
  private async assertAllowanceStillValid(manager: EntityManager, allowance: TurnkeyAllowanceEntity): Promise<void> {
    const invoice = await manager
      .createQueryBuilder(BaseTurnkeyInvoiceEntity, 'invoice')
      .setLock('pessimistic_write')
      .where('invoice.companyTaxId = :companyTaxId AND invoice.invoiceNumber = :invoiceNumber', {
        companyTaxId: allowance.companyTaxId,
        invoiceNumber: allowance.invoiceNumber,
      })
      .getOne();

    if (
      !invoice ||
      ![TurnkeyInvoiceStatus.ISSUED, TurnkeyInvoiceStatus.CONFIRMED].includes(invoice.status) ||
      invoice.voidedAt ||
      invoice.annulledAt
    ) {
      throw fail(TurnkeyValidationCode.INVALID_STATE, '原發票已不能折讓，不能重送', 'submissionId');
    }

    const active = await manager.find(TurnkeyAllowanceEntity, {
      where: {
        companyTaxId: allowance.companyTaxId,
        invoiceNumber: allowance.invoiceNumber,
        status: In([
          TurnkeyAllowanceStatus.SUBMITTED,
          TurnkeyAllowanceStatus.ISSUED,
          TurnkeyAllowanceStatus.CONFIRMED,
          TurnkeyAllowanceStatus.VOID_PENDING,
        ]),
      },
    });

    const total = [...active, allowance].reduce((sum, item) => sum + item.totalAmount + item.taxAmount, 0);

    if (total > invoice.totalAmount) {
      throw fail(TurnkeyValidationCode.ALLOWANCE_EXCEEDS_INVOICE, '加上這筆折讓會超過原發票總計', 'submissionId');
    }
  }

  /** Turnkey 本機退件會把檔案留在 ERR；搬走以免和重送的檔案混淆（找不到就略過） */
  private async archiveLocalError(submission: TurnkeySubmissionEntity): Promise<void> {
    const source = path.join(
      path.dirname(upCastSourceDirectory(this.options.dataPath, submission.category, submission.messageType)),
      'ERR',
      submission.fileName,
    );

    const target = path.join(this.options.dataPath, RETRIED_ARCHIVE_DIRECTORY, submission.fileName);

    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.rename(source, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Cannot archive ${source}: ${(error as Error).message}`);
      }
    }
  }

  /** 在呼叫端交易內把 MIG 文件轉成 XML，建立一筆待送 submission（由 SubmissionWriter 寫進 UpCast） */
  async enqueue(
    manager: EntityManager,
    companyTaxId: string,
    documentNumber: string,
    document: TurnkeyOutboundDocument,
    previousSubmissionId?: string,
  ): Promise<TurnkeySubmissionEntity> {
    const xml = buildMigXml(document);

    await this.options.validation?.xmlValidator?.(xml, document.messageType);

    const id = randomUUID();

    return manager.save(
      manager.create(TurnkeySubmissionEntity, {
        id,
        companyTaxId,
        messageType: document.messageType,
        category: MESSAGE_CATEGORY[document.messageType],
        documentNumber,
        fileName: `${id}.xml`,
        xml,
        previousSubmissionId: previousSubmissionId ?? null,
      }),
    );
  }

  /** 同一份文件、同一種訊息是否已有尚未失敗的送件（避免重複作廢等） */
  async hasActive(
    manager: EntityManager,
    companyTaxId: string,
    documentNumber: string,
    messageType: TurnkeyMigMessageType,
  ): Promise<boolean> {
    const count = await manager.count(TurnkeySubmissionEntity, {
      where: [
        { companyTaxId, documentNumber, messageType, status: TurnkeySubmissionStatus.PENDING },
        { companyTaxId, documentNumber, messageType, status: TurnkeySubmissionStatus.WRITTEN },
        { companyTaxId, documentNumber, messageType, status: TurnkeySubmissionStatus.ACCEPTED },
      ],
    });

    return count > 0;
  }

  findById(companyTaxId: string, id: string): Promise<TurnkeySubmissionEntity | null> {
    return this.submissionRepo.findOne({ where: { id, companyTaxId } });
  }

  /** 還沒有平台結果的送件（PENDING 與 WRITTEN） */
  listPending(companyTaxId: string, limit = 100): Promise<TurnkeySubmissionEntity[]> {
    return this.submissionRepo.find({
      where: [
        { companyTaxId, status: TurnkeySubmissionStatus.PENDING },
        { companyTaxId, status: TurnkeySubmissionStatus.WRITTEN },
      ],
      order: { createdAt: 'ASC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  listByStatus(companyTaxId: string, status: TurnkeySubmissionStatus, limit = 100): Promise<TurnkeySubmissionEntity[]> {
    return this.submissionRepo.find({
      where: { companyTaxId, status },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }
}
