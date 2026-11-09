import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import {
  TurnkeyAssignmentFileEntity,
  TurnkeyAssignmentFileOutcome,
  TurnkeyAssignmentFileRepo,
} from '../models/turnkey-assignment-file.entity';
import { BaseTurnkeyCompanyEntity, BaseTurnkeyCompanyRepo } from '../models/turnkey-company.entity';
import { TurnkeyInvoiceTrackEntity } from '../models/turnkey-invoice-track.entity';
import { TurnkeyEventService } from '../services/turnkey-event.service';
import { insertTrack, trackInputProblem } from '../services/turnkey-invoice-track.service';
import { TurnkeyTrackSource } from '../typings/turnkey-enums';
import { TurnkeyEvent, TurnkeyEvents } from '../typings/turnkey-events';
import { TurnkeyAssignmentEntry } from './parse-assignment-file';

/** 單一配號區間的處理結果 */
export type TurnkeyAssignmentEntryOutcome =
  /** 新建字軌 */
  | 'IMPORTED'
  /** 既有手動字軌區間完全相同：補上來源，號碼不動 */
  | 'ADOPTED'
  /** 已由配號檔匯入過 */
  | 'DUPLICATE'
  /** 與既有字軌部分重疊，未匯入 */
  | 'CONFLICT'
  /** 統編不是已登錄的營業人 */
  | 'UNMATCHED'
  /** 欄位格式錯誤 */
  | 'INVALID';

export interface TurnkeyAssignmentFileInput {
  readonly fileName: string;
  /** Turnkey 收到檔案的時間 */
  readonly receivedAt: Date;
  readonly entries: readonly TurnkeyAssignmentEntry[];
}

export interface TurnkeyAssignmentFileResult {
  /** null：整個檔案都對不到已登錄的營業人，不記帳本，之後登錄營業人時會再處理 */
  readonly outcome: TurnkeyAssignmentFileOutcome | null;
  readonly entries: readonly (TurnkeyAssignmentEntry & { readonly outcome: TurnkeyAssignmentEntryOutcome })[];
}

const rangeOf = (entry: TurnkeyAssignmentEntry): Record<string, unknown> => ({
  period: entry.period,
  track: entry.track,
  beginNumber: entry.beginNumber,
  endNumber: entry.endNumber,
  invoiceType: entry.invoiceType,
  booklets: entry.booklets,
});

/** 同一個檔內辨識區間的鍵 */
const entryKey = (entry: TurnkeyAssignmentEntry): string =>
  [entry.companyTaxId, entry.period, entry.track, entry.beginNumber, entry.endNumber].join('|');

const fileOutcome = (outcomes: readonly TurnkeyAssignmentEntryOutcome[]): TurnkeyAssignmentFileOutcome | null => {
  const matched = outcomes.filter(outcome => outcome !== 'UNMATCHED');

  if (!matched.length) return null;

  if (matched.includes('CONFLICT')) return TurnkeyAssignmentFileOutcome.CONFLICT;

  if (matched.some(outcome => outcome === 'IMPORTED' || outcome === 'ADOPTED')) {
    return TurnkeyAssignmentFileOutcome.IMPORTED;
  }

  if (matched.includes('INVALID')) return TurnkeyAssignmentFileOutcome.INVALID;

  return TurnkeyAssignmentFileOutcome.DUPLICATE;
};

/**
 * E0501 配號檔匯入字軌。每個區間：
 * - 沒有重疊 → 新建字軌（source = ASSIGNMENT_FILE），發 invoice-track.imported
 * - 與一條手動字軌完全相同 → 只補上來源欄位，號碼狀態不動，發 invoice-track.imported（previousSource = MANUAL）
 * - 已由配號檔匯入過 → 略過
 * - 部分重疊 → 不改任何字軌，發 invoice-track.import-conflict，需人工處理
 * 整個檔案與帳本寫入同一個交易；帳本以檔名去重。檔內有未登錄營業人的區間時帳本標為未完成，
 * 之後的輪次會再讀這個檔，只處理那些區間（登錄營業人後才匯入）。
 */
@Injectable()
export class TurnkeyAssignmentService {
  constructor(
    @Inject(BaseTurnkeyCompanyRepo)
    private readonly companyRepo: Repository<BaseTurnkeyCompanyEntity>,
    @Inject(TurnkeyAssignmentFileRepo)
    private readonly fileRepo: Repository<TurnkeyAssignmentFileEntity>,
    private readonly dataSource: DataSource,
    private readonly eventService: TurnkeyEventService,
  ) {}

  /** 已處理完的檔名（帳本內且沒有待登錄營業人的區間），之後的輪次不再讀取 */
  async processedFileNames(fileNames: readonly string[]): Promise<ReadonlySet<string>> {
    if (!fileNames.length) return new Set();

    const rows = await this.fileRepo.find({
      select: { fileName: true },
      where: { fileName: In([...fileNames]), complete: true },
    });

    return new Set(rows.map(row => row.fileName));
  }

  async importFile(input: TurnkeyAssignmentFileInput): Promise<TurnkeyAssignmentFileResult> {
    if (!input.entries.length) {
      await this.fileRepo.insert({
        fileName: input.fileName,
        receivedAt: input.receivedAt,
        outcome: TurnkeyAssignmentFileOutcome.INVALID,
        entries: [],
        complete: true,
      });

      return { outcome: TurnkeyAssignmentFileOutcome.INVALID, entries: [] };
    }

    const taxIds = [...new Set(input.entries.map(entry => entry.companyTaxId))];
    const companies = await this.companyRepo.find({ where: { taxId: In(taxIds) } });
    const registered = new Set(companies.map(company => company.taxId));

    const { result, events } = await this.dataSource.transaction(async manager => {
      // 先前處理過、但含未登錄營業人區間的檔：只處理當時對不到的區間
      const existing = await manager.findOne(TurnkeyAssignmentFileEntity, {
        where: { fileName: input.fileName },
        lock: { mode: 'pessimistic_write' },
      });

      const done = (existing?.entries ?? []).filter(entry => entry.outcome !== 'UNMATCHED');
      const doneKeys = new Set(done.map(entry => entryKey(entry as unknown as TurnkeyAssignmentEntry)));
      const pending = input.entries.filter(entry => !doneKeys.has(entryKey(entry)));

      if (!pending.some(entry => registered.has(entry.companyTaxId))) {
        return {
          result: {
            outcome: existing?.outcome ?? null,
            entries: pending.map(entry => ({ ...entry, outcome: 'UNMATCHED' as const })),
          },
          events: [],
        };
      }

      const applied = await pending.reduce<
        Promise<{
          readonly entries: TurnkeyAssignmentFileResult['entries'];
          readonly events: readonly TurnkeyEvent[];
        }>
      >(
        async (donePromise, entry) => {
          const previous = await donePromise;
          const { outcome, event } = registered.has(entry.companyTaxId)
            ? await this.applyEntry(manager, entry, input)
            : { outcome: 'UNMATCHED' as const, event: null };

          return {
            entries: [...previous.entries, { ...entry, outcome }],
            events: event ? [...previous.events, event] : previous.events,
          };
        },
        Promise.resolve({ entries: [], events: [] }),
      );

      const records: Record<string, unknown>[] = [
        ...done,
        ...applied.entries.map(entry => ({
          companyTaxId: entry.companyTaxId,
          ...rangeOf(entry),
          outcome: entry.outcome,
        })),
      ];

      const outcomes = records.map(record => record.outcome as TurnkeyAssignmentEntryOutcome);
      const outcome = fileOutcome(outcomes) ?? TurnkeyAssignmentFileOutcome.DUPLICATE;
      const row = {
        receivedAt: input.receivedAt,
        outcome,
        entries: records,
        complete: !outcomes.includes('UNMATCHED'),
      };

      // 有 id 時 save 會更新，沒有時新增（檔名唯一鍵擋住並行的重複新增）
      await manager.save(TurnkeyAssignmentFileEntity, { ...(existing ?? { fileName: input.fileName }), ...row });

      return { result: { outcome, entries: applied.entries }, events: applied.events };
    });

    this.eventService.publish(events);

    return result;
  }

  private async applyEntry(
    manager: EntityManager,
    entry: TurnkeyAssignmentEntry,
    file: TurnkeyAssignmentFileInput,
  ): Promise<{ readonly outcome: TurnkeyAssignmentEntryOutcome; readonly event: TurnkeyEvent | null }> {
    // 發票類別記錄但不擋（07、08 以外也照收），只檢查欄位長度
    if (trackInputProblem(entry) || !/^\d{2}$/.test(entry.invoiceType)) return { outcome: 'INVALID', event: null };

    const source = { sourceFileName: file.fileName, receivedAt: file.receivedAt.toISOString() };

    // 號碼唯一鍵是（統編, 字軌＋號碼），不分期別：重疊檢查也不分期別
    const overlapping = await manager.find(TurnkeyInvoiceTrackEntity, {
      where: {
        companyTaxId: entry.companyTaxId,
        track: entry.track,
        beginNumber: LessThanOrEqual(entry.endNumber),
        endNumber: MoreThanOrEqual(entry.beginNumber),
      },
      lock: { mode: 'pessimistic_write' },
    });

    if (!overlapping.length) {
      const track = await insertTrack(manager, {
        companyTaxId: entry.companyTaxId,
        period: entry.period,
        track: entry.track,
        beginNumber: entry.beginNumber,
        endNumber: entry.endNumber,
        source: TurnkeyTrackSource.ASSIGNMENT_FILE,
        invoiceType: entry.invoiceType || null,
        sourceFileName: file.fileName,
        receivedAt: file.receivedAt,
      });

      const event = await this.eventService.append(manager, TurnkeyEvents.INVOICE_TRACK_IMPORTED, entry.companyTaxId, {
        trackId: track.id,
        ...rangeOf(entry),
        ...source,
        previousSource: null,
      });

      return { outcome: 'IMPORTED', event };
    }

    const [existing] = overlapping;
    const sameRange =
      overlapping.length === 1 &&
      existing.period === entry.period &&
      existing.beginNumber === entry.beginNumber &&
      existing.endNumber === entry.endNumber;

    if (sameRange && existing.source === TurnkeyTrackSource.ASSIGNMENT_FILE)
      return { outcome: 'DUPLICATE', event: null };

    if (sameRange) {
      await manager.update(TurnkeyInvoiceTrackEntity, existing.id, {
        source: TurnkeyTrackSource.ASSIGNMENT_FILE,
        invoiceType: entry.invoiceType || null,
        sourceFileName: file.fileName,
        receivedAt: file.receivedAt,
      });

      const event = await this.eventService.append(manager, TurnkeyEvents.INVOICE_TRACK_IMPORTED, entry.companyTaxId, {
        trackId: existing.id,
        ...rangeOf(entry),
        ...source,
        previousSource: existing.source,
      });

      return { outcome: 'ADOPTED', event };
    }

    const event = await this.eventService.append(
      manager,
      TurnkeyEvents.INVOICE_TRACK_IMPORT_CONFLICT,
      entry.companyTaxId,
      {
        ...rangeOf(entry),
        ...source,
        conflictingTracks: overlapping.map(track => ({
          trackId: track.id,
          period: track.period,
          track: track.track,
          beginNumber: track.beginNumber,
          endNumber: track.endNumber,
          source: track.source,
        })),
      },
    );

    return { outcome: 'CONFLICT', event };
  }
}
