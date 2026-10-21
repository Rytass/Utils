import type { Request } from 'express';
import type {
  TurnkeyBaseModuleAsyncOptions,
  TurnkeyBaseModuleOptions,
} from '@rytass/invoice-turnkey-base-nestjs-module';

/** 與 REST 模組的 TurnkeyApiAction 同值，方便宿主用同一組權限表 */
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
  READ_EVENTS = 'READ_EVENTS',
  PRINT_INVOICE = 'PRINT_INVOICE',
  PRINT_ALLOWANCE = 'PRINT_ALLOWANCE',
}

/** 跟 REST 模組同義；複製一份而不依賴 REST 套件 */
export interface TurnkeyRouteAccess {
  /** 每個 resolver 方法額外套上的 decorator，例如 member-base 的權限 decorator */
  readonly decorateRoute?: (action: TurnkeyApiAction) => MethodDecorator[];
  /** 呼叫者可不可以代表這個統編；未提供且沒有 allowAllCompanies 時一律拒絕 */
  readonly canAccessCompany?: (request: Request, companyTaxId: string) => boolean | Promise<boolean>;
  /** 明確設 true 才不檢查，只建議單一營業人的內部部署 */
  readonly allowAllCompanies?: boolean;
}

/** 由 forRoot 帶入 Core 的 options 與存取設定；access 與同層欄位合併，access 優先（與 REST 相同） */
export interface TurnkeyBaseGraphQLModuleOptions extends TurnkeyBaseModuleOptions, TurnkeyRouteAccess {
  /** 例如 memberBaseAccess()；與同層的 decorateRoute 等欄位合併，access 優先 */
  readonly access?: TurnkeyRouteAccess;
}

/** 與 REST 模組並用時改用 forFeature，Core 已由 REST 模組註冊 */
export interface TurnkeyBaseGraphQLFeatureOptions extends TurnkeyRouteAccess {
  readonly access?: TurnkeyRouteAccess;
}

/** access 放頂層：decorator 在模組定義時就要套上，等不到 useFactory */
export interface TurnkeyBaseGraphQLModuleAsyncOptions extends TurnkeyBaseModuleAsyncOptions {
  readonly access?: TurnkeyRouteAccess;
}

/** GraphQL context 至少要帶 express 的 req（Apollo 預設即是） */
export interface TurnkeyGraphQLContext {
  readonly req: Request;
}
