import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, ObjectLiteral, Repository } from 'typeorm';
import { BaseTurnkeyCompanyEntity, BaseTurnkeyCompanyRepo } from './turnkey-company.entity';
import { TurnkeyAllowanceItemEntity, TurnkeyAllowanceItemRepo } from './turnkey-allowance-item.entity';
import { TurnkeyAllowanceEntity, TurnkeyAllowanceRepo } from './turnkey-allowance.entity';
import { TurnkeyReceivedDocumentEntity, TurnkeyReceivedDocumentRepo } from './turnkey-received-document.entity';
import { TurnkeyIdempotencyKeyEntity, TurnkeyIdempotencyKeyRepo } from './turnkey-idempotency-key.entity';
import { TurnkeyEventCursorEntity, TurnkeyEventCursorRepo } from './turnkey-event-cursor.entity';
import { TurnkeyEventEntity, TurnkeyEventRepo } from './turnkey-event.entity';
import { TurnkeyInvoiceItemEntity, TurnkeyInvoiceItemRepo } from './turnkey-invoice-item.entity';
import { TurnkeyInvoiceNumberEntity, TurnkeyInvoiceNumberRepo } from './turnkey-invoice-number.entity';
import { TurnkeyInvoiceTrackEntity, TurnkeyInvoiceTrackRepo } from './turnkey-invoice-track.entity';
import { BaseTurnkeyInvoiceEntity, BaseTurnkeyInvoiceRepo } from './turnkey-invoice.entity';
import { TurnkeySubmissionEntity, TurnkeySubmissionRepo } from './turnkey-submission.entity';
import { TurnkeyPrintLogEntity, TurnkeyPrintLogRepo } from './turnkey-print-log.entity';

export const TURNKEY_ENTITIES = [
  [BaseTurnkeyCompanyRepo, BaseTurnkeyCompanyEntity],
  [TurnkeyInvoiceTrackRepo, TurnkeyInvoiceTrackEntity],
  [TurnkeyInvoiceNumberRepo, TurnkeyInvoiceNumberEntity],
  [BaseTurnkeyInvoiceRepo, BaseTurnkeyInvoiceEntity],
  [TurnkeyInvoiceItemRepo, TurnkeyInvoiceItemEntity],
  [TurnkeySubmissionRepo, TurnkeySubmissionEntity],
  [TurnkeyEventRepo, TurnkeyEventEntity],
  [TurnkeyEventCursorRepo, TurnkeyEventCursorEntity],
  [TurnkeyIdempotencyKeyRepo, TurnkeyIdempotencyKeyEntity],
  [TurnkeyAllowanceRepo, TurnkeyAllowanceEntity],
  [TurnkeyAllowanceItemRepo, TurnkeyAllowanceItemEntity],
  [TurnkeyReceivedDocumentRepo, TurnkeyReceivedDocumentEntity],
  [TurnkeyPrintLogRepo, TurnkeyPrintLogEntity],
] as const;

@Module({
  imports: [TypeOrmModule.forFeature(TURNKEY_ENTITIES.map(([, entity]) => entity))],
  providers: TURNKEY_ENTITIES.map(([symbol, entity]) => ({
    provide: symbol,
    useFactory: (dataSource: DataSource): Repository<ObjectLiteral> => dataSource.getRepository(entity),
    inject: [DataSource],
  })),
  exports: TURNKEY_ENTITIES.map(([symbol]) => symbol),
})
export class TurnkeyBaseModelsModule {}
