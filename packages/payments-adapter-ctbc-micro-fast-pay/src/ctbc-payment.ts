import {
  BindCardGatewayLike,
  CTBCBindCardCallbackPayload,
  CTBCBindCardRequestPayload,
  CTBCOrderCommitMessage,
  CTBCOrderInput,
} from './typings';
import EventEmitter from 'node:events';
import { CTBCOrder } from './ctbc-order';
import {
  InputFromOrderCommitMessage,
  Order,
  PaymentEvents,
  PaymentGateway,
} from '@rytass/payments';
import { CTBCBindCardRequest } from './ctbc-bind-card-request';
import {
  decodeResponsePayload,
  toStringRecord,
  validateResponseMAC,
} from './ctbc-response';

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
  readonly emitter = new EventEmitter();
  readonly _server: boolean;

  readonly bindCardRequestsCache = new Map<string, CTBCBindCardRequest>();

  constructor(options: {
    merchantId: string;
    merId: string;
    txnKey: string;
    baseUrl?: string;
    withServer?: boolean;
  }) {
    this.merchantId = options.merchantId;
    this.merId = options.merId;
    this.txnKey = options.txnKey;
    this.baseUrl = options.baseUrl ?? 'https://ccapi.ctbcbank.com';
    this.endpoint = `${this.baseUrl}/mFastPay/TxnServlet`;
    this._server = options.withServer ?? false;
  }

  createBindCardRequest(
    payload: CTBCBindCardRequestPayload,
  ): CTBCBindCardRequest {
    return new CTBCBindCardRequest(payload, this);
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

    if (!this.bindCardRequestsCache.has(requestNo)) {
      throw new Error(`Unknown bind card request: ${requestNo}`);
    }

    const request = this.bindCardRequestsCache.get(requestNo)!;

    if (payload.StatusCode === '00') {
      request.bound(payload);
    } else {
      request.fail(payload.StatusCode, payload.StatusDesc, payload);
    }

    this.bindCardRequestsCache.delete(requestNo);
    this.emitter.emit(PaymentEvents.CARD_BOUND, request);
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
