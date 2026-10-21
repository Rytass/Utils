/**
 * @jest-environment node
 */

import { EventEmitter } from 'events';
import { TurnkeyEvent, TurnkeyEvents } from '@rytass/invoice-turnkey-base-nestjs-module';
import { TurnkeyRedisPublisherService, TurnkeyEventSource } from '../src/services/turnkey-redis-publisher.service';
import { RedisTransport } from '../src/transport/redis-transport';
import { AdvisoryLock } from '../src/utils/advisory-lock';
import { TurnkeyRedisNotifyOptions } from '../src/typings/turnkey-redis-notify.options';

interface XaddCall {
  readonly key: string;
  readonly maxLen: number | undefined;
  readonly fields: readonly string[];
}

interface PublishCall {
  readonly channel: string;
  readonly message: string;
}

const makeEvent = (sequence: number, type: TurnkeyEvents = TurnkeyEvents.INVOICE_ISSUED): TurnkeyEvent => ({
  id: String(sequence),
  type,
  companyTaxId: '12345678',
  data: { n: sequence },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
});

class FakeEventSource implements TurnkeyEventSource {
  readonly emitter = new EventEmitter();
  cursor: string | null = null;
  cursorReads = 0;
  /** 第一次 listAfter 算出結果之後呼叫，用來模擬「本輪讀完後才有新事件 commit」 */
  onAfterFirstRead: (() => void) | null = null;
  private stored: readonly TurnkeyEvent[];

  constructor(events: readonly TurnkeyEvent[]) {
    this.stored = events;
  }

  add(event: TurnkeyEvent): void {
    this.stored = [...this.stored, event];
  }

  async listAfter(cursor: string | null, limit = 100): Promise<{ events: TurnkeyEvent[]; nextCursor: string | null }> {
    const events = this.stored.filter(event => BigInt(event.id) > BigInt(cursor ?? '0')).slice(0, limit);
    const result = { events: [...events], nextCursor: events.length ? events[events.length - 1].id : cursor };

    if (this.onAfterFirstRead) {
      const hook = this.onAfterFirstRead;

      this.onAfterFirstRead = null;
      hook();
    }

    return result;
  }

  async getCursor(): Promise<string | null> {
    this.cursorReads += 1;

    return this.cursor;
  }

  async advanceCursor(_channel: string, sequence: string): Promise<void> {
    if (this.cursor === null || BigInt(sequence) > BigInt(this.cursor)) this.cursor = sequence;
  }
}

class FakeLock implements AdvisoryLock {
  available = true;
  held = false;
  releaseCount = 0;

  async acquire(): Promise<boolean> {
    if (this.held) return true;

    if (!this.available) return false;

    this.held = true;

    return true;
  }

  async release(): Promise<void> {
    this.held = false;
    this.releaseCount += 1;
  }
}

class FakeTransport implements RedisTransport {
  xadds: readonly XaddCall[] = [];
  publishes: readonly PublishCall[] = [];
  failOn: string | null = null;
  gate: Promise<void> | null = null;
  closed = false;

  async xadd(key: string, maxLen: number | undefined, fields: readonly string[]): Promise<void> {
    if (this.gate) await this.gate;

    if (fields[1] === this.failOn) throw new Error('connection lost');

    this.xadds = [...this.xadds, { key, maxLen, fields }];
  }

  async publish(channel: string, message: string): Promise<void> {
    if (this.gate) await this.gate;

    if (JSON.parse(message).id === this.failOn) throw new Error('connection lost');

    this.publishes = [...this.publishes, { channel, message }];
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  get streamIds(): string[] {
    return this.xadds.map(call => call.fields[1]);
  }
}

interface Harness {
  readonly service: TurnkeyRedisPublisherService;
  readonly lock: FakeLock;
  readonly transport: FakeTransport;
  readonly createTransport: jest.Mock<Promise<RedisTransport>, []>;
}

const OPTIONS: TurnkeyRedisNotifyOptions = { redis: 'redis://fake:6379', pollIntervalMs: 60_000 };

const setup = (
  events: FakeEventSource,
  options: TurnkeyRedisNotifyOptions = OPTIONS,
  lock: FakeLock = new FakeLock(),
  transport: FakeTransport = new FakeTransport(),
): Harness => {
  const createTransport = jest.fn<Promise<RedisTransport>, []>(async () => transport);
  const service = new TurnkeyRedisPublisherService(options, events, lock, createTransport);

  return { service, lock, transport, createTransport };
};

const waitUntil = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;

    await new Promise(resolve => setTimeout(resolve, 5));
  }

  throw new Error('waitUntil timed out');
};

describe('TurnkeyRedisPublisherService', () => {
  describe('STREAM mode (default)', () => {
    it('XADDs each event with id/type/companyTaxId/data fields in order and advances the cursor', async () => {
      const events = new FakeEventSource([makeEvent(1), makeEvent(2, TurnkeyEvents.SUBMISSION_ACCEPTED)]);
      const { service, transport } = setup(events);

      await service.tick();

      expect(transport.xadds.map(call => call.key)).toEqual(['turnkey:events', 'turnkey:events']);
      expect(transport.xadds[0].maxLen).toBeUndefined();
      expect(transport.xadds[0].fields).toEqual([
        'id',
        '1',
        'type',
        'invoice.issued',
        'companyTaxId',
        '12345678',
        'data',
        '{"n":1}',
      ]);

      expect(transport.streamIds).toEqual(['1', '2']);
      expect(events.cursor).toBe('2');
    });

    it('passes maxLen through for approximate trimming', async () => {
      const events = new FakeEventSource([makeEvent(1)]);
      const { service, transport } = setup(events, { ...OPTIONS, maxLen: 1000, keyPrefix: 'tk' });

      await service.tick();

      expect(transport.xadds[0].key).toBe('tk:events');
      expect(transport.xadds[0].maxLen).toBe(1000);
    });

    it('keeps the cursor at the last successful XADD and retries without duplicating earlier entries', async () => {
      const events = new FakeEventSource([makeEvent(1), makeEvent(2), makeEvent(3)]);
      const { service, transport, lock, createTransport } = setup(events);

      transport.failOn = '2';
      await service.tick();

      expect(transport.streamIds).toEqual(['1']);
      expect(events.cursor).toBe('1');
      expect(lock.held).toBe(false);
      // 失敗後丟掉連線，下一輪重建
      expect(transport.closed).toBe(true);

      transport.failOn = null;
      await service.tick();

      expect(transport.streamIds).toEqual(['1', '2', '3']);
      expect(createTransport).toHaveBeenCalledTimes(2);
      expect(events.cursor).toBe('3');
    });
  });

  describe('PUBSUB mode', () => {
    it('PUBLISHes the JSON event to `${keyPrefix}:${companyTaxId}:${type}` and advances the cursor', async () => {
      const events = new FakeEventSource([makeEvent(1)]);
      const { service, transport } = setup(events, { ...OPTIONS, mode: 'PUBSUB' });

      await service.tick();

      expect(transport.xadds).toEqual([]);
      expect(transport.publishes).toHaveLength(1);
      expect(transport.publishes[0].channel).toBe('turnkey:12345678:invoice.issued');
      expect(JSON.parse(transport.publishes[0].message)).toEqual({
        id: '1',
        type: 'invoice.issued',
        companyTaxId: '12345678',
        data: { n: 1 },
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      expect(events.cursor).toBe('1');
    });

    it('does not advance the cursor when PUBLISH fails', async () => {
      const events = new FakeEventSource([makeEvent(1), makeEvent(2)]);
      const { service, transport } = setup(events, { ...OPTIONS, mode: 'PUBSUB' });

      transport.failOn = '1';
      await service.tick();

      expect(transport.publishes).toEqual([]);
      expect(events.cursor).toBeNull();
    });
  });

  it('does not run a second round while one is in flight', async () => {
    const events = new FakeEventSource([makeEvent(1)]);
    const transport = new FakeTransport();
    const { service } = setup(events, OPTIONS, new FakeLock(), transport);
    let openGate: () => void = () => undefined;

    transport.gate = new Promise<void>(resolve => {
      openGate = resolve;
    });

    const first = service.tick();
    const second = service.tick();

    await waitUntil(() => events.cursorReads === 1);
    expect(events.cursorReads).toBe(1);

    openGate();
    await Promise.all([first, second]);
    await waitUntil(() => transport.streamIds.length === 1);

    expect(transport.streamIds).toEqual(['1']);
  });

  it('re-runs once when an event is committed while a round is in flight', async () => {
    const events = new FakeEventSource([makeEvent(1)]);
    const { service, transport } = setup(events);

    events.onAfterFirstRead = (): void => {
      events.add(makeEvent(2));
      void service.tick();
    };

    await service.tick();
    await waitUntil(() => transport.streamIds.length === 2);

    expect(transport.streamIds).toEqual(['1', '2']);
  });

  it('skips the round entirely when the advisory lock is held by another instance', async () => {
    const events = new FakeEventSource([makeEvent(1)]);
    const lock = new FakeLock();
    const { service, transport, createTransport } = setup(events, OPTIONS, lock);

    lock.available = false;
    await service.tick();

    expect(events.cursorReads).toBe(0);
    expect(createTransport).not.toHaveBeenCalled();
    expect(transport.streamIds).toEqual([]);
  });

  it('pages through backlogs larger than one batch in order', async () => {
    const events = new FakeEventSource(Array.from({ length: 250 }, (_, index) => makeEvent(index + 1)));
    const { service, transport } = setup(events);

    await service.tick();

    expect(transport.xadds).toHaveLength(250);
    expect(transport.streamIds[0]).toBe('1');
    expect(transport.streamIds[249]).toBe('250');
    expect(events.cursor).toBe('250');
  });

  it('releases the lock and retries connecting when the transport cannot be created', async () => {
    const events = new FakeEventSource([makeEvent(1)]);
    const transport = new FakeTransport();
    const lock = new FakeLock();
    const createTransport = jest
      .fn<Promise<RedisTransport>, []>()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValue(transport);

    const service = new TurnkeyRedisPublisherService(OPTIONS, events, lock, createTransport);

    await service.tick();

    expect(lock.releaseCount).toBe(1);
    expect(transport.streamIds).toEqual([]);

    await service.tick();

    expect(transport.streamIds).toEqual(['1']);
  });

  it('wakes up on base emitter events and stops cleanly on shutdown', async () => {
    const events = new FakeEventSource([]);
    const { service, transport, lock } = setup(events);

    await service.onApplicationBootstrap();
    events.add(makeEvent(1));
    events.emitter.emit(TurnkeyEvents.INVOICE_ISSUED, makeEvent(1));

    await waitUntil(() => transport.streamIds.length === 1);

    await service.onApplicationShutdown();

    expect(lock.held).toBe(false);
    expect(transport.closed).toBe(true);

    events.add(makeEvent(2));
    await service.tick();

    expect(transport.streamIds).toEqual(['1']);
  });
});
