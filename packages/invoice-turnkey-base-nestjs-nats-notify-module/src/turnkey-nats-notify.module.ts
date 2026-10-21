import { DynamicModule, Module, Provider } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TurnkeyNatsPublisherService } from './services/turnkey-nats-publisher.service';
import { createNatsTransport } from './transport/nats-transport';
import {
  TurnkeyNatsNotifyModuleAsyncOptions,
  TURNKEY_NATS_NOTIFY_OPTIONS,
  TurnkeyNatsNotifyOptions,
} from './typings/turnkey-nats-notify.options';
import { TURNKEY_NATS_ADVISORY_LOCK, TURNKEY_NATS_TRANSPORT_FACTORY } from './typings/turnkey-nats-notify-providers';
import { AdvisoryLock, PgAdvisoryLock, toLockObjectId } from './utils/advisory-lock';

/** 需要宿主已註冊 TurnkeyBaseModule（全域），且 DataSource 為存放 turnkey 表的那一個連線 */
const COMMON_PROVIDERS: Provider[] = [
  {
    provide: TURNKEY_NATS_ADVISORY_LOCK,
    useFactory: (options: TurnkeyNatsNotifyOptions, dataSource: DataSource): AdvisoryLock =>
      new PgAdvisoryLock(dataSource, toLockObjectId(`turnkey-notify:${options.channel ?? 'nats'}`)),
    inject: [TURNKEY_NATS_NOTIFY_OPTIONS, DataSource],
  },
  {
    provide: TURNKEY_NATS_TRANSPORT_FACTORY,
    useValue: createNatsTransport,
  },
  TurnkeyNatsPublisherService,
];

/**
 * 不註冊 Core，只把 base 的事件 outbox 發布到 NATS JetStream。
 * 需搭配 TurnkeyBaseModule（由宿主或 REST 模組 forRoot 註冊）使用。
 */
@Module({})
export class TurnkeyNatsNotifyModule {
  static forRoot(options: TurnkeyNatsNotifyOptions): DynamicModule {
    return {
      module: TurnkeyNatsNotifyModule,
      providers: [{ provide: TURNKEY_NATS_NOTIFY_OPTIONS, useValue: options }, ...COMMON_PROVIDERS],
    };
  }

  static forRootAsync(options: TurnkeyNatsNotifyModuleAsyncOptions): DynamicModule {
    return {
      module: TurnkeyNatsNotifyModule,
      imports: [...(options.imports ?? [])],
      providers: [
        {
          provide: TURNKEY_NATS_NOTIFY_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        ...COMMON_PROVIDERS,
      ],
    };
  }
}
