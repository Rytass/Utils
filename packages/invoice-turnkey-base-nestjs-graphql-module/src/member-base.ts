import type { Request } from 'express';
import { AllowActions } from '@rytass/member-base-nestjs-module';
import { TurnkeyApiAction, TurnkeyRouteAccess } from './turnkey-graphql.options';

/** Casbin policy 的 action：查詢類用 read，開立、作廢、註銷、折讓等各自一個，可以分開授權 */
export const TURNKEY_MEMBER_BASE_ACTIONS: Readonly<Record<TurnkeyApiAction, string>> = {
  [TurnkeyApiAction.READ_INVOICE]: 'read',
  [TurnkeyApiAction.READ_ALLOWANCE]: 'read',
  [TurnkeyApiAction.READ_RECEIVED]: 'read',
  [TurnkeyApiAction.READ_SUBMISSION]: 'read',
  [TurnkeyApiAction.READ_EVENTS]: 'read',
  [TurnkeyApiAction.VALIDATE]: 'read',
  [TurnkeyApiAction.READ_COMPANY]: 'read',
  [TurnkeyApiAction.ISSUE_INVOICE]: 'issue',
  [TurnkeyApiAction.VOID_INVOICE]: 'void',
  [TurnkeyApiAction.ANNUL_INVOICE]: 'annul',
  [TurnkeyApiAction.ISSUE_ALLOWANCE]: 'allowance',
  [TurnkeyApiAction.VOID_ALLOWANCE]: 'allowance',
  [TurnkeyApiAction.ACKNOWLEDGE_REJECTION]: 'exchange',
  [TurnkeyApiAction.REPLY_RECEIVED]: 'exchange',
  [TurnkeyApiAction.REGISTER_INVOICE_TRACK]: 'track',
  [TurnkeyApiAction.READ_INVOICE_TRACK]: 'track',
  [TurnkeyApiAction.REPORT_BLANK_NUMBERS]: 'track',
  [TurnkeyApiAction.ABANDON_INVOICE_NUMBER]: 'track',
  [TurnkeyApiAction.RETRY_SUBMISSION]: 'retry',
  [TurnkeyApiAction.PRINT_INVOICE]: 'print',
  [TurnkeyApiAction.PRINT_ALLOWANCE]: 'print',
  [TurnkeyApiAction.RESOLVE_SUBMISSION]: 'resolve',
  [TurnkeyApiAction.MANAGE_COMPANY]: 'company',
};

export interface TurnkeyMemberBaseAccessOptions {
  /** Casbin 的 subject（resource），預設 'turnkey' */
  readonly resource?: string;
  /** 覆寫個別 action 對應的 Casbin action */
  readonly actions?: Partial<Record<TurnkeyApiAction, string>>;
  /**
   * 呼叫者可不可以代表這個統編。member-base 沒有「營業人」的概念，所以要自己判斷，
   * 例如 `(request, taxId) => request.payload?.domain === taxId`；未提供且沒有 allowAllCompanies 時一律拒絕。
   */
  readonly canAccessCompany?: (request: Request, companyTaxId: string) => boolean | Promise<boolean>;
  readonly allowAllCompanies?: boolean;
}

/** 把每個 TurnkeyApiAction 套上 member-base 的 AllowActions([[resource, action]])，交給全域 CasbinGuard 檢查 */
export const memberBaseAccess = (options: TurnkeyMemberBaseAccessOptions = {}): TurnkeyRouteAccess => {
  const resource = options.resource ?? 'turnkey';
  const actions = { ...TURNKEY_MEMBER_BASE_ACTIONS, ...options.actions };

  return {
    decorateRoute: (action: TurnkeyApiAction): MethodDecorator[] => [AllowActions([[resource, actions[action]]])],
    canAccessCompany: options.canAccessCompany,
    allowAllCompanies: options.allowAllCompanies,
  };
};
