/**
 * @jest-environment node
 */

import { EventEmitter } from 'events';
import { TurnkeyEvent, TurnkeyEvents } from '@rytass/invoice-turnkey-base-nestjs-module';
import { TurnkeyNatsPublisherService, TurnkeyEventSource } from '../src/services/turnkey-nats-publisher.service';
import { NatsTransport } from '../src/transport/nats-transport';
import { AdvisoryLock } from '../src/utils/advisory-lock';
import { TurnkeyNatsNotifyOptions } from '../src/typings/turnkey-nats-notify.options';

interface SentMessage {
  readonly subject: string;
  readonly payload: string;
  readonly msgId: string;
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

class FakeTransport implements NatsTransport {
  published: readonly SentMessage[] = [];
  failOn: string | null = null;
  gate: Promise<void> | null = null;
  closed = false;

  async publish(subject: string, payload: string, msgId: string): Promise<void> {
    if (this.gate) await this.gate;

    if (msgId === this.failOn) throw new Error('no publish ack');

    this.published = [...this.published, { subject, payload, msgId }];
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  get msgIds(): string[] {
    return this.published.map(message => message.msgId);
  }
}

const OPTIONS: TurnkeyNatsNotifyOptions = { servers: 'nats://fake:4222', pollIntervalMs: 60_000 };

interface Harness {
  readonly service: TurnkeyNatsPublisherService;
  readonly lock: FakeLock;
  readonly transport: FakeTransport;
  readonly createTransport: jest.Mock<Promise<NatsTransport>, []>;
}

const setup = (
  events: FakeEventSource,
  lock: FakeLock = new FakeLock(),
  transport: FakeTransport = new FakeTransport(),
  createTransport: jest.Mock<Promise<NatsTransport>, []> = jest.fn<Promise<NatsTransport>, []>(async () => transport),
  options: TurnkeyNatsNotifyOptions = OPTIONS,
): Harness => {
  const service = new TurnkeyNatsPublisherService(options, events, lock, createTransport);

  return { service, lock, transport, createTransport };
};

const waitUntil = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;

    await new Promise(resolve => setTimeout(resolve, 5));
  }

  throw new Error('waitUntil timed out');
};

describe('TurnkeyNatsPublisherService', () => {
  it('publishes events in order with subject, JSON payload and msgID, then advances the cursor', async () => {
    const events = new FakeEventSource([makeEvent(1), makeEvent(2, TurnkeyEvents.SUBMISSION_ACCEPTED)]);
    const { service, transport } = setup(events);

    await service.tick();

    expect(transport.msgIds).toEqual(['1', '2']);
    expect(transport.published[0].subject).toBe('turnkey.12345678.invoice.issued');
    expect(transport.published[1].subject).toBe('turnkey.12345678.submission.accepted');
    expect(JSON.parse(transport.published[0].payload)).toEqual({
      id: '1',
      type: 'invoice.issued',
      companyTaxId: '12345678',
      data: { n: 1 },
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    expect(events.cursor).toBe('2');
  });

  it('keeps the cursor at the last successful event and retries from there without re-sending', async () => {
    const events = new FakeEventSource([makeEvent(1), makeEvent(2), makeEvent(3)]);
    const { service, transport, lock } = setup(events);

    transport.failOn = '2';
    await service.tick();

    expect(transport.msgIds).toEqual(['1']);
    expect(events.cursor).toBe('1');
    expect(lock.held).toBe(false);

    transport.failOn = null;
    await service.tick();

    expect(transport.msgIds).toEqual(['1', '2', '3']);
    expect(events.cursor).toBe('3');
  });

  it('does not run a second round while one is in flight, and does not publish twice', async () => {
    const events = new FakeEventSource([makeEvent(1)]);
    const transport = new FakeTransport();
    const { service } = setup(events, new FakeLock(), transport);
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
    await waitUntil(() => transport.msgIds.length === 1);

    expect(transport.msgIds).toEqual(['1']);
  });

  it('re-runs once when an event is committed while a round is in flight', async () => {
    const events = new FakeEventSource([makeEvent(1)]);
    const { service, transport } = setup(events);

    events.onAfterFirstRead = (): void => {
      events.add(makeEvent(2));
      void service.tick();
    };

    await service.tick();
    await waitUntil(() => transport.msgIds.length === 2);

    expect(transport.msgIds).toEqual(['1', '2']);
  });

  it('skips the round entirely when the advisory lock is held by another instance', async () => {
    const events = new FakeEventSource([makeEvent(1)]);
    const lock = new FakeLock();
    const { service, transport, createTransport } = setup(events, lock);

    lock.available = false;
    await service.tick();

    expect(events.cursorReads).toBe(0);
    expect(createTransport).not.toHaveBeenCalled();
    expect(transport.msgIds).toEqual([]);
  });

  it('pages through backlogs larger than one batch in order', async () => {
    const events = new FakeEventSource(Array.from({ length: 250 }, (_, index) => makeEvent(index + 1)));
    const { service, transport } = setup(events);

    await service.tick();

    expect(transport.published).toHaveLength(250);
    expect(transport.msgIds[0]).toBe('1');
    expect(transport.msgIds[249]).toBe('250');
    expect(events.cursor).toBe('250');
  });

  it('releases the lock and retries connecting when the transport cannot be created', async () => {
    const events = new FakeEventSource([makeEvent(1)]);
    const transport = new FakeTransport();
    const lock = new FakeLock();
    const createTransport = jest
      .fn<Promise<NatsTransport>, []>()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValue(transport);

    const { service } = setup(events, lock, transport, createTransport);

    await service.tick();

    expect(lock.releaseCount).toBe(1);
    expect(transport.msgIds).toEqual([]);

    await service.tick();

    expect(transport.msgIds).toEqual(['1']);
  });

  it('wakes up on base emitter events and stops cleanly on shutdown', async () => {
    const events = new FakeEventSource([]);
    const { service, transport, lock } = setup(events);

    await service.onApplicationBootstrap();
    events.add(makeEvent(1));
    events.emitter.emit(TurnkeyEvents.INVOICE_ISSUED, makeEvent(1));

    await waitUntil(() => transport.msgIds.length === 1);

    await service.onApplicationShutdown();

    expect(lock.held).toBe(false);
    expect(transport.closed).toBe(true);

    events.add(makeEvent(2));
    await service.tick();

    expect(transport.msgIds).toEqual(['1']);
  });
});
