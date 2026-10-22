import { Inject, Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { CONSUMER_BUYER_ID } from '../mig/mig-builder';
import { TurnkeyAllowanceItemEntity } from '../models/turnkey-allowance-item.entity';
import { TurnkeyAllowanceEntity, TurnkeyAllowanceRepo } from '../models/turnkey-allowance.entity';
import { BaseTurnkeyCompanyEntity, BaseTurnkeyCompanyRepo } from '../models/turnkey-company.entity';
import { TurnkeyInvoiceItemEntity } from '../models/turnkey-invoice-item.entity';
import { BaseTurnkeyInvoiceEntity } from '../models/turnkey-invoice.entity';
import {
  TurnkeyAllowanceStatus,
  TurnkeyDeliveryMode,
  TurnkeyInvoiceStatus,
  TurnkeyMigMessageType,
  TurnkeyTaxType,
} from '../typings/turnkey-enums';
import { TurnkeyItemTaxType } from '../typings/turnkey-invoice.types';
import { roundTo, splitAllowanceAmount } from '../utils/amounts';
import { formatMigDate } from '../utils/taipei-time';
import { validateSellerAddress } from '../validation/invoice-rules';
import { TurnkeyValidationCode, TurnkeyValidationError } from '../validation/turnkey-validation-error';
import { TurnkeySubmissionService } from './turnkey-submission.service';

export interface TurnkeyAllowanceItemInput {
  /** 對應原發票明細序號；省略時以品名比對 */
  readonly originalSequenceNumber?: number;
  readonly description: string;
  readonly quantity: number;
  /** 金額慣例同原發票：B2B 未稅、B2C 含稅 */
  readonly unitPrice: number;
  readonly taxType: TurnkeyItemTaxType;
  readonly amount?: number;
}

export interface TurnkeyAllowanceIssueInput {
  readonly companyTaxId: string;
  readonly invoiceNumber: string;
  readonly externalId?: string;
  /** 自訂折讓單號（最多 16 碼）；省略時自動產生 */
  readonly allowanceNumber?: string;
  readonly allowanceDate?: Date;
  readonly items: readonly TurnkeyAllowanceItemInput[];
}

const fail = (code: TurnkeyValidationCode, message: string, field?: string): TurnkeyValidationError =>
  new TurnkeyValidationError([{ code, message, field }]);

const ACTIVE_ALLOWANCE_STATUSES = [
  TurnkeyAllowanceStatus.SUBMITTED,
  TurnkeyAllowanceStatus.ISSUED,
  TurnkeyAllowanceStatus.CONFIRMED,
  TurnkeyAllowanceStatus.VOID_PENDING,
];

/**
 * 同一 externalId 的重送是否為同一筆折讓。存下的單價是未稅、B2C 輸入是含稅，所以不比單價，
 * 比原發票、品名、數量、課稅別與指定的原明細序號。
 */
const isSameAllowanceRequest = (allowance: TurnkeyAllowanceEntity, input: TurnkeyAllowanceIssueInput): boolean => {
  const items = [...(allowance.items ?? [])].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return (
    allowance.invoiceNumber === input.invoiceNumber &&
    (input.allowanceNumber == null || allowance.allowanceNumber === input.allowanceNumber) &&
    items.length === input.items.length &&
    items.every((item, index) => {
      const requested = input.items[index];

      return (
        item.description === requested.description &&
        Number(item.quantity) === Number(requested.quantity) &&
        item.taxType === requested.taxType &&
        (requested.originalSequenceNumber == null || item.originalSequenceNumber === requested.originalSequenceNumber)
      );
    })
  );
};

const replayOrConflict = (
  existing: TurnkeyAllowanceEntity,
  input: TurnkeyAllowanceIssueInput,
): TurnkeyAllowanceEntity => {
  if (!isSameAllowanceRequest(existing, input)) {
    throw fail(TurnkeyValidationCode.EXTERNAL_ID_CONFLICT, '此 externalId 已開立內容不同的折讓', 'externalId');
  }

  return existing;
};

/** 折讓單號：西元年月日 8 碼＋8 碼亂數，共 16 碼 */
const generateAllowanceNumber = (date: Date): string =>
  `${formatMigDate(date)}${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;

export interface TurnkeyAllowanceListFilter {
  readonly companyTaxId: string;
  readonly status?: TurnkeyAllowanceStatus;
  /** 原發票號碼 */
  readonly invoiceNumber?: string;
  /** 1–500，預設 100 */
  readonly limit?: number;
  readonly offset?: number;
}

export interface TurnkeyAllowanceListResult {
  readonly items: readonly TurnkeyAllowanceEntity[];
  readonly total: number;
}

@Injectable()
export class TurnkeyAllowanceService {
  constructor(
    @Inject(TurnkeyAllowanceRepo)
    private readonly allowanceRepo: Repository<TurnkeyAllowanceEntity>,
    @Inject(BaseTurnkeyCompanyRepo)
    private readonly companyRepo: Repository<BaseTurnkeyCompanyEntity>,
    private readonly dataSource: DataSource,
    private readonly submissionService: TurnkeySubmissionService,
  ) {}

  /**
   * 開立折讓（存證 G0401、交換 B0101）。原發票需已被平台收下且未作廢；
   * 折讓金額（含稅）累計不得超過原發票總計。
   */
  async issue(input: TurnkeyAllowanceIssueInput): Promise<TurnkeyAllowanceEntity> {
    if (input.externalId) {
      const existing = await this.allowanceRepo.findOne({
        where: { companyTaxId: input.companyTaxId, externalId: input.externalId },
        relations: { items: true },
      });

      if (existing) return replayOrConflict(existing, input);
    }

    if (!Array.isArray(input.items) || !input.items.length)
      throw fail(TurnkeyValidationCode.ALLOWANCE_AMOUNT_INVALID, '至少要有一筆明細', 'items');

    if (input.allowanceNumber != null && !/^[0-9A-Za-z-]{1,16}$/.test(input.allowanceNumber)) {
      throw fail(TurnkeyValidationCode.ALLOWANCE_AMOUNT_INVALID, '折讓單號最多 16 碼英數字', 'allowanceNumber');
    }

    const company = await this.companyRepo.findOne({ where: { taxId: input.companyTaxId } });

    if (!company) throw fail(TurnkeyValidationCode.COMPANY_NOT_REGISTERED, '營業人尚未登錄', 'companyTaxId');

    // G0401 與 B0101 同樣必須帶賣方地址
    const sellerIssues = validateSellerAddress(company);

    if (sellerIssues.length) throw new TurnkeyValidationError(sellerIssues);

    const allowanceDate = input.allowanceDate ?? new Date();

    return this.dataSource.transaction(async manager => {
      if (input.externalId) {
        // 併發的同 externalId 請求在此排隊，後到的拿到先開好的那筆
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `turnkey:allowance-external-id:${input.companyTaxId}:${input.externalId}`,
        ]);

        const raced = await manager.findOne(TurnkeyAllowanceEntity, {
          where: { companyTaxId: input.companyTaxId, externalId: input.externalId },
          relations: { items: true },
        });

        if (raced) return replayOrConflict(raced, input);
      }

      const invoice = await manager
        .createQueryBuilder(BaseTurnkeyInvoiceEntity, 'invoice')
        .setLock('pessimistic_write')
        .where('invoice.companyTaxId = :companyTaxId AND invoice.invoiceNumber = :invoiceNumber', {
          companyTaxId: input.companyTaxId,
          invoiceNumber: input.invoiceNumber,
        })
        .getOne();

      if (!invoice) throw fail(TurnkeyValidationCode.INVOICE_NOT_FOUND, '找不到原發票', 'invoiceNumber');

      if (
        ![TurnkeyInvoiceStatus.ISSUED, TurnkeyInvoiceStatus.CONFIRMED].includes(invoice.status) ||
        invoice.voidedAt ||
        invoice.annulledAt
      ) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, `狀態 ${invoice.status} 的發票不能折讓`, 'invoiceNumber');
      }

      if (formatMigDate(allowanceDate) < formatMigDate(invoice.issuedAt)) {
        throw fail(TurnkeyValidationCode.DATE_OUT_OF_ORDER, '折讓日期不得早於發票日期', 'allowanceDate');
      }

      const invoiceItems = await manager.find(TurnkeyInvoiceItemEntity, {
        where: { invoiceId: invoice.id },
        order: { sequenceNumber: 'ASC' },
      });

      const isB2B = invoice.buyerTaxId !== CONSUMER_BUYER_ID;

      const lines = input.items.map((item, index) => {
        const sameDescription = invoiceItems.filter(candidate => candidate.description === item.description);

        // 原發票有多筆同名明細時無法判斷折哪一筆，必須指定 originalSequenceNumber
        if (item.originalSequenceNumber == null && sameDescription.length > 1) {
          throw fail(
            TurnkeyValidationCode.ALLOWANCE_AMOUNT_INVALID,
            '原發票有多筆同名明細，請指定 originalSequenceNumber',
            `items[${index}].originalSequenceNumber`,
          );
        }

        const original =
          item.originalSequenceNumber != null
            ? invoiceItems.find(candidate => candidate.sequenceNumber === item.originalSequenceNumber)
            : sameDescription[0];

        if (!original) {
          throw fail(TurnkeyValidationCode.ALLOWANCE_AMOUNT_INVALID, '找不到對應的原發票明細', `items[${index}]`);
        }

        if (!(item.quantity > 0) || item.quantity > original.quantity) {
          throw fail(
            TurnkeyValidationCode.ALLOWANCE_AMOUNT_INVALID,
            '折讓數量需大於 0 且不超過原數量',
            `items[${index}]`,
          );
        }

        if (item.taxType !== original.taxType) {
          throw fail(
            TurnkeyValidationCode.ALLOWANCE_AMOUNT_INVALID,
            '課稅別需與原發票明細相同',
            `items[${index}].taxType`,
          );
        }

        const gross = item.amount ?? roundTo(item.quantity * item.unitPrice);

        if (!(gross > 0)) {
          throw fail(TurnkeyValidationCode.ALLOWANCE_AMOUNT_INVALID, '折讓金額需大於 0', `items[${index}]`);
        }

        const split = splitAllowanceAmount(gross, item.taxType, {
          isB2B,
          specialTaxRate: item.taxType === TurnkeyTaxType.SPECIAL ? invoice.taxRate : undefined,
        });

        return { item, original, split };
      });

      const previous = await manager.find(TurnkeyAllowanceEntity, {
        where: {
          companyTaxId: input.companyTaxId,
          invoiceNumber: input.invoiceNumber,
          status: In(ACTIVE_ALLOWANCE_STATUSES),
        },
      });

      const previousTotal = previous.reduce((sum, allowance) => sum + allowance.totalAmount + allowance.taxAmount, 0);

      // 每一筆原明細的累計折讓數量（含這次）不得超過原數量
      const previousItems = previous.length
        ? await manager.find(TurnkeyAllowanceItemEntity, {
            where: { allowanceId: In(previous.map(allowance => allowance.id)) },
          })
        : [];

      const cumulativeQuantity = (sequenceNumber: number): number =>
        [
          ...previousItems,
          ...lines.map(line => ({
            originalSequenceNumber: line.original.sequenceNumber,
            quantity: line.item.quantity,
          })),
        ]
          .filter(item => item.originalSequenceNumber === sequenceNumber)
          .reduce((sum, item) => sum + item.quantity, 0);

      lines.forEach((line, index) => {
        if (cumulativeQuantity(line.original.sequenceNumber) > line.original.quantity) {
          throw fail(
            TurnkeyValidationCode.ALLOWANCE_EXCEEDS_INVOICE,
            '同一明細的累計折讓數量超過原數量',
            `items[${index}].quantity`,
          );
        }
      });

      const totalAmount = lines.reduce((sum, line) => sum + line.split.amount, 0);
      const taxAmount = lines.reduce((sum, line) => sum + line.split.tax, 0);

      if (previousTotal + totalAmount + taxAmount > invoice.totalAmount) {
        throw fail(TurnkeyValidationCode.ALLOWANCE_EXCEEDS_INVOICE, '折讓累計金額超過原發票總計', 'items');
      }

      const allowanceId = randomUUID();
      const allowanceNumber = input.allowanceNumber ?? generateAllowanceNumber(allowanceDate);
      const isExchange = invoice.deliveryMode === TurnkeyDeliveryMode.EXCHANGE;

      const saved = await manager.save(
        manager.create(TurnkeyAllowanceEntity, {
          id: allowanceId,
          companyTaxId: input.companyTaxId,
          allowanceNumber,
          externalId: input.externalId ?? null,
          invoiceNumber: invoice.invoiceNumber,
          deliveryMode: invoice.deliveryMode,
          status: TurnkeyAllowanceStatus.SUBMITTED,
          allowanceDate,
          buyerTaxId: invoice.buyerTaxId,
          totalAmount,
          taxAmount,
          voidedAt: null,
          voidReason: null,
          items: lines.map((line, index) =>
            manager.create(TurnkeyAllowanceItemEntity, {
              allowanceId,
              sequenceNumber: index + 1,
              originalSequenceNumber: line.original.sequenceNumber,
              description: line.original.description,
              quantity: line.item.quantity,
              unitPrice: roundTo(line.split.amount / line.item.quantity),
              amount: line.split.amount,
              tax: line.split.tax,
              taxType: line.item.taxType,
            }),
          ),
        }),
      );

      await this.submissionService.enqueue(manager, input.companyTaxId, allowanceNumber, {
        messageType: isExchange ? TurnkeyMigMessageType.B0101 : TurnkeyMigMessageType.G0401,
        allowanceNumber,
        allowanceDate,
        seller: { taxId: company.taxId, name: company.name, address: company.address ?? undefined },
        buyer: { taxId: invoice.buyerTaxId, name: invoice.buyerName, address: invoice.buyerAddress ?? undefined },
        items: saved.items.map(item => ({
          originalInvoiceNumber: invoice.invoiceNumber,
          originalInvoiceIssuedAt: invoice.issuedAt,
          originalSequenceNumber: item.originalSequenceNumber ?? undefined,
          originalDescription: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          tax: item.tax,
          taxType: item.taxType,
        })),
        taxAmount,
        totalAmount,
      });

      return saved;
    });
  }

  /** 作廢折讓：存證 G0501（平台收下後 VOIDED），交換 B0201（VOID_PENDING，買方回 B0202 才 VOIDED） */
  async void(companyTaxId: string, allowanceNumber: string, reason: string): Promise<TurnkeyAllowanceEntity> {
    const trimmed = reason?.trim() ?? '';

    if (!trimmed || trimmed.length > 20) {
      throw fail(TurnkeyValidationCode.INVALID_STATE, '作廢原因必填，最多 20 字', 'reason');
    }

    return this.dataSource.transaction(async manager => {
      const allowance = await this.lockAllowance(manager, companyTaxId, allowanceNumber);

      if (![TurnkeyAllowanceStatus.ISSUED, TurnkeyAllowanceStatus.CONFIRMED].includes(allowance.status)) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, `狀態 ${allowance.status} 的折讓不能作廢`, 'allowanceNumber');
      }

      const isExchange = allowance.deliveryMode === TurnkeyDeliveryMode.EXCHANGE;
      const messageType = isExchange ? TurnkeyMigMessageType.B0201 : TurnkeyMigMessageType.G0501;

      if (await this.submissionService.hasActive(manager, companyTaxId, allowanceNumber, messageType)) {
        throw fail(TurnkeyValidationCode.INVALID_STATE, '已送出作廢，等待平台結果', 'allowanceNumber');
      }

      const cancelledAt = new Date();

      await this.submissionService.enqueue(manager, companyTaxId, allowanceNumber, {
        messageType,
        allowanceNumber,
        allowanceDate: allowance.allowanceDate,
        buyerTaxId: allowance.buyerTaxId,
        sellerTaxId: companyTaxId,
        cancelledAt,
        reason: trimmed,
      });

      await manager.update(TurnkeyAllowanceEntity, allowance.id, { voidedAt: cancelledAt, voidReason: trimmed });

      return { ...allowance, voidedAt: cancelledAt, voidReason: trimmed };
    });
  }

  /** 折讓單，新到舊；同一時間以折讓單號新到舊排序，分頁才穩定。不含明細 */
  async list(filter: TurnkeyAllowanceListFilter): Promise<TurnkeyAllowanceListResult> {
    const { companyTaxId, status, invoiceNumber } = filter;

    const [items, total] = await this.allowanceRepo.findAndCount({
      where: { companyTaxId, ...(status ? { status } : {}), ...(invoiceNumber ? { invoiceNumber } : {}) },
      order: { allowanceDate: 'DESC', allowanceNumber: 'DESC' },
      take: Math.min(Math.max(filter.limit ?? 100, 1), 500),
      skip: Math.max(filter.offset ?? 0, 0),
    });

    return { items, total };
  }

  /** 一張發票的所有折讓（含已作廢），依建立時間排序 */
  listByInvoice(companyTaxId: string, invoiceNumber: string): Promise<TurnkeyAllowanceEntity[]> {
    return this.allowanceRepo.find({
      where: { companyTaxId, invoiceNumber },
      relations: { items: true },
      order: { createdAt: 'ASC' },
    });
  }

  findByNumber(companyTaxId: string, allowanceNumber: string): Promise<TurnkeyAllowanceEntity | null> {
    return this.allowanceRepo.findOne({ where: { companyTaxId, allowanceNumber }, relations: { items: true } });
  }

  private async lockAllowance(
    manager: EntityManager,
    companyTaxId: string,
    allowanceNumber: string,
  ): Promise<TurnkeyAllowanceEntity> {
    const allowance = await manager
      .createQueryBuilder(TurnkeyAllowanceEntity, 'allowance')
      .setLock('pessimistic_write')
      .where('allowance.companyTaxId = :companyTaxId AND allowance.allowanceNumber = :allowanceNumber', {
        companyTaxId,
        allowanceNumber,
      })
      .getOne();

    if (!allowance) throw fail(TurnkeyValidationCode.INVOICE_NOT_FOUND, '找不到折讓單', 'allowanceNumber');

    return allowance;
  }
}
