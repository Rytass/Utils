import { serializeCsv } from './csv';
import { zipFiles } from './zip';
import type {
  FbdiCellValue,
  FbdiFileContent,
  FbdiFileTemplate,
  FbdiRow,
  FbdiTemplate,
  ZipEntry,
} from '../typings/fbdi';

function cellToString(value: FbdiCellValue): string {
  if (value === null || value === undefined) return '';

  return typeof value === 'number' ? String(value) : value;
}

/**
 * 定義一支 FBDI 資料檔。欄位索引重複或超出範圍會立刻拋錯——這類錯誤若留到匯入才發現，
 * Fusion 只會回一個難以定位的驗證失敗。
 */
export function defineFbdiFile(template: FbdiFileTemplate): FbdiFileTemplate {
  const seen = new Map<number, string>();

  for (const [name, index] of Object.entries(template.columns)) {
    if (!Number.isInteger(index) || index < 0 || index >= template.columnCount) {
      throw new Error(
        `FBDI file "${template.entryFileName}" column "${name}" has index ${index}, ` +
          `which is out of range [0, ${template.columnCount - 1}]`,
      );
    }

    const existing = seen.get(index);

    if (existing) {
      throw new Error(
        `FBDI file "${template.entryFileName}" columns "${existing}" and "${name}" both map to index ${index}`,
      );
    }

    seen.set(index, name);
  }

  return template;
}

/** 定義一種 FBDI 匯入。至少要有一支資料檔，且檔名不可重複。 */
export function defineFbdiTemplate(template: FbdiTemplate): FbdiTemplate {
  if (template.files.length === 0) {
    throw new Error(`FBDI template "${template.name}" must declare at least one file`);
  }

  const names = new Set<string>();

  for (const file of template.files) {
    if (names.has(file.entryFileName)) {
      throw new Error(`FBDI template "${template.name}" has duplicated file "${file.entryFileName}"`);
    }

    names.add(file.entryFileName);
  }

  return template;
}

/**
 * 把一列以欄位名為鍵的資料轉成位置對應的字串陣列。
 *
 * **未知欄位名會拋錯**——FBDI 是位置對應，打錯欄位名若靜默忽略，結果是該值從未送出、
 * 而 Fusion 端只會抱怨某個必填欄位是空的，極難回推。
 */
export function buildFbdiRow(file: FbdiFileTemplate, values: FbdiRow): string[] {
  const row = new Array<string>(file.columnCount).fill('');

  for (const [name, value] of Object.entries(values)) {
    const index = file.columns[name];

    if (index === undefined) {
      throw new Error(
        `FBDI file "${file.entryFileName}" has no column named "${name}". ` +
          `Known columns: ${Object.keys(file.columns).join(', ')}`,
      );
    }

    row[index] = cellToString(value);
  }

  return row;
}

/** 把多列資料序列化為該資料檔的 CSV 內容。 */
export function buildFbdiCsv(file: FbdiFileTemplate, rows: readonly FbdiRow[]): string {
  return serializeCsv(rows.map(values => buildFbdiRow(file, values)));
}

/**
 * 依模板把所有資料檔打包成 zip。
 *
 * 只會寫入 `contents` 有提供的檔案——部分 FBDI 的次要資料檔（如附加屬性）可以省略；
 * 但 `contents` 若指涉模板未定義的檔名則拋錯。
 */
export function buildFbdiZip(template: FbdiTemplate, contents: readonly FbdiFileContent[], mtime?: Date): Buffer {
  if (contents.length === 0) {
    throw new Error(`FBDI template "${template.name}" import requires at least one file content`);
  }

  const entries: ZipEntry[] = contents.map(content => {
    const file = template.files.find(candidate => candidate.entryFileName === content.entryFileName);

    if (!file) {
      throw new Error(
        `FBDI template "${template.name}" has no file "${content.entryFileName}". ` +
          `Declared files: ${template.files.map(candidate => candidate.entryFileName).join(', ')}`,
      );
    }

    return {
      name: file.entryFileName,
      content: Buffer.from(buildFbdiCsv(file, content.rows), 'utf-8'),
    };
  });

  return zipFiles(entries, mtime);
}
