import type { DataSource, QueryRunner } from 'typeorm';

/**
 * 兩參數形式的 advisory lock 第一段 classid。
 * base 使用的是單一 bigint key（7308640001 / 7308640002），兩者位於不同 key 空間，不會互相衝突。
 */
const LOCK_CLASS_ID = 7308;

export interface AdvisoryLock {
  /** 取得鎖；已持有時回傳 true，拿不到時回傳 false */
  acquire(): Promise<boolean>;
  release(): Promise<void>;
}

/** 以 FNV-1a 32-bit 把通道名稱轉成 int4 */
export const toLockObjectId = (name: string): number =>
  [...Buffer.from(name, 'utf8')].reduce((hash, byte) => Math.imul(hash ^ byte, 0x01000193), 0x811c9dc5) | 0;

/** 以 session-level advisory lock 實作；連線由 QueryRunner 持有，直到 release() 才歸還 */
export class PgAdvisoryLock implements AdvisoryLock {
  private runner: QueryRunner | null = null;

  constructor(
    private readonly dataSource: Pick<DataSource, 'createQueryRunner'>,
    private readonly objectId: number,
  ) {}

  async acquire(): Promise<boolean> {
    if (this.runner) return true;

    const runner = this.dataSource.createQueryRunner();

    await runner.connect();

    try {
      const [row] = (await runner.query('SELECT pg_try_advisory_lock($1, $2) AS locked', [
        LOCK_CLASS_ID,
        this.objectId,
      ])) as { locked: boolean }[];

      if (row?.locked) {
        this.runner = runner;

        return true;
      }
    } catch (error) {
      await runner.release();

      throw error;
    }

    await runner.release();

    return false;
  }

  async release(): Promise<void> {
    const runner = this.runner;

    if (!runner) return;

    this.runner = null;

    try {
      await runner.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_CLASS_ID, this.objectId]);
    } finally {
      await runner.release();
    }
  }
}
