import { Inject, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  TurnkeyReceivedDocumentEntity,
  TurnkeyReceivedDocumentRepo,
  TurnkeyReceivedDocumentStatus,
} from '../models/turnkey-received-document.entity';
import { TurnkeyMigMessageType } from '../typings/turnkey-enums';
import { parseMigDateTime } from '../utils/taipei-time';
import { TurnkeyValidationCode, TurnkeyValidationError } from '../validation/turnkey-validation-error';
import { TurnkeySubmissionService } from './turnkey-submission.service';

/** 收到的文件 → 我方回覆的訊息與回覆後的狀態 */
const REPLIES = {
  confirmInvoice: {
    received: TurnkeyMigMessageType.A0101,
    reply: TurnkeyMigMessageType.A0102,
    status: TurnkeyReceivedDocumentStatus.CONFIRMED,
  },
  rejectInvoice: {
    received: TurnkeyMigMessageType.A0101,
    reply: TurnkeyMigMessageType.A0301,
    status: TurnkeyReceivedDocumentStatus.REJECTED,
  },
  confirmInvoiceVoid: {
    received: TurnkeyMigMessageType.A0201,
    reply: TurnkeyMigMessageType.A0202,
    status: TurnkeyReceivedDocumentStatus.CONFIRMED,
  },
  confirmAllowance: {
    received: TurnkeyMigMessageType.B0101,
    reply: TurnkeyMigMessageType.B0102,
    status: TurnkeyReceivedDocumentStatus.CONFIRMED,
  },
  confirmAllowanceVoid: {
    received: TurnkeyMigMessageType.B0201,
    reply: TurnkeyMigMessageType.B0202,
    status: TurnkeyReceivedDocumentStatus.CONFIRMED,
  },
} as const;

export type TurnkeyReplyAction = keyof typeof REPLIES;

const fail = (code: TurnkeyValidationCode, message: string, field?: string): TurnkeyValidationError =>
  new TurnkeyValidationError([{ code, message, field }]);

/** 我方為買方時：列出收到的交換發票與折讓，並送確認、退回、確認作廢 */
@Injectable()
export class TurnkeyReceivedDocumentService {
  constructor(
    @Inject(TurnkeyReceivedDocumentRepo)
    private readonly receivedRepo: Repository<TurnkeyReceivedDocumentEntity>,
    private readonly dataSource: DataSource,
    private readonly submissionService: TurnkeySubmissionService,
  ) {}

  list(
    buyerTaxId: string,
    messageTypes: readonly TurnkeyMigMessageType[],
    status?: TurnkeyReceivedDocumentStatus,
    limit = 100,
  ): Promise<TurnkeyReceivedDocumentEntity[]> {
    return this.receivedRepo.find({
      where: messageTypes.map(messageType => ({ buyerTaxId, messageType, ...(status ? { status } : {}) })),
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }

  /** 送出回覆；狀態在送出時即更新（平台退件時由 submission.rejected 事件通知） */
  async reply(
    action: TurnkeyReplyAction,
    buyerTaxId: string,
    documentNumber: string,
    options: { readonly reason?: string; readonly remark?: string } = {},
  ): Promise<TurnkeyReceivedDocumentEntity> {
    const spec = REPLIES[action];

    if (action === 'rejectInvoice' && !options.reason?.trim()) {
      throw fail(TurnkeyValidationCode.INVALID_STATE, '退回原因必填', 'reason');
    }

    return this.dataSource.transaction(async manager => {
      const received = await manager
        .createQueryBuilder(TurnkeyReceivedDocumentEntity, 'doc')
        .setLock('pessimistic_write')
        .where(
          'doc.buyerTaxId = :buyerTaxId AND doc.messageType = :messageType AND doc.documentNumber = :documentNumber',
          {
            buyerTaxId,
            messageType: spec.received,
            documentNumber,
          },
        )
        .getOne();

      if (!received) throw fail(TurnkeyValidationCode.INVOICE_NOT_FOUND, '找不到收到的文件', 'documentNumber');

      if (received.status !== TurnkeyReceivedDocumentStatus.RECEIVED) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, `已回覆過（${received.status}）`, 'documentNumber');
      }

      await this.submissionService.enqueue(manager, buyerTaxId, documentNumber, {
        messageType: spec.reply,
        documentNumber,
        documentDate: parseMigDateTime(received.documentDate),
        buyerTaxId,
        sellerTaxId: received.sellerTaxId,
        repliedAt: new Date(),
        reason: options.reason,
        remark: options.remark,
      });

      await manager.update(TurnkeyReceivedDocumentEntity, received.id, { status: spec.status });

      return { ...received, status: spec.status };
    });
  }
}
