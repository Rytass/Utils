import type TypeORMAdapterType from 'typeorm-adapter';

// typeorm-adapter 是 optional peer dependency：只有設定 casbinAdapterOptions
// （亦即想把 Casbin policy 存進資料庫）的使用者才需要安裝它。
//
// 之所以不放進 dependencies，是因為 typeorm-adapter 把 typeorm 宣告成自己的
// dependency（^0.3.17）而非 peer。一旦內建，使用者升級 typeorm 時就會裝進第二份，
// 讓 getMetadataArgsStorage() 分裂成兩個實例，症狀是毫無關聯的
// 「Entity metadata for X was not found」。
//
// 錯誤映射與實際載入分開放，是為了讓映射邏輯能直接單元測試 —— ESM 模式下
// jest.mock 攔不到真正的 dynamic import。同 default-permission-checker 的作法。

const MODULE_NOT_FOUND_CODES = ['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'];

const TYPEORM_ADAPTER_PACKAGE = 'typeorm-adapter';

// Both loaders name the thing they could not find first and in quotes:
//   CommonJS  Cannot find module 'mongodb'
//   ESM       Cannot find package 'typeorm-adapter' imported from ...
const MISSING_SPECIFIER = /^Cannot find (?:module|package) '([^']+)'/;

export const isModuleNotFound = (ex: unknown): boolean =>
  MODULE_NOT_FOUND_CODES.includes((ex as NodeJS.ErrnoException | undefined)?.code ?? '');

/**
 * Which module the loader could not find, or null when the error does not say.
 *
 * Only the first line is read. The rest is a "Require stack" listing the files
 * that led here, and one of those is inside typeorm-adapter itself whenever
 * typeorm-adapter is the thing doing the requiring — so searching the whole
 * message for the package name reports its own broken dependency as itself.
 */
const missingSpecifier = (ex: unknown): string | null => {
  const message = (ex as { message?: string } | undefined)?.message;

  if (typeof message !== 'string') return null;

  return MISSING_SPECIFIER.exec(message.split('\n')[0])?.[1] ?? null;
};

/** Distinguishes "not installed" from "installed, and it threw". */
export const isTypeORMAdapterMissing = (ex: unknown): boolean =>
  isModuleNotFound(ex) && missingSpecifier(ex) === TYPEORM_ADAPTER_PACKAGE;

export const TYPEORM_ADAPTER_MISSING_MESSAGE =
  'casbinAdapterOptions is set but the "typeorm-adapter" package could not be resolved. ' +
  'Install it to enable database-backed Casbin policies (npm i typeorm-adapter). ' +
  'It is an optional peer dependency rather than a bundled dependency because it declares ' +
  'typeorm as its own dependency, which would install a second TypeORM copy and split ' +
  'the global entity metadata storage.';

// 只改寫「typeorm-adapter 本身沒安裝」這一種錯誤。其他載入失敗（adapter 自身
// 初始化錯誤、它自己缺依賴、版本不相容等）原樣回傳，否則真正的 bug 會被藏在
// 誤導性的安裝訊息底下 —— 例如 typeorm-adapter 有裝但缺 mongodb 時，叫使用者
// 去安裝一個已經存在的套件。
export const toTypeORMAdapterLoadError = (ex: unknown): unknown =>
  isTypeORMAdapterMissing(ex) ? new Error(TYPEORM_ADAPTER_MISSING_MESSAGE, { cause: ex }) : ex;

// 拋出會讓 Nest 的模組初始化失敗、app 直接在啟動時崩潰 —— 這是刻意的。
// CasbinGuard 雖然在 enforcer 為 null 時 fail closed（guards/casbin.guard.ts），
// 但一個「設了 casbinAdapterOptions 卻拿不到 enforcer」的 app 是設定錯誤，
// 不該帶著壞掉的授權狀態上線。
export const getTypeORMAdapter = async (): Promise<typeof TypeORMAdapterType> => {
  try {
    const module = (await import('typeorm-adapter')) as unknown as {
      default: {
        default: typeof TypeORMAdapterType;
      };
    };

    return module.default.default;
  } catch (ex) {
    throw toTypeORMAdapterLoadError(ex);
  }
};
