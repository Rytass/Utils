import type { ModuleMetadata, Type } from '@nestjs/common';
import type { ConnectionOptions } from 'nats';

export const TURNKEY_NATS_NOTIFY_OPTIONS = Symbol('TURNKEY_NATS_NOTIFY_OPTIONS');

export interface TurnkeyNatsNotifyOptions {
  /** NATS 伺服器位址，例如 `nats://nats:4222` */
  readonly servers: string | readonly string[];
  /** subject 前綴，預設 `turnkey`；實際 subject 為 `${subjectPrefix}.${companyTaxId}.${type}` */
  readonly subjectPrefix?: string;
  /** 游標與 advisory lock 的通道名稱，預設 `nats` */
  readonly channel?: string;
  /** 輪詢間隔（毫秒），預設 5000；commit 後的 emit 會另外喚醒一輪 */
  readonly pollIntervalMs?: number;
  /** 其他 nats.connect 選項（user / pass / token / tls / name 等） */
  readonly connectionOptions?: Omit<ConnectionOptions, 'servers'>;
}

export interface TurnkeyNatsNotifyModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  readonly useFactory: (...args: never[]) => Promise<TurnkeyNatsNotifyOptions> | TurnkeyNatsNotifyOptions;
  readonly inject?: (string | symbol | Type<unknown>)[];
}
