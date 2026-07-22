export class CtbcPaymentFailedError extends Error {
  orderId?: string;

  constructor(message: string, orderId?: string) {
    super(message);
    this.name = 'CtbcPaymentFailedError';
    this.orderId = orderId;
  }
}

export class CTBCPosQueryFailedError extends Error {
  readonly respCode?: string;
  readonly errCode?: string;
  readonly errDesc: string;

  constructor(respCode: string | undefined, errCode: string | undefined, errDesc: string | undefined) {
    const resolvedErrDesc = errDesc || 'Unknown error';

    super(`Query failed, RespCode: ${respCode} - ErrCode: ${errCode} - ErrDesc: ${resolvedErrDesc}`);

    this.name = 'CTBCPosQueryFailedError';
    this.respCode = respCode;
    this.errCode = errCode;
    this.errDesc = resolvedErrDesc;
  }
}
