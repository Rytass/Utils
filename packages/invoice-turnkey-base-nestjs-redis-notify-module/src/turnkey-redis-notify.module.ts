import { DynamicModule, Module, Provider } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TurnkeyRedisPublisherService } from './services/turnkey-redis-publisher.service';
import { createRedisTransport } from './transport/redis-transport';
import {
  TurnkeyRedisNotifyModuleAsyncOptions,
  TURNKEY_REDIS_NOTIFY_OPTIONS,
  TurnkeyRedisNotifyOptions,
} from './typings/turnkey-redis-notify.options';
import { TURNKEY_REDIS_ADVISORY_LOCK, TURNKEY_REDIS_TRANSPORT_FACTORY } from './typings/turnkey-redis-notify-providers';
import { AdvisoryLock, PgAdvisoryLock, toLockObjectId } from './utils/advisory-lock';

/** 需要宿主已註冊 TurnkeyBaseModule（全域），且 DataSource 為存放 turnkey 表的那一個連線 */
const COMMON_PROVIDERS: Provider[] = [
  {
    provide: TURNKEY_REDIS_ADVISORY_LOCK,
    useFactory: (options: TurnkeyRedisNotifyOptions, dataSource: DataSource): AdvisoryLock =>
      new PgAdvisoryLock(dataSource, toLockObjectId(`turnkey-notify:${options.channel ?? 'redis'}`)),
    inject: [TURNKEY_REDIS_NOTIFY_OPTIONS, DataSource],
  },
  {
    provide: TURNKEY_REDIS_TRANSPORT_FACTORY,
    useValue: createRedisTransport,
  },
  TurnkeyRedisPublisherService,
];

/**
 * 不註冊 Core，只把 base 的事件 outbox 發布到 Redis（Stream 或 Pub/Sub）。
 * 需搭配 TurnkeyBaseModule（由宿主或 REST 模組 forRoot 註冊）使用。
 */
@Module({})
export class TurnkeyRedisNotifyModule {
  static forRoot(options: TurnkeyRedisNotifyOptions): DynamicModule {
    return {
      module: TurnkeyRedisNotifyModule,
      providers: [{ provide: TURNKEY_REDIS_NOTIFY_OPTIONS, useValue: options }, ...COMMON_PROVIDERS],
    };
  }

  static forRootAsync(options: TurnkeyRedisNotifyModuleAsyncOptions): DynamicModule {
    return {
      module: TurnkeyRedisNotifyModule,
      imports: [...(options.imports ?? [])],
      providers: [
        {
          provide: TURNKEY_REDIS_NOTIFY_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        ...COMMON_PROVIDERS,
      ],
    };
  }
}
