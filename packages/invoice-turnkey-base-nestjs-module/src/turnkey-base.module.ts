import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TurnkeyInboundService } from './inbound/turnkey-inbound.service';
import { TurnkeyBaseModelsModule } from './models/models.module';
import { TurnkeyAllowanceService } from './services/turnkey-allowance.service';
import { TurnkeyReceivedDocumentService } from './services/turnkey-received-document.service';
import { TurnkeyCompanyService } from './services/turnkey-company.service';
import { TurnkeyEventService } from './services/turnkey-event.service';
import { TurnkeyInvoiceTrackService } from './services/turnkey-invoice-track.service';
import { TurnkeyInvoiceService } from './services/turnkey-invoice.service';
import { TurnkeyIdempotencyService } from './services/turnkey-idempotency.service';
import { TurnkeySubmissionService } from './services/turnkey-submission.service';
import {
  TurnkeyBaseModuleAsyncOptions,
  TurnkeyBaseModuleOptions,
  TurnkeyBaseModuleOptionsFactory,
} from './typings/turnkey-base-module-options';
import { TurnkeyMaintenanceService } from './services/turnkey-maintenance.service';
import { TurnkeyReconciliationService } from './services/turnkey-reconciliation.service';
import { TurnkeyInvoicePrintService } from './print/turnkey-invoice-print.service';
import { TURNKEY_BASE_MODULE_OPTIONS, TURNKEY_LOG_READER } from './typings/turnkey-base-providers';
import { TurnkeyDbLogReader, TurnkeyLogReader } from './workers/turnkey-log-reader';
import { TurnkeySubmissionWorker } from './workers/turnkey-submission.worker';
import { TurnkeyWorkerRunner } from './workers/turnkey-worker.runner';

const SERVICES = [
  TurnkeyEventService,
  TurnkeyCompanyService,
  TurnkeyInvoiceTrackService,
  TurnkeyInvoiceService,
  TurnkeySubmissionWorker,
  TurnkeyIdempotencyService,
  TurnkeySubmissionService,
  TurnkeyAllowanceService,
  TurnkeyInboundService,
  TurnkeyReceivedDocumentService,
  TurnkeyMaintenanceService,
  TurnkeyReconciliationService,
  TurnkeyInvoicePrintService,
];

const COMMON_PROVIDERS: Provider[] = [
  {
    provide: TURNKEY_LOG_READER,
    // 具名連線由宿主 app 以 TypeOrmModule.forRoot({ name }) 建立，初始化順序不保證在本模組之前，
    // 所以第一次查詢時才解析
    useFactory: (options: TurnkeyBaseModuleOptions, moduleRef: ModuleRef): TurnkeyLogReader => {
      const resolveDataSource = (): DataSource =>
        typeof options.turnkeyDataSource === 'string'
          ? moduleRef.get<DataSource>(getDataSourceToken(options.turnkeyDataSource), { strict: false })
          : options.turnkeyDataSource;

      return new TurnkeyDbLogReader((sql, parameters) => resolveDataSource().query(sql, [...parameters]));
    },
    inject: [TURNKEY_BASE_MODULE_OPTIONS, ModuleRef],
  },
  ...SERVICES,
  TurnkeyWorkerRunner,
];

const EXPORTS = [TURNKEY_BASE_MODULE_OPTIONS, TURNKEY_LOG_READER, ...SERVICES];

@Global()
@Module({})
export class TurnkeyBaseModule {
  static forRoot(options: TurnkeyBaseModuleOptions): DynamicModule {
    return {
      module: TurnkeyBaseModule,
      imports: [TurnkeyBaseModelsModule],
      providers: [{ provide: TURNKEY_BASE_MODULE_OPTIONS, useValue: options }, ...COMMON_PROVIDERS],
      exports: EXPORTS,
    };
  }

  static forRootAsync(options: TurnkeyBaseModuleAsyncOptions): DynamicModule {
    return {
      module: TurnkeyBaseModule,
      imports: [...(options.imports ?? []), TurnkeyBaseModelsModule],
      providers: [...this.createAsyncProviders(options), ...COMMON_PROVIDERS],
      exports: EXPORTS,
    };
  }

  private static createAsyncProviders(options: TurnkeyBaseModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: TURNKEY_BASE_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ];
    }

    const factoryClass = options.useClass ?? options.useExisting;

    if (!factoryClass) throw new Error('TurnkeyBaseModule.forRootAsync requires useFactory, useClass or useExisting');

    return [
      ...(options.useClass ? [{ provide: options.useClass, useClass: options.useClass }] : []),
      {
        provide: TURNKEY_BASE_MODULE_OPTIONS,
        useFactory: (
          factory: TurnkeyBaseModuleOptionsFactory,
        ): Promise<TurnkeyBaseModuleOptions> | TurnkeyBaseModuleOptions => factory.createTurnkeyBaseModuleOptions(),
        inject: [factoryClass],
      },
    ];
  }
}
