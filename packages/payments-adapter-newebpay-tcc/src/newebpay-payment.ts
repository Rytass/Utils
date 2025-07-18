import { PaymentEvents } from '@rytass/payments';
import { EventEmitter } from 'node:events';
import { NewebPayBindCardRequest } from './newebpay-bind-card-request';
import { decodePayload, EncodeOptions, encodePayload } from './newebpay-crypto';
import { NewebPayOrder } from './newebpay-order';
import {
  HttpResponse,
  NewebPayBindCardRequestInput,
  NewebPayBindCardRequestPayload,
  NewebPayBindCardRequestState,
  NewebPayBindCardResult,
  NewebPayOrderInput,
  NewebPayPaymentOptions,
  QueryBindCardResult,
  UnbindCardResult,
} from './typings';

export class NewebPayPayment {
  readonly _emitter = new EventEmitter();

  readonly merchantId: string;
  readonly key: string;
  readonly iv: string;
  readonly encryptType: 0 | 1;
  readonly baseUrl: string;

  readonly _bindCardCache = new Map<string, NewebPayBindCardRequest>();

  constructor(options: NewebPayPaymentOptions) {
    this.merchantId = options.merchantId;
    this.key = options.aesKey;
    this.iv = options.aesIv;
    this.encryptType = options.encryptType ?? 0;
    this.baseUrl = options.baseUrl ?? 'https://ccore.newebpay.com';
  }

  createOrder(input: NewebPayOrderInput): NewebPayOrder {
    return new NewebPayOrder(input, this);
  }

  /* ------------------------------------------------------------------ */
  /* Common helpers                                                      */
  /* ------------------------------------------------------------------ */

  get encodeOpts(): EncodeOptions {
    return { key: this.key, iv: this.iv, encryptType: this.encryptType };
  }

  private async postForm<T = any>(
    path: string,
    form: Record<string, string>,
  ): Promise<HttpResponse<T>> {
    const url = `${this.baseUrl}${path}`;

    const body = new URLSearchParams();

    Object.entries(form).forEach(([k, v]) => body.append(k, v));

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const json = (await resp.json()) as HttpResponse<T>;

    return json;
  }

  /**
   * 建立 NewebPayBindCardRequest 物件，產生表單提交資料
   */
  createBindCardRequest(
    payload: NewebPayBindCardRequestInput,
  ): NewebPayBindCardRequest {
    const normalized: NewebPayBindCardRequestPayload = {
      MerchantID: this.merchantId,
      RespondType: payload.RespondType ?? 'JSON',
      Version: payload.Version ?? '2.1',
      TimeStamp: payload.TimeStamp ?? Math.floor(Date.now() / 1000),
      MerchantOrderNo: payload.MerchantOrderNo,
      Amt: payload.Amt,
      ItemDesc: payload.ItemDesc,
      CREDITAGREEMENT: payload.CREDITAGREEMENT,
      TokenTerm: payload.TokenTerm,
      ...(payload.ReturnURL && { ReturnURL: payload.ReturnURL }),
      ...(payload.NotifyURL && { NotifyURL: payload.NotifyURL }),
      ...(payload.ClientBackURL && { ClientBackURL: payload.ClientBackURL }),
      ...(payload.Email && { Email: payload.Email }),
      ...(payload.EmailModify !== undefined && {
        EmailModify: payload.EmailModify,
      }),
      ...(payload.TokenLife && { TokenLife: payload.TokenLife }),
      ...(payload.UseFor !== undefined && { UseFor: payload.UseFor }),
      ...(payload.MobileVerify !== undefined && {
        MobileVerify: payload.MobileVerify,
      }),
      ...(payload.MobileNumber && { MobileNumber: payload.MobileNumber }),
      ...(payload.MobileNumberModify !== undefined && {
        MobileNumberModify: payload.MobileNumberModify,
      }),
    };

    const request = new NewebPayBindCardRequest(
      normalized,
      this.encodeOpts,
      this._emitter,
    );

    this._bindCardCache.set(normalized.TokenTerm, request);

    return request;
  }

  /**
   * 接收 NotifyURL 回傳資料（P1 callback），並觸發綁卡成功或失敗事件
   */
  handleBindCardCallback(tradeInfo: string, tradeSha: string): void {
    const raw = decodePayload(tradeInfo, tradeSha, this.encodeOpts);

    const status = raw['Status'];
    const message = raw['Message'];
    const tokenTerm = raw['TokenTerm'];

    const result: NewebPayBindCardResult = {
      TokenTerm: raw['TokenTerm'],
      TokenValue: raw['TokenValue'],
      MerchantOrderNo: raw['MerchantOrderNo'],
      Card6No: raw['Card6No'],
      Card4No: raw['Card4No'],
      PayTime: raw['PayTime'],
    };

    const request = this._bindCardCache.get(tokenTerm);

    if (
      !request ||
      request.state !== NewebPayBindCardRequestState.FORM_GENERATED
    ) {
      throw new Error('No bind-card request found for this TokenTerm');
    }

    if (status === 'SUCCESS') {
      request.bound(result);
    } else {
      request.fail(status, message, result);
    }
  }

  /* ------------------------------------------------------------------ */
  /* NPA-B103 Query Token                                               */
  /* ------------------------------------------------------------------ */

  async queryBindCard(
    tokenTerm: string,
    tokenValue: string,
  ): Promise<HttpResponse<QueryBindCardResult>> {
    const payload = {
      MerchantID: this.merchantId,
      TimeStamp: Math.floor(Date.now() / 1000),
      TokenTerm: tokenTerm,
      TokenValue: tokenValue,
    };

    const { encrypted: EncryptData, hash: HashData } = encodePayload(
      payload,
      this.encodeOpts,
    );

    const res = await this.postForm('/API/TokenCard/query', {
      UID_: this.merchantId,
      EncryptData_: EncryptData,
      HashData_: HashData,
      Version_: '1.0',
      RespondType_: 'JSON',
    });

    return res;
  }

  /* ------------------------------------------------------------------ */
  /* NPA-B104 Unbind Token                                              */
  /* ------------------------------------------------------------------ */

  async unbindCard(
    tokenTerm: string,
    tokenValue: string,
  ): Promise<HttpResponse<UnbindCardResult>> {
    const payload = {
      MerchantID: this.merchantId,
      TimeStamp: Math.floor(Date.now() / 1000),
      TokenTerm: tokenTerm,
      TokenValue: tokenValue,
    };

    const { encrypted: EncryptData, hash: HashData } = encodePayload(
      payload,
      this.encodeOpts,
    );

    const res = await this.postForm('/API/TokenCard/unbinding', {
      UID_: this.merchantId,
      EncryptData_: EncryptData,
      HashData_: HashData,
      Version_: '1.0',
      RespondType_: 'JSON',
    });

    if (res.Status === 'SUCCESS') {
      this._emitter.emit(PaymentEvents.CARD_BINDING_FAILED, {
        tokenTerm,
        tokenValue,
      });
    }

    return res;
  }
}
