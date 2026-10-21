export enum TurnkeyPrintErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  /** 不是 printed: true、已作廢或已註銷、平台退件的發票；已作廢的折讓 */
  NOT_PRINTABLE = 'NOT_PRINTABLE',
  /** 營業人尚未設定 QR Code AES 金鑰 */
  QR_KEY_MISSING = 'QR_KEY_MISSING',
  /** 該格式需要的選用套件（qrcode、bwip-js、pdfkit）沒有安裝，或缺字型 */
  RENDERER_UNAVAILABLE = 'RENDERER_UNAVAILABLE',
}

export class TurnkeyPrintError extends Error {
  constructor(
    readonly code: TurnkeyPrintErrorCode,
    message: string,
  ) {
    super(message);

    this.name = 'TurnkeyPrintError';
  }
}
