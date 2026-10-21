import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { EntityManager, MoreThan, Repository } from 'typeorm';
import { TurnkeyEventCursorEntity, TurnkeyEventCursorRepo } from '../models/turnkey-event-cursor.entity';
import { TurnkeyEventEntity, TurnkeyEventRepo } from '../models/turnkey-event.entity';
import { TurnkeyEvent, TurnkeyEvents } from '../typings/turnkey-events';

/** 所有 turnkey_events 寫入共用的 advisory lock key，讓流水號與 commit 順序一致 */
export const TURNKEY_EVENT_LOCK_KEY = 7_308_640_001;

const toEvent = (entity: TurnkeyEventEntity): TurnkeyEvent => ({
  id: entity.sequence,
  type: entity.type as TurnkeyEvents,
  companyTaxId: entity.companyTaxId,
  data: entity.data,
  createdAt: entity.createdAt,
});

@Injectable()
export class TurnkeyEventService {
  readonly emitter = new EventEmitter();

  constructor(
    @Inject(TurnkeyEventRepo)
    private readonly eventRepo: Repository<TurnkeyEventEntity>,
    @Inject(TurnkeyEventCursorRepo)
    private readonly cursorRepo: Repository<TurnkeyEventCursorEntity>,
  ) {}

  /**
   * 在呼叫端的交易內寫入 outbox。先取 transaction-level advisory lock，
   * 確保較小的流水號一定較早 commit，游標讀取不會跳過晚 commit 的事件。
   * commit 之後再呼叫 publish()。
   */
  async append(
    manager: EntityManager,
    type: TurnkeyEvents,
    companyTaxId: string,
    data: Record<string, unknown>,
  ): Promise<TurnkeyEvent> {
    await manager.query('SELECT pg_advisory_xact_lock($1)', [TURNKEY_EVENT_LOCK_KEY]);

    const saved = await manager.save(manager.create(TurnkeyEventEntity, { type, companyTaxId, data }));

    return toEvent(saved);
  }

  /** commit 之後才 emit；emitter 只是叫醒訊號，可靠交付靠 listAfter 游標 */
  publish(events: readonly TurnkeyEvent[]): void {
    events.forEach(event => this.emitter.emit(event.type, event));
  }

  async listAfter(
    cursor: string | null,
    limit = 100,
    companyTaxId?: string,
  ): Promise<{ readonly events: readonly TurnkeyEvent[]; readonly nextCursor: string | null }> {
    const rows = await this.eventRepo.find({
      where: {
        sequence: MoreThan(cursor ?? '0'),
        ...(companyTaxId ? { companyTaxId } : {}),
      },
      order: { sequence: 'ASC' },
      take: Math.min(Math.max(limit, 1), 500),
    });

    return {
      events: rows.map(toEvent),
      nextCursor: rows.length ? rows[rows.length - 1].sequence : cursor,
    };
  }

  /** 通知通道最後發布成功的流水號；沒有紀錄時為 null（從頭開始） */
  async getCursor(channel: string): Promise<string | null> {
    const cursor = await this.cursorRepo.findOne({ where: { channel } });

    return cursor?.lastSequence ?? null;
  }

  /** 發布成功後前進游標；只會往前，不會倒退 */
  async advanceCursor(channel: string, sequence: string): Promise<void> {
    await this.cursorRepo.query(
      `INSERT INTO turnkey_event_cursors (channel, "lastSequence", "updatedAt")
       VALUES ($1, $2, now())
       ON CONFLICT (channel) DO UPDATE
         SET "lastSequence" = GREATEST(turnkey_event_cursors."lastSequence", EXCLUDED."lastSequence"),
             "updatedAt" = now()`,
      [channel, sequence],
    );
  }
}
