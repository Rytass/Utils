import { createHash, randomBytes } from 'crypto';
import {
  PaymentGateway,
  PaymentEvents,
  Channel,
  PaymentPeriodType,
  CVSInfo,
  VirtualAccountInfo,
  CreditCardAuthInfo,
  BarcodeInfo,
  VirtualAccountPaymentInfo,
  OrderState,
} from '@rytass/payments';
import { DateTime } from 'luxon';
import { LRUCache } from 'lru-cache';
import axios from 'axios';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import debug from 'debug';
import ngrok from 'ngrok';
import { EventEmitter } from 'events';
import {
  ECPayCallbackCreditPayload,
  ECPayCallbackPayload,
  ECPayCallbackPaymentType,
  ECPayCommitMessage,
  ECPayOrderCreditCardCommitMessage,
  ECPayInitOptions,
  ECPayOrderForm,
  ECPayQueryResultPayload,
  ECPayOrderVirtualAccountCommitMessage,
  Language,
  GetOrderInput,
  ECPayCreditCardOrderInput,
  ECPayQueryOrderPayload,
  ECPayOrderCVSCommitMessage,
  ECPayOrderBarcodeCommitMessage,
  ECPayAsyncInformationBarcodePayload,
  ECPayAsyncInformationCVSPayload,
  ECPayAsyncInformationVirtualAccountPayload,
  ECPayAsyncInformationPayload,
  ECPayCallbackVirtualAccountPayload,
  ECPayCallbackCVSPayload,
  ECPayCallbackBarcodePayload,
  ECPayCreditCardDetailQueryPayload,
  ECPayCreditCardDetailQueryResponse,
  ECPayCreditCardOrderStatus,
  ECPayCreditCardOrderCloseStatus,
  ECPayOrderActionPayload,
  ECPayOrderDoActionResponse,
  OrdersCache,
  ECPayBindCardRequestPayload,
  ECPayPaymentCallbackPayload,
  ECPayBindCardCallbackPayload,
  BindCardRequestCache,
  ECPayBindCardRequestState,
  ECPayCheckoutWithBoundCardPayload,
  ECPayCheckoutWithBoundCardRequestPayload,
  ECPayCheckoutWithBoundCardResponsePayload,
  ECPayCheckoutWithBoundCardResult,
  ECPayBoundCardInfo,
  ECPayBoundCardQueryResponsePayload,
  ECPayBindCardWithTransactionRequestPayload,
  ECPayBoundCardWithTransactionResponsePayload,
} from './typings';
import {
  ECPayChannel,
  ECPayCVS,
  ECPayPaymentPeriodType,
  NUMERIC_CALLBACK_KEYS,
} from './constants';
import { ECPayOrder } from './ecpay-order';
import { ECPayBindCardRequest } from './ecpay-bind-card-request';

const debugPayment = debug('Rytass:Payment:ECPay');

export class ECPayPayment<CM extends ECPayCommitMessage = ECPayCommitMessage>
  implements PaymentGateway<CM, ECPayOrder<CM>>
{
  readonly baseUrl: string = 'https://payment-stage.ecpay.com.tw';

  private language = Language.TRADITIONAL_CHINESE;
  private merchantId = '2000132';
  private merchantCheckCode = '59997889'; // Production Only
  private hashKey = '5294y06JbISpM5x9';
  private hashIv = 'v77hoKGq4kWxNNIS';
  private serverHost = 'http://localhost:3000';
  private callbackPath = '/payments/ecpay/callback';
  private asyncInfoPath = '/payments/ecpay/async-informations';
  private checkoutPath = '/payments/ecpay/checkout';
  private bindCardPath = '/payments/ecpay/bind-card';
  private boundCardPath = '/payments/ecpay/bound-card';
  private boundCardFinishPath = '/payments/ecpay/bound-card-finished';

  private isGatewayReady = false;
  private emulateRefund = false;

  readonly emitter = new EventEmitter();

  private serverListener: (req: IncomingMessage, res: ServerResponse) => void =
    (req, res) => this.defaultServerListener(req, res);

  private readonly pendingOrdersCache: OrdersCache<CM, string, ECPayOrder<CM>>;
  private readonly bindCardRequestsCache: BindCardRequestCache;

  private emulateRefundedOrder = new Set<string>();

  _server?: Server;

  constructor(options?: ECPayInitOptions<ECPayOrder<CM>>) {
    this.language = options?.language || this.language;
    this.baseUrl = options?.baseUrl || this.baseUrl;
    this.merchantId = options?.merchantId || this.merchantId;
    this.merchantCheckCode =
      options?.merchantCheckCode || this.merchantCheckCode;
    this.hashKey = options?.hashKey || this.hashKey;
    this.hashIv = options?.hashIv || this.hashIv;
    this.serverHost = options?.serverHost || this.serverHost;
    this.callbackPath = options?.callbackPath || this.callbackPath;
    this.asyncInfoPath = options?.asyncInfoPath || this.asyncInfoPath;
    this.checkoutPath = options?.checkoutPath || this.checkoutPath;
    this.bindCardPath = options?.bindCardPath || this.bindCardPath;
    this.boundCardPath = options?.boundCardPath || this.boundCardPath;
    this.boundCardFinishPath =
      options?.boundCardFinishPath || this.boundCardFinishPath;
    this.emulateRefund = !!options?.emulateRefund;

    if (options?.withServer) {
      this.serverListener = options?.serverListener || this.serverListener;

      this.createServer(options.withServer === 'ngrok');
    } else {
      this.isGatewayReady = true;
    }

    if (typeof options?.onCommit === 'function') {
      this.emitter.on(PaymentEvents.ORDER_COMMITTED, options.onCommit);
    }

    if (typeof options?.onInfoRetrieved === 'function') {
      this.emitter.on(
        PaymentEvents.ORDER_INFO_RETRIEVED,
        options.onInfoRetrieved,
      );
    }

    this.emitter.on(PaymentEvents.SERVER_LISTENED, () => {
      this.isGatewayReady = true;
    });

    if (typeof options?.onServerListen === 'function') {
      this.emitter.on(PaymentEvents.SERVER_LISTENED, options.onServerListen);
    }

    const lruCache = options?.ordersCache
      ? undefined
      : new LRUCache<string, ECPayOrder<CM>>({
          ttlAutopurge: true,
          ttl: options?.ttl ?? 10 * 60 * 1000, // default: 10 mins
        });

    this.pendingOrdersCache = options?.ordersCache ?? {
      get: async (key: string) => lruCache!.get(key),
      set: async (key: string, value: ECPayOrder<CM>) => {
        lruCache!.set(key, value);
      },
    };

    const requestLruCache = options?.bindCardRequestsCache
      ? undefined
      : new LRUCache<string, ECPayBindCardRequest>({
          ttlAutopurge: true,
          ttl: options?.ttl ?? 10 * 60 * 1000, // default: 10 mins
        });

    this.bindCardRequestsCache = options?.bindCardRequestsCache ?? {
      get: async (key: string) => requestLruCache!.get(key),
      set: async (key: string, value: ECPayBindCardRequest) => {
        requestLruCache!.set(key, value);
      },
    };
  }

  private getOrderId() {
    return randomBytes(10).toString('hex');
  }

  private addMac<T extends Record<string, string>>(
    payload: Omit<T, 'CheckMacValue'>,
  ): T {
    const mac = createHash('sha256')
      .update(
        encodeURIComponent(
          [
            ['HashKey', this.hashKey],
            ...Object.entries(payload).sort(([aKey], [bKey]) =>
              aKey.toLowerCase() < bKey.toLowerCase() ? -1 : 1,
            ),
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
      Object.entries(res).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: (value as unknown as string | number).toString(),
        }),
        {},
      ),
    );

    if (computedMac !== mac) return false;

    return true;
  }

  private createServer(useNgrok: boolean) {
    const url = new URL(this.serverHost);

    this._server = createServer((req, res) => this.serverListener(req, res));

    const port = Number(url.port || 3000);

    this._server.listen(port, '0.0.0.0', async () => {
      if (useNgrok) {
        const ngrokUrl = await ngrok.connect(port);

        this.serverHost = ngrokUrl;

        debugPayment(
          `ECPayment Callback Server Listen on port ${port} with ngrok url: ${ngrokUrl}`,
        );
      } else {
        debugPayment(`ECPayment Callback Server Listen on port ${port}`);
      }

      this.emitter.emit(PaymentEvents.SERVER_LISTENED);
    });
  }

  public async defaultServerListener(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const checkoutRe = new RegExp(`^${this.checkoutPath}/([^/]+)$`);
    const bindCardRe = new RegExp(`^${this.bindCardPath}/([^/]+)$`);

    if (req.method === 'GET' && req.url) {
      if (checkoutRe.test(req.url)) {
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

      if (bindCardRe.test(req.url)) {
        const memberId = RegExp.$1;

        if (memberId) {
          const request = await this.bindCardRequestsCache.get(memberId);

          if (request) {
            debugPayment(
              `ECPayment serve bind card page for member ${memberId}`,
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
      !~[
        this.asyncInfoPath,
        this.callbackPath,
        this.boundCardPath,
        this.boundCardFinishPath,
      ].indexOf(req.url)
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
          [key]:
            value !== '' && ~NUMERIC_CALLBACK_KEYS.indexOf(key)
              ? Number(value)
              : value,
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

      try {
        switch (req.url) {
          case this.asyncInfoPath:
          case this.callbackPath: {
            const paymentPayload = payload as ECPayPaymentCallbackPayload;
            const order = await this.pendingOrdersCache.get(
              paymentPayload.MerchantTradeNo,
            );

            if (!order || !order.committable) {
              res.writeHead(400, {
                'Content-Type': 'text/plain',
              });

              res.end('0|OrderNotFound');

              return;
            }

            if (req.url === this.asyncInfoPath) {
              debugPayment(
                `ECPayment handled async information for order ${paymentPayload.MerchantTradeNo}`,
              );

              this.handleAsyncInformation(order, paymentPayload);
            } else {
              debugPayment(
                `ECPayment handled payment result for order ${paymentPayload.MerchantTradeNo}`,
              );

              this.handlePaymentResult(order, paymentPayload);
            }

            break;
          }

          case this.boundCardPath:
          case this.boundCardFinishPath: {
            const bindCardPayload = payload as ECPayBindCardCallbackPayload;
            const request = await this.bindCardRequestsCache.get(
              bindCardPayload.MerchantMemberID.replace(
                new RegExp(`^${bindCardPayload.MerchantID}`),
                '',
              ),
            );

            if (
              !request ||
              request.state !== ECPayBindCardRequestState.FORM_GENERATED
            ) {
              res.writeHead(400, {
                'Content-Type': 'text/plain',
              });

              res.end('0|RequestNotFound');

              return;
            }

            debugPayment('ECPayment handled bind card result');

            this.handleBindCardResult(request, bindCardPayload);
            break;
          }
        }

        res.writeHead(200, {
          'Content-Type': 'text/plain',
        });

        res.end('1|OK');
      } catch (ex) {
        res.writeHead(400, {
          'Content-Type': 'text/plain',
        });

        res.end('0|OrderNotFound');
      }
    });
  }

  public handleBindCardResult(
    request: ECPayBindCardRequest,
    payload: ECPayBindCardCallbackPayload,
  ): void {
    // CardNo is existed.
    if (payload.RtnCode === 10100112) {
      request.fail(payload.RtnCode.toString(), payload.RtnMsg, payload);

      return;
    }

    if (payload.RtnCode !== 1) {
      request.fail(payload.RtnCode.toString(), payload.RtnMsg);

      return;
    }

    request.bound(payload);
  }

  public handlePaymentResult(
    order: ECPayOrder<ECPayCommitMessage>,
    payload: ECPayPaymentCallbackPayload,
  ): void {
    if (payload.RtnCode !== 1) {
      order.fail(payload.RtnCode.toString(), payload.RtnMsg);

      return;
    }

    switch (payload.PaymentType) {
      case ECPayCallbackPaymentType.BARCODE: {
        const barcodePayload = payload as ECPayCallbackBarcodePayload;

        order.commit<ECPayOrderBarcodeCommitMessage>({
          id: payload.MerchantTradeNo,
          totalPrice: payload.TradeAmt,
          committedAt: DateTime.fromFormat(
            barcodePayload.PaymentDate,
            'yyyy/MM/dd HH:mm:ss',
          ).toJSDate(),
          merchantId: payload.MerchantID,
          tradeNumber: payload.TradeNo,
          tradeDate: DateTime.fromFormat(
            payload.TradeDate,
            'yyyy/MM/dd HH:mm:ss',
          ).toJSDate(),
          paymentType: payload.PaymentType,
        });

        break;
      }

      case ECPayCallbackPaymentType.CVS:
      case ECPayCallbackPaymentType.CVS_FAMILY:
      case ECPayCallbackPaymentType.CVS_HILIFE:
      case ECPayCallbackPaymentType.CVS_IBON:
      case ECPayCallbackPaymentType.CVS_OK: {
        const cvsInfo = payload as ECPayCallbackCVSPayload;

        order.commit<ECPayOrderCVSCommitMessage>(
          {
            id: payload.MerchantTradeNo,
            totalPrice: payload.TradeAmt,
            committedAt: DateTime.fromFormat(
              cvsInfo.PaymentDate,
              'yyyy/MM/dd HH:mm:ss',
            ).toJSDate(),
            merchantId: payload.MerchantID,
            tradeNumber: payload.TradeNo,
            tradeDate: DateTime.fromFormat(
              payload.TradeDate,
              'yyyy/MM/dd HH:mm:ss',
            ).toJSDate(),
            paymentType: payload.PaymentType,
          },
          {
            channel: Channel.CVS_KIOSK,
            cvsPayFrom: ECPayCVS[cvsInfo.PayFrom],
          },
        );

        break;
      }

      case ECPayCallbackPaymentType.ATM_BOT:
      case ECPayCallbackPaymentType.ATM_CHINATRUST:
      case ECPayCallbackPaymentType.ATM_FIRST:
      case ECPayCallbackPaymentType.ATM_LAND:
      case ECPayCallbackPaymentType.ATM_TACHONG:
      case ECPayCallbackPaymentType.ATM_PANHSIN: {
        const virtualAccountInfo =
          payload as ECPayCallbackVirtualAccountPayload;

        if (order.paymentType !== payload.PaymentType) {
          throw new Error('Order Not Found');
        }

        order.commit<ECPayOrderVirtualAccountCommitMessage>(
          {
            id: payload.MerchantTradeNo,
            totalPrice: payload.TradeAmt,
            committedAt: DateTime.fromFormat(
              virtualAccountInfo.PaymentDate,
              'yyyy/MM/dd HH:mm:ss',
            ).toJSDate(),
            merchantId: payload.MerchantID,
            tradeNumber: payload.TradeNo,
            tradeDate: DateTime.fromFormat(
              payload.TradeDate,
              'yyyy/MM/dd HH:mm:ss',
            ).toJSDate(),
            paymentType: payload.PaymentType,
          },
          {
            channel: Channel.VIRTUAL_ACCOUNT,
            buyerAccountNumber: virtualAccountInfo.ATMAccNo,
            buyerBankCode: virtualAccountInfo.ATMAccBank,
          } as VirtualAccountPaymentInfo,
        );

        break;
      }

      case ECPayCallbackPaymentType.CREDIT_CARD: {
        const creditCardInfo = payload as ECPayCallbackCreditPayload;

        order.commit<ECPayOrderCreditCardCommitMessage>(
          {
            id: payload.MerchantTradeNo,
            totalPrice: payload.TradeAmt,
            committedAt: DateTime.fromFormat(
              creditCardInfo.PaymentDate,
              'yyyy/MM/dd HH:mm:ss',
            ).toJSDate(),
            merchantId: payload.MerchantID,
            tradeNumber: payload.TradeNo,
            tradeDate: DateTime.fromFormat(
              payload.TradeDate,
              'yyyy/MM/dd HH:mm:ss',
            ).toJSDate(),
            paymentType: payload.PaymentType,
          },
          {
            channel: Channel.CREDIT_CARD,
            processDate: DateTime.fromFormat(
              creditCardInfo.process_date,
              'yyyy/MM/dd HH:mm:ss',
            ).toJSDate(),
            authCode: creditCardInfo.auth_code,
            amount: creditCardInfo.amount,
            eci: creditCardInfo.eci,
            card4Number: creditCardInfo.card4no,
            card6Number: creditCardInfo.card6no,
            gwsr: creditCardInfo.gwsr,
          } as CreditCardAuthInfo,
        );

        break;
      }

      default:
        throw new Error('Order Not Found');
    }
  }

  public handleAsyncInformation(
    order: ECPayOrder<ECPayCommitMessage>,
    payload: ECPayAsyncInformationPayload,
  ): void {
    if (order.state !== OrderState.PRE_COMMIT) {
      return;
    }

    switch (payload.PaymentType) {
      case ECPayCallbackPaymentType.BARCODE:
        if (payload.RtnCode === 10100073) {
          const asyncInfo = payload as ECPayAsyncInformationBarcodePayload;

          order.infoRetrieved<ECPayOrderBarcodeCommitMessage>({
            channel: Channel.CVS_BARCODE,
            barcodes: [
              asyncInfo.Barcode1,
              asyncInfo.Barcode2,
              asyncInfo.Barcode3,
            ],
            expiredAt: DateTime.fromFormat(
              asyncInfo.ExpireDate,
              'yyyy/MM/dd HH:mm:ss',
            ).toJSDate(),
          } as BarcodeInfo);
        } else {
          order.fail(payload.RtnCode.toString(), payload.RtnMsg);

          debugPayment(`Get barcode number failed: ${order.id}`);
        }

        break;

      case ECPayCallbackPaymentType.CVS:
      case ECPayCallbackPaymentType.CVS_FAMILY:
      case ECPayCallbackPaymentType.CVS_HILIFE:
      case ECPayCallbackPaymentType.CVS_IBON:
      case ECPayCallbackPaymentType.CVS_OK:
        if (payload.RtnCode === 10100073) {
          const asyncInfo = payload as ECPayAsyncInformationCVSPayload;

          order.infoRetrieved<ECPayOrderCVSCommitMessage>({
            channel: Channel.CVS_KIOSK,
            paymentType: payload.PaymentType,
            paymentCode: asyncInfo.PaymentNo,
            expiredAt: DateTime.fromFormat(
              asyncInfo.ExpireDate,
              'yyyy/MM/dd HH:mm:ss',
            ).toJSDate(),
          } as CVSInfo);
        } else {
          order.fail(payload.RtnCode.toString(), payload.RtnMsg);

          debugPayment(`Get cvs kiosk number failed: ${order.id}`);
        }

        break;

      case ECPayCallbackPaymentType.ATM_BOT:
      case ECPayCallbackPaymentType.ATM_CHINATRUST:
      case ECPayCallbackPaymentType.ATM_FIRST:
      case ECPayCallbackPaymentType.ATM_LAND:
      case ECPayCallbackPaymentType.ATM_TACHONG:
      case ECPayCallbackPaymentType.ATM_PANHSIN:
        if (
          order.paymentType !== ECPayCallbackPaymentType.VIRTUAL_ACCOUNT_WAITING
        ) {
          throw new Error('Order Not Found');
        }

        if (payload.RtnCode === 2) {
          const asyncInfo =
            payload as ECPayAsyncInformationVirtualAccountPayload;

          order.infoRetrieved<ECPayOrderVirtualAccountCommitMessage>(
            {
              channel: Channel.VIRTUAL_ACCOUNT,
              bankCode: asyncInfo.BankCode,
              account: asyncInfo.vAccount,
              expiredAt: DateTime.fromFormat(
                asyncInfo.ExpireDate,
                'yyyy/MM/dd',
              ).toJSDate(),
            } as VirtualAccountInfo,
            payload.PaymentType,
          );
        } else {
          order.fail(payload.RtnCode.toString(), payload.RtnMsg);

          debugPayment(`Get virutal account failed: ${order.id}`);
        }

        break;

      default:
        throw new Error('Order Not Found');
    }
  }

  async prepare<P extends CM>(
    orderInput: GetOrderInput<P>,
  ): Promise<ECPayOrder<P>> {
    if (!this.isGatewayReady) {
      throw new Error('Please waiting gateway ready');
    }

    if (
      orderInput.channel &&
      orderInput.channel !== Channel.CREDIT_CARD &&
      (orderInput as ECPayCreditCardOrderInput).memory
    ) {
      throw new Error('`memory` only use on credit card channel');
    }

    if (
      'cvsBarcodeExpireDays' in orderInput &&
      orderInput.channel !== Channel.CVS_BARCODE
    ) {
      throw new Error(
        '`cvsBarcodeExpireDays` only work on virtual account channel',
      );
    }

    if (
      'cvsExpireMinutes' in orderInput &&
      orderInput.channel !== Channel.CVS_KIOSK
    ) {
      throw new Error(
        '`cvsExpireMinutes` only work on virtual account channel',
      );
    }

    if (
      'virtualAccountExpireDays' in orderInput &&
      orderInput.channel !== Channel.VIRTUAL_ACCOUNT
    ) {
      throw new Error(
        '`virtualAccountExpireDays` only work on virtual account channel',
      );
    }

    if (
      'allowUnionPay' in orderInput &&
      orderInput.channel &&
      orderInput.channel !== Channel.CREDIT_CARD
    ) {
      throw new Error('Union Pay should use credit card channel');
    }

    if (
      'allowCreditCardRedeem' in orderInput &&
      orderInput.channel &&
      orderInput.channel !== Channel.CREDIT_CARD
    ) {
      throw new Error('`allowCreditCardRedeem` should use credit card channel');
    }

    if (
      'installments' in orderInput &&
      orderInput.channel !== Channel.CREDIT_CARD
    ) {
      throw new Error('`installments` should use credit card channel');
    }

    if ('period' in orderInput && orderInput.channel !== Channel.CREDIT_CARD) {
      throw new Error('`period` should use credit card channel');
    }

    const orderId = orderInput.id || this.getOrderId();
    const now = new Date();

    const totalAmount = orderInput.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );

    const payload = {
      MerchantID: this.merchantId,
      MerchantTradeNo: orderId,
      MerchantTradeDate: DateTime.fromJSDate(now).toFormat(
        'yyyy/MM/dd HH:mm:ss',
      ),
      PaymentType: 'aio',
      TotalAmount: totalAmount.toString(),
      TradeDesc: orderInput.description || '-',
      ItemName: orderInput.items
        .map((item) => `${item.name.replace(/#/g, '%23')} x${item.quantity}`)
        .join('#'),
      ReturnURL: `${this.serverHost}${this.callbackPath}`,
      ChoosePayment: orderInput.channel
        ? ECPayChannel[orderInput.channel]
        : 'ALL',
      NeedExtraPaidInfo: 'Y',
      EncryptType: '1',
      OrderResultURL: orderInput.clientBackUrl || '',
      Language: this.language,
      CustomField1: '',
      CustomField2: '',
      CustomField3: '',
      CustomField4: orderInput.items.map((item) => item.unitPrice).join('#'),
    } as Omit<ECPayOrderForm, 'CheckMacValue'>;

    if (!orderInput.channel || orderInput.channel === Channel.CREDIT_CARD) {
      if (totalAmount < 5) {
        throw new Error('Credit card channel minimum amount is 5');
      }

      if (totalAmount > 199999) {
        throw new Error('Credit card channel maximum amount is 199999');
      }

      if (orderInput.memory && !orderInput.memberId) {
        throw new Error('Memory card should provide `memberId`.');
      }

      if (orderInput.installments) {
        if (orderInput.allowCreditCardRedeem) {
          throw new Error(
            '`installments` should not working with `allowCreditCardRedeem`',
          );
        }

        if (orderInput.period) {
          throw new Error('`installments` should not working with `period`');
        }

        if (orderInput.installments!.match(/[^,0-9]/)) {
          throw new Error('`installments` format invalid, example: 3,6,9,12');
        }

        const installments = orderInput.installments!.split(/,/g);

        if (
          installments.some((period) => !period || Number.isNaN(Number(period)))
        ) {
          throw new Error('`installments` format invalid, example: 3,6,9,12');
        }
      }

      if (orderInput.period) {
        if (orderInput.period.frequency !== undefined) {
          switch (orderInput.period.type) {
            case PaymentPeriodType.MONTH:
              if (orderInput.period.frequency < 1)
                throw new Error(
                  '`period.frequency` should between 1 and 12 when `period.type` set to MONTH',
                );
              if (orderInput.period.frequency > 12)
                throw new Error(
                  '`period.frequency` should between 1 and 12 when `period.type` set to MONTH',
                );
              break;

            case PaymentPeriodType.YEAR:
              if (orderInput.period.frequency !== 1)
                throw new Error(
                  '`period.frequency` should be 1 when `period.type` set to YEAR',
                );
              break;

            case PaymentPeriodType.DAY:
            default:
              if (orderInput.period.frequency < 1)
                throw new Error(
                  '`period.frequency` should between 1 and 365 when `period.type` set to DAY',
                );
              if (orderInput.period.frequency > 365)
                throw new Error(
                  '`period.frequency` should between 1 and 365 when `period.type` set to DAY',
                );
              break;
          }
        }

        if (orderInput.period!.times < 1) {
          throw new Error('Invalid `period.times`, should >= 1');
        }

        switch (orderInput.period!.type) {
          case PaymentPeriodType.MONTH:
            if (orderInput.period!.times > 99)
              throw new Error(
                '`period.times` should below 99 when `period.type` set to MONTH',
              );
            break;

          case PaymentPeriodType.YEAR:
            if (orderInput.period!.times > 9)
              throw new Error(
                '`period.times` should below 9 when `period.type` set to YEAR',
              );
            break;

          case PaymentPeriodType.DAY:
          default:
            if (orderInput.period!.times > 999)
              throw new Error(
                '`period.times` should below 999 when `period.type` set to DAY',
              );
            break;
        }
      }

      if (orderInput.memory) {
        payload.BindingCard = '1';
        payload.MerchantMemberID = `${this.merchantId}${orderInput.memberId}`;
      }

      if (orderInput.allowCreditCardRedeem) {
        payload.Redeem = 'Y';
      }

      if (orderInput.allowUnionPay) {
        payload.UnionPay = '0';
      }

      if (orderInput.installments) {
        payload.CreditInstallment = orderInput.installments!;
      }

      if (orderInput.period) {
        payload.PeriodAmount = orderInput.period.amountPerPeriod.toString();
        payload.PeriodType = ECPayPaymentPeriodType[orderInput.period.type];
        payload.Frequency = (orderInput.period.frequency || 1).toString();
        payload.ExecTimes = orderInput.period.times.toString();
        payload.PeriodReturnURL = `${this.serverHost}${this.callbackPath}`;
      }
    }

    if (orderInput.channel === Channel.VIRTUAL_ACCOUNT) {
      if (totalAmount < 11) {
        throw new Error('Virtual account channel minimum amount is 11');
      }

      if (totalAmount > 49999) {
        throw new Error('Virtual account channel maximum amount is 49999');
      }

      if (orderInput.virtualAccountExpireDays !== undefined) {
        if (orderInput.virtualAccountExpireDays < 1)
          throw new Error(
            '`virtualAccountExpireDays` should between 1 and 60 days',
          );
        if (orderInput.virtualAccountExpireDays > 60)
          throw new Error(
            '`virtualAccountExpireDays` should between 1 and 60 days',
          );
      }

      if (orderInput.virtualAccountExpireDays) {
        payload.ExpireDate = orderInput.virtualAccountExpireDays!.toString();
      } else {
        payload.ExpireDate = '3';
      }

      payload.ChooseSubPayment = orderInput.bank?.toString() ?? '';
      payload.PaymentInfoURL = `${this.serverHost}${this.asyncInfoPath}`;
      payload.ClientRedirectURL = orderInput.clientBackUrl || '';
    }

    if (orderInput.channel === Channel.CVS_KIOSK) {
      if (totalAmount < 33) {
        throw new Error('CVS channel minimum amount is 33');
      }

      if (totalAmount > 6000) {
        throw new Error('CVS channel maximum amount is 6000');
      }

      if (orderInput.cvsExpireMinutes !== undefined) {
        if (orderInput.cvsExpireMinutes < 1)
          throw new Error(
            '`cvsExpireMinutes` should between 1 and 43200 miuntes',
          );
        if (orderInput.cvsExpireMinutes > 43200)
          throw new Error(
            '`cvsExpireMinutes` should between 1 and 43200 miuntes',
          );
      }

      if (orderInput.cvsExpireMinutes) {
        payload.StoreExpireDate = orderInput.cvsExpireMinutes!.toString();
      } else {
        payload.StoreExpireDate = '10080';
      }

      payload.PaymentInfoURL = `${this.serverHost}${this.asyncInfoPath}`;
      payload.ClientRedirectURL = orderInput.clientBackUrl || '';
    }

    if (orderInput.channel === Channel.CVS_BARCODE) {
      if (totalAmount < 17) {
        throw new Error('CVS barcode channel minimum amount is 17');
      }

      if (totalAmount > 20000) {
        throw new Error('CVS barcode channel maximum amount is 20000');
      }

      if (orderInput.cvsBarcodeExpireDays !== undefined) {
        // Not documented
        if (orderInput.cvsBarcodeExpireDays < 1)
          throw new Error('`cvsBarcodeExpireDays` should between 1 and 7 days');
        if (orderInput.cvsBarcodeExpireDays > 7)
          throw new Error('`cvsBarcodeExpireDays` should between 1 and 7 days');
      }

      if (orderInput.cvsBarcodeExpireDays) {
        payload.StoreExpireDate = orderInput.cvsBarcodeExpireDays!.toString();
      } else {
        payload.StoreExpireDate = '7';
      }

      payload.PaymentInfoURL = `${this.serverHost}${this.asyncInfoPath}`;
      payload.ClientRedirectURL = orderInput.clientBackUrl || '';
    }

    const order = new ECPayOrder<P>({
      id: orderId,
      items: orderInput.items,
      form: this.addMac<ECPayOrderForm>(payload),
      gateway: this,
    }) as ECPayOrder<P>;

    await this.pendingOrdersCache.set(order.id, order);

    return order;
  }

  async query<T extends ECPayOrder<ECPayCommitMessage>>(
    id: string,
  ): Promise<T> {
    if (!this.isGatewayReady) {
      throw new Error('Please waiting gateway ready');
    }

    const date = new Date();

    const payload = this.addMac<ECPayQueryOrderPayload>({
      MerchantID: this.merchantId,
      MerchantTradeNo: id,
      PlatformID: '',
      TimeStamp: Math.round(date.getTime() / 1000).toString(),
    });

    const result = await axios.post<string>(
      `${this.baseUrl}/Cashier/QueryTradeInfo/V5`,
      new URLSearchParams(payload).toString(),
    );

    const response = Array.from(
      new URLSearchParams(result.data).entries(),
    ).reduce(
      (vars, [key, value]) => ({
        ...vars,
        [key]: value,
      }),
      {},
    ) as ECPayQueryResultPayload;

    if (!this.checkMac<ECPayQueryResultPayload>(response)) {
      throw new Error('Invalid CheckSum');
    }

    const unitPrices = (response.CustomField4 || '')
      .split(/#/)
      .filter((unitPrice) => unitPrice !== '');

    const items = response.ItemName.split(/#/).map((itemStr, index) => {
      const [name, quantity] = itemStr.split(/\sx(\d+)$/);

      return {
        name: name.replace(/%23/g, '#'),
        quantity: Number(quantity),
        unitPrice:
          unitPrices[index] !== undefined
            ? Number(unitPrices[index])
            : index === 0
              ? Number(response.TradeAmt)
              : 0,
      };
    });

    const baseOrderInfo = {
      id: response.MerchantTradeNo,
      items,
      gateway: this as ECPayPayment<ECPayCommitMessage>,
      createdAt: DateTime.fromFormat(
        response.TradeDate,
        'yyyy/MM/dd HH:mm:ss',
      ).toJSDate(),
      committedAt: response.PaymentDate
        ? DateTime.fromFormat(
            response.PaymentDate,
            'yyyy/MM/dd HH:mm:ss',
          ).toJSDate()
        : null,
      platformTradeNumber: response.MerchantTradeNo,
      paymentType: response.PaymentType,
      status: response.TradeStatus,
    };

    switch (response.PaymentType) {
      case ECPayCallbackPaymentType.CREDIT_CARD:
        return new ECPayOrder<ECPayOrderCreditCardCommitMessage>(
          baseOrderInfo,
          {
            channel: Channel.CREDIT_CARD,
            processDate: DateTime.fromFormat(
              response.process_date,
              'yyyy/MM/dd HH:mm:ss',
            ).toJSDate(),
            authCode: response.auth_code,
            amount: Number(response.amount),
            eci: response.eci,
            card4Number: response.card4no,
            card6Number: response.card6no,
            gwsr: response.gwsr,
          } as CreditCardAuthInfo,
        ) as T;

      case ECPayCallbackPaymentType.ATM_BOT:
      case ECPayCallbackPaymentType.ATM_CHINATRUST:
      case ECPayCallbackPaymentType.ATM_FIRST:
      case ECPayCallbackPaymentType.ATM_LAND:
      case ECPayCallbackPaymentType.ATM_TACHONG:
      case ECPayCallbackPaymentType.ATM_PANHSIN:
        return new ECPayOrder<ECPayOrderVirtualAccountCommitMessage>(
          baseOrderInfo,
          {
            channel: Channel.VIRTUAL_ACCOUNT,
            buyerAccountNumber: response.ATMAccNo,
            buyerBankCode: response.ATMAccBank,
          } as VirtualAccountPaymentInfo,
        ) as T;

      case ECPayCallbackPaymentType.CVS:
      case ECPayCallbackPaymentType.CVS_FAMILY:
      case ECPayCallbackPaymentType.CVS_HILIFE:
      case ECPayCallbackPaymentType.CVS_IBON:
      case ECPayCallbackPaymentType.CVS_OK:
        return new ECPayOrder<ECPayOrderCVSCommitMessage>(baseOrderInfo, {
          channel: Channel.CVS_KIOSK,
          cvsPayFrom: ECPayCVS[response.PayFrom],
        }) as T;

      default:
        return new ECPayOrder(baseOrderInfo) as T;
    }
  }

  getCheckoutUrl(order: ECPayOrder<ECPayCommitMessage>): string {
    return `${this.serverHost}${this.checkoutPath}/${order.id}`;
  }

  getBindingURL(bindCardRequest: ECPayBindCardRequest): string {
    return `${this.serverHost}${this.bindCardPath}/${bindCardRequest.memberId}`;
  }

  private getEmulatedCreditCardTradeStatusResponse(
    gwsr: string,
    amount: number,
  ): { data: ECPayCreditCardDetailQueryResponse } {
    if (this.emulateRefundedOrder.has(gwsr)) {
      return {
        data: {
          RtnMsg: '',
          RtnValue: {
            TradeID: Date.now().toString(),
            amount: amount.toString(),
            clsamt: amount.toString(),
            authtime: DateTime.local().toFormat('yyyy/M/dd tt'),
            status: ECPayCreditCardOrderStatus.CLOSED,
            close_data: [
              {
                status: ECPayCreditCardOrderCloseStatus.COMMITTED,
                sno: Date.now().toString(),
                amount: amount.toString(),
                datetime: DateTime.local().toFormat('yyyy/M/dd tt'),
              },
            ],
          },
        },
      };
    }

    this.emulateRefundedOrder.add(gwsr);

    return {
      data: {
        RtnMsg: '',
        RtnValue: {
          TradeID: Date.now().toString(),
          amount: amount.toString(),
          clsamt: amount.toString(),
          authtime: DateTime.local().toFormat('yyyy/M/dd tt'),
          status: ECPayCreditCardOrderStatus.CLOSED,
          close_data: [
            {
              status: ECPayCreditCardOrderCloseStatus.COMMITTED,
              sno: Date.now().toString(),
              amount: amount.toString(),
              datetime: DateTime.local().toFormat('yyyy/M/dd tt'),
            },
          ],
        },
      },
    };
  }

  async getCreditCardTradeStatus(
    gwsr: string,
    amount: number,
  ): Promise<ECPayCreditCardOrderStatus> {
    if (!this.isGatewayReady) {
      throw new Error('Please waiting gateway ready');
    }

    const payload = this.addMac<ECPayCreditCardDetailQueryPayload>({
      MerchantID: this.merchantId,
      CreditRefundId: gwsr,
      CreditAmount: amount.toString(),
      CreditCheckCode: this.merchantCheckCode.toString(),
    });

    const result = this.emulateRefund
      ? this.getEmulatedCreditCardTradeStatusResponse(gwsr, amount)
      : await axios.post<ECPayCreditCardDetailQueryResponse>(
          `${this.baseUrl}/CreditDetail/QueryTrade/V2`,
          new URLSearchParams(payload).toString(),
        );

    return result.data.RtnValue.status;
  }

  private getEmulatedOrderActionResponse(
    merchantId: string,
    merchantTradeNo: string,
    tradeNo: string,
  ): { data: ECPayOrderDoActionResponse } {
    return {
      data: {
        MerchantID: merchantId,
        MerchantTradeNo: merchantTradeNo,
        TradeNo: tradeNo,
        RtnCode: 1,
        RtnMsg: '',
      },
    };
  }

  async doOrderAction(
    order: ECPayOrder<ECPayCommitMessage>,
    action: 'R' | 'N',
    amount: number,
  ): Promise<void> {
    if (!this.isGatewayReady) {
      throw new Error('Please waiting gateway ready');
    }

    const payload = this.addMac<ECPayOrderActionPayload>({
      MerchantID: this.merchantId,
      MerchantTradeNo: order.id,
      TradeNo: order.platformTradeNumber as string,
      Action: action,
      TotalAmount: amount.toString(),
    });

    const result = this.emulateRefund
      ? this.getEmulatedOrderActionResponse(
          this.merchantId,
          order.id,
          order.platformTradeNumber as string,
        )
      : await axios.post<ECPayOrderDoActionResponse>(
          `${this.baseUrl}/CreditDetail/DoAction`,
          new URLSearchParams(payload).toString(),
        );

    if (result.data.RtnCode !== 1) {
      throw new Error(result.data.RtnMsg || 'Unknown error');
    }
  }

  async bindCardWithTransaction(
    memberId: string,
    orderIdFromECPay: string,
    bindingOrderId?: string,
  ): Promise<ECPayBindCardRequest> {
    const payload = this.addMac<ECPayBindCardWithTransactionRequestPayload>({
      MerchantID: this.merchantId,
      MerchantMemberID: `${this.merchantId}${memberId}`,
      MerchantTradeNo: bindingOrderId ?? randomBytes(10).toString('hex'),
      AllpayTradeNo: orderIdFromECPay,
    });

    const { data } = await axios.post<string>(
      `${this.baseUrl}/MerchantMember/BindingTrade`,
      new URLSearchParams(payload).toString(),
    );

    const responsePayload = Array.from(
      new URLSearchParams(data).entries(),
    ).reduce(
      (vars, [key, value]) => ({
        ...vars,
        [key]:
          value !== '' && ~NUMERIC_CALLBACK_KEYS.indexOf(key)
            ? Number(value)
            : value,
      }),
      {},
    ) as ECPayBoundCardWithTransactionResponsePayload;

    if (
      !this.checkMac<ECPayBoundCardWithTransactionResponsePayload>(
        responsePayload,
      )
    ) {
      throw new Error('Invalid CheckSum');
    }

    // 1: Success, 10100112: Already bound
    if (!~[1, 10100112].indexOf(responsePayload.RtnCode)) {
      throw new Error(responsePayload.RtnMsg);
    }

    return new ECPayBindCardRequest(
      {
        memberId,
        cardId: responsePayload.CardID,
        cardNumberPrefix: responsePayload.Card6No,
        cardNumberSuffix: responsePayload.Card4No,
        bindingDate: DateTime.fromFormat(
          responsePayload.BindingDate,
          'yyyy/MM/dd HH:mm:ss',
        ).toJSDate(),
      },
      this,
    );
  }

  async prepareBindCard(
    memberId: string,
    finishRedirectURL?: string,
  ): Promise<ECPayBindCardRequest> {
    const payload = this.addMac<ECPayBindCardRequestPayload>({
      MerchantID: this.merchantId,
      MerchantMemberID: `${this.merchantId}${memberId}`,
      ServerReplyURL: `${this.serverHost}${this.boundCardPath}`,
      ClientRedirectURL:
        finishRedirectURL ?? `${this.serverHost}${this.boundCardFinishPath}`,
    });

    const request = new ECPayBindCardRequest(payload, this);

    await this.bindCardRequestsCache.set(memberId, request);

    return request;
  }

  async checkoutWithBoundCard(
    options: ECPayCheckoutWithBoundCardPayload,
  ): Promise<ECPayCheckoutWithBoundCardResult> {
    const payload = this.addMac<ECPayCheckoutWithBoundCardRequestPayload>({
      MerchantID: this.merchantId,
      MerchantMemberID: `${this.merchantId}${options.memberId}`,
      MerchantTradeNo: options.orderId || this.getOrderId(),
      MerchantTradeDate: DateTime.fromJSDate(
        options.tradeTime || new Date(),
      ).toFormat('yyyy/MM/dd HH:mm:ss'),
      TotalAmount: options.amount.toString(),
      TradeDesc: encodeURIComponent(options.description),
      CardID: options.cardId,
      stage: (options.installments ?? 0).toString(),
    });

    const { data } = await axios.post<string>(
      `${this.baseUrl}/MerchantMember/AuthCardID/V2`,
      new URLSearchParams(payload).toString(),
    );

    const responsePayload = Array.from(
      new URLSearchParams(data).entries(),
    ).reduce(
      (vars, [key, value]) => ({
        ...vars,
        [key]:
          value !== '' && ~NUMERIC_CALLBACK_KEYS.indexOf(key)
            ? Number(value)
            : value,
      }),
      {},
    ) as ECPayCheckoutWithBoundCardResponsePayload;

    if (
      !this.checkMac<ECPayCheckoutWithBoundCardResponsePayload>(responsePayload)
    ) {
      throw new Error('Invalid CheckSum');
    }

    if (responsePayload.RtnCode !== 1) {
      throw new Error(responsePayload.RtnMsg);
    }

    return {
      id: responsePayload.MerchantTradeNo,
      platformTradeNumber: responsePayload.AllpayTradeNo,
      amount: responsePayload.amount,
      installments: Number(responsePayload.stage),
      firstInstallmentAmount: Number(responsePayload.stast),
      eachInstallmentAmount: Number(responsePayload.staed),
      gwsr: responsePayload.gwsr.toString(),
      process_date: DateTime.fromFormat(
        responsePayload.process_date,
        'yyyy/MM/dd HH:mm:ss',
      ).toJSDate(),
      auth_code: responsePayload.auth_code,
      eci: responsePayload.eci,
      lastFourDigits: responsePayload.card4no,
      firstSixDigits: responsePayload.card6no,
    };
  }

  async queryBoundCard(memberId: string): Promise<ECPayBoundCardInfo> {
    const payload = this.addMac<ECPayCheckoutWithBoundCardRequestPayload>({
      MerchantID: this.merchantId,
      MerchantMemberID: `${this.merchantId}${memberId}`,
    });

    const { data } = await axios.post<string>(
      `${this.baseUrl}/MerchantMember/QueryMemberBinding`,
      new URLSearchParams(payload).toString(),
    );

    const responsePayload = Array.from(
      new URLSearchParams(data).entries(),
    ).reduce(
      (vars, [key, value]) => ({
        ...vars,
        [key]:
          value !== '' && ~NUMERIC_CALLBACK_KEYS.indexOf(key)
            ? Number(value)
            : value,
      }),
      {},
    ) as ECPayBoundCardQueryResponsePayload;

    if (!this.checkMac<ECPayBoundCardQueryResponsePayload>(responsePayload)) {
      throw new Error('Invalid CheckSum');
    }

    if (!responsePayload.Count) {
      throw new Error('No card found');
    }

    const jsonPayload = JSON.parse(responsePayload.JSonData) as {
      CardID: string;
      Card6No: string;
      Card4No: string;
      CardExpireDate: string;
      BindingDate: string;
    };

    return {
      cardId: jsonPayload.CardID,
      cardNumberPrefix: jsonPayload.Card6No,
      cardNumberSuffix: jsonPayload.Card4No,
      bindingDate: DateTime.fromFormat(
        jsonPayload.BindingDate,
        'yyyy/MM/dd HH:mm:ss',
      ).toJSDate(),
      expireDate: DateTime.fromFormat(jsonPayload.CardExpireDate, 'yyMM')
        .startOf('month')
        .toJSDate(),
    };
  }
}
