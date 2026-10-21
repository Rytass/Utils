import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { TurnkeyIdempotencyKeyEntity, TurnkeyIdempotencyKeyRepo } from '../models/turnkey-idempotency-key.entity';

export const IDEMPOTENCY_RETENTION_DAYS = 7;

export class TurnkeyIdempotencyConflictError extends Error {
  constructor(
    readonly code: 'IDEMPOTENCY_KEY_REUSED' | 'IDEMPOTENCY_KEY_IN_PROGRESS',
    message: string,
  ) {
    super(message);

    this.name = 'TurnkeyIdempotencyConflictError';
  }
}

export interface TurnkeyIdempotentResult<T> {
  readonly status: number;
  readonly body: T;
  /** true 表示是重送，回傳的是第一次的結果 */
  readonly replayed: boolean;
}

/** null 與缺欄位視為相同（GraphQL 的選填欄位會是 null、REST 則是缺欄位），Date 以 ISO 字串比較 */
const stableStringify = (value: unknown): string => {
  if (value instanceof Date) return JSON.stringify(value.toISOString());

  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';

  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const record = value as Record<string, unknown>;

  return `{${Object.keys(record)
    .sort()
    .filter(key => record[key] != null)
    .map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
};

export const hashIdempotentRequest = (action: string, payload: unknown): string =>
  createHash('sha256')
    .update(`${action}\n${stableStringify(payload)}`)
    .digest('hex');

@Injectable()
export class TurnkeyIdempotencyService {
  constructor(
    @Inject(TurnkeyIdempotencyKeyRepo)
    private readonly keyRepo: Repository<TurnkeyIdempotencyKeyEntity>,
  ) {}

  /**
   * 同一個（統編, key）只執行一次 handler；重送回傳第一次的結果，內容不同丟 IDEMPOTENCY_KEY_REUSED。
   * handler 丟錯時刪掉 key，讓呼叫端修正後可用同一個 key 重試；handler 成功但結果沒存下時保留 key。
   */
  async run<T>(
    companyTaxId: string,
    key: string,
    action: string,
    payload: unknown,
    handler: () => Promise<{ readonly status: number; readonly body: T }>,
  ): Promise<TurnkeyIdempotentResult<T>> {
    const requestHash = hashIdempotentRequest(action, payload);

    const inserted = await this.keyRepo
      .createQueryBuilder()
      .insert()
      .into(TurnkeyIdempotencyKeyEntity)
      .values({ companyTaxId, key, requestHash, responseStatus: null, responseBody: null })
      .orIgnore()
      .returning(['id'])
      .execute();

    if (!inserted.raw?.length) {
      const existing = await this.keyRepo.findOneOrFail({ where: { companyTaxId, key } });

      if (existing.requestHash !== requestHash) {
        throw new TurnkeyIdempotencyConflictError('IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key 已用於不同的請求內容');
      }

      if (existing.responseStatus === null) {
        throw new TurnkeyIdempotencyConflictError(
          'IDEMPOTENCY_KEY_IN_PROGRESS',
          '同一個 Idempotency-Key 的請求仍在處理中',
        );
      }

      return { status: existing.responseStatus, body: existing.responseBody?.value as T, replayed: true };
    }

    const id = (inserted.raw[0] as { id: string }).id;

    const result = await handler().catch(async (error: unknown) => {
      // handler 失敗代表沒有副作用成立（交易已回滾），刪 key 讓呼叫端修正後重試
      await this.keyRepo.delete(id);

      throw error;
    });

    // 這裡失敗不刪 key：handler 已成功，刪掉的話同 key 重送會再執行一次（例如再開一張發票）。
    // key 會停在處理中（409 IDEMPOTENCY_KEY_IN_PROGRESS），呼叫端可改用 externalId 查詢結果。
    await this.keyRepo.save({
      id,
      responseStatus: result.status,
      responseBody: JSON.parse(JSON.stringify({ value: result.body })) as Record<string, unknown>,
    });

    return { ...result, replayed: false };
  }

  /** 刪掉超過保留天數的 key */
  async purgeExpired(now = new Date()): Promise<number> {
    const result = await this.keyRepo.delete({
      createdAt: LessThan(new Date(now.getTime() - IDEMPOTENCY_RETENTION_DAYS * 86_400_000)),
    });

    return result.affected ?? 0;
  }
}
