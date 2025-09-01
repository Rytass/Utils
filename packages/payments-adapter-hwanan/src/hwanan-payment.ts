import {
  AdditionalInfo,
  Channel,
  CreditCardAuthInfo,
  CreditCardECI,
  PaymentEvents,
  PaymentGateway,
} from '@rytass/payments';
import { EventEmitter } from 'events';
import debug from 'debug';
import { LRUCache } from 'lru-cache';
import { IncomingMessage, ServerResponse, Server, createServer } from 'http';
import { createHash, randomBytes } from 'crypto';
import { HwaNanOrder } from './hwanan-order';
import {
  GetCheckCodeArgs,
  HwaNanAutoCapMode,
  HwaNanCommitMessage,
  HwaNanCreditCardCommitMessage,
  HwaNanCustomizePageType,
  HwaNanNotifyPayload,
  HwaNanOrderInput,
  HwaNanPaymentChannel,
  HwaNanPaymentInitOptions,
  HwaNanTransactionType,
  OrdersCache,
} from './typings';

const debugPayment = debug('Rytass:Payment:HwaNan');

export class HwaNanPayment<
  CM extends HwaNanCommitMessage = HwaNanCreditCardCommitMessage,
> implements PaymentGateway<CM, HwaNanOrder<CM>>
{
  private readonly baseUrl: string;
  private readonly merchantId: string;
  private readonly terminalId: string;
  private readonly merchantName: string;
  private readonly merID: string;
  private readonly checkoutPath: string = '/payments/hwanan/checkout';
  private readonly callbackPath: string = '/payments/hwanan/callback';
  private readonly identifier: string;
  private readonly customizePageType: HwaNanCustomizePageType =
    HwaNanCustomizePageType.ZH_TW;
  private readonly customizePageVersion: string | undefined;
  private readonly pendingOrdersCache: OrdersCache<CM, string, HwaNanOrder<CM>>;
  private readonly serverListener:
    | ((req: IncomingMessage, res: ServerResponse) => void)
    | undefined;
  private serverHost: string = 'http://localhost:3000';
  private isGatewayReady = false;

  readonly _server?: Server;
  readonly emitter = new EventEmitter();

  constructor(options: HwaNanPaymentInitOptions<HwaNanOrder<CM>>) {
    this.baseUrl = options.baseUrl || 'https://eposnt.hncb.com.tw';
    this.merchantId = options.merchantId;
    this.terminalId = options.terminalId;
    this.merchantName = options.merchantName;
    this.merID = options.merID;
    this.identifier = options.identifier;
    this.serverHost = options.serverHost || this.serverHost;
    this.callbackPath = options.callbackPath || this.callbackPath;
    this.checkoutPath = options.checkoutPath || this.checkoutPath;
    this.customizePageType =
      options.customizePageType || this.customizePageType;

    this.customizePageVersion =
      this.customizePageType === HwaNanCustomizePageType.OTHER
        ? options.customizePageVersion
        : undefined;

    const lruCache = options?.ordersCache
      ? undefined
      : new LRUCache<string, HwaNanOrder<CM>>({
          ttlAutopurge: true,
          ttl: options?.ttl ?? 10 * 60 * 1000, // default: 10 mins
        });

    this.pendingOrdersCache = options?.ordersCache ?? {
      get: async (key: string) => lruCache!.get(key),
      set: async (key: string, value: HwaNanOrder<CM>) => {
        lruCache!.set(key, value);
      },
    };

    if (typeof options?.onCommit === 'function') {
      this.emitter.on(PaymentEvents.ORDER_COMMITTED, options.onCommit);
    }

    this.emitter.on(PaymentEvents.SERVER_LISTENED, () => {
      this.isGatewayReady = true;
    });

    if (typeof options?.onServerListen === 'function') {
      this.emitter.on(PaymentEvents.SERVER_LISTENED, options.onServerListen);
    }

    if (options?.withServer) {
      this.serverListener =
        options?.serverListener ??
        ((req: IncomingMessage, res: ServerResponse) =>
          this.defaultServerListener(req, res));

      const url = new URL(this.serverHost);
      const port = Number(url.port);

      this._server = createServer((req, res) => this.serverListener!(req, res));

      this._server.listen(port, '0.0.0.0', async () => {
        if (options.withServer === 'ngrok') {
          if (!process.env.NGROK_AUTHTOKEN) {
            debugPayment(
              '[HwananPayment] NGROK_AUTHTOKEN is not set. Please set it in your environment variables.',
            );

            throw new Error(
              '[HwananPayment] NGROK_AUTHTOKEN is not set. Please set it in your environment variables.',
            );
          }

          try {
            await import('@ngrok/ngrok');
          } catch (ex) {
            debugPayment(
              '[HwananPayment] Failed to import ngrok. Please install it to use ngrok feature.',
            );

            throw ex;
          }

          const ngrok = (await import('@ngrok/ngrok')).default;

          await ngrok.authtoken(process.env.NGROK_AUTHTOKEN);

          const forwarder = await ngrok.forward(port);

          this.serverHost = forwarder.url() as string;

          debugPayment(
            `Callback Server Listen on port ${port} with ngrok url: ${this.serverHost}`,
          );
        } else {
          debugPayment(`Callback Server Listen on port ${port}`);
        }

        this.emitter.emit(PaymentEvents.SERVER_LISTENED);
      });
    } else {
      this.isGatewayReady = true;
    }
  }

  private getCheckCode(options: GetCheckCodeArgs): string {
    return createHash('md5')
      .update(
        `${createHash('md5').update(`${this.identifier}|${options.id}`).digest('hex')}|${this.merchantId}|${this.terminalId}|${options.totalPrice}`,
      )
      .digest('hex')
      .substring(16);
  }

  private getOrderId() {
    return randomBytes(10).toString('hex');
  }

  get checkoutActionUrl(): string {
    return `${this.baseUrl}/transaction/api-auth/`;
  }

  public async parseCallbackMessage(
    payload: HwaNanNotifyPayload,
  ): Promise<void> {
    const order = await this.pendingOrdersCache.get(payload.lidm);

    if (!order) throw new Error('Order not found');

    switch (payload.status) {
      case '0':
        order.commit<CM>(
          {
            id: payload.lidm,
            totalPrice: Number(payload.authAmt),
            committedAt: new Date(),
            channel: HwaNanPaymentChannel.CREDIT,
            platformTradeNumber: payload.xid,
          } as CM,
          {
            channel: Channel.CREDIT_CARD,
            processDate: new Date(),
            authCode: payload.authCode,
            amount: Number(payload.authAmt),
            eci: CreditCardECI.VISA_AE_JCB_3D,
            card6Number: 'xxxxxx',
            card4Number: payload.Last4digitPAN,
          } as AdditionalInfo<CM>,
        );

        break;

      default:
        order.fail(payload.errcode, payload.errDesc);
        break;
    }
  }

  public isCheckValueValid(payload: HwaNanNotifyPayload): boolean {
    return (
      payload.checkValue ===
      createHash('md5')
        .update(
          `${createHash('md5')
            .update(`${this.identifier}|${payload.lidm}`)
            .digest(
              'hex',
            )}|${payload.status}|${payload.errcode}|${payload.authCode}|${payload.authAmt}|${payload.xid}`,
        )
        .digest('hex')
        .substring(16)
    );
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
      !~[this.callbackPath].indexOf(req.url)
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
      ) as HwaNanNotifyPayload;

      if (!this.isCheckValueValid(payload)) {
        res.writeHead(400);
        res.end('Checksum Invalid');

        return;
      }

      try {
        await this.parseCallbackMessage(payload);

        res.writeHead(200);
        res.end();
      } catch (ex) {
        debugPayment(ex);

        res.writeHead(400);
        res.end('Order Not Found');
      }
    });
  }

  async prepare<NCM extends CM>(
    input: HwaNanOrderInput<NCM>,
  ): Promise<HwaNanOrder<NCM>> {
    if (!this.isGatewayReady) {
      throw new Error('Please waiting gateway ready');
    }

    const totalPrice = input.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );

    if (totalPrice <= 0) throw new Error('Total price must be greater than 0');

    const id = input.id || this.getOrderId();

    const order = new HwaNanOrder({
      id,
      items: input.items,
      gateway: this,
      makePayload: {
        MerchantID: this.merchantId,
        TerminalID: this.terminalId,
        MerchantName: this.merchantName,
        lidm: id,
        merID: this.merID,
        customize: this.customizePageType,
        ...(this.customizePageVersion
          ? { PageVer: this.customizePageVersion }
          : {}),
        purchAmt: totalPrice,
        txType: HwaNanTransactionType.ONE_TIME,
        AutoCap: HwaNanAutoCapMode.AUTO,
        AuthResURL: `${this.serverHost}${this.callbackPath}`,
        AuthInfoPage: 'N',
        checkValue: this.getCheckCode({
          id,
          totalPrice,
        }),
      },
    }) as HwaNanOrder<NCM>;

    await this.pendingOrdersCache.set(order.id, order);

    return order;
  }

  async query<T extends HwaNanOrder<CM>>(id: string): Promise<T> {
    throw new Error('Hwa Nan Bank does not support query');
  }
}
