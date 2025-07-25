/**
 * NewebPayBindCardRequest
 * --------------------------------------------------
 * Encapsulates the request object for the "Initial Tokenized Payment (P1)" bind card flow.
 * Generates submission form data (TradeInfo/TradeSha) and HTML, and tracks bind status.
 *
 * Focuses solely on the client-side binding flow. The Gateway (NewebPayPayment) is responsible for:
 * - Providing encryption Key/IV for encoding
 * - Listening for server-side callback and invoking bound() / fail()
 */

import { PaymentEvents } from '@rytass/payments';
import { DateTime } from 'luxon';
import { buildTradeInfo } from './newebpay-crypto';
import {
  EncodeOptions,
  NewebPayBindCardRequestPayload,
  NewebPayBindCardRequestState,
  NewebPayBindCardResult,
  TradeInfoResult,
} from './typings';
import { EventEmitter } from 'node:events';

export class NewebPayBindCardRequest {
  /* Raw P1 payload (before ASCII sort and AES encryption) */
  private readonly _payload: NewebPayBindCardRequestPayload;

  /* Gateway context (used only for baseUrl, encryption key/iv, and event dispatching) */
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
  get failedMessage(): { code: string; message: string } | null {
    if (!this._failedCode) return null;

    return { code: this._failedCode, message: this._failedMsg! };
  }

  /** Returns the form fields for submitting a bind card request (P1 frontend) */
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

  /** Generates auto-submitting HTML (useful for backend to redirect to frontend) */
  get formHTML(): string {
    const formFields = this.form;

    const inputs = Object.entries(formFields)
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`)
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

  /**
   * Handles bind card success
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
   * Handles bind card failure
   */
  fail(
    code: string,
    message: string,
    maybeResult?: Partial<NewebPayBindCardResult>,
  ): void {
    this._failedCode = code;
    this._failedMsg = message;
    this._state = NewebPayBindCardRequestState.FAILED;

    if (maybeResult?.TokenValue) this._tokenValue = maybeResult.TokenValue;
    if (maybeResult?.Card6No) this._card6 = maybeResult.Card6No;
    if (maybeResult?.Card4No) this._card4 = maybeResult.Card4No;

    this._emitter.emit(PaymentEvents.CARD_BINDING_FAILED, this);
  }
}
