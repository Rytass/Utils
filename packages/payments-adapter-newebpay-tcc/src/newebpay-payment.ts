/**
 * NewebPayPayment (Gateway)
 * --------------------------------------------------
 * Entry point for NewebPay Tokenized Credit Card (TCC) integration.
 *
 * Provides a unified interface to handle:
 *   - Initial card binding (P1 / NPA-B101)
 *   - Subsequent token-based payments (Pn / NPA-B102)
 *   - Token status query (NPA-B103)
 *   - Token unbinding (NPA-B104)
 *
 * Core features:
 *   - AES encryption + SHA-256 signature (CBC or GCM)
 *   - Form generator for P1 HTML submission
 *   - Callback handling for bind success/failure
 *   - Event-driven architecture via EventEmitter
 *
 * Exposes methods:
 *   - createBindCardRequest()
 *   - handleBindCardCallback()
 *   - createOrder()
 *   - queryBindCard()
 *   - unbindCard()
 *
 * Emits PaymentEvents such as:
 *   - CARD_BOUND / CARD_BINDING_FAILED
 *   - ORDER_COMMITTED / ORDER_FAILED
 */

import {
  InputFromOrderCommitMessage,
  Order,
  PaymentEvents,
  PaymentGateway,
} from '@rytass/payments';
import { EventEmitter } from 'node:events';
import { NewebPayBindCardRequest } from './newebpay-bind-card-request';
import { decodePayload, encodePayload } from './newebpay-crypto';
import { NewebPayOrder } from './newebpay-order';
import {
  EncodeOptions,
  HttpResponse,
  NewebPayBindCardRequestInput,
  NewebPayBindCardRequestPayload,
  NewebPayBindCardRequestState,
  NewebPayBindCardResult,
  NewebPayOrderCommitMessage,
  NewebPayOrderInput,
  NewebPayPaymentOptions,
  QueryBindCardResult,
  UnbindCardResult,
} from './typings';

export class NewebPayPayment
  implements PaymentGateway<NewebPayOrderCommitMessage, NewebPayOrder>
{
  readonly merchantId: string;
  readonly key: string;
  readonly iv: string;
  readonly encryptType: 0 | 1;
  readonly baseUrl: string;

  readonly emitter = new EventEmitter();
  readonly bindCardRequestsCache = new Map<string, NewebPayBindCardRequest>();

  constructor(options: NewebPayPaymentOptions) {
    this.merchantId = options.merchantId;
    this.key = options.aesKey;
    this.iv = options.aesIv;
    this.encryptType = options.encryptType ?? 0;
    this.baseUrl = options.baseUrl ?? 'https://ccore.newebpay.com';
  }

  async prepare<N extends NewebPayOrderCommitMessage>(
    input: InputFromOrderCommitMessage<N>,
  ): Promise<Order<N>> {
    throw new Error('NewebPayPayment.prepare() not implemented');
  }

  async query<OO extends NewebPayOrder>(id: string): Promise<OO> {
    throw new Error('NewebPayPayment.query() not implemented');
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

  /* ------------------------------------------------------------------ */
  /* P1 Bind Card Flow                                                  */
  /* ------------------------------------------------------------------ */

  /**
   * Create a NewebPayBindCardRequest instance to generate form submission data.
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
      this.emitter,
    );

    this.bindCardRequestsCache.set(normalized.TokenTerm, request);

    return request;
  }

  /**
   * Handle data returned from the NotifyURL (P1 callback) and emit success or failure events for card binding.
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

    const request = this.bindCardRequestsCache.get(tokenTerm);

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
      this.emitter.emit(PaymentEvents.CARD_BINDING_FAILED, {
        tokenTerm,
        tokenValue,
      });
    }

    return res;
  }
}
