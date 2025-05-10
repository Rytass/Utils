/* eslint-disable no-control-regex */
import {
  Channel,
  CreditCardAuthInfo,
  OrderState,
  PaymentEvents,
  PaymentGateway,
  VirtualAccountPaymentInfo,
  WebATMPaymentInfo,
} from '@rytass/payments';
import { EventEmitter } from 'events';
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
} from 'crypto';
import { DateTime } from 'luxon';
import debug from 'debug';
import ngrok from 'ngrok';
import { LRUCache } from 'lru-cache';
import { Server, IncomingMessage, ServerResponse, createServer } from 'http';
import { NewebPayOrder } from './newebpay-order';
import {
  AllowUILanguage,
  NewebPaymentChannel,
  NewebPayCommitMessage,
  NewebPayMPGMakeOrderEncryptedPayload,
  NewebPayMPGMakeOrderPayload,
  NewebPayOrderInput,
  NewebPayPaymentInitOptions,
  NewebPayNotifyPayload,
  NewebPayNotifyEncryptedPayload,
  NewebPayInfoRetrieveEncryptedPayload,
  NewebPayQueryRequestPayload,
  NewebPayAPIResponseWrapper,
  NewebPayQueryResponsePayload,
  NewebPayCreditCardBalanceStatus,
  NewebPayOrderFromServerInit,
  NewebPayCreditCardCancelRequestPayload,
  NewebPayCreditCardCancelEncryptedRequestPayload,
  NewebPayCreditCardCancelResponse,
  NewebPayCreditCardCloseEncryptedRequestPayload,
  NewebPayCreditCardCloseRequestPayload,
  NewebPayCreditCardCloseResponse,
  NewebPayOrderStatusFromAPI,
  OrdersCache,
} from './typings';
import {
  NewebPayAdditionInfoCreditCard,
  NewebPayCreditCardCommitMessage,
  NewebPayCreditCardOrderInput,
} from './typings/credit-card.typing';
import {
  NewebPayWebATMCommitMessage,
  NewebPayWebATMOrderInput,
} from './typings/webatm.typing';
import { NewebPayVirtualAccountCommitMessage } from './typings/virtual-account.typing';
import axios from 'axios';

const debugPayment = debug('Rytass:Payment:NewebPay');

export class NewebPayPayment<
  CM extends NewebPayCommitMessage = NewebPayCommitMessage,
> implements PaymentGateway<CM, NewebPayOrder<CM>>
{
  private readonly baseUrl: string;
  private readonly aesKey: string;
  private readonly aesIv: string;
  private readonly merchantId: string;
  private readonly language: AllowUILanguage;
  private serverHost: string;
  private readonly callbackPath: string;
  private readonly asyncInfoPath: string;
  private readonly checkoutPath: string;
  private readonly serverListener:
    | ((req: IncomingMessage, res: ServerResponse) => void)
    | undefined;
  private readonly pendingOrdersCache: OrdersCache<
    CM,
    string,
    NewebPayOrder<CM>
  >;
  private isGatewayReady = false;

  readonly _server?: Server;

  constructor(options: NewebPayPaymentInitOptions<NewebPayOrder<CM>>) {
    this.baseUrl = options?.baseUrl ?? 'https://ccore.newebpay.com';
    this.aesKey = options.aesKey;
    this.aesIv = options.aesIv;
    this.merchantId = options.merchantId;
    this.language = options?.language ?? AllowUILanguage.ZH_TW;
    this.serverHost = options?.serverHost ?? 'http://localhost:3000';
    this.callbackPath = options?.callbackPath ?? '/payments/newebpay/callback';
    this.asyncInfoPath =
      options?.asyncInfoPath ?? '/payments/newebpay/async-information';
    this.checkoutPath = options?.checkoutPath ?? '/payments/newebpay/checkout';

    if (options?.withServer) {
      this.serverListener =
        options?.serverListener ??
        ((req: IncomingMessage, res: ServerResponse) =>
          this.defaultServerListener(req, res));

      const url = new URL(this.serverHost);
      const port = Number(url.port || 3000);

      this._server = createServer((req, res) => this.serverListener!(req, res));

      this._server.listen(port, '0.0.0.0', async () => {
        if (options.withServer === 'ngrok') {
          try {
            const ngrokUrl = await ngrok.connect(port);

            this.serverHost = ngrokUrl;

            debugPayment(
              `ECPayment Callback Server Listen on port ${port} with ngrok url: ${ngrokUrl}`,
            );
          } catch (ex) {
            debugPayment(ex);
          }
        } else {
          debugPayment(`ECPayment Callback Server Listen on port ${port}`);
        }

        this.emitter.emit(PaymentEvents.SERVER_LISTENED);
      });
    } else {
      this.isGatewayReady = true;
    }

    if (typeof options?.onCommit === 'function') {
      this.emitter.on(PaymentEvents.ORDER_COMMITTED, options.onCommit);
    }

    this.emitter.on(PaymentEvents.SERVER_LISTENED, () => {
      this.isGatewayReady = true;
    });

    if (typeof options?.onServerListen === 'function') {
      this.emitter.on(PaymentEvents.SERVER_LISTENED, options.onServerListen);
    }

    const lruCache = options?.ordersCache
      ? undefined
      : new LRUCache<string, NewebPayOrder<CM>>({
          ttlAutopurge: true,
          ttl: options?.ttl ?? 10 * 60 * 1000, // default: 10 mins
        });

    this.pendingOrdersCache = options?.ordersCache ?? {
      get: async (key: string) => lruCache!.get(key),
      set: async (key: string, value: NewebPayOrder<CM>) => {
        lruCache!.set(key, value);
      },
    };
  }

  readonly emitter = new EventEmitter();

  get checkoutActionUrl(): string {
    return `${this.baseUrl}/MPG/mpg_gateway`;
  }

  getCheckoutUrl(order: NewebPayOrder<NewebPayCommitMessage>): string {
    return `${this.serverHost}${this.checkoutPath}/${order.id}`;
  }

  public async defaultServerListener(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const checkoutRe = new RegExp(`^${this.checkoutPath}/([^/]+)$`);

    if (req.method === 'GET' && req.url && checkoutRe.test(req.url)) {
      const orderId = RegExp.$1;

      if (orderId) {
        const order = await this.pendingOrdersCache.get(orderId);

        if (order) {
          debugPayment(`ECPayment serve checkout page for order ${orderId}`);

          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
          });

          res.end(order.formHTML);

          return;
        }
      }
    }

    if (
      !req.url ||
      req.method !== 'POST' ||
      !~[this.callbackPath, this.asyncInfoPath].indexOf(req.url)
    ) {
      res.writeHead(404);
      res.end();

      return;
    }

    const bufferArray = [] as Buffer[];

    req.on('data', (chunk) => {
      bufferArray.push(chunk);
    });

    req.on('end', async () => {
      const payloadString = Buffer.from(Buffer.concat(bufferArray)).toString(
        'utf8',
      );
      const payload = Array.from(
        new URLSearchParams(payloadString).entries(),
      ).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as NewebPayNotifyPayload;

      try {
        switch (req.url) {
          case this.callbackPath: {
            const resolvedData =
              await this.resolveEncryptedPayload<NewebPayNotifyEncryptedPayload>(
                payload.TradeInfo,
                payload.TradeSha,
              );
            const order = await this.pendingOrdersCache.get(
              resolvedData.MerchantOrderNo,
            );

            if (!order) {
              res.writeHead(404);
              res.end();

              return;
            }

            this.handlePaymentResult(order, resolvedData);
            break;
          }

          case this.asyncInfoPath: {
            const resolvedData =
              await this.resolveEncryptedPayload<NewebPayInfoRetrieveEncryptedPayload>(
                payload.TradeInfo,
                payload.TradeSha,
              );
            const order = await this.pendingOrdersCache.get(
              resolvedData.MerchantOrderNo,
            );

            if (!order) {
              res.writeHead(404);
              res.end();

              return;
            }

            this.handleAsyncInformation(order, resolvedData);
            break;
          }
        }

        res.writeHead(200);
        res.end();
      } catch (ex) {
        debugPayment(ex);

        res.writeHead(400);
        res.end('Checksum Invalid');
      }
    });
  }

  private handleAsyncInformation(
    order: NewebPayOrder<NewebPayCommitMessage>,
    payload: NewebPayInfoRetrieveEncryptedPayload,
  ) {
    if (order.state !== OrderState.PRE_COMMIT) return;

    switch (payload.PaymentType) {
      case 'VACC':
        order.infoRetrieved<NewebPayVirtualAccountCommitMessage>({
          channel: Channel.VIRTUAL_ACCOUNT,
          bankCode: payload.BankCode!,
          account: payload.CodeNo!,
          expiredAt: DateTime.fromFormat(
            `${payload.ExpireDate!} ${payload.ExpireTime!}`,
            'yyyy-MM-dd HH:mm:ss',
          ).toJSDate(),
        });

        break;
    }
  }

  private handlePaymentResult(
    order: NewebPayOrder<NewebPayCommitMessage>,
    payload: NewebPayNotifyEncryptedPayload,
  ) {
    if (
      !~[OrderState.PRE_COMMIT, OrderState.ASYNC_INFO_RETRIEVED].indexOf(
        order.state,
      )
    )
      return;

    switch (payload.PaymentType) {
      case 'WEBATM':
        order.commit<NewebPayWebATMCommitMessage>(
          {
            id: payload.MerchantOrderNo,
            totalPrice: payload.Amt,
            committedAt: DateTime.fromFormat(
              payload.PayTime,
              'yyyy-MM-dd HH:mm:ss',
            ).toJSDate(),
            platformTradeNumber: payload.TradeNo,
            channel: NewebPaymentChannel.WEBATM,
          },
          {
            channel: Channel.WEB_ATM,
            buyerBankCode: payload.PayBankCode,
            buyerAccountNumber: payload.PayerAccount5Code,
          } as WebATMPaymentInfo,
        );

        break;

      case 'VACC':
        order.commit<NewebPayVirtualAccountCommitMessage>(
          {
            id: payload.MerchantOrderNo,
            totalPrice: payload.Amt,
            committedAt: DateTime.fromFormat(
              payload.PayTime,
              'yyyy-MM-dd HH:mm:ss',
            ).toJSDate(),
            platformTradeNumber: payload.TradeNo,
            channel: NewebPaymentChannel.VACC,
          },
          {
            channel: Channel.VIRTUAL_ACCOUNT,
            buyerBankCode: payload.PayBankCode,
            buyerAccountNumber: payload.PayerAccount5Code,
          } as VirtualAccountPaymentInfo,
        );

        break;

      case 'CREDIT':
        order.commit<NewebPayCreditCardCommitMessage>(
          {
            id: payload.MerchantOrderNo,
            totalPrice: payload.Amt,
            committedAt: DateTime.fromFormat(
              payload.PayTime,
              'yyyy-MM-dd HH:mm:ss',
            ).toJSDate(),
            platformTradeNumber: payload.TradeNo,
            channel: NewebPaymentChannel.CREDIT,
          },
          {
            channel: Channel.CREDIT_CARD,
            processDate: DateTime.fromFormat(
              payload.PayTime,
              'yyyy-MM-dd HH:mm:ss',
            ).toJSDate(),
            authCode: payload.Auth!,
            amount: payload.Amt,
            eci: payload.ECI!,
            card4Number: payload.Card4No!,
            card6Number: payload.Card6No!,
            authBank: payload.AuthBank!,
            subChannel: payload.PaymentMethod,
            speedCheckoutMode: payload.TokenUseStatus,
            installments: payload.Inst
              ? {
                  count: payload.Inst,
                  firstAmount: payload.InstFirst,
                  eachAmount: payload.InstEach,
                }
              : undefined,
            dcc: payload.DCC_Amt
              ? {
                  amount: payload.DCC_Amt,
                  rate: payload.DCC_Rate,
                  markup: payload.DCC_Markup,
                  currency: payload.DCC_Currency,
                  currencyCode: payload.DCC_Currency_Code,
                }
              : undefined,
            bonusAmount: payload.RedAmt,
            closeBalance: payload.Amt,
            closeStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
            remainingBalance: payload.Amt,
            refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
          } as NewebPayAdditionInfoCreditCard,
        );

        break;
    }
  }

  private getOrderId() {
    return randomBytes(10).toString('hex');
  }

  private generatePayload<
    T extends Record<string, string | number | undefined> = Record<
      string,
      string | number | undefined
    >,
  >(payload: T): NewebPayMPGMakeOrderPayload {
    const params = Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(
        ([key, value]) =>
          `${key}=${encodeURIComponent(value as string | number)}`,
      )
      .join('&');

    const cipher = createCipheriv('aes-256-cbc', this.aesKey, this.aesIv);
    const encrypted = `${cipher.update(params, 'utf8', 'hex')}${cipher.final('hex')}`;

    return {
      MerchantID: this.merchantId,
      TradeInfo: encrypted,
      TradeSha: createHash('sha256')
        .update(`HashKey=${this.aesKey}&${encrypted}&HashIV=${this.aesIv}`)
        .digest('hex')
        .toUpperCase(),
      Version: '2.0',
      EncryptType: 0,
    };
  }

  private async resolveEncryptedPayload<
    T extends { MerchantOrderNo: string } = { MerchantOrderNo: string },
  >(encrypted: string, hash: string): Promise<T> {
    if (
      hash !==
      createHash('sha256')
        .update(`HashKey=${this.aesKey}&${encrypted}&HashIV=${this.aesIv}`)
        .digest('hex')
        .toUpperCase()
    ) {
      throw new Error('Invalid hash');
    }

    const decipher = createDecipheriv('aes-256-cbc', this.aesKey, this.aesIv);

    decipher.setAutoPadding(false);

    const plainInfo =
      `${decipher.update(encrypted, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(
        /[\u0000-\u001F\u007F-\u009F]/g,
        '',
      );

    try {
      const payload = JSON.parse(plainInfo) as NewebPayAPIResponseWrapper<T>;

      if (payload.Status === 'SUCCESS') return payload.Result;

      const order = await this.pendingOrdersCache.get(
        payload.Result.MerchantOrderNo,
      );

      if (order) {
        order.fail(payload.Status, payload.Message);

        return payload.Result;
      }

      throw new Error(payload.Message);
    } catch (ex) {
      debugPayment(ex);

      throw new Error('Invalid response format');
    }
  }

  async prepare<NCM extends CM = CM>(
    input: NewebPayOrderInput<NCM>,
  ): Promise<NewebPayOrder<NCM>> {
    if (!this.isGatewayReady) {
      throw new Error('Please waiting gateway ready');
    }

    if ('tradeLimit' in input && input.tradeLimit && input.tradeLimit < 60) {
      throw new Error('`tradeLimit` should between 60 and 900 (seconds)');
    }

    if ('tradeLimit' in input && input.tradeLimit && input.tradeLimit > 900) {
      throw new Error('`tradeLimit` should between 60 and 900 (seconds)');
    }

    if (
      'expireDate' in input &&
      input.expireDate &&
      !DateTime.fromFormat(input.expireDate, 'yyyyMMdd').isValid
    ) {
      throw new Error('`expireDate` should be in format of `YYYYMMDD`');
    }

    const now = Math.round(Date.now() / 1000);

    const id = this.getOrderId();

    const payload = {
      MerchantID: this.merchantId,
      RespondType: 'JSON',
      TimeStamp: now.toString(),
      Version: '2.0',
      LangType: input.language ?? this.language,
      MerchantOrderNo: input.id ?? id,
      Amt: input.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      ),
      ItemDesc: input.items
        .map((item) => item.name)
        .join(',')
        .substring(0, 50),
      TradeLimit: 'tradeLimit' in input ? (input.tradeLimit ?? 0) : 0,
      ExpireDate: 'expireDate' in input ? (input.expireDate ?? '') : '',
      ReturnURL: 'clientBackUrl' in input ? (input.clientBackUrl ?? '') : '',
      NotifyURL: `${this.serverHost}${this.callbackPath}`,
      CustomerURL: `${this.serverHost}${this.asyncInfoPath}`,
      ClientBackURL:
        'clientBackUrl' in input ? (input.clientBackUrl ?? '') : '',
      Email: 'email' in input ? (input.email ?? '') : '',
      EmailModify: 0,
      LoginType: 0,
      OrderComment: 'remark' in input ? (input.remark ?? '') : '',
      CREDIT:
        'channel' in input
          ? input.channel & NewebPaymentChannel.CREDIT
            ? 1
            : 0
          : 0,
      ANDROIDPAY:
        'channel' in input
          ? input.channel & NewebPaymentChannel.ANDROID_PAY
            ? 1
            : 0
          : 0,
      SAMSUNGPAY:
        'channel' in input
          ? input.channel & NewebPaymentChannel.SAMSUNG_PAY
            ? 1
            : 0
          : 0,
      InstFlag:
        ((input as NewebPayCreditCardOrderInput).installments ?? []).join(
          ',',
        ) || '',
      UNIONPAY:
        'channel' in input
          ? input.channel & NewebPaymentChannel.UNION_PAY
            ? 1
            : 0
          : 0,
      WEBATM:
        'channel' in input
          ? input.channel & NewebPaymentChannel.WEBATM
            ? 1
            : 0
          : 0,
      VACC:
        'channel' in input
          ? input.channel & NewebPaymentChannel.VACC
            ? 1
            : 0
          : 0,
      BankType:
        ((input as NewebPayWebATMOrderInput).bankTypes ?? []).join(',') || '',
    } as NewebPayMPGMakeOrderEncryptedPayload;

    const order = new NewebPayOrder({
      id: payload.MerchantOrderNo,
      items: input.items,
      makePayload:
        this.generatePayload<NewebPayMPGMakeOrderEncryptedPayload>(payload),
      gateway: this,
    });

    await this.pendingOrdersCache.set(order.id, order);

    return order;
  }

  async query<T extends NewebPayOrder<CM> = NewebPayOrder<CM>>(
    id: string,
    amount: number,
  ): Promise<T> {
    const now = Math.round(Date.now() / 1000);

    const payload = {
      MerchantID: this.merchantId,
      Version: '1.3',
      RespondType: 'JSON',
      TimeStamp: now.toString(),
      MerchantOrderNo: id,
      Amt: amount.toString(),
      Gateway: /^MS5/.test(this.merchantId) ? 'Composite' : '',
      CheckValue: createHash('sha256')
        .update(
          `IV=${this.aesIv}&Amt=${amount}&MerchantID=${this.merchantId}&MerchantOrderNo=${id}&Key=${this.aesKey}`,
        )
        .digest('hex')
        .toUpperCase(),
    } as NewebPayQueryRequestPayload;

    const { data } = await axios.post<
      NewebPayAPIResponseWrapper<NewebPayQueryResponsePayload>
    >(
      `${this.baseUrl}/API/QueryTradeInfo`,
      new URLSearchParams(payload).toString(),
    );

    const checkCode = createHash('sha256')
      .update(
        `HashIV=${this.aesIv}&Amt=${data.Result.Amt}&MerchantID=${data.Result.MerchantID}&MerchantOrderNo=${data.Result.MerchantOrderNo}&TradeNo=${data.Result.TradeNo}&HashKey=${this.aesKey}`,
      )
      .digest('hex')
      .toUpperCase();

    if (checkCode !== data.Result.CheckCode) {
      throw new Error('CheckCode is not valid');
    }

    const savedOrder = await this.pendingOrdersCache.get(
      data.Result.MerchantOrderNo,
    );

    const basicInfo = {
      id: data.Result.MerchantOrderNo,
      items: savedOrder?.items ?? [
        {
          name: '商品一批',
          unitPrice: data.Result.Amt,
          quantity: 1,
        },
      ],
      gateway: this,
      createdAt: DateTime.fromFormat(
        data.Result.CreateTime,
        'yyyy-MM-dd HH:mm:ss',
      ).toJSDate(),
      committedAt: data.Result.PayTime
        ? DateTime.fromFormat(
            data.Result.PayTime,
            'yyyy-MM-dd HH:mm:ss',
          ).toJSDate()
        : null,
      platformTradeNumber: data.Result.TradeNo,
      channel: ((paymentType) => {
        switch (paymentType) {
          case 'ANDROIDPAY':
            return NewebPaymentChannel.ANDROID_PAY;

          case 'SAMSUNGPAY':
            return NewebPaymentChannel.SAMSUNG_PAY;

          case 'UNIONPAY':
            return NewebPaymentChannel.UNION_PAY;

          case 'WEBATM':
            return NewebPaymentChannel.WEBATM;

          case 'VACC':
            return NewebPaymentChannel.VACC;

          case 'CREDIT':
          default:
            return NewebPaymentChannel.CREDIT;
        }
      })(data.Result.PaymentType),
      status: data.Result.TradeStatus,
    };

    if ('ECI' in data.Result) {
      return new NewebPayOrder<NewebPayCreditCardCommitMessage>(
        {
          ...(basicInfo as NewebPayOrderFromServerInit<NewebPayCreditCardCommitMessage>),
          status:
            data.Result.BackStatus === NewebPayCreditCardBalanceStatus.UNSETTLED
              ? data.Result.TradeStatus
              : NewebPayOrderStatusFromAPI.REFUNDED,
        },
        {
          channel: Channel.CREDIT_CARD,
          processDate: DateTime.fromFormat(
            data.Result.PayTime || data.Result.CreateTime,
            'yyyy-MM-dd HH:mm:ss',
          ).toJSDate(),
          authCode: data.Result.Auth,
          amount: data.Result.Amt,
          eci: data.Result.ECI,
          card4Number: data.Result.Card4No,
          card6Number: data.Result.Card6No,
          authBank: data.Result.AuthBank,
          subChannel: data.Result.PaymentMethod,
          installments: data.Result.Inst
            ? {
                count: data.Result.Inst,
                firstAmount: data.Result.InstFirst,
                eachAmount: data.Result.InstEach,
              }
            : undefined,
          closeStatus: data.Result.CloseStatus,
          closeBalance: Number(data.Result.CloseAmt),
          refundStatus: data.Result.BackStatus,
          remainingBalance: Number(data.Result.BackBalance),
        } as CreditCardAuthInfo,
      ) as T;
    }

    if ('PayInfo' in data.Result) {
      switch (data.Result.PaymentType) {
        case 'VACC':
        case 'WEBATM': {
          const [, buyerBankCode, buyerAccountNumber] =
            data.Result.PayInfo.match(/^\((\d+)\)(.+)$/) as [
              string,
              string,
              string,
            ];

          return new NewebPayOrder<NewebPayVirtualAccountCommitMessage>(
            {
              ...basicInfo,
              status: data.Result.OrderStatus,
            } as NewebPayOrderFromServerInit<NewebPayVirtualAccountCommitMessage>,
            {
              buyerBankCode,
              buyerAccountNumber,
            } as VirtualAccountPaymentInfo,
          ) as T;
        }

        // case 'BARCODE': {
        //   const barcodes = data.Result.PayInfo.split(/,/) as [string, string, string];
        // }

        // case 'CVS': {
        //
        // }
      }
    }

    return new NewebPayOrder(basicInfo) as T;
  }

  async cancel(
    order: NewebPayOrder<NewebPayCreditCardCommitMessage>,
  ): Promise<void> {
    if (
      (order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus !==
      NewebPayCreditCardBalanceStatus.UNSETTLED
    ) {
      throw new Error('Only unsettled order can be canceled');
    }

    const cipher = createCipheriv('aes-256-cbc', this.aesKey, this.aesIv);

    const encrypted = `${cipher.update(
      Object.entries({
        RespondType: 'JSON',
        Version: '1.0',
        Amt: order.totalPrice,
        MerchantOrderNo: order.id,
        IndexType: 1,
        TimeStamp: Math.round(Date.now() / 1000).toString(),
      } as NewebPayCreditCardCancelEncryptedRequestPayload)
        .filter(([, value]) => value !== undefined)
        .map(
          ([key, value]) =>
            `${key}=${encodeURIComponent(value as string | number)}`,
        )
        .join('&'),
      'utf8',
      'hex',
    )}${cipher.final('hex')}`;

    const payload = {
      MerchantID_: this.merchantId,
      PostData_: encrypted,
    } as NewebPayCreditCardCancelRequestPayload;

    const { data } = await axios.post<
      NewebPayAPIResponseWrapper<NewebPayCreditCardCancelResponse>
    >(
      `${this.baseUrl}/API/CreditCard/Cancel`,
      new URLSearchParams(payload).toString(),
    );

    if (data.Status !== 'SUCCESS') {
      debugPayment(data.Message);

      throw new Error('Cancel order failed');
    }

    const validCode = createHash('sha256')
      .update(
        `HashIV=${this.aesIv}&Amt=${order.totalPrice}&MerchantID=${this.merchantId}&MerchantOrderNo=${order.id}&TradeNo=${data.Result.TradeNo}&HashKey=${this.aesKey}`,
      )
      .digest('hex')
      .toUpperCase();

    if (validCode !== data.Result.CheckCode)
      throw new Error('Invalid check code');
  }

  async settle(
    order: NewebPayOrder<NewebPayCreditCardCommitMessage>,
  ): Promise<void> {
    if (
      (order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus !==
      NewebPayCreditCardBalanceStatus.UNSETTLED
    ) {
      throw new Error('Only unsettled order can be canceled');
    }

    const cipher = createCipheriv('aes-256-cbc', this.aesKey, this.aesIv);

    const encrypted = `${cipher.update(
      Object.entries({
        RespondType: 'JSON',
        Version: '1.0',
        Amt: order.totalPrice,
        MerchantOrderNo: order.id,
        IndexType: 1,
        TimeStamp: Math.round(Date.now() / 1000).toString(),
        CloseType: 1,
      } as NewebPayCreditCardCloseEncryptedRequestPayload)
        .filter(([, value]) => value !== undefined)
        .map(
          ([key, value]) =>
            `${key}=${encodeURIComponent(value as string | number)}`,
        )
        .join('&'),
      'utf8',
      'hex',
    )}${cipher.final('hex')}`;

    const payload = {
      MerchantID_: this.merchantId,
      PostData_: encrypted,
    } as NewebPayCreditCardCloseRequestPayload;

    const { data } = await axios.post<
      NewebPayAPIResponseWrapper<NewebPayCreditCardCloseResponse>
    >(
      `${this.baseUrl}/API/CreditCard/Close`,
      new URLSearchParams(payload).toString(),
    );

    if (data.Status !== 'SUCCESS') {
      debugPayment(data.Message);

      throw new Error('Settle order failed');
    }
  }

  async unsettle(
    order: NewebPayOrder<NewebPayCreditCardCommitMessage>,
  ): Promise<void> {
    if (
      (order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus !==
      NewebPayCreditCardBalanceStatus.WAITING
    ) {
      throw new Error('Only waiting order can be unsettle');
    }

    const cipher = createCipheriv('aes-256-cbc', this.aesKey, this.aesIv);

    const encrypted = `${cipher.update(
      Object.entries({
        RespondType: 'JSON',
        Version: '1.0',
        Amt: order.totalPrice,
        MerchantOrderNo: order.id,
        IndexType: 1,
        TimeStamp: Math.round(Date.now() / 1000).toString(),
        CloseType: 1,
        Cancel: 1,
      } as NewebPayCreditCardCloseEncryptedRequestPayload)
        .filter(([, value]) => value !== undefined)
        .map(
          ([key, value]) =>
            `${key}=${encodeURIComponent(value as string | number)}`,
        )
        .join('&'),
      'utf8',
      'hex',
    )}${cipher.final('hex')}`;

    const payload = {
      MerchantID_: this.merchantId,
      PostData_: encrypted,
    } as NewebPayCreditCardCloseRequestPayload;

    const { data } = await axios.post<
      NewebPayAPIResponseWrapper<NewebPayCreditCardCloseResponse>
    >(
      `${this.baseUrl}/API/CreditCard/Close`,
      new URLSearchParams(payload).toString(),
    );

    if (data.Status !== 'SUCCESS') {
      debugPayment(data.Message);

      throw new Error('Unsettle order failed');
    }
  }

  async refund(
    order: NewebPayOrder<NewebPayCreditCardCommitMessage>,
  ): Promise<void> {
    if (
      !~[
        NewebPayCreditCardBalanceStatus.WORKING,
        NewebPayCreditCardBalanceStatus.SETTLED,
      ].indexOf(
        (order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus,
      )
    ) {
      throw new Error('Only working/settled order can be refunded');
    }

    if (
      (order.additionalInfo as NewebPayAdditionInfoCreditCard).refundStatus !==
      NewebPayCreditCardBalanceStatus.UNSETTLED
    ) {
      throw new Error('Order refunding.');
    }

    const cipher = createCipheriv('aes-256-cbc', this.aesKey, this.aesIv);

    const encrypted = `${cipher.update(
      Object.entries({
        RespondType: 'JSON',
        Version: '1.0',
        Amt: order.totalPrice,
        MerchantOrderNo: order.id,
        IndexType: 1,
        TimeStamp: Math.round(Date.now() / 1000).toString(),
        CloseType: 2,
      } as NewebPayCreditCardCloseEncryptedRequestPayload)
        .filter(([, value]) => value !== undefined)
        .map(
          ([key, value]) =>
            `${key}=${encodeURIComponent(value as string | number)}`,
        )
        .join('&'),
      'utf8',
      'hex',
    )}${cipher.final('hex')}`;

    const payload = {
      MerchantID_: this.merchantId,
      PostData_: encrypted,
    } as NewebPayCreditCardCloseRequestPayload;

    const { data } = await axios.post<
      NewebPayAPIResponseWrapper<NewebPayCreditCardCloseResponse>
    >(
      `${this.baseUrl}/API/CreditCard/Close`,
      new URLSearchParams(payload).toString(),
    );

    if (data.Status !== 'SUCCESS') {
      debugPayment(data.Message);

      throw new Error('Refund order failed');
    }
  }

  async cancelRefund(
    order: NewebPayOrder<NewebPayCreditCardCommitMessage>,
  ): Promise<void> {
    if (
      (order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus !==
      NewebPayCreditCardBalanceStatus.SETTLED
    ) {
      throw new Error('Only settled order can be cancel refund');
    }

    if (
      (order.additionalInfo as NewebPayAdditionInfoCreditCard).refundStatus !==
      NewebPayCreditCardBalanceStatus.WAITING
    ) {
      throw new Error('Order not refunding.');
    }

    if (order.state !== OrderState.REFUNDED) {
      throw new Error('Only refunded order can be cancel refund');
    }

    const cipher = createCipheriv('aes-256-cbc', this.aesKey, this.aesIv);

    const encrypted = `${cipher.update(
      Object.entries({
        RespondType: 'JSON',
        Version: '1.0',
        Amt: order.totalPrice,
        MerchantOrderNo: order.id,
        IndexType: 1,
        TimeStamp: Math.round(Date.now() / 1000).toString(),
        CloseType: 2,
        Cancel: 1,
      } as NewebPayCreditCardCloseEncryptedRequestPayload)
        .filter(([, value]) => value !== undefined)
        .map(
          ([key, value]) =>
            `${key}=${encodeURIComponent(value as string | number)}`,
        )
        .join('&'),
      'utf8',
      'hex',
    )}${cipher.final('hex')}`;

    const payload = {
      MerchantID_: this.merchantId,
      PostData_: encrypted,
    } as NewebPayCreditCardCloseRequestPayload;

    const { data } = await axios.post<
      NewebPayAPIResponseWrapper<NewebPayCreditCardCloseResponse>
    >(
      `${this.baseUrl}/API/CreditCard/Close`,
      new URLSearchParams(payload).toString(),
    );

    if (data.Status !== 'SUCCESS') {
      debugPayment(data.Message);

      throw new Error('Refund order failed');
    }
  }
}
