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

export const isModuleNotFound = (ex: unknown): boolean =>
  MODULE_NOT_FOUND_CODES.includes((ex as NodeJS.ErrnoException | undefined)?.code ?? '');

export const TYPEORM_ADAPTER_MISSING_MESSAGE =
  'casbinAdapterOptions is set but the "typeorm-adapter" package could not be resolved. ' +
  'Install it to enable database-backed Casbin policies (npm i typeorm-adapter). ' +
  'It is an optional peer dependency rather than a bundled dependency because it declares ' +
  'typeorm as its own dependency, which would install a second TypeORM copy and split ' +
  'the global entity metadata storage.';

// 只改寫「套件沒安裝」這一種錯誤。其他載入失敗（adapter 自身初始化錯誤、
// 版本不相容等）原樣回傳，否則真正的 bug 會被藏在誤導性的安裝訊息底下。
export const toTypeORMAdapterLoadError = (ex: unknown): unknown =>
  isModuleNotFound(ex) ? new Error(TYPEORM_ADAPTER_MISSING_MESSAGE, { cause: ex }) : ex;

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
