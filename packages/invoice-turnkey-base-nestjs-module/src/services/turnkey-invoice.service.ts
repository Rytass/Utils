import { Inject, Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { CONSUMER_BUYER_ID } from '../mig/mig-builder';
import { BaseTurnkeyCompanyEntity, BaseTurnkeyCompanyRepo } from '../models/turnkey-company.entity';
import { TurnkeyAllowanceEntity } from '../models/turnkey-allowance.entity';
import { TurnkeyInvoiceItemEntity } from '../models/turnkey-invoice-item.entity';
import { BaseTurnkeyInvoiceEntity, BaseTurnkeyInvoiceRepo } from '../models/turnkey-invoice.entity';
import { TurnkeySubmissionEntity } from '../models/turnkey-submission.entity';
import type { TurnkeyBaseModuleOptions } from '../typings/turnkey-base-module-options';
import { TURNKEY_BASE_MODULE_OPTIONS } from '../typings/turnkey-base-providers';
import {
  TurnkeyAllowanceStatus,
  TurnkeyDeliveryMode,
  TurnkeyInvoiceStatus,
  TurnkeyMigMessageType,
} from '../typings/turnkey-enums';
import { TurnkeyInvoiceDocument, TurnkeyInvoiceIssueInput } from '../typings/turnkey-invoice.types';
import { computeInvoiceAmounts, itemAmount } from '../utils/amounts';
import { formatMigDate, formatPeriod } from '../utils/taipei-time';
import { validateInvoiceInput, validateInvoiceShape } from '../validation/invoice-rules';
import { TurnkeyValidationCode, TurnkeyValidationError } from '../validation/turnkey-validation-error';
import { TurnkeyEventService } from './turnkey-event.service';
import { TurnkeyInvoiceTrackService } from './turnkey-invoice-track.service';
import { TurnkeySubmissionService } from './turnkey-submission.service';

const fail = (code: TurnkeyValidationCode, message: string, field?: string): TurnkeyValidationError =>
  new TurnkeyValidationError([{ code, message, field }]);

/** 已存下的發票轉回 MIG 文件（開立與同號重送共用） */
export const toInvoiceDocument = (
  invoice: BaseTurnkeyInvoiceEntity,
  company: Pick<BaseTurnkeyCompanyEntity, 'taxId' | 'name' | 'address'>,
): TurnkeyInvoiceDocument => ({
  messageType:
    invoice.deliveryMode === TurnkeyDeliveryMode.EXCHANGE ? TurnkeyMigMessageType.A0101 : TurnkeyMigMessageType.F0401,
  invoiceNumber: invoice.invoiceNumber,
  issuedAt: invoice.issuedAt,
  seller: { taxId: company.taxId, name: company.name, address: company.address ?? undefined },
  buyer: { taxId: invoice.buyerTaxId, name: invoice.buyerName, address: invoice.buyerAddress ?? undefined },
  items: [...invoice.items]
    .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
    .map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: item.amount,
      taxType: item.taxType,
      unit: item.unit ?? undefined,
      remark: item.remark ?? undefined,
    })),
  amounts: {
    salesAmount: invoice.salesAmount,
    taxFreeSalesAmount: invoice.taxFreeSalesAmount,
    zeroRatedSalesAmount: invoice.zeroRatedSalesAmount,
    taxType: invoice.taxType,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
  },
  carrier: invoice.carrierType
    ? {
        type: invoice.carrierType,
        code: invoice.carrierCode ?? '',
        hiddenCode: invoice.carrierHiddenCode ?? undefined,
        typeCode: invoice.carrierTypeCode ?? undefined,
      }
    : undefined,
  donation: invoice.npoCode ? { npoCode: invoice.npoCode } : undefined,
  printed: invoice.printed,
  randomNumber: invoice.randomNumber ?? undefined,
  zeroRated:
    invoice.zeroRatedReasonCode && invoice.customsClearance
      ? { reasonCode: invoice.zeroRatedReasonCode, customsClearance: invoice.customsClearance }
      : undefined,
  mainRemark: invoice.mainRemark ?? undefined,
});

/** externalId 重送是否為同一張發票：比對買方、交付方式與品項 */
const isSameIssueRequest = (invoice: BaseTurnkeyInvoiceEntity, input: TurnkeyInvoiceIssueInput): boolean => {
  const items = [...invoice.items].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return (
    invoice.deliveryMode === input.deliveryMode &&
    invoice.buyerTaxId === (input.buyer?.taxId ?? CONSUMER_BUYER_ID) &&
    items.length === input.items.length &&
    items.every((item, index) => {
      const requested = input.items[index];

      return (
        item.description === requested.description &&
        Number(item.quantity) === Number(requested.quantity) &&
        Number(item.unitPrice) === Number(requested.unitPrice) &&
        item.taxType === requested.taxType
      );
    })
  );
};

@Injectable()
export class TurnkeyInvoiceService {
  constructor(
    @Inject(TURNKEY_BASE_MODULE_OPTIONS)
    private readonly options: TurnkeyBaseModuleOptions,
    @Inject(BaseTurnkeyInvoiceRepo)
    private readonly invoiceRepo: Repository<BaseTurnkeyInvoiceEntity>,
    @Inject(BaseTurnkeyCompanyRepo)
    private readonly companyRepo: Repository<BaseTurnkeyCompanyEntity>,
    private readonly dataSource: DataSource,
    private readonly trackService: TurnkeyInvoiceTrackService,
    private readonly eventService: TurnkeyEventService,
    private readonly submissionService: TurnkeySubmissionService,
  ) {}

  /**
   * 同步完成檢核與取號，寫入發票與待送 submission，回傳狀態 SUBMITTED 的發票。
   * 檢核失敗丟 TurnkeyValidationError，號碼不會用掉。
   * 同一個 externalId 再呼叫一次會回傳第一次的發票；內容（買方、交付方式、品項）不同則丟 EXTERNAL_ID_CONFLICT。
   */
  async issue(input: TurnkeyInvoiceIssueInput): Promise<BaseTurnkeyInvoiceEntity> {
    const shapeIssues = validateInvoiceShape(input);

    if (shapeIssues.length) throw new TurnkeyValidationError(shapeIssues);

    if (input.externalId) {
      const existing = await this.findByExternalId(input.companyTaxId, input.externalId);

      if (existing) {
        if (!isSameIssueRequest(existing, input)) {
          throw fail(TurnkeyValidationCode.EXTERNAL_ID_CONFLICT, '此 externalId 已開立內容不同的發票', 'externalId');
        }

        return existing;
      }
    }

    const now = new Date();
    const issues = validateInvoiceInput(input, { now, ...this.options.validation });

    if (issues.length) throw new TurnkeyValidationError(issues);

    const company = await this.companyRepo.findOne({ where: { taxId: input.companyTaxId } });

    if (!company) throw fail(TurnkeyValidationCode.COMPANY_NOT_REGISTERED, '營業人尚未登錄', 'companyTaxId');

    const isExchange = input.deliveryMode === TurnkeyDeliveryMode.EXCHANGE;

    if (isExchange && !company.exchangeEnabled) {
      throw fail(TurnkeyValidationCode.BUYER_NOT_EXCHANGE_READY, '此營業人未啟用交換發票', 'deliveryMode');
    }

    // A0101 的 Seller.Address 必填，缺了 Turnkey 本機就以 7001 擋下，號碼卻已用掉
    if (isExchange && !company.address?.trim()) {
      throw fail(
        TurnkeyValidationCode.SELLER_ADDRESS_REQUIRED,
        '交換發票需要賣方地址，請先設定營業人地址',
        'companyTaxId',
      );
    }

    const issuedAt = input.issuedAt ?? now;
    const isB2B = !!input.buyer?.taxId;
    const amounts = computeInvoiceAmounts(input.items, { isB2B, specialTaxRate: input.specialTaxRate });

    const { invoice, events } = await this.dataSource.transaction(async manager => {
      if (input.externalId) {
        // 同一 externalId 併發開立：鎖住後再查一次，後到的拿到先開好的那張，不會撞唯一鍵變 500
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `turnkey:invoice-external-id:${company.taxId}:${input.externalId}`,
        ]);

        const raced = await manager.findOne(BaseTurnkeyInvoiceEntity, {
          where: { companyTaxId: company.taxId, externalId: input.externalId },
          relations: { items: true },
        });

        if (raced) {
          if (!isSameIssueRequest(raced, input)) {
            throw fail(TurnkeyValidationCode.EXTERNAL_ID_CONFLICT, '此 externalId 已開立內容不同的發票', 'externalId');
          }

          return { invoice: raced, events: [] };
        }
      }

      const allocation = await this.trackService.allocate(manager, company.taxId, formatPeriod(issuedAt));

      await this.assertDateOrder(manager, company.taxId, allocation.invoiceNumber, issuedAt);

      const invoiceId = randomUUID();

      const saved = await manager.save(
        manager.create(BaseTurnkeyInvoiceEntity, {
          id: invoiceId,
          companyTaxId: company.taxId,
          invoiceNumber: allocation.invoiceNumber,
          externalId: input.externalId ?? null,
          deliveryMode: input.deliveryMode,
          status: TurnkeyInvoiceStatus.SUBMITTED,
          issuedAt,
          buyerTaxId: input.buyer?.taxId ?? CONSUMER_BUYER_ID,
          buyerName: input.buyer?.name ?? (isB2B ? (input.buyer?.taxId ?? '') : '消費者'),
          buyerAddress: input.buyer?.address ?? null,
          ...amounts,
          carrierType: input.carrier?.type ?? null,
          carrierCode: input.carrier?.code ?? null,
          carrierHiddenCode: input.carrier?.hiddenCode ?? null,
          carrierTypeCode: input.carrier?.typeCode ?? null,
          npoCode: input.donation?.npoCode ?? null,
          printed: input.printed ?? (!input.carrier && !input.donation),
          // 交換發票（A0101）沒有隨機碼欄位
          randomNumber: isExchange ? null : String(randomInt(0, 10000)).padStart(4, '0'),
          zeroRatedReasonCode: input.zeroRated?.reasonCode ?? null,
          customsClearance: input.zeroRated?.customsClearance ?? null,
          mainRemark: input.mainRemark ?? null,
          voidedAt: null,
          voidReason: null,
          annulledAt: null,
          annulReason: null,
          confirmedAt: null,
          rejectedAt: null,
          rejectReason: null,
          items: input.items.map((item, index) =>
            manager.create(TurnkeyInvoiceItemEntity, {
              invoiceId,
              sequenceNumber: index + 1,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit ?? null,
              unitPrice: item.unitPrice,
              amount: itemAmount(item),
              taxType: item.taxType,
              remark: item.remark ?? null,
            }),
          ),
        }),
      );

      await this.enqueueSubmission(manager, saved, company);

      return { invoice: saved, events: allocation.events };
    });

    this.eventService.publish(events);

    return invoice;
  }

  /** 為發票建立一筆待送 submission（開立與同號重送共用），在呼叫端交易內 */
  enqueueSubmission(
    manager: EntityManager,
    invoice: BaseTurnkeyInvoiceEntity,
    company: Pick<BaseTurnkeyCompanyEntity, 'taxId' | 'name' | 'address'>,
    previousSubmissionId?: string,
  ): Promise<TurnkeySubmissionEntity> {
    return this.submissionService.enqueue(
      manager,
      invoice.companyTaxId,
      invoice.invoiceNumber,
      toInvoiceDocument(invoice, company),
      previousSubmissionId,
    );
  }

  /**
   * 作廢：存證送 F0501（平台收下後 VOIDED），交換送 A0201（平台收下後 VOID_PENDING，買方回 A0202 才 VOIDED）。
   * 只有平台已收下（ISSUED）或買方已確認（CONFIRMED）的發票可以作廢。
   */
  async void(
    companyTaxId: string,
    invoiceNumber: string,
    options: { readonly reason: string; readonly remark?: string },
  ): Promise<BaseTurnkeyInvoiceEntity> {
    const reason = options.reason?.trim() ?? '';

    if (!reason || reason.length > 20) {
      throw fail(TurnkeyValidationCode.INVALID_STATE, '作廢原因必填，最多 20 字', 'reason');
    }

    return this.dataSource.transaction(async manager => {
      const invoice = await manager
        .createQueryBuilder(BaseTurnkeyInvoiceEntity, 'invoice')
        .setLock('pessimistic_write')
        .where('invoice.companyTaxId = :companyTaxId AND invoice.invoiceNumber = :invoiceNumber', {
          companyTaxId,
          invoiceNumber,
        })
        .getOne();

      if (!invoice) throw fail(TurnkeyValidationCode.INVOICE_NOT_FOUND, '找不到發票', 'invoiceNumber');

      if (![TurnkeyInvoiceStatus.ISSUED, TurnkeyInvoiceStatus.CONFIRMED].includes(invoice.status)) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, `狀態 ${invoice.status} 的發票不能作廢`, 'invoiceNumber');
      }

      if (invoice.annulledAt)
        throw fail(TurnkeyValidationCode.INVALID_STATE, '已送出註銷，等待平台結果', 'invoiceNumber');

      // 平台規定已有折讓的發票要先作廢折讓才能作廢發票（與註銷相同）
      await this.assertNoActiveAllowance(manager, companyTaxId, invoiceNumber);

      const isExchange = invoice.deliveryMode === TurnkeyDeliveryMode.EXCHANGE;
      const messageType = isExchange ? TurnkeyMigMessageType.A0201 : TurnkeyMigMessageType.F0501;

      if (await this.submissionService.hasActive(manager, companyTaxId, invoiceNumber, messageType)) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, '已送出作廢，等待平台結果', 'invoiceNumber');
      }

      const cancelledAt = new Date();

      await this.submissionService.enqueue(manager, companyTaxId, invoiceNumber, {
        messageType,
        invoiceNumber,
        invoiceIssuedAt: invoice.issuedAt,
        buyerTaxId: invoice.buyerTaxId,
        sellerTaxId: companyTaxId,
        cancelledAt,
        reason,
        remark: options.remark,
      });

      await manager.update(BaseTurnkeyInvoiceEntity, invoice.id, { voidedAt: cancelledAt, voidReason: reason });

      return { ...invoice, voidedAt: cancelledAt, voidReason: reason };
    });
  }

  /**
   * 註銷（F0701）：僅限系統異常、需以原號碼重開的存證發票（MIG 規定）；記載錯誤請作廢後另開。
   * 平台收下後 ANNULLED，號碼維持 USED。有未作廢的折讓時不能註銷。
   */
  async annul(
    companyTaxId: string,
    invoiceNumber: string,
    options: { readonly reason: string; readonly remark?: string },
  ): Promise<BaseTurnkeyInvoiceEntity> {
    const reason = options.reason?.trim() ?? '';

    if (!reason || reason.length > 20) {
      throw fail(TurnkeyValidationCode.INVALID_STATE, '註銷原因必填，最多 20 字', 'reason');
    }

    return this.dataSource.transaction(async manager => {
      const invoice = await manager.findOne(BaseTurnkeyInvoiceEntity, {
        where: { companyTaxId, invoiceNumber },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) throw fail(TurnkeyValidationCode.INVOICE_NOT_FOUND, '找不到發票', 'invoiceNumber');

      if (invoice.deliveryMode !== TurnkeyDeliveryMode.STORAGE) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, '只有存證發票可以註銷', 'invoiceNumber');
      }

      if (invoice.status !== TurnkeyInvoiceStatus.ISSUED || invoice.voidedAt) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, `狀態 ${invoice.status} 的發票不能註銷`, 'invoiceNumber');
      }

      await this.assertNoActiveAllowance(manager, companyTaxId, invoiceNumber);

      if (
        (await this.submissionService.hasActive(manager, companyTaxId, invoiceNumber, TurnkeyMigMessageType.F0701)) ||
        (await this.submissionService.hasActive(manager, companyTaxId, invoiceNumber, TurnkeyMigMessageType.F0501))
      ) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, '已送出註銷或作廢，等待平台結果', 'invoiceNumber');
      }

      const annulledAt = new Date();

      await this.submissionService.enqueue(manager, companyTaxId, invoiceNumber, {
        messageType: TurnkeyMigMessageType.F0701,
        invoiceNumber,
        invoiceIssuedAt: invoice.issuedAt,
        buyerTaxId: invoice.buyerTaxId,
        sellerTaxId: companyTaxId,
        cancelledAt: annulledAt,
        reason,
        remark: options.remark,
      });

      await manager.update(BaseTurnkeyInvoiceEntity, invoice.id, { annulledAt, annulReason: reason });

      return { ...invoice, annulledAt, annulReason: reason };
    });
  }

  /**
   * 交換發票被買方退回（A0301）後，賣方送 A0302 確認；RejectDate、RejectTime 要照抄 A0301。
   */
  async acknowledgeRejection(companyTaxId: string, invoiceNumber: string): Promise<BaseTurnkeyInvoiceEntity> {
    return this.dataSource.transaction(async manager => {
      const invoice = await manager.findOne(BaseTurnkeyInvoiceEntity, {
        where: { companyTaxId, invoiceNumber },
        lock: { mode: 'pessimistic_write' },
      });

      if (!invoice) throw fail(TurnkeyValidationCode.INVOICE_NOT_FOUND, '找不到發票', 'invoiceNumber');

      if (invoice.status !== TurnkeyInvoiceStatus.REJECTED || !invoice.rejectedAt) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, `狀態 ${invoice.status} 的發票不能確認退回`, 'invoiceNumber');
      }

      if (await this.submissionService.hasActive(manager, companyTaxId, invoiceNumber, TurnkeyMigMessageType.A0302)) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, '已送出退回確認，等待平台結果', 'invoiceNumber');
      }

      await this.submissionService.enqueue(manager, companyTaxId, invoiceNumber, {
        messageType: TurnkeyMigMessageType.A0302,
        documentNumber: invoiceNumber,
        documentDate: invoice.issuedAt,
        buyerTaxId: invoice.buyerTaxId,
        sellerTaxId: companyTaxId,
        repliedAt: invoice.rejectedAt,
      });

      return invoice;
    });
  }

  findByNumber(companyTaxId: string, invoiceNumber: string): Promise<BaseTurnkeyInvoiceEntity | null> {
    return this.invoiceRepo.findOne({ where: { companyTaxId, invoiceNumber }, relations: { items: true } });
  }

  findByExternalId(companyTaxId: string, externalId: string): Promise<BaseTurnkeyInvoiceEntity | null> {
    return this.invoiceRepo.findOne({ where: { companyTaxId, externalId }, relations: { items: true } });
  }

  /** 作廢、註銷前：未作廢（也未失敗）的折讓要先作廢 */
  private async assertNoActiveAllowance(
    manager: EntityManager,
    companyTaxId: string,
    invoiceNumber: string,
  ): Promise<void> {
    const activeAllowances = await manager.count(TurnkeyAllowanceEntity, {
      where: {
        companyTaxId,
        invoiceNumber,
        status: Not(In([TurnkeyAllowanceStatus.VOIDED, TurnkeyAllowanceStatus.FAILED])),
      },
    });

    if (activeAllowances) throw fail(TurnkeyValidationCode.INVALID_STATE, '請先作廢這張發票的折讓', 'invoiceNumber');
  }

  /** 同字軌較小號碼的發票日期不得晚於這張 */
  private async assertDateOrder(
    manager: EntityManager,
    companyTaxId: string,
    invoiceNumber: string,
    issuedAt: Date,
  ): Promise<void> {
    const previous = await manager
      .createQueryBuilder(BaseTurnkeyInvoiceEntity, 'invoice')
      .where('invoice.companyTaxId = :companyTaxId', { companyTaxId })
      .andWhere('invoice.invoiceNumber LIKE :track', { track: `${invoiceNumber.slice(0, 2)}%` })
      .andWhere('invoice.invoiceNumber < :invoiceNumber', { invoiceNumber })
      .orderBy('invoice.issuedAt', 'DESC')
      .getOne();

    // 平台依日期（不含時間）檢查
    if (previous && formatMigDate(previous.issuedAt) > formatMigDate(issuedAt)) {
      throw fail(TurnkeyValidationCode.DATE_OUT_OF_ORDER, '開立日期早於同字軌前一張發票', 'issuedAt');
    }
  }
}
