import { createHash, randomBytes } from 'crypto';
import { PaymentGateway, PaymentEvents, ECPayQueryOrderPayload, Channel, PaymentPeriodType } from '@rytass/payments';
import { DateTime } from 'luxon';
import LRUCache from 'lru-cache';
import axios from 'axios';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import debug from 'debug';
import { EventEmitter } from 'events';
import { ECPayCallbackPayload, ECPayCommitMessage, ECPayInitOptions, ECPayOrderForm, ECPayOrderInput, ECPayQueryResultPayload, Language } from './typings';
import { ECPayChannel, NUMERIC_CALLBACK_KEYS } from './constants';
import { ECPayOrder } from './ecpay-order';

const debugPayment = debug('Rytass:Payment:ECPay');

export class ECPayPayment implements PaymentGateway<ECPayOrderInput, ECPayCommitMessage, ECPayOrder<ECPayCommitMessage>> {
  readonly baseUrl: string = 'https://payment-stage.ecpay.com.tw';

  private language = Language.TRADITIONAL_CHINESE;
  private merchantId = '2000132';
  private merchantCheckCode = '59997889'; // Production Only
  private hashKey = '5294y06JbISpM5x9';
  private hashIv = 'v77hoKGq4kWxNNIS';
  private serverHost = 'http://localhost:3000';
  private callbackPath = '/payments/ecpay/callback';
  private checkoutPath = '/payments/ecpay/checkout';

  readonly emitter = new EventEmitter();

  private serverListener: (req: IncomingMessage, res: ServerResponse) => void = (req, res) => this.defaultServerListener(req, res);

  private pendingOrdersCache: LRUCache<string, ECPayOrder<ECPayCommitMessage>>;

  _server?: Server;

  constructor(options?: ECPayInitOptions<ECPayOrder<ECPayCommitMessage>>) {
    this.language = options?.language || this.language;
    this.baseUrl = options?.baseUrl || this.baseUrl;
    this.merchantId = options?.merchantId || this.merchantId;
    this.merchantCheckCode = options?.merchantCheckCode || this.merchantCheckCode;
    this.hashKey = options?.hashKey || this.hashKey;
    this.hashIv = options?.hashIv || this.hashIv;
    this.serverHost = options?.serverHost || this.serverHost;
    this.callbackPath = options?.callbackPath || this.callbackPath;
    this.checkoutPath = options?.checkoutPath || this.checkoutPath;

    if (options?.withServer) {
      this.serverListener = options?.serverListener || this.serverListener;

      this.createServer();
    }

    if (typeof options?.onCommit === 'function') {
      this.emitter.on(PaymentEvents.ORDER_COMMITTED, options.onCommit);
    }

    if (typeof options?.onServerListen === 'function') {
      this.emitter.on(PaymentEvents.SERVER_LISTENED, options.onServerListen);
    }

    this.pendingOrdersCache = new LRUCache({
      ttlAutopurge: true,
      ttl: options?.ttl ?? 10 * 60 * 1000, // default: 10 mins
    });
  }

  private getOrderId() {
    return randomBytes(10).toString('hex');
  }

  private addMac<T extends Record<string, string>>(payload: Omit<T, 'CheckMacValue'>): T {
    const mac = createHash('sha256')
      .update(
        encodeURIComponent(
          [
            ['HashKey', this.hashKey],
            ...Object.entries(payload).sort(([aKey], [bKey]) => (aKey.toLowerCase() < bKey.toLowerCase() ? -1 : 1)),
            ['HashIV', this.hashIv],
          ]
            .map(([key, value]) => `${key}=${value}`)
            .join('&'),
        )
          .toLowerCase()
          .replace(/'/g, '%27')
          .replace(/~/g, '%7e')
          .replace(/%20/g, '+'),
      )
      .digest('hex')
      .toUpperCase();

    return {
      ...payload,
      CheckMacValue: mac,
    } as unknown as T;
  }

  private checkMac<T extends { CheckMacValue: string }>(payload: T): boolean {
    const { CheckMacValue: mac, ...res } = payload;
    const { CheckMacValue: computedMac } = this.addMac(
      Object.entries(res)
        .reduce((vars, [key, value]) => ({
          ...vars,
          [key]: (value as unknown as (string | number)).toString(),
        }),
        {}),
    );

    if (computedMac !== mac) return false;

    return true;
  }

  private createServer() {
    const url = new URL(this.serverHost);

    this._server = createServer((req, res) => this.serverListener(req, res));

    this._server.listen(Number(url.port || 80), '0.0.0.0', () => {
      this.emitter.emit(PaymentEvents.SERVER_LISTENED);

      debugPayment(`ECPayment Callback Server Listen on port ${url.port || 80}`);
    });
  }

  private defaultServerListener(req: IncomingMessage, res: ServerResponse) {
    const checkoutRe = new RegExp(`^${this.checkoutPath}/([^/]+)$`);

    if (req.method === 'GET' && req.url && checkoutRe.test(req.url)) {
      const orderId = RegExp.$1;

      if (orderId) {
        const order = this.pendingOrdersCache.get(orderId);

        if (order) {
          res.writeHead(200, {
            'Content-Type': 'text/html',
          });

          res.end(order.formHTML);

          return;
        }
      }
    }

    if (req.url !== this.callbackPath && req.method !== 'POST') {
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
            [key]: ~NUMERIC_CALLBACK_KEYS.indexOf(key) ? Number(value) : value,
          }),
          {},
        ) as ECPayCallbackPayload;

      if (!this.checkMac<ECPayCallbackPayload>(payload)) {
        res.writeHead(400, {
          'Content-Type': 'text/plain',
        });

        res.end('0|CheckSumInvalid');

        return;
      }

      const order = this.pendingOrdersCache.get(payload.MerchantTradeNo);

      if (!order || !order.commitable) {
        res.writeHead(400, {
          'Content-Type': 'text/plain',
        });

        res.end('0|OrderNotFound');

        return;
      }

      order.commit({
        id: payload.MerchantTradeNo,
        totalPrice: payload.TradeAmt,
        committedAt: DateTime.fromFormat(payload.PaymentDate, 'yyyy/MM/dd HH:mm:ss').toJSDate(),
        merchantId: payload.MerchantID,
        tradeNumber: payload.TradeNo,
        tradeDate: DateTime.fromFormat(payload.TradeDate, 'yyyy/MM/dd HH:mm:ss').toJSDate(),
        paymentType: payload.PaymentType,
      });

      res.writeHead(200, {
        'Content-Type': 'text/plain',
      });

      res.end('1|OK');
    });
  }

  prepare<T extends ECPayOrderInput, P extends ECPayOrder<ECPayCommitMessage>>(orderInput: T): P {
    if (orderInput.virtualAccountExpireDays && orderInput.channel && orderInput.channel !== Channel.VIRTUAL_ACCOUNT) {
      throw new Error('`virtualAccountExpireDays` only work on virtual account channel');
    }

    if (orderInput.virtualAccountExpireDays !== undefined) {
      if (orderInput.virtualAccountExpireDays < 1) throw new Error('`virtualAccountExpireDays` should between 1 and 60 days');
      if (orderInput.virtualAccountExpireDays > 60) throw new Error('`virtualAccountExpireDays` should between 1 and 60 days');
    }

    if (orderInput.channel && orderInput.channel !== Channel.CREDIT_CARD && orderInput.memory) {
      throw new Error('`memory` only use on credit card channel');
    }

    if (orderInput.memory && !orderInput.memberId) {
      throw new Error('Memory card should provide `memberId`.');
    }

    if (orderInput.allowUnionPay && (orderInput.channel
      && orderInput.channel !== Channel.CREDIT_CARD)) {
      throw new Error('Union Pay should use credit card channel');
    }

    if (orderInput.allowCreditCardRedeem
      && (orderInput.channel && orderInput.channel !== Channel.CREDIT_CARD)) {
      throw new Error('`allowCreditCardRedeem` should use credit card channel');
    }

    if (orderInput.installments) {
      if (orderInput.channel && orderInput.channel !== Channel.CREDIT_CARD) {
        throw new Error('`installments` should use credit card channel');
      }

      if (orderInput.allowCreditCardRedeem) {
        throw new Error('`installments` should not working with `allowCreditCardRedeem`');
      }

      if (orderInput.period) {
        throw new Error('`installments` should not working with `period`');
      }

      if (orderInput.installments.match(/[^,0-9]/)) {
        throw new Error('`installments` format invalid, example: 3,6,9,12');
      }

      const installments = orderInput.installments.split(/,/g);

      if (installments.some(period => !period || Number.isNaN(Number(period)))) {
        throw new Error('`installments` format invalid, example: 3,6,9,12');
      }
    }

    if (orderInput.period) {
      if (orderInput.channel && orderInput.channel !== Channel.CREDIT_CARD) {
        throw new Error('`period` should use credit card channel');
      }

      if (orderInput.period.frequency !== undefined) {
        switch (orderInput.period.type) {
          case PaymentPeriodType.MONTH:
            if (orderInput.period.frequency < 1) throw new Error('`period.frequency` should between 1 and 12 when `period.type` set to MONTH');
            if (orderInput.period.frequency > 12) throw new Error('`period.frequency` should between 1 and 12 when `period.type` set to MONTH');
            break;

          case PaymentPeriodType.YEAR:
            if (orderInput.period.frequency !== 1) throw new Error('`period.frequency` should be 1 when `period.type` set to YEAR');
            break;

          case PaymentPeriodType.DAY:
          default:
            if (orderInput.period.frequency < 1) throw new Error('`period.frequency` should between 1 and 365 when `period.type` set to DAY');
            if (orderInput.period.frequency > 365) throw new Error('`period.frequency` should between 1 and 365 when `period.type` set to DAY');
            break;
        }
      }

      if (orderInput.period.times < 1) {
        throw new Error('Invalid `period.times`, should >= 1');
      }

      switch (orderInput.period.type) {
        case PaymentPeriodType.MONTH:
          if (orderInput.period.times > 99) throw new Error('`period.times` should below 99 when `period.type` set to MONTH');
          break;

        case PaymentPeriodType.YEAR:
          if (orderInput.period.times > 9) throw new Error('`period.times` should below 9 when `period.type` set to YEAR');
          break;

        case PaymentPeriodType.DAY:
        default:
          if (orderInput.period.times > 999) throw new Error('`period.times` should below 999 when `period.type` set to DAY');
          break;
      }
    }

    const orderId = orderInput.id || this.getOrderId();
    const now = new Date();

    const totalAmount = orderInput.items.reduce((sum, item) => (
      sum + (item.unitPrice * item.quantity)
    ), 0);

    const payload = {
      MerchantID: this.merchantId,
      MerchantTradeNo: orderId,
      MerchantTradeDate: DateTime.fromJSDate(now).toFormat('yyyy/MM/dd HH:mm:ss'),
      PaymentType: 'aio',
      TotalAmount: totalAmount.toString(),
      TradeDesc: orderInput.description || '-',
      ItemName: orderInput.items.map(item => `${item.name} x${item.quantity}`).join('#'),
      ReturnURL: `${this.serverHost}${this.callbackPath}`,
      ChoosePayment: orderInput.channel ? ECPayChannel[orderInput.channel] : 'ALL',
      NeedExtraPaidInfo: 'Y',
      EncryptType: '1',
      OrderResultURL: orderInput.clientBackUrl || '',
      Language: this.language,
    } as Omit<ECPayOrderForm, 'CheckMacValue'>;

    if ((!orderInput.channel || orderInput.channel === Channel.CREDIT_CARD)) {
      if (orderInput.memory) {
        payload.BindingCard = '1';
        payload.MerchantMemberID = orderInput.memberId as string;
      }

      if (orderInput.allowCreditCardRedeem) {
        payload.Redeem = 'Y';
      }

      if (orderInput.allowUnionPay) {
        payload.UnionPay = '0';
      }

      if (orderInput.installments) {
        payload.CreditInstallment = orderInput.installments;
      }

      if (orderInput.period) {
        payload.PeriodAmount = orderInput.period.amountPerPeriod.toString();
        payload.PeriodType = orderInput.period.type;
        payload.Frequency = (orderInput.period.frequency || 1).toString();
        payload.ExecTimes = orderInput.period.times.toString();
        payload.PeriodReturnURL = `${this.serverHost}${this.callbackPath}`;
      }
    }

    if ((!orderInput.channel || orderInput.channel === Channel.VIRTUAL_ACCOUNT)) {
      if (orderInput.virtualAccountExpireDays) {
        payload.ExpireDate = orderInput.virtualAccountExpireDays.toString();
      } else if (orderInput.channel === Channel.VIRTUAL_ACCOUNT) {
        payload.ExpireDate = '3';
      }

      payload.PaymentInfoURL = `${this.serverHost}${this.callbackPath}`;
      payload.ClientRedirectURL = orderInput.clientBackUrl || '';
    }

    const order = new ECPayOrder<ECPayCommitMessage>({
      id: orderId,
      items: orderInput.items,
      form: this.addMac<ECPayOrderForm>(payload),
      gateway: this,
    }) as P;

    this.pendingOrdersCache.set(order.id, order);

    return order;
  }

  async query<T extends ECPayOrder<ECPayCommitMessage>>(id: string): Promise<T> {
    const date = new Date();

    const payload = this.addMac<ECPayQueryOrderPayload>({
      MerchantID: this.merchantId,
      MerchantTradeNo: id,
      PlatformID: '',
      TimeStamp: Math.round(date.getTime() / 1000).toString(),
    });

    const result = await axios.post<string>(`${this.baseUrl}/Cashier/QueryTradeInfo/V5`, new URLSearchParams(payload).toString());

    const response = Array.from(new URLSearchParams(result.data).entries())
      .reduce((vars, [key, value]) => ({
        ...vars,
        [key]: value,
      }), {}) as ECPayQueryResultPayload;

    if (!this.checkMac<ECPayQueryResultPayload>(response)) {
      throw new Error('Invalid CheckSum');
    }

    return new ECPayOrder({
      id: response.MerchantTradeNo,
      items: [{
        name: ECPayOrder.FAKE_ITEM,
        unitPrice: response.TradeAmt,
        quantity: 1,
      }],
      gateway: this,
      createdAt: DateTime.fromFormat(response.TradeDate, 'yyyy/MM/dd HH:mm:ss').toJSDate(),
      committedAt: response.PaymentDate ? DateTime.fromFormat(response.PaymentDate, 'yyyy/MM/dd HH:mm:ss').toJSDate() : null,
      platformTradeNumber: response.MerchantTradeNo,
      paymentType: response.PaymentType,
      status: response.TradeStatus,
    }) as T;
  }

  getCheckoutUrl(order: ECPayOrder<ECPayCommitMessage>) {
    return `${this.serverHost}${this.checkoutPath}/${order.id}`;
  }
}
