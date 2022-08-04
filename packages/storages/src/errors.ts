export class StorageError extends Error {
  readonly code: ErrorCode;

  readonly message: string;

  constructor(code: ErrorCode, message?: string) {
    super(message || ErrorDefaultMessage[code]);

    this.code = code;

    this.message = message || ErrorDefaultMessage[code];
  }
}

export enum ErrorCode {
  WRITE_FILE_ERROR = '101',
  READ_FILE_ERROR = '102',
  REMOVE_FILE_ERROR = '103',
  UNRECOGNIZED_ERROR = '104',
  DIRECTORY_NOT_FOUND = '201',
  FILE_NOT_FOUND = '202',
}

const ErrorDefaultMessage = {
  [ErrorCode.WRITE_FILE_ERROR]: 'WRITE_FILE_ERROR',
  [ErrorCode.READ_FILE_ERROR]: 'READ_FILE_ERROR',
  [ErrorCode.REMOVE_FILE_ERROR]: 'REMOVE_FILE_ERROR',
  [ErrorCode.UNRECOGNIZED_ERROR]: 'UNRECOGNIZED_ERROR',
  [ErrorCode.DIRECTORY_NOT_FOUND]: 'DIRECTORY_NOT_FOUND',
  [ErrorCode.FILE_NOT_FOUND]: 'FILE_NOT_FOUND',
};
