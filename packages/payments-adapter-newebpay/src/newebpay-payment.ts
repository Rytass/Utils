/* eslint-disable no-control-regex */
import { AdditionalInfo, Channel, CreditCardAuthInfo, OrderCommitMessage, OrderState, PaymentEvents, PaymentGateway, VistualAccountPaymentInfo } from '@rytass/payments';
import { EventEmitter } from 'events';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import { DateTime } from 'luxon';
import debug from 'debug';
import ngrok from 'ngrok';
import LRUCache from 'lru-cache';
import { Server, IncomingMessage, ServerResponse, createServer } from 'http';
import { NewebPayOrder } from './newebpay-order';
import { AllowUILanguage, NewebPaymentChannel, NewebPayCommitMessage, NewebPayMPGMakeOrderEncryptedPayload, NewebPayMPGMakeOrderPayload, NewebPayOrderInput, NewebPayPaymentInitOptions, NewebPayNotifyPayload, NewebPayNotifyEncryptedPayload, NewebPayInfoRetriveEncryptedPayload, NewebPayQueryRequestPayload, NewebPayAPIResponseWrapper, NewebPayQueryResponsePayload, NewebPayCreditCardBalanceStatus, NewebPayCreditCardSpeedCheckoutMode, NewebPayOrderFromServerInit, NewebPayCreditCardCancelRequestPayload, NewebPayCreditCardCancelEncryptedRequestPayload, NewebPayCreditCardCancelResponse, NewebPayCreditCardCloseEncryptedRequestPayload, NewebPayCreditCardCloseRequestPayload, NewebPayCreditCardCloseResponse } from './typings';
import { NewebPayAdditionInfoCreditCard, NewebPayCreditCardCommitMessage, NewebPayCreditCardOrderInput } from './typings/credit-card.typing';
import { NewebPayWebATMCommitMessage, NewebPayWebATMOrderInput } from './typings/webatm.typing';
import { NewebPayVirtualAccountCommitMessage } from './typings/virtual-account.typing';
import axios from 'axios';

const debugPayment = debug('Rytass:Payment:NewebPay');

export class NewebPayPayment<CM extends NewebPayCommitMessage> implements PaymentGateway<CM, NewebPayOrder<CM>> {
  private readonly baseUrl: string;
  private readonly hashKey: string;
  private readonly hashIv: string;
  private readonly merchantId: string;
  private readonly language: AllowUILanguage;
  private serverHost: string;
  private readonly callbackPath: string;
  private readonly asyncInfoPath: string;
  private readonly checkoutPath: string;
  private readonly serverListener: ((req: IncomingMessage, res: ServerResponse) => void) | undefined;
  private readonly pendingOrdersCache: LRUCache<string, NewebPayOrder<CM>>;
  private isGatewayReady = false;

  readonly _server?: Server;

  constructor(options?: NewebPayPaymentInitOptions<NewebPayOrder<CM>>) {
    this.baseUrl = options?.baseUrl ?? 'https://ccore.newebpay.com';
    this.hashKey = options?.hashKey ?? 'csZM5zSocJo7IZqaAlIpiu0pxZ8U7R9P';
    this.hashIv = options?.hashIv ?? 'yKeWqlY8mXvhoG71';
    this.merchantId = options?.merchantId ?? 'MS34356577';
    this.language = options?.language ?? AllowUILanguage.ZH_TW;
    this.serverHost = options?.serverHost ?? 'http://localhost:3000';
    this.callbackPath = options?.callbackPath ?? '/payments/newebpay/callback';
    this.asyncInfoPath = options?.asyncInfoPath ?? '/payments/newebpay/async-informations';
    this.checkoutPath = options?.checkoutPath ?? '/payments/newebpay/checkout';

    if (options?.withServer) {
      this.serverListener = options?.serverListener ?? ((req: IncomingMessage, res: ServerResponse) => this.defaultServerListener(req, res));

      const url = new URL(this.serverHost);
      const port = Number(url.port || 3000);

      this._server = createServer((req, res) => this.serverListener!(req, res));

      this._server.listen(port, '0.0.0.0', async () => {
        if (options.withServer === 'ngrok') {
          try {
            const ngrokUrl = await ngrok.connect(port);

            this.serverHost = ngrokUrl;

            debugPayment(`ECPayment Callback Server Listen on port ${port} with ngrok url: ${ngrokUrl}`);
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

    if (typeof options?.onServerListen === 'function') {
      this.emitter.on(PaymentEvents.SERVER_LISTENED, () => { this.isGatewayReady = true; });
      this.emitter.on(PaymentEvents.SERVER_LISTENED, options.onServerListen);
    }

    this.pendingOrdersCache = new LRUCache({
      ttlAutopurge: true,
      ttl: options?.ttl ?? 10 * 60 * 1000, // default: 10 mins
    });
  }

  readonly emitter = new EventEmitter();

  get checkoutActionUrl() {
    return `${this.baseUrl}/MPG/mpg_gateway`;
  }

  getCheckoutUrl(order: NewebPayOrder<NewebPayCommitMessage>) {
    return `${this.serverHost}${this.checkoutPath}/${order.id}`;
  }

  public defaultServerListener(req: IncomingMessage, res: ServerResponse) {
    const checkoutRe = new RegExp(`^${this.checkoutPath}/([^/]+)$`);

    if (req.method === 'GET' && req.url && checkoutRe.test(req.url)) {
      const orderId = RegExp.$1;

      if (orderId) {
        const order = this.pendingOrdersCache.get(orderId);

        if (order) {
          debugPayment(`ECPayment serve checkout page for order ${orderId}`);

          res.writeHead(200, {
            'Content-Type': 'text/html',
          });

          res.end(order.formHTML);

          return;
        }
      }
    }

    if (!req.url || req.method !== 'POST' || !~[this.callbackPath, this.asyncInfoPath].indexOf(req.url)) {
      res.writeHead(404);
      res.end();

      return;
    }

    const bufferArray = [] as Buffer[];

    req.on('data', (chunk) => {
      bufferArray.push(chunk);
    });

    req.on('end', () => {
      const payloadString = Buffer.from(Buffer.concat(bufferArray)).toString('utf8');
      const payload = Array.from(new URLSearchParams(payloadString).entries())
        .reduce(
          (vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }),
          {},
        ) as NewebPayNotifyPayload;

      switch (req.url) {
        case this.callbackPath: {
          const resolvedData = this.resolveEncryptedPayload<NewebPayNotifyEncryptedPayload>(payload.TradeInfo, payload.TradeSha);
          const order = this.pendingOrdersCache.get<NewebPayOrder<NewebPayCommitMessage>>(resolvedData.MerchantOrderNo);

          if (!order) {
            res.writeHead(404);
            res.end();

            return;
          }

          this.handlePaymentResult(order, resolvedData);
          break;
        }

        case this.asyncInfoPath: {
          const resolvedData = this.resolveEncryptedPayload<NewebPayInfoRetriveEncryptedPayload>(payload.TradeInfo, payload.TradeSha);
          const order = this.pendingOrdersCache.get<NewebPayOrder<NewebPayCommitMessage>>(resolvedData.MerchantOrderNo);

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
    });
  }

  private handleAsyncInformation(order: NewebPayOrder<NewebPayCommitMessage>, payload: NewebPayInfoRetriveEncryptedPayload) {
    if (order.state !== OrderState.PRE_COMMIT) return;

    switch (payload.PaymentType) {
      case 'VACC':
        order.infoRetrieved<NewebPayVirtualAccountCommitMessage>({
          channel: Channel.VIRTUAL_ACCOUNT,
          bankCode: payload.BankCode!,
          account: payload.CodeNo!,
          expiredAt: DateTime.fromFormat(`${payload.ExpireDate!} ${payload.ExpireTime!}`, 'yyyy-MM-dd HH:mm:ss').toJSDate(),
        });

        break;
    }
  }

  private handlePaymentResult(order: NewebPayOrder<NewebPayCommitMessage>, payload: NewebPayNotifyEncryptedPayload) {
    if (!~[OrderState.PRE_COMMIT, OrderState.ASYNC_INFO_RETRIEVED].indexOf(order.state)) return;

    switch (payload.PaymentType) {
      case 'WEBATM':
        order.commit<NewebPayWebATMCommitMessage>({
          id: payload.MerchantOrderNo,
          totalPrice: payload.Amt,
          committedAt: DateTime.fromFormat(payload.PayTime, 'yyyy-MM-dd HH:mm:ss').toJSDate(),
          platformTradeNumber: payload.TradeNo,
          channel: NewebPaymentChannel.WEBATM,
        });

        break;

      case 'VACC':
        order.commit<NewebPayVirtualAccountCommitMessage>({
          id: payload.MerchantOrderNo,
          totalPrice: payload.Amt,
          committedAt: DateTime.fromFormat(payload.PayTime, 'yyyy-MM-dd HH:mm:ss').toJSDate(),
          platformTradeNumber: payload.TradeNo,
          channel: NewebPaymentChannel.VACC,
        });

        break;

      case 'CREDIT':
        order.commit<NewebPayCreditCardCommitMessage>({
          id: payload.MerchantOrderNo,
          totalPrice: payload.Amt,
          committedAt: DateTime.fromFormat(payload.PayTime, 'yyyy-MM-dd HH:mm:ss').toJSDate(),
          platformTradeNumber: payload.TradeNo,
          channel: NewebPaymentChannel.CREDIT,
        }, {
          channel: Channel.CREDIT_CARD,
          processDate: DateTime.fromFormat(payload.PayTime, 'yyyy-MM-dd HH:mm:ss').toJSDate(),
          authCode: payload.Auth!,
          amount: payload.Amt,
          eci: payload.ECI!,
          card4Number: payload.Card4No!,
          card6Number: payload.Card6No!,
          authBank: payload.AuthBank!,
          subChannel: payload.PaymentMethod,
          speedCheckoutMode: payload.TokenUseStatus,
          installments: payload.Inst ? {
            count: payload.Inst,
            firstAmount: payload.InstFirst,
            eachAmount: payload.InstEach,
          } : undefined,
          dcc: payload.DCC_Amt ? {
            amount: payload.DCC_Amt,
            rate: payload.DCC_Rate,
            markup: payload.DCC_Markup,
            currency: payload.DCC_Currency,
            currencyCode: payload.DCC_Currency_Code,
          }: undefined,
          bonusAmount: payload.RedAmt,
          closeBalance: payload.Amt,
          closeStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
          remainingBalance: payload.Amt,
          refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
        } as NewebPayAdditionInfoCreditCard);

        break;
    }
  }

  private getOrderId() {
    return randomBytes(10).toString('hex');
  }

  private generatePayload<T extends Record<string, string | number | undefined>>(payload: T): NewebPayMPGMakeOrderPayload {
    const params = Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${encodeURIComponent(value as string | number)}`)
      .join('&');

    const cipher = createCipheriv('aes-256-cbc', this.hashKey, this.hashIv);
    const encrypted = `${cipher.update(params, 'utf8', 'hex')}${cipher.final('hex') }`;

    return {
      MerchantID: this.merchantId,
      TradeInfo: encrypted,
      TradeSha: createHash('sha256').update(`HashKey=${this.hashKey}&${encrypted}&HashIV=${this.hashIv}`).digest('hex').toUpperCase(),
      Version: '2.0',
      EncryptType: 0,
    };
  }

  private resolveEncryptedPayload<T extends { MerchantOrderNo: string }>(encrypted: string, hash: string): T {
    if (hash !== createHash('sha256').update(`HashKey=${this.hashKey}&${encrypted}&HashIV=${this.hashIv}`).digest('hex').toUpperCase()) {
      throw new Error('Invalid hash');
    }

    const decipher = createDecipheriv('aes-256-cbc', this.hashKey, this.hashIv);

    decipher.setAutoPadding(false);

    const plainInfo = `${decipher.update(encrypted, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(/\x1E/g, '').replace(/\x14/g, '');

    try {
      const payload = JSON.parse(plainInfo) as NewebPayAPIResponseWrapper<T>;

      if (payload.Status === 'SUCCESS') return payload.Result;

      const order = this.pendingOrdersCache.get<NewebPayOrder<NewebPayCommitMessage>>((payload.Result).MerchantOrderNo);

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

  prepare<NCM extends CM>(input: NewebPayOrderInput<NCM>): NewebPayOrder<NCM> {
    if (!this.isGatewayReady) {
      throw new Error('Please waiting gateway ready');
    }

    if (input.tradeLimit && input.tradeLimit < 60) {
      throw new Error('`tradeLimit` should between 60 and 900 (seconds)');
    }

    if (input.tradeLimit && input.tradeLimit > 900) {
      throw new Error('`tradeLimit` should between 60 and 900 (seconds)');
    }

    if (input.expireDate && !DateTime.fromFormat(input.expireDate, 'yyyyMMdd').isValid) {
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
      Amt: input.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0),
      ItemDesc: input.items.map(item => item.name).join(',').substring(0, 50),
      TradeLimit: input.tradeLimit ?? 0,
      ExpireDate: input.expireDate,
      ReturnURL: input.clientBackUrl ?? '',
      NotifyURL: `${this.serverHost}${this.callbackPath}`,
      CustomerURL: `${this.serverHost}${this.asyncInfoPath}`,
      ClientBackURL: input.clientBackUrl ?? '',
      Email: input.email ?? '',
      EmailModify: 0,
      LoginType: 0,
      OrderComment: input.remark ?? '',
      CREDIT: input.channel & NewebPaymentChannel.CREDIT ? 1 : 0,
      ANDROIDPAY: input.channel & NewebPaymentChannel.ANDROID_PAY ? 1 : 0,
      SAMSUNGPAY: input.channel & NewebPaymentChannel.SAMSUNGPAY ? 1 : 0,
      // LINEPAY: input.channel & NewebPaymentChannel.LINEPAY ? 1 : 0,
      // ImageUrl: (input as NewebPayLinePayOrderInput).imageUrl ?? undefined,
      InstFlag: ((input as NewebPayCreditCardOrderInput).installments ?? []).join(',') || '',
      // CreditRed: (input as NewebPayCreditCardOrderInput).canUseBonus ? 1 : 0,
      UNIONPAY: input.channel & NewebPaymentChannel.UNIONPAY ? 1 : 0,
      WEBATM: input.channel & NewebPaymentChannel.WEBATM ? 1 : 0,
      VACC: input.channel & NewebPaymentChannel.VACC ? 1 : 0,
      BankType: ((input as NewebPayWebATMOrderInput).bankTypes ?? []).join(',') || '',
      // CVS: input.channel & NewebPaymentChannel.CVS ? 1 : 0,
      // BARCODE: input.channel & NewebPaymentChannel.BARCODE ? 1 : 0,
      // ESUNWALLET: input.channel & NewebPaymentChannel.ESUNWALLET ? 1 : 0,
      // TAIWANPAY: input.channel & NewebPaymentChannel.TAIWANPAY ? 1 : 0,
      // CVSCOM: 0,
      // EZPAY: input.channel & NewebPaymentChannel.EZPAY ? 1 : 0,
      // EZPWECHAT: input.channel & NewebPaymentChannel.EZPWECHAT ? 1 : 0,
      // EZPALIPAY: input.channel & NewebPaymentChannel.EZPALIPAY ? 1 : 0,
    } as NewebPayMPGMakeOrderEncryptedPayload;

    const order = new NewebPayOrder({
      id: payload.MerchantOrderNo,
      items: input.items,
      makePayload: this.generatePayload<NewebPayMPGMakeOrderEncryptedPayload>(payload),
      gateway: this,
    });

    this.pendingOrdersCache.set(order.id, order);

    return order;
  }

  async query<T extends NewebPayOrder<CM>>(id: string, amount: number): Promise<T> {
    if (!this.isGatewayReady) {
      throw new Error('Please waiting gateway ready');
    }

    const now = Math.round(Date.now() / 1000);

    const payload = {
      MerchantID: this.merchantId,
      Version: '1.3',
      RespondType: 'JSON',
      TimeStamp: now.toString(),
      MerchantOrderNo: id,
      Amt: amount.toString(),
      Gateway: /^MS5/.test(this.merchantId) ? 'Composite' : '',
      CheckValue: createHash('sha256').update(`IV=${this.hashIv}&Amt=${amount}&MerchantID=${this.merchantId}&MerchantOrderNo=${id}&Key=${this.hashKey}`).digest('hex').toUpperCase(),
    } as NewebPayQueryRequestPayload;

    const { data } = await axios.post<NewebPayAPIResponseWrapper<NewebPayQueryResponsePayload>>(`${this.baseUrl}/API/QueryTradeInfo`, new URLSearchParams(payload).toString());

    const savedOrder = this.pendingOrdersCache.get(data.Result.MerchantOrderNo);

    const basicInfo = {
      id: data.Result.MerchantOrderNo,
      items: savedOrder?.items ?? [{
        name: '商品一批',
        unitPrice: data.Result.Amt,
        quantity: 1,
      }],
      gateway: this,
      createdAt: DateTime.fromFormat(data.Result.CreateTime, 'yyyy-MM-dd HH:mm:ss').toJSDate(),
      committedAt: data.Result.PayTime ? DateTime.fromFormat(data.Result.PayTime, 'yyyy-MM-dd HH:mm:ss').toJSDate() : null,
      platformTradeNumber: data.Result.TradeNo,
      channel: ((paymentType) => {
        switch (paymentType) {
          case 'ANDROIDPAY':
            return NewebPaymentChannel.ANDROID_PAY;

          case 'SAMSUNGPAY':
            return NewebPaymentChannel.SAMSUNGPAY;

          case 'UNIONPAY':
            return NewebPaymentChannel.UNIONPAY;

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
      return new NewebPayOrder<NewebPayCreditCardCommitMessage>(basicInfo as NewebPayOrderFromServerInit<NewebPayCreditCardCommitMessage>, {
        channel: Channel.CREDIT_CARD,
        processDate: DateTime.fromFormat(data.Result.PayTime || data.Result.CreateTime, 'yyyy-MM-dd HH:mm:ss').toJSDate(),
        authCode: data.Result.Auth,
        amount: data.Result.Amt,
        eci: data.Result.ECI,
        card4Number: data.Result.Card4No,
        card6Number: data.Result.Card6No,
        authBank: data.Result.AuthBank,
        subChannel: data.Result.PaymentMethod,
        installments: data.Result.Inst ? {
          count: data.Result.Inst,
          firstAmount: data.Result.InstFirst,
          eachAmount: data.Result.InstEach,
        } : undefined,
        closeStatus: data.Result.CloseStatus,
        closeBalance: Number(data.Result.CloseAmt),
        refundStatus: data.Result.BackStatus,
        remainingBalance: Number(data.Result.BackBalance),
      } as CreditCardAuthInfo) as T;
    }

    if ('PayInfo' in data.Result) {
      switch (data.Result.PaymentType) {
        case 'VACC':
        case 'WEBATM': {
          const [, buyerBankCode, buyerAccountNumber] = data.Result.PayInfo.match(/^\((\d+)\)(\d+)$/) as [string, string, string];

          return new NewebPayOrder<NewebPayVirtualAccountCommitMessage>({
            ...basicInfo,
            status: data.Result.OrderStatus,
          } as NewebPayOrderFromServerInit<NewebPayVirtualAccountCommitMessage>, {
            buyerBankCode,
            buyerAccountNumber,
          } as VistualAccountPaymentInfo) as T;
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

  async cancel(order: NewebPayOrder<NewebPayCreditCardCommitMessage>): Promise<void> {
    if ((order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus !== NewebPayCreditCardBalanceStatus.UNSETTLED) {
      throw new Error('Only unsettled order can be canceled');
    }

    const cipher = createCipheriv('aes-256-cbc', this.hashKey, this.hashIv);

    const encrypted = `${cipher.update(Object.entries({
      RespondType: 'JSON',
      Version: '1.0',
      Amt: order.totalPrice,
      MerchantOrderNo: order.id,
      IndexType: 1,
      TimeStamp: Math.round(Date.now() / 1000).toString(),
    } as NewebPayCreditCardCancelEncryptedRequestPayload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${encodeURIComponent(value as string | number)}`)
      .join('&'), 'utf8', 'hex')}${cipher.final('hex')}`;

    const payload = {
      MerchantID_: this.merchantId,
      PostData_: encrypted,
    } as NewebPayCreditCardCancelRequestPayload;

    const { data } = await axios.post<NewebPayAPIResponseWrapper<NewebPayCreditCardCancelResponse>>(`${this.baseUrl}/API/CreditCard/Cancel`, new URLSearchParams(payload).toString());

    if (data.Status !== 'SUCCESS') {
      debugPayment(data.Message);

      throw new Error('Cancel order failed');
    }

    const validCode = createHash('sha256').update(`HashKey=${this.hashKey}&${encrypted}&HashIV=${this.hashIv}`).digest('hex').toUpperCase();

    if (validCode !== data.Result.CheckCode) throw new Error('Invalid check code');
  }

  async settle(order: NewebPayOrder<NewebPayCreditCardCommitMessage>): Promise<void> {
    if ((order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus !== NewebPayCreditCardBalanceStatus.UNSETTLED) {
      throw new Error('Only unsettled order can be canceled');
    }

    const cipher = createCipheriv('aes-256-cbc', this.hashKey, this.hashIv);

    const encrypted = `${cipher.update(Object.entries({
      RespondType: 'JSON',
      Version: '1.0',
      Amt: order.totalPrice,
      MerchantOrderNo: order.id,
      IndexType: 1,
      TimeStamp: Math.round(Date.now() / 1000).toString(),
      CloseType: 1,
    } as NewebPayCreditCardCloseEncryptedRequestPayload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${encodeURIComponent(value as string | number)}`)
      .join('&'), 'utf8', 'hex')}${cipher.final('hex')}`;

    const payload = {
      MerchantID_: this.merchantId,
      PostData_: encrypted,
    } as NewebPayCreditCardCloseRequestPayload;

    const { data } = await axios.post<NewebPayAPIResponseWrapper<NewebPayCreditCardCloseResponse>>(`${this.baseUrl}/API/CreditCard/Close`, new URLSearchParams(payload).toString());

    if (data.Status !== 'SUCCESS') {
      debugPayment(data.Message);

      throw new Error('Settle order failed');
    }
  }

  async unsettle(order: NewebPayOrder<NewebPayCreditCardCommitMessage>): Promise<void> {
    if ((order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus !== NewebPayCreditCardBalanceStatus.SETTLED) {
      throw new Error('Only unsettled order can be canceled');
    }

    const cipher = createCipheriv('aes-256-cbc', this.hashKey, this.hashIv);

    const encrypted = `${cipher.update(Object.entries({
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
      .map(([key, value]) => `${key}=${encodeURIComponent(value as string | number)}`)
      .join('&'), 'utf8', 'hex')}${cipher.final('hex')}`;

    const payload = {
      MerchantID_: this.merchantId,
      PostData_: encrypted,
    } as NewebPayCreditCardCloseRequestPayload;

    const { data } = await axios.post<NewebPayAPIResponseWrapper<NewebPayCreditCardCloseResponse>>(`${this.baseUrl}/API/CreditCard/Close`, new URLSearchParams(payload).toString());

    if (data.Status !== 'SUCCESS') {
      debugPayment(data.Message);

      throw new Error('Unsettle order failed');
    }
  }

  async refund(order: NewebPayOrder<NewebPayCreditCardCommitMessage>): Promise<void> {
    if (!~[NewebPayCreditCardBalanceStatus.WORKING, NewebPayCreditCardBalanceStatus.SETTLED].indexOf((order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus)) {
      throw new Error('Only working/settled order can be refunded');
    }

    if ((order.additionalInfo as NewebPayAdditionInfoCreditCard).refundStatus !== NewebPayCreditCardBalanceStatus.UNSETTLED) {
      throw new Error('Order refunding.');
    }

    const cipher = createCipheriv('aes-256-cbc', this.hashKey, this.hashIv);

    const encrypted = `${cipher.update(Object.entries({
      RespondType: 'JSON',
      Version: '1.0',
      Amt: order.totalPrice,
      MerchantOrderNo: order.id,
      IndexType: 1,
      TimeStamp: Math.round(Date.now() / 1000).toString(),
      CloseType: 2,
    } as NewebPayCreditCardCloseEncryptedRequestPayload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}=${encodeURIComponent(value as string | number)}`)
      .join('&'), 'utf8', 'hex')}${cipher.final('hex')}`;

    const payload = {
      MerchantID_: this.merchantId,
      PostData_: encrypted,
    } as NewebPayCreditCardCloseRequestPayload;

    const { data } = await axios.post<NewebPayAPIResponseWrapper<NewebPayCreditCardCloseResponse>>(`${this.baseUrl}/API/CreditCard/Close`, new URLSearchParams(payload).toString());

    if (data.Status !== 'SUCCESS') {
      debugPayment(data.Message);

      throw new Error('Refund order failed');
    }
  }

  async cancelRefund(order: NewebPayOrder<NewebPayCreditCardCommitMessage>): Promise<void> {
    if ((order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus !== NewebPayCreditCardBalanceStatus.SETTLED) {
      throw new Error('Only settled order can be cancel refund');
    }

    if ((order.additionalInfo as NewebPayAdditionInfoCreditCard).refundStatus !== NewebPayCreditCardBalanceStatus.WAITING) {
      throw new Error('Order not refunding.');
    }

    if (order.state !== OrderState.REFUNDED) {
      throw new Error('Only refunded order can be cancel refund');
    }

    const cipher = createCipheriv('aes-256-cbc', this.hashKey, this.hashIv);

    const encrypted = `${cipher.update(Object.entries({
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
      .map(([key, value]) => `${key}=${encodeURIComponent(value as string | number)}`)
      .join('&'), 'utf8', 'hex')}${cipher.final('hex')}`;

    const payload = {
      MerchantID_: this.merchantId,
      PostData_: encrypted,
    } as NewebPayCreditCardCloseRequestPayload;

    const { data } = await axios.post<NewebPayAPIResponseWrapper<NewebPayCreditCardCloseResponse>>(`${this.baseUrl}/API/CreditCard/Close`, new URLSearchParams(payload).toString());

    if (data.Status !== 'SUCCESS') {
      debugPayment(data.Message);

      throw new Error('Refund order failed');
    }
  }
}
