import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { TurnkeyEvent, TurnkeyEventService, TurnkeyEvents } from '@rytass/invoice-turnkey-base-nestjs-module';
import type { AdvisoryLock } from '../utils/advisory-lock';
import type { NatsTransport, NatsTransportFactory } from '../transport/nats-transport';
import { TURNKEY_NATS_NOTIFY_OPTIONS } from '../typings/turnkey-nats-notify.options';
import type { TurnkeyNatsNotifyOptions } from '../typings/turnkey-nats-notify.options';
import { TURNKEY_NATS_ADVISORY_LOCK, TURNKEY_NATS_TRANSPORT_FACTORY } from '../typings/turnkey-nats-notify-providers';

const DEFAULT_CHANNEL = 'nats';
const DEFAULT_SUBJECT_PREFIX = 'turnkey';
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
 * 把 turnkey_events outbox 依序發布到 NATS JetStream。
 * 一次只跑一輪；每筆發布成功（收到 publish ack）後才前進游標，失敗則下一輪重試。
 * 多實例時以 advisory lock 選出唯一發布者。
 */
@Injectable()
export class TurnkeyNatsPublisherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(TurnkeyNatsPublisherService.name);
  private readonly channel: string;
  private readonly subjectPrefix: string;
  private readonly pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private transport: NatsTransport | null = null;
  private inFlight: Promise<void> | null = null;
  private rerunRequested = false;
  private stopped = false;

  private readonly wake = (): void => {
    void this.tick();
  };

  constructor(
    @Inject(TURNKEY_NATS_NOTIFY_OPTIONS)
    private readonly options: TurnkeyNatsNotifyOptions,
    @Inject(TurnkeyEventService)
    private readonly events: TurnkeyEventSource,
    @Inject(TURNKEY_NATS_ADVISORY_LOCK)
    private readonly lock: AdvisoryLock,
    @Inject(TURNKEY_NATS_TRANSPORT_FACTORY)
    private readonly createTransport: NatsTransportFactory,
  ) {
    this.channel = options.channel ?? DEFAULT_CHANNEL;
    this.subjectPrefix = options.subjectPrefix ?? DEFAULT_SUBJECT_PREFIX;
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
    await this.transport?.close().catch(error => this.logger.warn(`Close NATS connection failed: ${String(error)}`));

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
      this.logger.error(`NATS notify round failed: ${(error as Error).message}`);

      // 出錯即釋放鎖，讓下一輪重新競選（連線壞掉時 session lock 也會一併失效）
      await this.lock.release().catch(() => undefined);

      // 連線可能已永久關閉（例如重連次數用完），丟掉它讓下一輪重建
      const broken = this.transport;

      this.transport = null;
      await broken?.close().catch(() => undefined);
    }
  }

  private async ensureTransport(): Promise<NatsTransport> {
    if (!this.transport) this.transport = await this.createTransport(this.options);

    return this.transport;
  }

  /** 從游標一批批往後送，直到沒有新事件 */
  private async drain(transport: NatsTransport): Promise<void> {
    await this.drainFrom(transport, await this.events.getCursor(this.channel));
  }

  private async drainFrom(transport: NatsTransport, cursor: string | null): Promise<void> {
    const { events } = await this.events.listAfter(cursor, BATCH_SIZE);

    if (events.length === 0) return;

    await this.publishInOrder(transport, events);

    if (events.length === BATCH_SIZE) await this.drainFrom(transport, events[events.length - 1].id);
  }

  /** 依序發布，每筆成功才前進游標 */
  private publishInOrder(transport: NatsTransport, events: readonly TurnkeyEvent[]): Promise<void> {
    return events.reduce<Promise<void>>(async (previous, event) => {
      await previous;
      await transport.publish(this.subjectOf(event), encodeEvent(event), event.id);
      await this.events.advanceCursor(this.channel, event.id);
    }, Promise.resolve());
  }

  private subjectOf(event: TurnkeyEvent): string {
    return `${this.subjectPrefix}.${event.companyTaxId}.${event.type}`;
  }
}
