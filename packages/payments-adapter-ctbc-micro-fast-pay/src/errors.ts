export class CtbcPaymentFailedError extends Error {
  orderId?: string;

  constructor(message: string, orderId?: string) {
    super(message);
    this.name = 'CtbcPaymentFailedError';
    this.orderId = orderId;
  }
}
