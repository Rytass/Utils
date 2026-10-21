import { DateTime } from 'luxon';

const ZONE = 'Asia/Taipei';

const toTaipei = (date: Date): DateTime => DateTime.fromJSDate(date, { zone: ZONE });

/** MIG 的 DateType：西元 yyyyMMdd */
export const formatMigDate = (date: Date): string => toTaipei(date).toFormat('yyyyMMdd');

/** MIG 的 TimeType：HH:mm:ss */
export const formatMigTime = (date: Date): string => toTaipei(date).toFormat('HH:mm:ss');

/** 民國年月日 7 碼，例如 1151021 */
export const formatRocDate = (date: Date): string => {
  const dt = toTaipei(date);

  return `${String(dt.year - 1911).padStart(3, '0')}${dt.toFormat('MMdd')}`;
};

/** 期別：民國年 3 碼＋雙數月 2 碼，例如 2026-09 / 2026-10 都是 11510 */
export const formatPeriod = (date: Date): string => {
  const dt = toTaipei(date);
  const evenMonth = dt.month % 2 === 0 ? dt.month : dt.month + 1;

  return `${String(dt.year - 1911).padStart(3, '0')}${String(evenMonth).padStart(2, '0')}`;
};

/** 期別顯示文字，例如 115年09-10月 */
export const formatPeriodLabel = (period: string): string => {
  const year = Number(period.slice(0, 3));
  const evenMonth = Number(period.slice(3, 5));

  return `${year}年${String(evenMonth - 1).padStart(2, '0')}-${String(evenMonth).padStart(2, '0')}月`;
};

/** 解析 MIG 的日期與時間（台北時區） */
export const parseMigDateTime = (date: string, time = '00:00:00'): Date =>
  DateTime.fromFormat(`${date} ${time}`, 'yyyyMMdd HH:mm:ss', { zone: ZONE }).toJSDate();
