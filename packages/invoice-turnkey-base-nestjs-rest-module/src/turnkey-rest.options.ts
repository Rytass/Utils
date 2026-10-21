import type { Request } from 'express';
import type {
  TurnkeyBaseModuleAsyncOptions,
  TurnkeyBaseModuleOptions,
} from '@rytass/invoice-turnkey-base-nestjs-module';

export const DEFAULT_TURNKEY_ROUTE_PREFIX = 'turnkey';

export enum TurnkeyApiAction {
  ISSUE_INVOICE = 'ISSUE_INVOICE',
  READ_INVOICE = 'READ_INVOICE',
  VOID_INVOICE = 'VOID_INVOICE',
  VALIDATE = 'VALIDATE',
  ISSUE_ALLOWANCE = 'ISSUE_ALLOWANCE',
  VOID_ALLOWANCE = 'VOID_ALLOWANCE',
  READ_ALLOWANCE = 'READ_ALLOWANCE',
  ACKNOWLEDGE_REJECTION = 'ACKNOWLEDGE_REJECTION',
  READ_RECEIVED = 'READ_RECEIVED',
  REPLY_RECEIVED = 'REPLY_RECEIVED',
  REGISTER_INVOICE_TRACK = 'REGISTER_INVOICE_TRACK',
  READ_SUBMISSION = 'READ_SUBMISSION',
  RETRY_SUBMISSION = 'RETRY_SUBMISSION',
  ANNUL_INVOICE = 'ANNUL_INVOICE',
  REPORT_BLANK_NUMBERS = 'REPORT_BLANK_NUMBERS',
  ABANDON_INVOICE_NUMBER = 'ABANDON_INVOICE_NUMBER',
  PRINT_INVOICE = 'PRINT_INVOICE',
  PRINT_ALLOWANCE = 'PRINT_ALLOWANCE',
  READ_EVENTS = 'READ_EVENTS',
  READ_COMPANY = 'READ_COMPANY',
  MANAGE_COMPANY = 'MANAGE_COMPANY',
  RESOLVE_SUBMISSION = 'RESOLVE_SUBMISSION',
}

/** 跟 routePrefix 一樣在模組定義時決定（decorator 要在 class 建立時套上） */
export interface TurnkeyRouteAccess {
  /** 每個 handler 額外套上的 decorator，例如 member-base 的權限 decorator */
  readonly decorateRoute?: (action: TurnkeyApiAction) => MethodDecorator[];
  /** 呼叫者可不可以代表這個統編；未提供且沒有 allowAllCompanies 時一律拒絕 */
  readonly canAccessCompany?: (request: Request, companyTaxId: string) => boolean | Promise<boolean>;
  /** 明確設 true 才不檢查，只建議單一營業人的內部部署 */
  readonly allowAllCompanies?: boolean;
}

export interface TurnkeyBaseRestModuleOptions extends TurnkeyBaseModuleOptions, TurnkeyRouteAccess {
  /** 預設 'turnkey'；空字串、'/' 與 '.' 直接 throw */
  readonly routePrefix?: string;
  /** 例如 memberBaseAccess()；與同層的 decorateRoute 等欄位合併，access 優先 */
  readonly access?: TurnkeyRouteAccess;
}

export interface TurnkeyBaseRestFeatureOptions extends TurnkeyRouteAccess {
  readonly routePrefix?: string;
  readonly access?: TurnkeyRouteAccess;
}

/** routePrefix 與 access 放頂層：decorator 在模組定義時就要套上，等不到 useFactory */
export interface TurnkeyBaseRestModuleAsyncOptions extends TurnkeyBaseModuleAsyncOptions {
  readonly routePrefix?: string;
  readonly access?: TurnkeyRouteAccess;
}

/** 去掉前後的 '/'；不用 regex，避免 /\/+$/ 在大量斜線時的多項式回溯 */
const trimSlashes = (value: string): string => {
  let start = 0;
  let end = value.length;

  while (start < end && value[start] === '/') start += 1;

  while (end > start && value[end - 1] === '/') end -= 1;

  return value.slice(start, end);
};

export const resolveRoutePrefix = (configured: string | undefined): string => {
  if (configured === undefined) return DEFAULT_TURNKEY_ROUTE_PREFIX;

  const trimmed = trimSlashes(configured.trim()).trim();

  if (!trimmed || /^\.+$/.test(trimmed)) {
    throw new Error(
      `[TurnkeyBaseRestModule] routePrefix ${JSON.stringify(configured)} is not a usable path segment; ` +
        `give it a path segment or omit it to use "${DEFAULT_TURNKEY_ROUTE_PREFIX}".`,
    );
  }

  return trimmed;
};
