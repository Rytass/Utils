import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { TurnkeyRedisNotifyOptions } from '../typings/turnkey-redis-notify.options';

const DEFAULT_COMMAND_TIMEOUT_MS = 10_000;

/** 發布端抽象；方便單元測試替換成假的 client */
export interface RedisTransport {
  /** XADD；resolve 代表 Redis 已回覆寫入成功 */
  xadd(key: string, maxLen: number | undefined, fields: readonly string[]): Promise<void>;
  /** PUBLISH；resolve 代表 Redis 已接受（不代表有訂閱者收到） */
  publish(channel: string, message: string): Promise<void>;
  close(): Promise<void>;
}

export type RedisTransportFactory = (options: TurnkeyRedisNotifyOptions) => Promise<RedisTransport>;

export const createRedisTransport: RedisTransportFactory = async ({ redis }) => {
  const logger = new Logger('TurnkeyRedisNotify');
  // 半開連線時命令不會自己結束；逾時讓這一輪失敗、下一輪重建連線
  const client =
    typeof redis === 'string'
      ? new Redis(redis, { commandTimeout: DEFAULT_COMMAND_TIMEOUT_MS })
      : new Redis({ commandTimeout: DEFAULT_COMMAND_TIMEOUT_MS, ...redis });

  client.on('error', error => logger.warn(`Redis connection error: ${error.message}`));

  return {
    xadd: async (key, maxLen, fields): Promise<void> => {
      if (maxLen === undefined) {
        await client.xadd(key, '*', ...fields);

        return;
      }

      await client.xadd(key, 'MAXLEN', '~', String(maxLen), '*', ...fields);
    },
    publish: async (channel, message): Promise<void> => {
      await client.publish(channel, message);
    },
    close: async (): Promise<void> => {
      await client.quit();
    },
  };
};
