/** FBDI CSV 為 headerless、純位置對應（SQL*Loader TRAILING NULLCOLS 語意）。 */

function csvEscape(value: string): string {
  if (value === '') return '';

  if (/["\n\r,]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/** 序列化為 headerless CSV。 */
export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return rows.map(row => row.map(csvEscape).join(',')).join('\n');
}

/** 截斷至指定長度（Oracle 多數文字欄位有長度上限，超長會導致匯入驗證失敗）。 */
export function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/** DB 日期格式 `YYYY-MM-DD` → Fusion FBDI 慣用的 `YYYY/MM/DD`。 */
export function formatFbdiDate(isoDate: string): string {
  return isoDate.replaceAll('-', '/');
}
