import { TurnkeyPrintError, TurnkeyPrintErrorCode } from '../turnkey-print-error';

interface ModuleLoadError {
  readonly code?: unknown;
  readonly message: string;
}

/** 不用 instanceof Error：jest 等沙箱的 Error 來自另一個 realm，instanceof 會判斷失準 */
const isModuleLoadError = (error: unknown): error is ModuleLoadError =>
  typeof error === 'object' && error !== null && typeof (error as { message?: unknown }).message === 'string';

const isMissingPackage = (error: unknown, name: string): boolean => {
  if (!isModuleLoadError(error)) return false;

  // Jest 的模組解析錯誤沒有 code，只能以訊息判斷
  const notFound =
    error.code === 'ERR_MODULE_NOT_FOUND' ||
    error.code === 'MODULE_NOT_FOUND' ||
    /Cannot find (module|package)/.test(error.message);

  return notFound && error.message.includes(`'${name}'`);
};

/**
 * 動態載入選用套件。套件本身不存在時丟 RENDERER_UNAVAILABLE 並說明要安裝哪個套件；
 * 其他錯誤（例如套件內部載入失敗）原樣丟出，避免把真正的原因藏起來。
 */
export const loadOptional = async <T>(name: string, purpose: string, load: () => Promise<T>): Promise<T> => {
  try {
    return await load();
  } catch (error: unknown) {
    if (isMissingPackage(error, name)) {
      throw new TurnkeyPrintError(
        TurnkeyPrintErrorCode.RENDERER_UNAVAILABLE,
        `${purpose}需要選用套件 ${name}，請先安裝（yarn add ${name}）`,
      );
    }

    throw error;
  }
};

/** CJS 套件被動態 import 時，預設匯出可能落在 default 底下；兩種形狀都接受 */
export const unwrapDefault = <T extends object>(mod: T & { readonly default?: T }): T => mod.default ?? mod;
