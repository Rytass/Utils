import { createHash, randomBytes } from 'crypto';
import { PaymentGateway, Channel, PaymentEvents } from '@rytass/payments';
import { DateTime } from 'luxon';
import LRUCache from 'lru-cache';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import debug from 'debug';
import { EventEmitter } from 'events';
import { ECPayCallbackPayload, ECPayCommitMessage, ECPayInitOptions, ECPayOrderForm, ECPayOrderInput } from './typings';
import { ECPayChannel, NUMERIC_CALLBACK_KEYS } from './constants';
import { ECPayOrder } from './ecpay-order';

const debugPayment = debug('Rytass:Payment:ECPay');

export class ECPayPayment implements PaymentGateway<ECPayOrderInput, ECPayCommitMessage, ECPayOrder<ECPayCommitMessage>> {
  readonly baseUrl: string = 'https://payment-stage.ecpay.com.tw';

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
      ttl: options?.ttl ?? 10 * 60 * 1000 // default: 10 mins
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

  private checkMac(payload: ECPayCallbackPayload): boolean {
    const { CheckMacValue: mac, ...res } = payload;
    const { CheckMacValue: computedMac } = this.addMac(
      Object.entries(res)
        .reduce((vars, [key, value]) => ({
          ...vars,
          [key]: value.toString(),
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
    const checkoutRe = new RegExp(`^${this.checkoutPath}\/([^/]+)$`);

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

      if (!this.checkMac(payload)) {
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
      ItemName: orderInput.items.map((item) => `${item.name} x${item.quantity}`).join('#'),
      ReturnURL: `${this.serverHost}${this.callbackPath}`,
      ChoosePayment: orderInput.channel ? ECPayChannel[orderInput.channel] : ECPayChannel[Channel.CREDIT_CARD],
      NeedExtraPaidInfo: 'Y',
      EncryptType: '1',
      ClientBackURL: orderInput.clientBackUrl || '',
    } as Omit<ECPayOrderForm, 'CheckMacValue'>;

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
    return Promise.resolve({} as T);
  }

  getCheckoutUrl(order: ECPayOrder<ECPayCommitMessage>) {
    return `${this.serverHost}${this.checkoutPath}/${order.id}`;
  }
}
