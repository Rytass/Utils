import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import {
  TurnkeyIdempotencyConflictError,
  TurnkeyPrintError,
  TurnkeyPrintErrorCode,
  TurnkeyValidationCode,
  TurnkeyValidationError,
} from '@rytass/invoice-turnkey-base-nestjs-module';

const NOT_FOUND_CODES = new Set<TurnkeyValidationCode>([
  TurnkeyValidationCode.INVOICE_NOT_FOUND,
  TurnkeyValidationCode.COMPANY_NOT_REGISTERED,
  TurnkeyValidationCode.SUBMISSION_NOT_FOUND,
]);

/** 檢核錯誤 → 422、冪等衝突與 externalId 衝突 → 409、列印錯誤依代碼；其他錯誤交回 Nest 預設處理 */
const PRINT_ERROR_STATUS: Readonly<Record<TurnkeyPrintErrorCode, number>> = {
  [TurnkeyPrintErrorCode.NOT_FOUND]: 404,
  [TurnkeyPrintErrorCode.NOT_PRINTABLE]: 422,
  [TurnkeyPrintErrorCode.QR_KEY_MISSING]: 422,
  [TurnkeyPrintErrorCode.RENDERER_UNAVAILABLE]: 501,
};

@Catch(TurnkeyValidationError, TurnkeyIdempotencyConflictError, TurnkeyPrintError)
export class TurnkeyExceptionFilter implements ExceptionFilter {
  catch(
    exception: TurnkeyValidationError | TurnkeyIdempotencyConflictError | TurnkeyPrintError,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof TurnkeyPrintError) {
      response.status(PRINT_ERROR_STATUS[exception.code]).json({ code: exception.code, message: exception.message });

      return;
    }

    if (exception instanceof TurnkeyIdempotencyConflictError) {
      response.status(409).json({ code: exception.code, message: exception.message });

      return;
    }

    const status = NOT_FOUND_CODES.has(exception.code)
      ? 404
      : exception.code === TurnkeyValidationCode.EXTERNAL_ID_CONFLICT
        ? 409
        : 422;

    response.status(status).json({ code: exception.code, message: exception.message, issues: exception.issues });
  }
}

export const isHttpException = (error: unknown): error is HttpException => error instanceof HttpException;
