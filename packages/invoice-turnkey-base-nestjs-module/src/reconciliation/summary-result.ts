import { promises as fs } from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';

/** 平台每日彙總（SummaryResult）中的一筆訊息 */
export interface TurnkeySummaryMessage {
  /** turnkey_message_log.uuid（Info/Id 的最後一段） */
  readonly turnkeyUuid: string;
  readonly messageType: string;
  /** From/PartyId */
  readonly companyTaxId: string;
  readonly good: readonly string[];
  readonly failed: readonly string[];
}

export interface TurnkeySummaryDay {
  /** 送出日 yyyyMMdd */
  readonly date: string;
  /**
   * Final 檔記載的數字加總，全部 Final 檔到齊才有值；只用來判斷彙總是否到齊。
   * 實測（2026-10-20）明細 22 筆含 2 筆 E0402，Final 為 20，看來不計 E0402，所以不拿來和明細筆數比對。
   */
  readonly expectedCount: number | null;
  readonly messages: readonly TurnkeySummaryMessage[];
}

export const SUMMARY_RESULT_DIRECTORY = 'Unpack/BAK/SummaryResult';

const UUID_PATTERN = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  isArray: (name: string): boolean => name === 'Message' || name === 'Invoice',
});

type Node = Readonly<Record<string, unknown>>;

const child = (node: unknown, key: string): Node | undefined =>
  node && typeof node === 'object' ? ((node as Node)[key] as Node | undefined) : undefined;

const references = (detail: Node | undefined): readonly string[] =>
  ((child(child(child(detail, 'ResultDetailType'), 'Invoices'), 'Invoice') as unknown as Node[] | undefined) ?? [])
    .map(invoice => invoice.ReferenceNumber)
    .filter((value): value is string => typeof value === 'string');

/** 解析一份 SummaryResult XML（-1、-2… 檔） */
export const parseSummaryResult = (xml: string): readonly TurnkeySummaryMessage[] => {
  const root = child(parser.parse(xml), 'SummaryResult');
  const companyTaxId = String(child(child(child(root, 'RoutingInfo'), 'From'), 'PartyId') ?? '');
  const messages = (child(child(root, 'DetailList'), 'Message') as unknown as Node[] | undefined) ?? [];

  return messages.flatMap(message => {
    const info = child(message, 'Info');
    const id = typeof info?.Id === 'string' ? info.Id : '';
    const turnkeyUuid = UUID_PATTERN.exec(id)?.[1];
    const result = child(message, 'ResultType');

    return turnkeyUuid
      ? [
          {
            turnkeyUuid: turnkeyUuid.toLowerCase(),
            messageType: typeof info?.MessageType === 'string' ? info.MessageType : '',
            companyTaxId,
            good: references(child(result, 'Good')),
            failed: references(child(result, 'Failed')),
          },
        ]
      : [];
  });
};

/**
 * 讀 `<dataPath>/Unpack/BAK/SummaryResult/<送出日>/` 底下所有 SummaryResult。
 * 同一天可能有多組（存證一組、各交換對象各一組），每組有 -N 明細檔與一個 Final 檔（內容為訊息數）。
 */
export const readSummaryDay = async (dataPath: string, date: string): Promise<TurnkeySummaryDay | null> => {
  const dayDirectory = path.join(dataPath, SUMMARY_RESULT_DIRECTORY, date);
  const batches = await fs.readdir(dayDirectory).catch(() => null);

  if (!batches) return null;

  const files = (
    await Promise.all(
      batches.map(async batch =>
        (await fs.readdir(path.join(dayDirectory, batch)).catch(() => [] as string[]))
          .filter(name => name.endsWith('.SummaryResult'))
          .map(name => path.join(dayDirectory, batch, name)),
      ),
    )
  ).flat();

  const finals = files.filter(file => file.endsWith('-Final.SummaryResult'));
  const details = files.filter(file => !file.endsWith('-Final.SummaryResult'));

  const finalCounts = await Promise.all(finals.map(async file => Number((await fs.readFile(file, 'utf8')).trim())));

  const messages = (
    await Promise.all(details.map(async file => parseSummaryResult(await fs.readFile(file, 'utf8'))))
  ).flat();

  // 每組明細都有對應的 Final 才算到齊
  const groups = new Set(details.map(file => path.basename(file).replace(/-\d+\.SummaryResult$/, '')));
  const complete = finals.length > 0 && finals.length === groups.size && finalCounts.every(Number.isFinite);

  return {
    date,
    expectedCount: complete ? finalCounts.reduce((sum, count) => sum + count, 0) : null,
    messages,
  };
};
