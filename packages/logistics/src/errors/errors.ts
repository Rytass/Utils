import { LogisticsErrorInterface } from '..';

export class LogisticsError implements LogisticsErrorInterface {
  readonly code: ErrorCode;
  readonly message?: string;
  constructor(code: ErrorCode, message?: string) {
    this.code = code;
    this.message = message;
  }
}

export enum ErrorCode {
  NOT_FOUND_ERROR = '101'
}