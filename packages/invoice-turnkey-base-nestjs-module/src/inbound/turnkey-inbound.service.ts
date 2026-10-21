import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { TurnkeyAllowanceEntity } from '../models/turnkey-allowance.entity';
import { BaseTurnkeyCompanyEntity, BaseTurnkeyCompanyRepo } from '../models/turnkey-company.entity';
import { BaseTurnkeyInvoiceEntity } from '../models/turnkey-invoice.entity';
import {
  TurnkeyReceivedDocumentEntity,
  TurnkeyReceivedDocumentStatus,
} from '../models/turnkey-received-document.entity';
import { TurnkeyEventService } from '../services/turnkey-event.service';
import { TurnkeyAllowanceStatus, TurnkeyInvoiceStatus, TurnkeyMigMessageType } from '../typings/turnkey-enums';
import { TurnkeyEvent, TurnkeyEvents } from '../typings/turnkey-events';
import { TurnkeyInboundMessage } from './parse-inbound-message';

export type TurnkeyInboundOutcome = 'APPLIED' | 'DUPLICATE' | 'UNMATCHED';

/** 我方為賣方時收到的買方回覆 */
const SELLER_SIDE: ReadonlySet<TurnkeyMigMessageType> = new Set([
  TurnkeyMigMessageType.A0102,
  TurnkeyMigMessageType.A0202,
  TurnkeyMigMessageType.A0301,
  TurnkeyMigMessageType.B0102,
  TurnkeyMigMessageType.B0202,
]);

const RECEIVED_EVENT: Readonly<Partial<Record<TurnkeyMigMessageType, TurnkeyEvents>>> = {
  [TurnkeyMigMessageType.A0101]: TurnkeyEvents.RECEIVED_INVOICE_ARRIVED,
  [TurnkeyMigMessageType.A0201]: TurnkeyEvents.RECEIVED_INVOICE_VOID_REQUESTED,
  [TurnkeyMigMessageType.A0302]: TurnkeyEvents.RECEIVED_INVOICE_REJECTION_ACKNOWLEDGED,
  [TurnkeyMigMessageType.B0101]: TurnkeyEvents.RECEIVED_ALLOWANCE_ARRIVED,
  [TurnkeyMigMessageType.B0201]: TurnkeyEvents.RECEIVED_ALLOWANCE_VOID_REQUESTED,
};

interface Transition<S> {
  readonly from: readonly S[];
  readonly to: S;
  readonly event: TurnkeyEvents;
}

const INVOICE_TRANSITIONS: Readonly<Partial<Record<TurnkeyMigMessageType, Transition<TurnkeyInvoiceStatus>>>> = {
  [TurnkeyMigMessageType.A0102]: {
    from: [TurnkeyInvoiceStatus.ISSUED],
    to: TurnkeyInvoiceStatus.CONFIRMED,
    event: TurnkeyEvents.INVOICE_CONFIRMED,
  },
  [TurnkeyMigMessageType.A0301]: {
    from: [TurnkeyInvoiceStatus.ISSUED, TurnkeyInvoiceStatus.CONFIRMED],
    to: TurnkeyInvoiceStatus.REJECTED,
    event: TurnkeyEvents.INVOICE_REJECTED,
  },
  [TurnkeyMigMessageType.A0202]: {
    from: [TurnkeyInvoiceStatus.VOID_PENDING],
    to: TurnkeyInvoiceStatus.VOIDED,
    event: TurnkeyEvents.INVOICE_VOIDED,
  },
};

const ALLOWANCE_TRANSITIONS: Readonly<Partial<Record<TurnkeyMigMessageType, Transition<TurnkeyAllowanceStatus>>>> = {
  [TurnkeyMigMessageType.B0102]: {
    from: [TurnkeyAllowanceStatus.ISSUED],
    to: TurnkeyAllowanceStatus.CONFIRMED,
    event: TurnkeyEvents.ALLOWANCE_CONFIRMED,
  },
  [TurnkeyMigMessageType.B0202]: {
    from: [TurnkeyAllowanceStatus.VOID_PENDING],
    to: TurnkeyAllowanceStatus.VOIDED,
    event: TurnkeyEvents.ALLOWANCE_VOIDED,
  },
};

/** 把 RecvTarget 的一份文件套用到狀態機或收件匣，與事件寫入同一個交易 */
@Injectable()
export class TurnkeyInboundService {
  constructor(
    @Inject(BaseTurnkeyCompanyRepo)
    private readonly companyRepo: Repository<BaseTurnkeyCompanyEntity>,
    private readonly dataSource: DataSource,
    private readonly eventService: TurnkeyEventService,
  ) {}

  async process(message: TurnkeyInboundMessage, fileName: string): Promise<TurnkeyInboundOutcome> {
    const isSellerSide = SELLER_SIDE.has(message.messageType);
    const ownTaxId = isSellerSide ? message.sellerTaxId : message.buyerTaxId;
    const company = await this.companyRepo.findOne({ where: { taxId: ownTaxId } });

    if (!company) return 'UNMATCHED';

    const { outcome, events } = await this.dataSource.transaction(manager =>
      isSellerSide ? this.applyReply(manager, message) : this.storeReceived(manager, message, fileName),
    );

    this.eventService.publish(events);

    return outcome;
  }

  private async applyReply(
    manager: EntityManager,
    message: TurnkeyInboundMessage,
  ): Promise<{ readonly outcome: TurnkeyInboundOutcome; readonly events: readonly TurnkeyEvent[] }> {
    const companyTaxId = message.sellerTaxId;
    const invoiceTransition = INVOICE_TRANSITIONS[message.messageType];
    const allowanceTransition = ALLOWANCE_TRANSITIONS[message.messageType];
    const numberField = invoiceTransition ? 'invoiceNumber' : 'allowanceNumber';

    const extra =
      message.messageType === TurnkeyMigMessageType.A0102
        ? { confirmedAt: message.occurredAt }
        : message.messageType === TurnkeyMigMessageType.A0301
          ? { rejectedAt: message.occurredAt, rejectReason: message.reason }
          : {};

    const applied: { readonly exists: number; readonly affected: number; readonly event: TurnkeyEvents } | null =
      invoiceTransition
        ? {
            exists: await manager.count(BaseTurnkeyInvoiceEntity, {
              where: { companyTaxId, invoiceNumber: message.documentNumber },
            }),
            affected:
              (
                await manager.update(
                  BaseTurnkeyInvoiceEntity,
                  {
                    companyTaxId,
                    invoiceNumber: message.documentNumber,
                    status: In([...invoiceTransition.from]),
                  },
                  { status: invoiceTransition.to, ...extra },
                )
              ).affected ?? 0,
            event: invoiceTransition.event,
          }
        : allowanceTransition
          ? {
              exists: await manager.count(TurnkeyAllowanceEntity, {
                where: { companyTaxId, allowanceNumber: message.documentNumber },
              }),
              affected:
                (
                  await manager.update(
                    TurnkeyAllowanceEntity,
                    {
                      companyTaxId,
                      allowanceNumber: message.documentNumber,
                      status: In([...allowanceTransition.from]),
                    },
                    { status: allowanceTransition.to },
                  )
                ).affected ?? 0,
              event: allowanceTransition.event,
            }
          : null;

    if (!applied || !applied.exists) return { outcome: 'UNMATCHED', events: [] };

    if (!applied.affected) return { outcome: 'DUPLICATE', events: [] };

    const event = await this.eventService.append(manager, applied.event, companyTaxId, {
      [numberField]: message.documentNumber,
      messageType: message.messageType,
      occurredAt: message.occurredAt?.toISOString() ?? null,
      reason: message.reason,
    });

    return { outcome: 'APPLIED', events: [event] };
  }

  private async storeReceived(
    manager: EntityManager,
    message: TurnkeyInboundMessage,
    fileName: string,
  ): Promise<{ readonly outcome: TurnkeyInboundOutcome; readonly events: readonly TurnkeyEvent[] }> {
    const eventType = RECEIVED_EVENT[message.messageType];

    if (!eventType) return { outcome: 'UNMATCHED', events: [] };

    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(TurnkeyReceivedDocumentEntity)
      .values({
        buyerTaxId: message.buyerTaxId,
        sellerTaxId: message.sellerTaxId,
        messageType: message.messageType,
        documentNumber: message.documentNumber,
        documentDate: message.documentDate,
        occurredAt: message.occurredAt,
        reason: message.reason,
        xml: message.xml,
        fileName,
      })
      .orIgnore()
      .returning(['id'])
      .execute();

    if (!inserted.raw?.length) return { outcome: 'DUPLICATE', events: [] };

    if (message.messageType === TurnkeyMigMessageType.A0302) {
      await manager.update(
        TurnkeyReceivedDocumentEntity,
        {
          buyerTaxId: message.buyerTaxId,
          messageType: TurnkeyMigMessageType.A0101,
          documentNumber: message.documentNumber,
        },
        { status: TurnkeyReceivedDocumentStatus.REJECTION_ACKNOWLEDGED },
      );
    }

    const event = await this.eventService.append(manager, eventType, message.buyerTaxId, {
      messageType: message.messageType,
      documentNumber: message.documentNumber,
      sellerTaxId: message.sellerTaxId,
      occurredAt: message.occurredAt?.toISOString() ?? null,
      reason: message.reason,
    });

    return { outcome: 'APPLIED', events: [event] };
  }
}
