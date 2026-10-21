import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, MoreThan, Repository } from 'typeorm';
import { TurnkeyAllowanceEntity } from '../models/turnkey-allowance.entity';
import { BaseTurnkeyCompanyEntity } from '../models/turnkey-company.entity';
import { BaseTurnkeyInvoiceEntity } from '../models/turnkey-invoice.entity';
import { TurnkeyPrintLogEntity, TurnkeyPrintLogRepo } from '../models/turnkey-print-log.entity';
import { TurnkeyCompanyService } from '../services/turnkey-company.service';
import type { TurnkeyBaseModuleOptions } from '../typings/turnkey-base-module-options';
import { TURNKEY_BASE_MODULE_OPTIONS } from '../typings/turnkey-base-providers';
import {
  TurnkeyAllowanceStatus,
  TurnkeyInvoiceStatus,
  TurnkeyPrintDocumentType,
  TurnkeyProofFormat,
} from '../typings/turnkey-enums';
import { formatPeriod, formatPeriodLabel } from '../utils/taipei-time';
import { buildProofBarcode, buildProofCodes } from './proof-codes';
import { TurnkeyPrintError, TurnkeyPrintErrorCode } from './turnkey-print-error';
import type {
  TurnkeyAllowanceProof,
  TurnkeyInvoiceProof,
  TurnkeyProof,
  TurnkeyProofParty,
  TurnkeyProofRequest,
  TurnkeyRenderedProof,
  TurnkeyRenderOptions,
} from './turnkey-print.types';

const CONSUMER_BUYER_ID = '0000000000';

/** 平台收下前（SUBMITTED）就能印給消費者；退件、作廢、註銷後不能印 */
const PRINTABLE_INVOICE_STATUSES: ReadonlySet<TurnkeyInvoiceStatus> = new Set([
  TurnkeyInvoiceStatus.SUBMITTED,
  TurnkeyInvoiceStatus.ISSUED,
  TurnkeyInvoiceStatus.CONFIRMED,
]);

const PRINTABLE_ALLOWANCE_STATUSES: ReadonlySet<TurnkeyAllowanceStatus> = new Set([
  TurnkeyAllowanceStatus.SUBMITTED,
  TurnkeyAllowanceStatus.ISSUED,
  TurnkeyAllowanceStatus.CONFIRMED,
]);

const toBuyer = (invoice: BaseTurnkeyInvoiceEntity): TurnkeyProofParty => ({
  taxId: invoice.buyerTaxId === CONSUMER_BUYER_ID ? null : invoice.buyerTaxId,
  name: invoice.buyerName,
  address: invoice.buyerAddress,
});

const toSeller = (company: BaseTurnkeyCompanyEntity): TurnkeyProofParty => ({
  taxId: company.taxId,
  name: company.name,
  address: company.address,
});

/**
 * 證明聯（《電子發票證明聯一維及二維條碼規格說明》Ver 1.9）與折讓證明單。
 * 每次 buildProof／buildAllowanceProof 都算一次列印，寫一筆 turnkey_print_logs；第 2 次起 reprint 為 true。
 */
@Injectable()
export class TurnkeyInvoicePrintService {
  /** 本次呼叫新寫入的列印紀錄；渲染失敗時由 discardPrint 撤銷 */
  private readonly createdLogs = new WeakMap<TurnkeyProof, TurnkeyPrintLogEntity>();

  constructor(
    @Inject(TurnkeyPrintLogRepo)
    private readonly printLogRepo: Repository<TurnkeyPrintLogEntity>,
    private readonly dataSource: DataSource,
    private readonly companyService: TurnkeyCompanyService,
    @Inject(TURNKEY_BASE_MODULE_OPTIONS)
    private readonly moduleOptions: TurnkeyBaseModuleOptions,
  ) {}

  async buildProof(request: TurnkeyProofRequest & { readonly invoiceNumber: string }): Promise<TurnkeyInvoiceProof> {
    const { companyTaxId, invoiceNumber } = request;

    const invoice = await this.dataSource.getRepository(BaseTurnkeyInvoiceEntity).findOne({
      where: { companyTaxId, invoiceNumber },
      relations: { items: true },
    });

    if (!invoice) throw new TurnkeyPrintError(TurnkeyPrintErrorCode.NOT_FOUND, '找不到發票');

    if (!invoice.printed || !PRINTABLE_INVOICE_STATUSES.has(invoice.status) || invoice.voidedAt || invoice.annulledAt) {
      throw new TurnkeyPrintError(
        TurnkeyPrintErrorCode.NOT_PRINTABLE,
        invoice.printed ? `狀態 ${invoice.status} 的發票不能列印` : '未註記列印（printed: false）的發票不能列印',
      );
    }

    const company = await this.findCompany(companyTaxId);
    const aesKey = await this.companyService.getQrAesKey(companyTaxId);

    if (!aesKey) throw new TurnkeyPrintError(TurnkeyPrintErrorCode.QR_KEY_MISSING, '營業人尚未設定 QR Code AES 金鑰');

    const items = [...invoice.items].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    const isConsumer = invoice.buyerTaxId === CONSUMER_BUYER_ID;
    const randomNumber = invoice.randomNumber ?? undefined;

    const codes = buildProofCodes({
      invoiceNumber,
      issuedAt: invoice.issuedAt,
      randomNumber,
      // 消費者發票稅額不分離，QR Code 的銷售額填 0（規格書）；B2B 為未稅合計
      salesAmount: isConsumer ? 0 : invoice.totalAmount - invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      buyerTaxId: isConsumer ? undefined : invoice.buyerTaxId,
      sellerTaxId: companyTaxId,
      aesKey,
      items: items.map(item => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice })),
    });

    const { log, created } = await this.recordPrint(
      companyTaxId,
      TurnkeyPrintDocumentType.INVOICE,
      invoiceNumber,
      request,
    );

    return this.remember(created ? log : null, {
      documentType: 'INVOICE',
      invoiceNumber,
      issuedAt: invoice.issuedAt,
      periodLabel: formatPeriodLabel(formatPeriod(invoice.issuedAt)),
      randomNumber: invoice.randomNumber,
      seller: toSeller(company),
      buyer: toBuyer(invoice),
      deliveryMode: invoice.deliveryMode,
      taxType: invoice.taxType,
      salesAmount: invoice.salesAmount,
      taxFreeSalesAmount: invoice.taxFreeSalesAmount,
      zeroRatedSalesAmount: invoice.zeroRatedSalesAmount,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      zeroRated:
        invoice.zeroRatedReasonCode && invoice.customsClearance
          ? { reasonCode: invoice.zeroRatedReasonCode, customsClearance: invoice.customsClearance }
          : null,
      mainRemark: invoice.mainRemark,
      items: items.map(item => ({
        sequenceNumber: item.sequenceNumber,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        amount: item.amount,
        taxType: item.taxType,
        remark: item.remark,
      })),
      barcode: buildProofBarcode(invoiceNumber, invoice.issuedAt, randomNumber),
      qrCodeLeft: codes.qrCodeLeft,
      qrCodeRight: codes.qrCodeRight,
      printCount: log.sequence,
      reprint: log.sequence > 1,
      printedAt: log.createdAt,
    });
  }

  async buildAllowanceProof(
    request: TurnkeyProofRequest & { readonly allowanceNumber: string },
  ): Promise<TurnkeyAllowanceProof> {
    const { companyTaxId, allowanceNumber } = request;

    const allowance = await this.dataSource.getRepository(TurnkeyAllowanceEntity).findOne({
      where: { companyTaxId, allowanceNumber },
      relations: { items: true },
    });

    if (!allowance) throw new TurnkeyPrintError(TurnkeyPrintErrorCode.NOT_FOUND, '找不到折讓');

    if (!PRINTABLE_ALLOWANCE_STATUSES.has(allowance.status) || allowance.voidedAt) {
      throw new TurnkeyPrintError(TurnkeyPrintErrorCode.NOT_PRINTABLE, `狀態 ${allowance.status} 的折讓不能列印`);
    }

    const invoice = await this.dataSource.getRepository(BaseTurnkeyInvoiceEntity).findOne({
      where: { companyTaxId, invoiceNumber: allowance.invoiceNumber },
    });

    if (!invoice) throw new TurnkeyPrintError(TurnkeyPrintErrorCode.NOT_FOUND, '找不到原發票');

    const company = await this.findCompany(companyTaxId);
    const { log, created } = await this.recordPrint(
      companyTaxId,
      TurnkeyPrintDocumentType.ALLOWANCE,
      allowanceNumber,
      request,
    );

    return this.remember(created ? log : null, {
      documentType: 'ALLOWANCE',
      allowanceNumber,
      allowanceDate: allowance.allowanceDate,
      originalInvoiceNumber: allowance.invoiceNumber,
      originalInvoiceIssuedAt: invoice.issuedAt,
      seller: toSeller(company),
      buyer: toBuyer(invoice),
      deliveryMode: allowance.deliveryMode,
      totalAmount: allowance.totalAmount,
      taxAmount: allowance.taxAmount,
      items: [...allowance.items]
        .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
        .map(item => ({
          sequenceNumber: item.sequenceNumber,
          originalSequenceNumber: item.originalSequenceNumber,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          tax: item.tax,
          taxType: item.taxType,
        })),
      printCount: log.sequence,
      reprint: log.sequence > 1,
      printedAt: log.createdAt,
    });
  }

  /**
   * 渲染失敗（例如缺選用套件）時撤銷這次的列印紀錄，下次列印才不會被算成補印。
   * 只撤銷本次新寫入、且仍是最新一筆的紀錄；冪等重播回傳的既有紀錄不動。
   */
  async discardPrint(proof: TurnkeyProof): Promise<void> {
    const log = this.createdLogs.get(proof);

    if (!log) return;

    this.createdLogs.delete(proof);

    await this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `turnkey-print:${log.companyTaxId}:${log.documentType}:${log.documentNumber}`,
      ]);

      const later = await manager.count(TurnkeyPrintLogEntity, {
        where: {
          companyTaxId: log.companyTaxId,
          documentType: log.documentType,
          documentNumber: log.documentNumber,
          sequence: MoreThan(log.sequence),
        },
      });

      if (!later) await manager.delete(TurnkeyPrintLogEntity, { id: log.id });
    });
  }

  private remember<T extends TurnkeyProof>(created: TurnkeyPrintLogEntity | null, proof: T): T {
    if (created) this.createdLogs.set(proof, created);

    return proof;
  }

  /** JSON 直接回傳資料；其他格式交給 renderers（需要選用套件） */
  async render(proof: TurnkeyProof, options: TurnkeyRenderOptions): Promise<TurnkeyRenderedProof> {
    if (options.format === TurnkeyProofFormat.JSON) {
      return {
        format: options.format,
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify(proof), 'utf8'),
      };
    }

    const { renderProof } = await import('./renderers');

    // 呼叫參數優先，未指定時沿用 module options 的 print 設定
    const merged: TurnkeyRenderOptions = {
      format: options.format,
      fontPath: options.fontPath ?? this.moduleOptions.print?.fontPath,
      paperWidthMm: options.paperWidthMm ?? this.moduleOptions.print?.paperWidthMm,
    };

    return renderProof(proof, merged);
  }

  listPrintLogs(
    companyTaxId: string,
    documentType: TurnkeyPrintDocumentType,
    documentNumber: string,
  ): Promise<TurnkeyPrintLogEntity[]> {
    return this.printLogRepo.find({
      where: { companyTaxId, documentType, documentNumber },
      order: { sequence: 'ASC' },
    });
  }

  private async findCompany(companyTaxId: string): Promise<BaseTurnkeyCompanyEntity> {
    const company = await this.companyService.findByTaxId(companyTaxId);

    if (!company) throw new TurnkeyPrintError(TurnkeyPrintErrorCode.NOT_FOUND, '營業人尚未登錄');

    return company;
  }

  /** 以 advisory xact lock 序列化同一份文件的列印，第幾次不會重複；同一個 idempotencyKey 回傳原紀錄 */
  private recordPrint(
    companyTaxId: string,
    documentType: TurnkeyPrintDocumentType,
    documentNumber: string,
    request: TurnkeyProofRequest,
  ): Promise<{ readonly log: TurnkeyPrintLogEntity; readonly created: boolean }> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `turnkey-print:${companyTaxId}:${documentType}:${documentNumber}`,
      ]);

      if (request.idempotencyKey) {
        const replayed = await manager.findOne(TurnkeyPrintLogEntity, {
          where: { companyTaxId, documentType, documentNumber, idempotencyKey: request.idempotencyKey },
        });

        if (replayed) return { log: replayed, created: false };
      }

      const printed = await manager.count(TurnkeyPrintLogEntity, {
        where: { companyTaxId, documentType, documentNumber },
      });

      const log = await manager.save(
        manager.create(TurnkeyPrintLogEntity, {
          companyTaxId,
          documentType,
          documentNumber,
          sequence: printed + 1,
          format: request.format ?? TurnkeyProofFormat.JSON,
          operator: request.operator ?? null,
          idempotencyKey: request.idempotencyKey ?? null,
        }),
      );

      return { log, created: true };
    });
  }
}
