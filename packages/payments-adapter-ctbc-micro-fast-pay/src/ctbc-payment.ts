import {
  InputFromOrderCommitMessage,
  Order,
  PaymentEvents,
  PaymentGateway,
} from '@rytass/payments';
import EventEmitter from 'node:events';
import { CTBCBindCardRequest } from './ctbc-bind-card-request';
import { CTBCOrder } from './ctbc-order';
import { decodeResponsePayload } from './ctbc-response';
import {
  BindCardGatewayLike,
  CTBCBindCardCallbackPayload,
  CTBCBindCardRequestPayload,
  CTBCOrderCommitMessage,
  CTBCOrderInput,
  CTBCPaymentOptions,
} from './typings';

export class CTBCPayment
  implements
    PaymentGateway<CTBCOrderCommitMessage, CTBCOrder>,
    BindCardGatewayLike
{
  readonly merchantId: string;
  readonly merId: string;
  readonly txnKey: string;
  readonly baseUrl: string;
  readonly endpoint: string;
  readonly requireCacheHit: boolean;

  readonly emitter = new EventEmitter();
  readonly _server: boolean;

  readonly bindCardRequestsCache = new Map<string, CTBCBindCardRequest>();

  constructor(options: CTBCPaymentOptions) {
    this.merchantId = options.merchantId;
    this.merId = options.merId;
    this.txnKey = options.txnKey;
    this.baseUrl = options.baseUrl ?? 'https://ccapi.ctbcbank.com';
    this.endpoint = `${this.baseUrl}/mFastPay/TxnServlet`;
    this.requireCacheHit = options.requireCacheHit ?? true;
    this._server = options.withServer ?? false;
  }

  createBindCardRequest(
    payload: CTBCBindCardRequestPayload,
  ): CTBCBindCardRequest {
    const request = new CTBCBindCardRequest(payload, this);

    this.bindCardRequestsCache.set(payload.RequestNo, request);

    return request;
  }

  async prepare<N extends CTBCOrderCommitMessage>(
    input: InputFromOrderCommitMessage<N>,
  ): Promise<Order<N>> {
    const isCTBCOrderInput =
      typeof input === 'object' &&
      input !== null &&
      'id' in input &&
      'memberId' in input &&
      'cardToken' in input &&
      'totalPrice' in input &&
      typeof input.id === 'string' &&
      typeof input.memberId === 'string' &&
      typeof input.cardToken === 'string' &&
      typeof input.totalPrice === 'number';

    if (!isCTBCOrderInput) throw new Error('Invalid CTBCOrderInput');

    const orderInput = input as CTBCOrderInput;

    return new CTBCOrder(orderInput, this) as Order<N>;
  }

  async query<OO extends CTBCOrder>(id: string): Promise<OO> {
    throw new Error('Not implemented');
  }

  getBindingURL(): string {
    return `${this.baseUrl}/mFastPay/TxnServlet`;
  }

  async queryBoundCard(memberId: string): Promise<{ expireDate: Date }> {
    throw new Error('CTBCPayment.queryBoundCard not implemented');
  }

  handleBindCardCallback(rawPayload: string): void {
    const payload = decodeResponsePayload<CTBCBindCardCallbackPayload>(
      rawPayload,
      this.txnKey,
    );

    const requestNo = payload.RequestNo;

    if (this.requireCacheHit && !this.bindCardRequestsCache.has(requestNo)) {
      throw new Error(`Unknown bind card request: ${requestNo}`);
    }

    const cachedRequest = this.bindCardRequestsCache.get(requestNo);

    if (cachedRequest) {
      const original = cachedRequest.payload;
      const mismatches = ['MerID', 'MemberID', 'RequestNo'].filter(
        (field) =>
          original[field as keyof typeof original] !==
          payload[field as keyof typeof payload],
      );

      if (mismatches.length > 0) {
        console.warn(
          `[CTBC] Warning: Mismatched callback fields: ${mismatches.join(', ')}`,
        );
      }
    }

    const request =
      cachedRequest ??
      new CTBCBindCardRequest({ ...payload, TokenURL: '' }, this);

    if (payload.StatusCode === 'I0000') {
      request.bound(payload);
      this.emitter.emit(PaymentEvents.CARD_BOUND, request);
    } else {
      request.fail(payload.StatusCode, payload.StatusDesc, payload);
      this.emitter.emit(PaymentEvents.CARD_BINDING_FAILED, request);
    }

    if (this.requireCacheHit) {
      this.bindCardRequestsCache.delete(requestNo);
    }
  }

  createOrder(
    id: string,
    amount: number,
    memberId: string,
    cardToken: string,
  ): CTBCOrder {
    return new CTBCOrder({ id, totalPrice: amount, memberId, cardToken }, this);
  }
}
