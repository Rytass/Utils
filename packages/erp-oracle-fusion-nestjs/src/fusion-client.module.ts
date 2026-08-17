import { DynamicModule, Logger, Module, Provider } from '@nestjs/common';
import {
  FusionCustomerAccountService,
  FusionCustomerProfileService,
  FusionFbdiService,
  FusionRestClient,
  FusionSoapClient,
} from '@rytass/erp-oracle-fusion';
import type { FusionCallLogSink, FusionClientOptions, FusionLogger } from '@rytass/erp-oracle-fusion';
import { FUSION_CALL_LOG_SINK, FUSION_CLIENT_OPTIONS } from './constants';
import { NoopFusionCallLogSink } from './noop-call-log.sink';
import type {
  FusionCallLogSinkOptions,
  FusionClientModuleAsyncOptions,
  FusionClientModuleConfig,
  FusionClientModuleOptions,
} from './interfaces';

/** 把 NestJS `Logger` 橋接成 core 的 `FusionLogger`。 */
function createNestLogger(): FusionLogger {
  const logger = new Logger(FusionRestClient.name);

  return {
    debug: (message: string): void => logger.debug(message),
    warn: (message: string): void => logger.warn(message),
    error: (message: string): void => logger.error(message),
  };
}

function buildCallLogSinkProvider(options?: FusionCallLogSinkOptions): Provider {
  if (options?.useExisting) {
    return { provide: FUSION_CALL_LOG_SINK, useExisting: options.useExisting };
  }

  if (options?.useClass) {
    return { provide: FUSION_CALL_LOG_SINK, useClass: options.useClass };
  }

  if (options?.useFactory) {
    return {
      provide: FUSION_CALL_LOG_SINK,
      useFactory: options.useFactory,
      inject: (options.inject ?? []) as never[],
    };
  }

  return { provide: FUSION_CALL_LOG_SINK, useClass: NoopFusionCallLogSink };
}

function buildClientProviders(disableLogger?: boolean): Provider[] {
  return [
    {
      provide: FusionRestClient,
      useFactory: (config: FusionClientModuleConfig, callLogSink: FusionCallLogSink): FusionRestClient =>
        new FusionRestClient({
          ...config,
          callLogSink,
          ...(disableLogger ? {} : { logger: createNestLogger() }),
        } as FusionClientOptions),
      inject: [FUSION_CLIENT_OPTIONS, FUSION_CALL_LOG_SINK],
    },
    {
      provide: FusionFbdiService,
      useFactory: (client: FusionRestClient): FusionFbdiService => new FusionFbdiService(client),
      inject: [FusionRestClient],
    },
    // SOAP client 與 REST client 共用同一份設定（含認證與觀測 sink），因此兩邊的呼叫會落在
    // 同一組觀測紀錄裡，可依 correlationId 串起一筆單據的完整整合軌跡。
    {
      provide: FusionSoapClient,
      useFactory: (config: FusionClientModuleConfig, callLogSink: FusionCallLogSink): FusionSoapClient =>
        new FusionSoapClient({
          ...config,
          callLogSink,
          ...(disableLogger ? {} : { logger: createNestLogger() }),
        } as FusionClientOptions),
      inject: [FUSION_CLIENT_OPTIONS, FUSION_CALL_LOG_SINK],
    },
    {
      provide: FusionCustomerAccountService,
      useFactory: (client: FusionSoapClient): FusionCustomerAccountService => new FusionCustomerAccountService(client),
      inject: [FusionSoapClient],
    },
    {
      provide: FusionCustomerProfileService,
      useFactory: (client: FusionSoapClient): FusionCustomerProfileService => new FusionCustomerProfileService(client),
      inject: [FusionSoapClient],
    },
  ];
}

/** `forRoot` 與 `forRootAsync` 共用的匯出清單。 */
const EXPORTED_PROVIDERS = [
  FusionRestClient,
  FusionFbdiService,
  FusionSoapClient,
  FusionCustomerAccountService,
  FusionCustomerProfileService,
  FUSION_CLIENT_OPTIONS,
];

/**
 * Oracle Fusion 整合的 NestJS 入口 module。
 *
 * 一次註冊即提供 REST（`FusionRestClient`／`FusionFbdiService`）與 SOAP
 * （`FusionSoapClient`／`FusionCustomerAccountService`／`FusionCustomerProfileService`）
 * 兩條通路，共用同一份設定與觀測 sink。客戶帳戶與 AR 信用檔沒有 REST 資源，只能走 SOAP。
 *
 * ```ts
 * FusionClientModule.forRootAsync({
 *   imports: [ConfigModule],
 *   inject: [ConfigService],
 *   useFactory: (config: ConfigService) => ({
 *     baseUrl: config.getOrThrow('FUSION_BASE_URL'),
 *     auth: {
 *       type: 'oauth2_client_credentials',
 *       tokenUrl: config.getOrThrow('FUSION_OAUTH_TOKEN_URL'),
 *       clientId: config.getOrThrow('FUSION_CLIENT_ID'),
 *       clientSecret: config.getOrThrow('FUSION_CLIENT_SECRET'),
 *     },
 *   }),
 *   callLogSink: { imports: [ObservabilityModule], useExisting: MyFusionCallLogService },
 * })
 * ```
 *
 * **`forRoot(Async)` 只能呼叫一次**（呼叫兩次會建出兩套 client，各自有獨立的 token 快取）。
 * 要讓多個 module 共用，建議包一層 wrapper module 並 `exports: [FusionClientModule]`，
 * 讓依賴在模組定義上看得見；不想逐一改 module 定義時才用 `isGlobal: true`。
 */
@Module({})
export class FusionClientModule {
  static forRoot(options: FusionClientModuleOptions): DynamicModule {
    return {
      module: FusionClientModule,
      global: options.isGlobal ?? false,
      imports: options.callLogSink?.imports ?? [],
      providers: [
        { provide: FUSION_CLIENT_OPTIONS, useValue: options.config },
        buildCallLogSinkProvider(options.callLogSink),
        ...buildClientProviders(options.disableLogger),
      ],
      exports: EXPORTED_PROVIDERS,
    };
  }

  static forRootAsync(options: FusionClientModuleAsyncOptions): DynamicModule {
    return {
      module: FusionClientModule,
      global: options.isGlobal ?? false,
      imports: [...(options.imports ?? []), ...(options.callLogSink?.imports ?? [])],
      providers: [
        {
          provide: FUSION_CLIENT_OPTIONS,
          useFactory: options.useFactory,
          inject: (options.inject ?? []) as never[],
        },
        buildCallLogSinkProvider(options.callLogSink),
        ...buildClientProviders(options.disableLogger),
      ],
      exports: EXPORTED_PROVIDERS,
    };
  }
}
