import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Between, DataSource, In, Raw } from 'typeorm';
import { TurnkeyEventEntity } from '../models/turnkey-event.entity';
import { TurnkeySubmissionEntity } from '../models/turnkey-submission.entity';
import { readSummaryDay, TurnkeySummaryMessage } from '../reconciliation/summary-result';
import type { TurnkeyBaseModuleOptions } from '../typings/turnkey-base-module-options';
import { TURNKEY_BASE_MODULE_OPTIONS } from '../typings/turnkey-base-providers';
import { TurnkeySubmissionStatus } from '../typings/turnkey-enums';
import { TurnkeyEvent, TurnkeyEvents } from '../typings/turnkey-events';
import { TurnkeyEventService } from './turnkey-event.service';

export type TurnkeyReconciliationIssueKind =
  /** 平台收下，本地送件不是 ACCEPTED */
  | 'ACCEPTED_BY_PLATFORM'
  /** 平台判失敗，本地送件是 ACCEPTED */
  | 'FAILED_BY_PLATFORM'
  /** 彙總中有、本地找不到對應送件（例如其他系統送的） */
  | 'UNKNOWN_MESSAGE'
  /** 本地當天寫出且 ACCEPTED，彙總裡沒有 */
  | 'MISSING_FROM_SUMMARY';

export interface TurnkeyReconciliationIssue {
  readonly kind: TurnkeyReconciliationIssueKind;
  readonly turnkeyUuid: string | null;
  readonly submissionId: string | null;
  readonly messageType: string;
  readonly documentNumbers: readonly string[];
  readonly localStatus: TurnkeySubmissionStatus | null;
}

export interface TurnkeyReconciliationReport {
  readonly companyTaxId: string;
  /** 送出日 yyyyMMdd */
  readonly date: string;
  readonly summaryMessages: number;
  readonly matched: number;
  readonly issues: readonly TurnkeyReconciliationIssue[];
}

const DATE_PATTERN = /^\d{8}$/;

/**
 * 每日對帳：解析平台的 SummaryResult（依送出日分組），和送件紀錄比對。只回報差異，不改本地狀態；
 * Failed 不附錯誤碼，原因請看該筆送件的 resultCode 或 turnkey_sysevent_log。
 */
@Injectable()
export class TurnkeyReconciliationService {
  constructor(
    @Inject(TURNKEY_BASE_MODULE_OPTIONS)
    private readonly options: TurnkeyBaseModuleOptions,
    private readonly dataSource: DataSource,
    private readonly eventService: TurnkeyEventService,
  ) {}

  /** 比對一天；彙總還沒到齊回傳 null。每個營業人一份報告，各發一筆 reconciliation.completed */
  async reconcile(date: string): Promise<readonly TurnkeyReconciliationReport[] | null> {
    if (!DATE_PATTERN.test(date)) throw new Error('date must be yyyyMMdd');

    const day = await readSummaryDay(this.options.dataPath, date);

    if (!day || day.expectedCount === null) return null;

    const reports = await this.compare(date, day.messages);

    const events = await this.dataSource.transaction(manager =>
      reports.reduce<Promise<readonly TurnkeyEvent[]>>(
        async (eventsPromise, report) => [
          ...(await eventsPromise),
          await this.eventService.append(manager, TurnkeyEvents.RECONCILIATION_COMPLETED, report.companyTaxId, {
            date: report.date,
            summaryMessages: report.summaryMessages,
            matched: report.matched,
            issues: report.issues,
          }),
        ],
        Promise.resolve([]),
      ),
    );

    this.eventService.publish(events);

    return reports;
  }

  /** 前一個台北日還沒對帳過、而且已過 01:30 時才對帳；給背景工作每小時呼叫 */
  async reconcileYesterdayIfDue(now: Date = new Date()): Promise<readonly TurnkeyReconciliationReport[] | null> {
    const taipei = DateTime.fromJSDate(now, { zone: 'Asia/Taipei' });

    if (taipei.hour * 60 + taipei.minute < 90) return null;

    const date = taipei.minus({ days: 1 }).toFormat('yyyyMMdd');

    const done = await this.dataSource.getRepository(TurnkeyEventEntity).count({
      where: {
        type: TurnkeyEvents.RECONCILIATION_COMPLETED,
        data: Raw(alias => `${alias} ->> 'date' = :date`, { date }),
      },
    });

    return done > 0 ? null : this.reconcile(date);
  }

  private async compare(
    date: string,
    messages: readonly TurnkeySummaryMessage[],
  ): Promise<readonly TurnkeyReconciliationReport[]> {
    const repo = this.dataSource.getRepository(TurnkeySubmissionEntity);
    const uuids = messages.map(message => message.turnkeyUuid);

    const known = uuids.length
      ? await repo.find({
          select: {
            id: true,
            companyTaxId: true,
            messageType: true,
            documentNumber: true,
            status: true,
            turnkeyUuid: true,
          },
          where: { turnkeyUuid: In(uuids) },
        })
      : [];

    const byUuid = new Map(known.map(submission => [submission.turnkeyUuid as string, submission]));
    const start = DateTime.fromFormat(date, 'yyyyMMdd', { zone: 'Asia/Taipei' });

    const writtenThatDay = await repo.find({
      select: {
        id: true,
        companyTaxId: true,
        messageType: true,
        documentNumber: true,
        status: true,
        turnkeyUuid: true,
      },
      where: {
        status: TurnkeySubmissionStatus.ACCEPTED,
        writtenAt: Between(start.toJSDate(), start.plus({ days: 1 }).minus({ milliseconds: 1 }).toJSDate()),
      },
    });

    const summaryIssues = messages.flatMap((message): TurnkeyReconciliationIssue[] => {
      const submission = byUuid.get(message.turnkeyUuid);
      const documentNumbers = [...message.good, ...message.failed];
      const platformAccepted = message.failed.length === 0 && message.good.length > 0;

      if (!submission) {
        return [
          {
            kind: 'UNKNOWN_MESSAGE',
            turnkeyUuid: message.turnkeyUuid,
            submissionId: null,
            messageType: message.messageType,
            documentNumbers,
            localStatus: null,
          },
        ];
      }

      const localAccepted = submission.status === TurnkeySubmissionStatus.ACCEPTED;

      if (platformAccepted === localAccepted) return [];

      return [
        {
          kind: platformAccepted ? 'ACCEPTED_BY_PLATFORM' : 'FAILED_BY_PLATFORM',
          turnkeyUuid: message.turnkeyUuid,
          submissionId: submission.id,
          messageType: message.messageType,
          documentNumbers,
          localStatus: submission.status,
        },
      ];
    });

    const inSummary = new Set(uuids);

    const missing = writtenThatDay
      .filter(submission => !submission.turnkeyUuid || !inSummary.has(submission.turnkeyUuid))
      .map(
        (submission): TurnkeyReconciliationIssue => ({
          kind: 'MISSING_FROM_SUMMARY',
          turnkeyUuid: submission.turnkeyUuid,
          submissionId: submission.id,
          messageType: submission.messageType,
          documentNumbers: [submission.documentNumber],
          localStatus: submission.status,
        }),
      );

    const companyOf = (issue: TurnkeyReconciliationIssue): string =>
      (issue.turnkeyUuid && byUuid.get(issue.turnkeyUuid)?.companyTaxId) ||
      writtenThatDay.find(submission => submission.id === issue.submissionId)?.companyTaxId ||
      messages.find(message => message.turnkeyUuid === issue.turnkeyUuid)?.companyTaxId ||
      '';

    const companies = [
      ...new Set([...messages.map(message => message.companyTaxId), ...writtenThatDay.map(s => s.companyTaxId)]),
    ].filter(Boolean);

    const issues = [...summaryIssues, ...missing];

    return companies.map(companyTaxId => {
      const companyMessages = messages.filter(message => message.companyTaxId === companyTaxId);
      const companyIssues = issues.filter(issue => companyOf(issue) === companyTaxId);

      return {
        companyTaxId,
        date,
        summaryMessages: companyMessages.length,
        matched: companyMessages.length - companyIssues.filter(issue => issue.kind !== 'MISSING_FROM_SUMMARY').length,
        issues: companyIssues,
      };
    });
  }
}
