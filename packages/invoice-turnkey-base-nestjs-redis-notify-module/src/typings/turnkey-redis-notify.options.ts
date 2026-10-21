import type { ModuleMetadata, Type } from '@nestjs/common';
import type { RedisOptions } from 'ioredis';

export const TURNKEY_REDIS_NOTIFY_OPTIONS = Symbol('TURNKEY_REDIS_NOTIFY_OPTIONS');

/**
 * STREAM：寫入 Redis Stream，可靠（消費端用 XREAD / consumer group 讀取，游標不會遺漏）。
 * PUBSUB：PUBLISH 到頻道，發布後即前進游標；訂閱者離線時的訊息不會重送，可能遺漏。
 */
export type TurnkeyRedisNotifyMode = 'STREAM' | 'PUBSUB';

export interface TurnkeyRedisNotifyOptions {
  /** ioredis 連線選項，或 `redis://` URL */
  readonly redis: string | RedisOptions;
  /** 預設 STREAM */
  readonly mode?: TurnkeyRedisNotifyMode;
  /** key / 頻道前綴，預設 `turnkey`；STREAM 寫入 `${keyPrefix}:events` */
  readonly keyPrefix?: string;
  /** 游標與 advisory lock 的通道名稱，預設 `redis` */
  readonly channel?: string;
  /** 輪詢間隔（毫秒），預設 5000；commit 後的 emit 會另外喚醒一輪 */
  readonly pollIntervalMs?: number;
  /** STREAM 專用：以 `MAXLEN ~ maxLen` 近似裁切，未設定則不裁切 */
  readonly maxLen?: number;
}

export interface TurnkeyRedisNotifyModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  readonly useFactory: (...args: never[]) => Promise<TurnkeyRedisNotifyOptions> | TurnkeyRedisNotifyOptions;
  readonly inject?: (string | symbol | Type<unknown>)[];
}
