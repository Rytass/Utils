import { DataSource } from 'typeorm';

/** turnkey_message_log 與 detail、sysevent 對一個 UpCast 檔名的查詢結果 */
export interface TurnkeyUpCastRecord {
  readonly uuid: string;
  /** turnkey_message_log.status：C 成功、E 失敗、其他為處理中 */
  readonly status: string;
  /** 有 E 的那一步（UpCast、Pack、SendFile、Unpack…） */
  readonly failedTask: string | null;
  /** 依時間排序的 sysevent：errorcode 與串接後的 message1–6 */
  readonly events: readonly { readonly errorCode: string | null; readonly message: string }[];
}

export interface TurnkeyLogReader {
  findByUpCastFileName(fileName: string): Promise<TurnkeyUpCastRecord | null>;
}

type QueryFn = (sql: string, parameters: readonly unknown[]) => Promise<readonly Record<string, string | null>[]>;

/**
 * 依使用說明書「捌、上傳狀態查詢」讀官方資料表。
 * 一律明列欄位：正式環境用 column-level GRANT，select * 會整句失敗。
 */
export class TurnkeyDbLogReader implements TurnkeyLogReader {
  private readonly query: QueryFn;

  constructor(source: DataSource | QueryFn) {
    this.query =
      typeof source === 'function'
        ? source
        : (sql, parameters): Promise<readonly Record<string, string | null>[]> => source.query(sql, [...parameters]);
  }

  async findByUpCastFileName(fileName: string): Promise<TurnkeyUpCastRecord | null> {
    // filename 是完整路徑，會隨處理移到 SRC、BAK/日期/、ERR/日期/，以檔名結尾比對
    const [upcast] = await this.query(
      `SELECT d.uuid, d.seqno, d.subseqno
         FROM turnkey_message_log_detail d
        WHERE d.task = 'UpCast' AND d.filename LIKE $1
        ORDER BY d.process_dts DESC
        LIMIT 1`,
      [`%/${fileName.replace(/[\\%_]/g, char => `\\${char}`)}`],
    );

    if (!upcast?.seqno) return null;

    const [log] = await this.query(
      `SELECT m.uuid, m.status
         FROM turnkey_message_log m
        WHERE m.seqno = $1 AND m.subseqno = $2`,
      [upcast.seqno, upcast.subseqno],
    );

    if (!log) return null;

    const failed = await this.query(
      `SELECT d.task
         FROM turnkey_message_log_detail d
        WHERE d.seqno = $1 AND d.subseqno = $2 AND d.status = 'E'
        ORDER BY d.process_dts
        LIMIT 1`,
      [upcast.seqno, upcast.subseqno],
    );

    const events = log.uuid
      ? await this.query(
          `SELECT s.errorcode, s.message1, s.message2, s.message3, s.message4, s.message5, s.message6
             FROM turnkey_sysevent_log s
            WHERE s.uuid = $1
            ORDER BY s.eventdts`,
          [log.uuid],
        )
      : [];

    return {
      uuid: log.uuid ?? '',
      status: log.status ?? '',
      failedTask: failed[0]?.task ?? null,
      events: events.map(row => ({
        errorCode: row.errorcode,
        message: ['message1', 'message2', 'message3', 'message4', 'message5', 'message6']
          .map(key => row[key] ?? '')
          .join(''),
      })),
    };
  }
}
