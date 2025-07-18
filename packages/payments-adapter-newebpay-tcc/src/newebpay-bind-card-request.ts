/**
 * NewebPayBindCardRequest
 * --------------------------------------------------
 * 封裝「首次約定付款 (P1) 綁卡流程」之 Request 物件。
 * 產生提交表單 (TradeInfo/TradeSha) 與 HTML，並追蹤綁卡狀態。
 *
 * ⚠️ 僅聚焦流程本身；Gateway (NewebPayPayment) 將負責
 * - 提供 encode Key/IV
 * - 監聽伺服器並回呼 bound() / fail()
 */

import { PaymentEvents } from '@rytass/payments';
import { DateTime } from 'luxon';
import { buildTradeInfo, EncodeOptions } from './newebpay-crypto';
import { NewebPayBindCardRequestPayload, NewebPayBindCardRequestState, NewebPayBindCardResult, TradeInfoResult } from './typings';
import { EventEmitter } from 'node:events';

export class NewebPayBindCardRequest {
  /* raw P1 payload (ASCII→AES 前) */
  private readonly _payload: NewebPayBindCardRequestPayload;

  /* gateway 資訊 (僅用於 baseUrl 與 encode key/iv、事件派送) */
  private readonly _encodeOpts: EncodeOptions;
  private readonly _emitter: EventEmitter;
  private readonly _mpgEndpoint: string;

  /* state tracking */
  private _resolved = false;
  private _state = NewebPayBindCardRequestState.INITED;

  /* after bound */
  private _tokenValue?: string;
  private _card6?: string;
  private _card4?: string;
  private _bindingDate?: Date;
  private _failedCode?: string;
  private _failedMsg?: string;

  constructor(
    payload: NewebPayBindCardRequestPayload,
    encodeOpts: EncodeOptions,
    emitter: EventEmitter,
    mpgEndpoint = 'https://ccore.newebpay.com/MPG/mpg_gateway',
  ) {
    this._payload = payload;
    this._encodeOpts = encodeOpts;
    this._emitter = emitter;
    this._mpgEndpoint = mpgEndpoint;
  }

  /* ------------------------------------------------------------------ */
  /* Basic getters */
  /* ------------------------------------------------------------------ */

  get tokenValue(): string | undefined {
    return this._tokenValue;
  }
  get cardNumberPrefix(): string | undefined {
    return this._card6;
  }
  get cardNumberSuffix(): string | undefined {
    return this._card4;
  }
  get bindingDate(): Date | undefined {
    return this._bindingDate;
  }
  get state(): NewebPayBindCardRequestState {
    return this._state;
  }
  get failedMessage():
    | { code: string; message: string }
    | null {
    if (!this._failedCode) return null;

    return { code: this._failedCode, message: this._failedMsg! };
  }

  /* ------------------------------------------------------------------ */
  /* Form & HTML */
  /* ------------------------------------------------------------------ */

  /** 回傳提交綁卡用的表單欄位 (P1 前台) */
  get form(): Record<string, string | number> {
    if (this._state !== NewebPayBindCardRequestState.INITED)
      throw new Error('Form already generated');

    const { TradeInfo, TradeSha, EncryptType } = buildTradeInfo(
      this._payload,
      this._encodeOpts,
    );

    this._state = NewebPayBindCardRequestState.FORM_GENERATED;

    const baseFields: TradeInfoResult = {
      TradeInfo,
      TradeSha,
      EncryptType,
    };

    return {
      MerchantID: this._payload.MerchantID,
      Version: this._payload.Version,
      RespondType: this._payload.RespondType,
      ...baseFields,
    };
  }

  /** 產生自動 submit 的 HTML (方便後端返回前端直接跳轉) */
  get formHTML(): string {
    const formFields = this.form;

    const inputs = Object.entries(formFields)
      .map(
        ([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`,
      )
      .join('\n      ');

    return `<!DOCTYPE html>
<html>
  <body onload="document.forms[0].submit();">
    <form action="${this._mpgEndpoint}" method="post">
      ${inputs}
    </form>
  </body>
</html>`;
  }

  /* ------------------------------------------------------------------ */
  /* Callback handlers – called by Gateway */
  /* ------------------------------------------------------------------ */

  /**
   * 處理綁卡成功
   */
  bound(result: NewebPayBindCardResult): void {
    this._tokenValue = result.TokenValue;
    this._card6 = result.Card6No;
    this._card4 = result.Card4No;
    this._bindingDate = DateTime.fromFormat(
      result.PayTime,
      'yyyy-MM-dd HH:mm:ss',
    ).toJSDate();

    this._state = NewebPayBindCardRequestState.BOUND;

    this._emitter.emit(PaymentEvents.CARD_BOUND, this);
  }

  /**
   * 處理綁卡失敗
   */
  fail(code: string, message: string, maybeResult?: Partial<NewebPayBindCardResult>): void {
    this._failedCode = code;
    this._failedMsg = message;
    this._state = NewebPayBindCardRequestState.FAILED;

    if (maybeResult?.TokenValue) this._tokenValue = maybeResult.TokenValue;
    if (maybeResult?.Card6No) this._card6 = maybeResult.Card6No;
    if (maybeResult?.Card4No) this._card4 = maybeResult.Card4No;

    this._emitter.emit(PaymentEvents.CARD_BINDING_FAILED, this);
  }
}
