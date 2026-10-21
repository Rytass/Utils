import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { TurnkeyEvent, TurnkeyEventService, TurnkeyEvents } from '@rytass/invoice-turnkey-base-nestjs-module';
import type { AdvisoryLock } from '../utils/advisory-lock';
import type { RedisTransport, RedisTransportFactory } from '../transport/redis-transport';
import { TURNKEY_REDIS_NOTIFY_OPTIONS } from '../typings/turnkey-redis-notify.options';
import type { TurnkeyRedisNotifyMode, TurnkeyRedisNotifyOptions } from '../typings/turnkey-redis-notify.options';
import {
  TURNKEY_REDIS_ADVISORY_LOCK,
  TURNKEY_REDIS_TRANSPORT_FACTORY,
} from '../typings/turnkey-redis-notify-providers';

const DEFAULT_CHANNEL = 'redis';
const DEFAULT_KEY_PREFIX = 'turnkey';
const DEFAULT_MODE: TurnkeyRedisNotifyMode = 'STREAM';
const DEFAULT_POLL_INTERVAL_MS = 5000;
const BATCH_SIZE = 100;

/** base 只會在 commit 之後 emit 這些事件；這裡只把 emit 當叫醒訊號，可靠交付靠游標 */
const WAKE_EVENT_TYPES: readonly TurnkeyEvents[] = Object.values(TurnkeyEvents);

/** 本服務實際用到的 base 介面，方便測試替換 */
export type TurnkeyEventSource = Pick<TurnkeyEventService, 'emitter' | 'listAfter' | 'getCursor' | 'advanceCursor'>;

const encodeEvent = (event: TurnkeyEvent): string =>
  JSON.stringify({
    id: event.id,
    type: event.type,
    companyTaxId: event.companyTaxId,
    data: event.data,
    createdAt: event.createdAt,
  });

/**
 * 把 turnkey_events outbox 依序發布到 Redis（STREAM 或 PUBSUB）。
 * 一次只跑一輪；每筆發布成功後才前進游標，失敗則下一輪重試。
 * 多實例時以 advisory lock 選出唯一發布者。
 */
@Injectable()
export class TurnkeyRedisPublisherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TurnkeyRedisPublisherService.name);
  private readonly channel: string;
  private readonly mode: TurnkeyRedisNotifyMode;
  private readonly keyPrefix: string;
  private readonly pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private transport: RedisTransport | null = null;
  private inFlight: Promise<void> | null = null;
  private rerunRequested = false;
  private stopped = false;

  private readonly wake = (): void => {
    void this.tick();
  };

  constructor(
    @Inject(TURNKEY_REDIS_NOTIFY_OPTIONS)
    private readonly options: TurnkeyRedisNotifyOptions,
    @Inject(TurnkeyEventService)
    private readonly events: TurnkeyEventSource,
    @Inject(TURNKEY_REDIS_ADVISORY_LOCK)
    private readonly lock: AdvisoryLock,
    @Inject(TURNKEY_REDIS_TRANSPORT_FACTORY)
    private readonly createTransport: RedisTransportFactory,
  ) {
    this.channel = options.channel ?? DEFAULT_CHANNEL;
    this.mode = options.mode ?? DEFAULT_MODE;
    this.keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  }

  onApplicationBootstrap(): void {
    WAKE_EVENT_TYPES.forEach(type => this.events.emitter.on(type, this.wake));

    this.timer = setInterval(() => void this.tick(), this.pollIntervalMs);

    void this.tick();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;

    if (this.timer) clearInterval(this.timer);

    WAKE_EVENT_TYPES.forEach(type => this.events.emitter.off(type, this.wake));

    await this.inFlight?.catch(() => undefined);
    await this.lock.release().catch(error => this.logger.warn(`Release advisory lock failed: ${String(error)}`));
    await this.transport?.close().catch(error => this.logger.warn(`Close Redis connection failed: ${String(error)}`));

    this.transport = null;
  }

  /** 觸發一輪發布。上一輪還在跑時不會並行執行，而是標記為需要再跑一輪 */
  tick(): Promise<void> {
    if (this.stopped) return Promise.resolve();

    if (this.inFlight) {
      this.rerunRequested = true;

      return this.inFlight;
    }

    this.inFlight = this.runRound().finally(() => {
      this.inFlight = null;

      if (this.rerunRequested && !this.stopped) {
        this.rerunRequested = false;
        void this.tick();
      }
    });

    return this.inFlight;
  }

  private async runRound(): Promise<void> {
    try {
      if (!(await this.lock.acquire())) return;

      const transport = await this.ensureTransport();

      await this.drain(transport);
    } catch (error) {
      this.logger.error(`Redis notify round failed: ${(error as Error).message}`);

      // 出錯即釋放鎖，讓下一輪重新競選（連線壞掉時 session lock 也會一併失效）
      await this.lock.release().catch(() => undefined);
    }
  }

  private async ensureTransport(): Promise<RedisTransport> {
    if (!this.transport) this.transport = await this.createTransport(this.options);

    return this.transport;
  }

  private async drain(transport: RedisTransport): Promise<void> {
    let cursor = await this.events.getCursor(this.channel);

    for (;;) {
      const { events } = await this.events.listAfter(cursor, BATCH_SIZE);

      if (events.length === 0) return;

      await this.publishInOrder(transport, events);

      cursor = events[events.length - 1].id;

      if (events.length < BATCH_SIZE) return;
    }
  }

  private async publishInOrder(transport: RedisTransport, events: readonly TurnkeyEvent[]): Promise<void> {
    for (const event of events) {
      await this.publishOne(transport, event);
      await this.events.advanceCursor(this.channel, event.id);
    }
  }

  private async publishOne(transport: RedisTransport, event: TurnkeyEvent): Promise<void> {
    if (this.mode === 'PUBSUB') {
      await transport.publish(`${this.keyPrefix}:${event.companyTaxId}:${event.type}`, encodeEvent(event));

      return;
    }

    await transport.xadd(`${this.keyPrefix}:events`, this.options.maxLen, [
      'id',
      event.id,
      'type',
      event.type,
      'companyTaxId',
      event.companyTaxId,
      'data',
      JSON.stringify(event.data),
    ]);
  }
}
