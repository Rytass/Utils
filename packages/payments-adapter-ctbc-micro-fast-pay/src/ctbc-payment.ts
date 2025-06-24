import { EventEmitter } from 'node:events';
import { CTBCBindCardRequest } from './ctbc-bind-card-request';
import {
  CTBCBindCardCallbackPayload,
  CTBCBindCardRequestPayload,
} from './typings';
import { parseRspjsonpwd, validateRspjsonpwdMAC } from './ctbc-response';

export interface BindCardGatewayLike {
  baseUrl: string;
  emitter: EventEmitter;
  getBindingURL(request: any): string;
  queryBoundCard(memberId: string): Promise<{ expireDate: Date }>;
}

export interface CTBCMicroFastPayOptions {
  merchantId: string;
  txnKey: string;
  baseUrl?: string;
  withServer?: boolean;
}

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
    if (!validateRspjsonpwdMAC(rspjsonpwd, this.txnKey)) {
      throw new Error('MAC validation failed');
    }

    const payload = parseRspjsonpwd(
      rspjsonpwd,
      this.txnKey,
    ) as unknown as CTBCBindCardCallbackPayload;

    const requestNo = payload.RequestNo;

    if (!requestNo || !this.bindCardRequestsCache.has(requestNo)) {
      throw new Error(`Unknown bind card request: ${requestNo}`);
    }

    const request = this.bindCardRequestsCache.get(requestNo)!;

    if (payload.StatusCode === '00') {
      request.bound(payload);
    } else {
      request.fail(payload.StatusCode, payload.StatusDesc, payload);
    }

    // Optionally: clear cache
    this.bindCardRequestsCache.delete(requestNo);
  }
}
