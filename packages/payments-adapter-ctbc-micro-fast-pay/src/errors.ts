export class CtbcPaymentFailedError extends Error {
  orderId?: string;

  constructor(message: string, orderId?: string) {
    super(message);
    this.name = 'CtbcPaymentFailedError';
    this.orderId = orderId;
  }
}

// 錯誤訊息中僅保留開頭片段，完整內容請取用 responseText，避免維護公告頁灌爆 log
const HTML_ERROR_PREVIEW_LENGTH = 200;

export class CTBCHtmlErrorResponseError extends Error {
  readonly responseText: string;

  constructor(responseText: string) {
    const preview =
      responseText.length > HTML_ERROR_PREVIEW_LENGTH
        ? `${responseText.slice(0, HTML_ERROR_PREVIEW_LENGTH)}…`
        : responseText;

    super(`CTBC API returned an HTML error page: ${preview}`);

    this.name = 'CTBCHtmlErrorResponseError';
    this.responseText = responseText;
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
