import { StorageErrorInterface } from '..';

export class StorageError implements StorageErrorInterface {
  readonly code: ErrorCode;
  readonly message?: string;
  constructor(code: ErrorCode, message?: string) {
    this.code = code;
    this.message = message;
  }
}

export enum ErrorCode {
  WRITE_FILE_ERROR = '101',
  READ_FILE_ERROR = '102',
  REMOVE_FILE_ERROR = '103',
  UNRECOGNIZED_ERROR = '104',
  DIRECTORY_NOT_FOUND = '201',
}
