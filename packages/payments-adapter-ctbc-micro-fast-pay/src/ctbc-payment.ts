import { PaymentEvents } from '@rytass/payments';
import EventEmitter from 'node:events';
import { CTBCBindCardRequest } from './ctbc-bind-card-request';
import { CTBCOrder } from './ctbc-order';
import {
  decodeResponsePayload,
  toStringRecord,
  validateResponseMAC,
} from './ctbc-response';
import {
  BindCardGatewayLike,
  CTBCBindCardCallbackPayload,
  CTBCBindCardRequestPayload,
  CTBCMicroFastPayOptions,
} from './typings';

export class CTBCPayment implements BindCardGatewayLike {
  readonly merchantId: string;
  readonly txnKey: string;
  readonly baseUrl: string;
  readonly endpoint: string;
  readonly _server: boolean;
  readonly emitter: EventEmitter;

  readonly bindCardRequestsCache = new Map<string, CTBCBindCardRequest>();

  constructor(options: CTBCMicroFastPayOptions) {
    this.merchantId = options.merchantId;
    this.txnKey = options.txnKey;
    this.baseUrl = options.baseUrl ?? 'https://ccapi.ctbcbank.com';
    this.endpoint = `${this.baseUrl}/MicroPayExt/TokenAdd`;
    this._server = options.withServer ?? false;
    this.emitter = new EventEmitter();
  }

  createBindCardRequest(
    payload: CTBCBindCardRequestPayload,
  ): CTBCBindCardRequest {
    return new CTBCBindCardRequest(payload, this);
  }

  getBindingURL(_: CTBCBindCardRequest): string {
    return `${this.baseUrl}/MicroPayExt/TokenAdd`;
  }

  async queryBoundCard(_memberId: string): Promise<{ expireDate: Date }> {
    throw new Error('CTBCPayment.queryBoundCard not implemented');
  }

  handleBindCardCallback(rspjsonpwd: string): void {
    const payload = decodeResponsePayload<CTBCBindCardCallbackPayload>(
      rspjsonpwd,
      this.txnKey,
    );

    if (!validateResponseMAC(toStringRecord(payload), this.txnKey)) {
      throw new Error('MAC validation failed');
    }

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
    return new CTBCOrder(id, amount, memberId, cardToken, this);
  }
}
