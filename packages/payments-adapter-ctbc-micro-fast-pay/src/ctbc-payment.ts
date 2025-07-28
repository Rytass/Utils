import {
  BindCardPaymentGateway,
  InputFromOrderCommitMessage,
  Order,
  PaymentEvents,
  PaymentGateway,
} from '@rytass/payments';
import EventEmitter from 'node:events';
import { LRUCache } from 'lru-cache';
import debug from 'debug';
import {
  createServer,
  IncomingMessage,
  ServerResponse,
  Server,
} from 'node:http';
import { CTBCBindCardRequest } from './ctbc-bind-card-request';
import { CTBCOrder } from './ctbc-order';
import {
  BindCardRequestCache,
  CTBCBindCardRequestPayload,
  CTBCCheckoutWithBoundCardOptions,
  CTBCOrderCommitMessage,
  CTBCPaymentOptions,
  CTBCRawRequest,
  CTBCRequestPrepareBindCardOptions,
  CTBCResponsePayload,
  OrderCache,
} from './typings';
import { randomBytes } from 'node:crypto';
import { DateTime } from 'luxon';
import {
  decrypt3DES,
  encrypt3DES,
  getDivKey,
  getMAC,
} from './ctbc-crypto-core';
import { URLSearchParams } from 'node:url';

const debugPayment = debug('Rytass:Payment:CTBC');
const debugPaymentServer = debug('Rytass:Payment:CTBC:Server');

export class CTBCPayment<
    CM extends CTBCOrderCommitMessage = CTBCOrderCommitMessage,
  >
  implements PaymentGateway<CM, CTBCOrder<CM>>, BindCardPaymentGateway<CM>
{
  private serverHost = 'http://localhost:3000';
  private bindCardPath = '/payments/ctbc/bind-card';
  private boundCardPath = '/payments/ctbc/bound-card';
  private boundCardCheckoutResultPath =
    '/payments/ctbc/bound-card/checkout-result';

  readonly merchantId: string;
  readonly merId: string;
  readonly txnKey: string;
  readonly terminalId: string;
  readonly baseUrl: string;
  readonly endpoint: string;

  readonly emitter = new EventEmitter();

  _server?: Server;

  private isGatewayReady = false;
  private serverListener: (req: IncomingMessage, res: ServerResponse) => void =
    (req, res) => this.defaultServerListener(req, res);

  private readonly orderCache: OrderCache<CM>;
  private readonly bindCardRequestsCache: BindCardRequestCache;

  constructor(options: CTBCPaymentOptions) {
    this.merchantId = options.merchantId;
    this.merId = options.merId;
    this.txnKey = options.txnKey;
    this.terminalId = options.terminalId;
    this.baseUrl = options.baseUrl ?? 'https://testepos.ctbcbank.com';
    this.endpoint = `${this.baseUrl}/mFastPay/TxnServlet`;
    this.serverHost = options?.serverHost || this.serverHost;
    this.bindCardPath = options?.bindCardPath || this.bindCardPath;
    this.boundCardPath = options?.boundCardPath || this.boundCardPath;
    this.boundCardCheckoutResultPath =
      options?.boundCardCheckoutResultPath || this.boundCardCheckoutResultPath;

    if (options?.withServer) {
      this.serverListener = options?.serverListener || this.serverListener;

      this.createServer(options.withServer === 'ngrok');
    } else {
      this.isGatewayReady = true;
    }

    this.emitter.on(PaymentEvents.SERVER_LISTENED, () => {
      this.isGatewayReady = true;
    });

    if (typeof options?.onCommit === 'function') {
      this.emitter.on(PaymentEvents.ORDER_COMMITTED, options.onCommit);
    }

    if (typeof options?.onServerListen === 'function') {
      this.emitter.on(PaymentEvents.SERVER_LISTENED, options.onServerListen);
    }

    const orderLruCache = new LRUCache<string, CTBCOrder<CM>>({
      ttlAutopurge: true,
      ttl: options?.orderCacheTTL ?? 10 * 60 * 1000, // default: 10 mins
    });

    this.orderCache = options?.orderCache ?? {
      get: async (key: string) => orderLruCache!.get(key),
      set: async (key: string, value: CTBCOrder<CM>) => {
        orderLruCache!.set(key, value);
      },
    };

    const requestLruCache = new LRUCache<string, CTBCBindCardRequest>({
      ttlAutopurge: true,
      ttl: options?.bindCardRequestsCacheTTL ?? 10 * 60 * 1000, // default: 10 mins
    });

    this.bindCardRequestsCache = options?.bindCardRequestsCache ?? {
      get: async (key: string) => requestLruCache!.get(key),
      set: async (key: string, value: CTBCBindCardRequest) => {
        requestLruCache!.set(key, value);
      },
    };
  }

  public async defaultServerListener(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const bindCardRe = new RegExp(`^${this.bindCardPath}/([^/]+)$`);

    debugPaymentServer(`[${req.method}] ${req.url}`);

    debugPaymentServer(this.bindCardRequestsCache);

    if (req.method === 'GET' && req.url) {
      if (bindCardRe.test(req.url)) {
        const memberId = RegExp.$1;

        if (memberId) {
          const request = await this.bindCardRequestsCache.get(memberId);

          if (request) {
            debugPayment(
              `CTBCPayment serve bind card page for member ${memberId}`,
            );

            res.writeHead(200, {
              'Content-Type': 'text/html; charset=utf-8',
            });

            res.end(request.formHTML);

            return;
          }
        }
      }
    }

    if (
      !req.url ||
      req.method !== 'POST' ||
      !~[this.boundCardPath, this.boundCardCheckoutResultPath].indexOf(req.url)
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

      try {
        switch (req.url) {
          case this.boundCardPath: {
            const params = new URLSearchParams(payloadString);
            const payload = JSON.parse(
              decodeURIComponent(params.get('rspjsonpwd') as string),
            ) as {
              Response: CTBCResponsePayload;
            };

            const { Data } = payload.Response;

            const divKey = getDivKey(this.txnKey);

            const plainPayload = decrypt3DES(
              Buffer.from(Data.TXN, 'hex'),
              divKey,
            );
            const decryptedParams = new URLSearchParams(plainPayload);

            const statusCode = decryptedParams.get('StatusCode');
            const statusDesc = decryptedParams.get('StatusDesc');
            const requestId = decryptedParams.get('RequestNo') ?? '';
            const request = await this.bindCardRequestsCache.get(requestId);

            if (statusCode !== 'I0000') {
              if (request) {
                request.fail(statusCode ?? 'x9999', statusDesc ?? '-');
              }

              throw new Error(
                `CTBC Bind Card Failed: ${statusCode} - ${statusDesc}`,
              );
            }

            if (!request) {
              throw new Error(`Unknown bind card request: ${requestId}`);
            }

            request.bound({
              cardToken: decryptedParams.get('CardToken') as string,
              cardNoMask: (decryptedParams.get('CardNoMask') as string).replace(
                /-/g,
                '',
              ),
              requestNo: requestId,
            });

            debugPaymentServer(
              `CTBCPayment bound card for request ${requestId} [${request.memberId}]`,
            );

            res.writeHead(200, {
              'Content-Type': 'text/plain',
            });

            res.end('1|OK');

            break;
          }

          case this.boundCardCheckoutResultPath: {
            const payload = JSON.parse(decodeURIComponent(payloadString)) as {
              Response: CTBCResponsePayload;
            };

            const { Data } = payload.Response;

            const divKey = getDivKey(this.txnKey);

            const plainPayload = decrypt3DES(
              Buffer.from(Data.TXN, 'hex'),
              divKey,
            );
            const decryptedParams = new URLSearchParams(plainPayload);

            const statusCode = decryptedParams.get('StatusCode');
            const statusDesc = decryptedParams.get('StatusDesc');
            const requestId = decryptedParams.get('RequestNo') ?? '';
            const order = await this.orderCache.get(requestId);

            if (statusCode !== 'I0000') {
              if (order) {
                order.fail(statusCode ?? 'x9999', statusDesc ?? '-');
              }

              throw new Error(
                `CTBC Bound Card Checkout Failed: ${statusCode} - ${statusDesc}`,
              );
            }

            if (!order) {
              throw new Error(
                `Unknown bound card checkout order: ${requestId}`,
              );
            }

            order.commit({
              id: order.id,
              totalPrice: Number(decryptedParams.get('AuthAmount')),
              committedAt: new Date(),
            } as CM);

            debugPaymentServer(
              `CTBCPayment bound card checkout order ${order.id} successful.`,
            );

            res.writeHead(200, {
              'Content-Type': 'text/plain',
            });

            res.end('1|OK');

            break;
          }

          default:
            break;
        }
      } catch (ex) {
        debugPaymentServer(
          `CTBCPayment server listener error: ${ex instanceof Error ? ex.message : ex}`,
        );

        res.writeHead(400, {
          'Content-Type': 'text/plain',
        });

        res.end('0|ERROR');
      }
    });
  }

  private createServer(useNgrok: boolean) {
    const url = new URL(this.serverHost ?? 'http://localhost:3000');

    this._server = createServer((req, res) => this.serverListener(req, res));

    const port = Number(url.port || 3000);

    this._server.listen(port, '0.0.0.0', async () => {
      if (useNgrok) {
        if (!process.env.NGROK_AUTHTOKEN) {
          debugPayment(
            '[CTBCPayment] NGROK_AUTHTOKEN is not set. Please set it in your environment variables.',
          );

          throw new Error(
            '[CTBCPayment] NGROK_AUTHTOKEN is not set. Please set it in your environment variables.',
          );
        }

        try {
          await import('@ngrok/ngrok');
        } catch (ex) {
          debugPayment(
            '[CTBCPayment] Failed to import ngrok. Please install it to use ngrok feature.',
          );

          throw ex;
        }

        const ngrok = (await import('@ngrok/ngrok')).default;

        await ngrok.authtoken(process.env.NGROK_AUTHTOKEN);

        const forwarder = await ngrok.forward(port);

        this.serverHost = forwarder.url() as string;

        debugPayment(
          `CTBCPayment Callback Server Listen on port ${port} with ngrok url: ${this.serverHost}`,
        );
      } else {
        debugPayment(`CTBCPayment Callback Server Listen on port ${port}`);
      }

      this.emitter.emit(PaymentEvents.SERVER_LISTENED);
    });
  }

  async prepareBindCard(
    memberId: string,
    options: CTBCRequestPrepareBindCardOptions = {},
  ): Promise<CTBCBindCardRequest> {
    if (!this.isGatewayReady) {
      throw new Error('Please waiting gateway ready');
    }

    const payload = {
      MerID: this.merId,
      MemberID: memberId,
      RequestNo: options.requestId ?? randomBytes(8).toString('hex'),
      TokenURL:
        options.finishRedirectURL ?? `${this.serverHost}${this.boundCardPath}`,
      PromoCode: options.promoCode ?? undefined,
      Pid: options.Pid ?? undefined,
      PhoneNum: options.PhoneNum ?? undefined,
      PhoneNumEditable: options.PhoneNumEditable ?? undefined,
      Birthday: options.Birthday
        ? DateTime.fromJSDate(options.Birthday).toFormat('MMddyyyy')
        : undefined,
    } satisfies CTBCBindCardRequestPayload;

    const request = new CTBCBindCardRequest(payload, this);

    await this.bindCardRequestsCache.set(payload.RequestNo, request);

    debugPayment(
      `CTBCPayment prepareBindCard for member ${memberId}, URL: ${this.serverHost}${this.bindCardPath}/${payload.RequestNo}`,
    );

    return request;
  }

  async prepare<N extends CTBCOrderCommitMessage>(
    input: InputFromOrderCommitMessage<N>,
  ): Promise<Order<N>> {
    throw new Error('CTBCPayment.prepare not implemented');
  }

  async query<OO extends CTBCOrder>(id: string): Promise<OO> {
    throw new Error('Not implemented');
  }

  get executeURL(): string {
    return `${this.baseUrl}/mFastPay/TxnServlet`;
  }

  get boundCheckoutResultURL(): string {
    return `${this.serverHost}${this.boundCardCheckoutResultPath}`;
  }

  async checkoutWithBoundCard(
    options: CTBCCheckoutWithBoundCardOptions,
  ): Promise<CTBCOrder<CM>> {
    if (options.orderId && options.orderId.length > 19) {
      throw new Error('Order ID must be less than 20 characters');
    }

    if (options.orderId && /[^0-9a-z_]/i.test(options.orderId)) {
      throw new Error(
        'Order ID can only contain alphanumeric characters and underscores',
      );
    }

    const totalPrice = options.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    if (totalPrice <= 0) {
      throw new Error('Total price must be greater than 0');
    }

    const orderId = options.orderId ?? randomBytes(8).toString('hex');

    const order = new CTBCOrder({
      id: orderId,
      items: options.items,
      gateway: this,
      checkoutCardId: options.cardId,
      checkoutMemberId: options.memberId,
    });

    this.orderCache.set(orderId, order);

    const payload = order.boundCardCheckoutPayload;

    const urlString = Object.entries(payload)
      .filter(([_, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const divKey = getDivKey(this.txnKey);
    const mac = getMAC(urlString, this.txnKey);
    const txn = encrypt3DES(urlString, divKey, true);

    const data = {
      Request: {
        Header: {
          ServiceName: 'PayJSON',
          Version: '1.0',
          MerchantID: this.merchantId,
          RequestTime: DateTime.now().toFormat('yyyy/MM/dd HH:mm:ss'),
        },
        Data: {
          MAC: mac,
          TXN: txn.toString('hex').toUpperCase(),
        },
      },
    } satisfies CTBCRawRequest;

    await fetch(this.executeURL, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    return order;
  }
}
