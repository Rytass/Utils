import { ForbiddenException } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import type { Request } from 'express';
import {
  TurnkeyIdempotencyConflictError,
  TurnkeyPrintError,
  TurnkeyValidationError,
} from '@rytass/invoice-turnkey-base-nestjs-module';
import type { TurnkeyRouteAccess } from './turnkey-graphql.options';

/** 依 canAccessCompany 決定呼叫者能不能代表統編；未設定時預設拒絕（與 REST guard 相同語意） */
export const assertCompanyAccess = async (
  access: TurnkeyRouteAccess,
  request: Request,
  companyTaxId: string,
): Promise<void> => {
  if (!/^\d{8}$/.test(companyTaxId)) throw new ForbiddenException('Invalid company tax id');

  if (access.allowAllCompanies) return;

  if (!access.canAccessCompany) throw new ForbiddenException('Company access is not configured');

  if (!(await access.canAccessCompany(request, companyTaxId))) {
    throw new ForbiddenException('Cannot access this company');
  }
};

export const requireIdempotencyKey = (key: string): string => {
  if (!key || key.length > 255) {
    throw new GraphQLError('idempotencyKey is required (1-255 chars)', {
      extensions: { code: 'IDEMPOTENCY_KEY_REQUIRED' },
    });
  }

  return key;
};

/** 把 Core 的錯誤轉成帶 extensions.code 的 GraphQL 錯誤，其他錯誤原樣拋出 */
export const toGraphQLError = (error: unknown): unknown => {
  if (error instanceof TurnkeyValidationError) {
    return new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field, issues: error.issues },
    });
  }

  if (error instanceof TurnkeyIdempotencyConflictError) {
    return new GraphQLError(error.message, { extensions: { code: error.code } });
  }

  /** 證明聯錯誤：code 為 NOT_FOUND、NOT_PRINTABLE、QR_KEY_MISSING、RENDERER_UNAVAILABLE */
  if (error instanceof TurnkeyPrintError) {
    return new GraphQLError(error.message, { extensions: { code: error.code } });
  }

  return error;
};

/** 執行 Core 呼叫並統一轉換錯誤 */
export const runTurnkey = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    throw toGraphQLError(error);
  }
};

export const parseIsoDate = (value: string | null | undefined, field: string): Date | undefined => {
  if (value === null || value === undefined) return undefined;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new GraphQLError(`${field} must be an ISO 8601 date`, {
      extensions: { code: 'BAD_USER_INPUT', field },
    });
  }

  return date;
};
