import {
  AdditionalInfo,
  BindCardPaymentGateway,
  CardType,
  Channel,
  CreditCardECI,
  InputFromOrderCommitMessage,
  Order,
  OrderCreditCardCommitMessage,
  OrderState,
  PaymentEvents,
  PaymentGateway,
} from '@rytass/payments';
import debug from 'debug';
import * as iconv from 'iconv-lite';
import { LRUCache } from 'lru-cache';
import { DateTime } from 'luxon';
import { createDecipheriv, randomBytes } from 'node:crypto';
import EventEmitter from 'node:events';
import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { URLSearchParams } from 'node:url';
import { CTBCBindCardRequest } from './ctbc-bind-card-request';
import { decrypt3DES, desMac, encrypt3DES, getDivKey, getMAC, getMacFromParams, SSLAuthIV } from './ctbc-crypto-core';
import { CTBCOrder } from './ctbc-order';
import { posApiQuery } from './ctbc-pos-api-utils';
import {
  BindCardRequestCache,
  CTBCBindCardRequestPayload,
  CTBCCheckoutWithBoundCardOptions,
  CTBCOrderCommitMessage,
  CTBCOrderFormKey,
  CTBCPaymentOptions,
  CTBCPayOrderForm,
  CTBCPosApiConfig,
  CTBCPosApiQueryParams,
  CTBCRawRequest,
  CTBCRequestPrepareBindCardOptions,
  CTBCResponsePayload,
  OrderCache,
} from './typings';
import { CtbcPaymentFailedError } from './errors';

export const debugPayment = debug('Rytass:Payment:CTBC');
export const debugPaymentServer = debug('Rytass:Payment:CTBC:Server');

export class CTBCPayment<CM extends CTBCOrderCommitMessage = CTBCOrderCommitMessage>
  implements PaymentGateway<CM, CTBCOrder<CM>>, BindCardPaymentGateway<CM>
{
  private serverHost = 'http://localhost:3000';
  private readonly callbackPath: string = '/payments/ctbc/callback';
  private readonly checkoutPath: string = '/payments/ctbc/checkout';
  private readonly bindCardPath: string = '/payments/ctbc/bind-card';
  private readonly boundCardPath: string = '/payments/ctbc/bound-card';
  private readonly boundCardCheckoutResultPath: string = '/payments/ctbc/bound-card/checkout-result';
  private readonly isAmex: boolean = false;

  readonly merchantId: string;
  readonly merId: string;
  readonly txnKey: string;
  readonly terminalId: string;
  readonly baseUrl: string;
  readonly endpoint: string;

  readonly emitter = new EventEmitter();

  _server?: Server;

  private isGatewayReady = false;
  private readonly serverListener: (req: IncomingMessage, res: ServerResponse) => void = (req, res) =>
    this.defaultServerListener(req, res);

  private readonly orderCache: OrderCache<CM>;
  private readonly bindCardRequestsCache: BindCardRequestCache;

  constructor(options: CTBCPaymentOptions) {
    this.merchantId = options.merchantId;
    this.merId = options.merId;
    this.txnKey = options.txnKey;
    this.terminalId = options.terminalId;
    this.baseUrl = options.baseUrl ?? 'https://testepos.ctbcbank.com';
    this.serverHost = options?.serverHost || this.serverHost;
    this.callbackPath = options?.callbackPath || this.callbackPath;
    this.checkoutPath = options?.checkoutPath || this.checkoutPath;
    this.bindCardPath = options?.bindCardPath || this.bindCardPath;
    this.boundCardPath = options?.boundCardPath || this.boundCardPath;
    this.boundCardCheckoutResultPath = options?.boundCardCheckoutResultPath || this.boundCardCheckoutResultPath;

    this.isAmex = options?.isAmex ?? this.isAmex;

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
      get: async (key: string): Promise<CTBCOrder<CM> | undefined> => orderLruCache!.get(key),
      set: async (key: string, value: CTBCOrder<CM>): Promise<void> => {
        orderLruCache!.set(key, value);
      },
    };

    const requestLruCache = new LRUCache<string, CTBCBindCardRequest>({
      ttlAutopurge: true,
      ttl: options?.bindCardRequestsCacheTTL ?? 10 * 60 * 1000, // default: 10 mins
    });

    this.bindCardRequestsCache = options?.bindCardRequestsCache ?? {
      get: async (key: string): Promise<CTBCBindCardRequest | undefined> => requestLruCache!.get(key),
      set: async (key: string, value: CTBCBindCardRequest): Promise<void> => {
        requestLruCache!.set(key, value);
      },
    };
  }

  async handleCallbackTextBodyByURLPath(
    url: string,
    body: string,
  ): Promise<{
    status?: number;
    headers?: Record<string, string>;
    body?: string;
  }> {
    switch (url) {
      case this.callbackPath: {
        const params = new URLSearchParams(body);
        const response = params.get('URLResEnc');

        if (!response) {
          throw new Error('Missing URLResEnc parameter in callback');
        }

        const decipher = createDecipheriv('des-ede3-cbc', Buffer.from(this.txnKey, 'utf8'), SSLAuthIV);

        decipher.setAutoPadding(false);

        const decrypted = Buffer.concat([decipher.update(Buffer.from(response, 'hex')), decipher.final()]);

        const plain = iconv.decode(decrypted, 'big5');

        const payload = new URLSearchParams(plain);

        const requestId = payload.get('lidm');

        if (!requestId) {
          throw new Error('Missing lidm parameter in callback');
        }

        const order = (await this.orderCache.get(requestId)) as CTBCOrder<OrderCreditCardCommitMessage>;

        const errorCode = payload.get('errcode');
        const errorMessage = payload.get('errDesc');

        const isSuccess =
          (order.cardType === CardType.AE && errorCode === 'A000') ||
          (order.cardType === CardType.VMJ && errorCode === '00');

        if (!isSuccess) {
          if (order) {
            order.fail(errorCode ?? 'x9999', errorMessage ?? '-');
          }

          const typeLabel =
            {
              [CardType.AE]: 'Amex',
              [CardType.VMJ]: 'Card',
            }[order.cardType] ?? 'Unknown';

          throw new CtbcPaymentFailedError(
            `CTBC ${typeLabel} Checkout Failed: ${errorCode} - ${errorMessage}`,
            order?.id,
          );
        }

        if (!order) {
          throw new Error(`Unknown callback checkout order: ${requestId}`);
        }

        order.commit(
          {
            id: order.id,
            totalPrice: Number(payload.get('authAmt')),
            committedAt: new Date(),
          } as OrderCreditCardCommitMessage,
          {
            channel: Channel.CREDIT_CARD,
            processDate: new Date(),
            amount: Number(payload.get('authAmt')),
            eci: CreditCardECI.VISA_AE_JCB_3D,
            authCode: payload.get('authCode') as string,
            card6Number: (payload.get('CardNumber') ?? '').substring(0, 6),
            card4Number: payload.get('Last4digitPAN') as string,
          } as AdditionalInfo<OrderCreditCardCommitMessage>,
        );

        // XID會在需要退款時使用, 先記錄
        const xid = payload.get('xid') as string;

        if (xid) {
          order.setPosApiInfo(xid);
        }

        debugPaymentServer(`CTBCPayment callback checkout order ${order.id} successful.`);

        if (order.clientBackUrl) {
          return {
            status: 302,
            headers: {
              Location: order.clientBackUrl,
            },
          };
        }

        return {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
          },
          body: '1|OK',
        };
      }

      case this.boundCardPath: {
        const params = new URLSearchParams(body);
        const payload = JSON.parse(decodeURIComponent(params.get('rspjsonpwd') as string)) as {
          Response: CTBCResponsePayload;
        };

        const { Data } = payload.Response;

        const divKey = getDivKey(this.txnKey);

        const plainPayload = decrypt3DES(Buffer.from(Data.TXN, 'hex'), divKey);

        const decryptedParams = new URLSearchParams(plainPayload);

        const statusCode = decryptedParams.get('StatusCode');
        const statusDesc = decryptedParams.get('StatusDesc');
        const requestId = decryptedParams.get('RequestNo') ?? '';

        const request = await this.bindCardRequestsCache.get(requestId);

        if (statusCode !== 'I0000') {
          console.log(request);

          if (request) {
            request.fail(statusCode ?? 'x9999', statusDesc ?? '-');
          }

          throw new Error(`CTBC Bind Card Failed: ${statusCode} - ${statusDesc}`);
        }

        if (!request) {
          throw new Error(`Unknown bind card request: ${requestId}`);
        }

        request.bound({
          cardToken: decryptedParams.get('CardToken') as string,
          cardNoMask: (decryptedParams.get('CardNoMask') as string).replace(/-/g, ''),
          requestNo: requestId,
        });

        debugPaymentServer(`CTBCPayment bound card for request ${requestId} [${request.memberId}]`);

        return {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
          },
          body: '1|OK',
        };
      }

      case this.boundCardCheckoutResultPath: {
        const payload = JSON.parse(decodeURIComponent(body)) as {
          Response: CTBCResponsePayload;
        };

        const { Data } = payload.Response;

        const divKey = getDivKey(this.txnKey);

        const plainPayload = decrypt3DES(Buffer.from(Data.TXN, 'hex'), divKey);

        const decryptedParams = new URLSearchParams(plainPayload);

        const statusCode = decryptedParams.get('StatusCode');
        const statusDesc = decryptedParams.get('StatusDesc');
        const requestId = decryptedParams.get('RequestNo') ?? '';
        const order = await this.orderCache.get(requestId);

        if (statusCode !== 'I0000') {
          if (order) {
            order.fail(statusCode ?? 'x9999', statusDesc ?? '-');
          }

          throw new Error(`CTBC Bound Card Checkout Failed: ${statusCode} - ${statusDesc}`);
        }

        if (!order) {
          throw new Error(`Unknown bound card checkout order: ${requestId}`);
        }

        order.commit({
          id: order.id,
          totalPrice: Number(decryptedParams.get('AuthAmount')),
          committedAt: new Date(),
        } as CM);

        debugPaymentServer(`CTBCPayment bound card checkout order ${order.id} successful.`);

        if (order.clientBackUrl) {
          return {
            status: 302,
            headers: {
              Location: order.clientBackUrl,
            },
          };
        }

        return {
          status: 200,
          headers: {
            'Content-Type': 'text/plain',
          },
          body: '1|OK',
        };
      }

      default:
        return {
          status: 404,
          headers: {
            'Content-Type': 'text/plain',
          },
          body: '0|Not Found',
        };
    }
  }

  public async defaultServerListener(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const checkoutRe = new RegExp(`^${this.checkoutPath}/([^/]+)$`);
    const bindCardRe = new RegExp(`^${this.bindCardPath}/([^/]+)$`);

    debugPaymentServer(`[${req.method}] ${req.url}`);

    debugPaymentServer(this.bindCardRequestsCache);

    if (req.method === 'GET' && req.url) {
      if (checkoutRe.test(req.url)) {
        const orderId = RegExp.$1;

        if (orderId) {
          const order = await this.orderCache.get(orderId);

          if (order) {
            debugPayment(`CTBCPayment serve checkout page for order ${orderId}`);

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
            debugPayment(`CTBCPayment serve bind card page for member ${memberId}`);

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
      !~[this.boundCardPath, this.boundCardCheckoutResultPath, this.callbackPath].indexOf(req.url)
    ) {
      res.writeHead(404);
      res.end();

      return;
    }

    const bufferArray = [] as Buffer[];

    req.on('data', chunk => {
      bufferArray.push(chunk);
    });

    req.on('end', async () => {
      const payloadString = Buffer.from(Buffer.concat(bufferArray)).toString('utf8');

      try {
        const response = await this.handleCallbackTextBodyByURLPath(req.url as string, payloadString);

        res.writeHead(
          response.status || 404,
          response.headers || {
            'Content-Type': 'text/plain',
          },
        );

        if (response.body) {
          res.end(response.body);
        } else {
          res.end();
        }
      } catch (ex) {
        debugPaymentServer(`CTBCPayment server listener error: ${ex instanceof Error ? ex.message : ex}`);

        res.writeHead(400, {
          'Content-Type': 'text/plain',
        });

        res.end('0|ERROR');
      }
    });
  }

  private createServer(useNgrok: boolean): void {
    const url = new URL(this.serverHost ?? 'http://localhost:3000');

    this._server = createServer((req, res) => this.serverListener(req, res));

    const port = Number(url.port || 3000);

    this._server.listen(port, '0.0.0.0', async () => {
      if (useNgrok) {
        if (!process.env.NGROK_AUTHTOKEN) {
          debugPayment('[CTBCPayment] NGROK_AUTHTOKEN is not set. Please set it in your environment variables.');

          throw new Error('[CTBCPayment] NGROK_AUTHTOKEN is not set. Please set it in your environment variables.');
        }

        try {
          await import('@ngrok/ngrok');
        } catch (ex) {
          debugPayment('[CTBCPayment] Failed to import ngrok. Please install it to use ngrok feature.');

          throw ex;
        }

        const ngrok = (await import('@ngrok/ngrok')).default;

        await ngrok.authtoken(process.env.NGROK_AUTHTOKEN);

        const forwarder = await ngrok.forward(port);

        this.serverHost = forwarder.url() as string;

        debugPayment(`CTBCPayment Callback Server Listen on port ${port} with ngrok url: ${this.serverHost}`);
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
      TokenURL: options.finishRedirectURL ?? `${this.serverHost}${this.boundCardPath}`,
      PromoCode: options.promoCode ?? undefined,
      Pid: options.Pid ?? undefined,
      PhoneNum: options.PhoneNum ?? undefined,
      PhoneNumEditable: options.PhoneNumEditable ?? undefined,
      Birthday: options.Birthday ? DateTime.fromJSDate(options.Birthday).toFormat('MMddyyyy') : undefined,
    } satisfies CTBCBindCardRequestPayload;

    const request = new CTBCBindCardRequest(payload, this);

    await this.bindCardRequestsCache.set(payload.RequestNo, request);

    debugPayment(
      `CTBCPayment prepareBindCard for member ${memberId}, URL: ${this.serverHost}${this.bindCardPath}/${payload.RequestNo}`,
    );

    return request;
  }

  async prepare<N extends CTBCOrderCommitMessage>(options: InputFromOrderCommitMessage<N>): Promise<Order<N>> {
    if (options.id && options.id.length > 19) {
      throw new Error('Order ID must be less than 20 characters');
    }

    if (options.id && /[^0-9a-z_]/i.test(options.id)) {
      throw new Error('Order ID can only contain alphanumeric characters and underscores');
    }

    const totalPrice = options.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    if (totalPrice <= 0) {
      throw new Error('Total price must be greater than 0');
    }

    const orderId = options.id ?? randomBytes(8).toString('hex');

    const cardType = options.cardType;
    const orderDesc = options.items.map(item => item.name).join(', ');
    const txType = options.cardType === CardType.AE ? '6' : '0';
    const option = options.cardType === CardType.AE ? '' : '1';

    const mac = getMacFromParams({
      MerchantID: this.merchantId,
      TerminalID: this.terminalId,
      lidm: orderId,
      purchAmt: totalPrice,
      txType,
      Option: option,
      Key: this.txnKey,
    }).slice(-48);

    // Keep Order In Params
    const params: (string | Buffer)[] = [];

    params.push(`MerchantID=${this.merchantId}&`);
    params.push(`TerminalID=${this.terminalId}&`);
    params.push(`lidm=${orderId}&`);
    params.push(`purchAmt=${totalPrice.toString()}&`);
    params.push(`txType=${txType}&`);
    params.push('MerchantName=');

    if (options.shopName) {
      params.push(iconv.encode(options.shopName, 'big5'));
    }

    params.push(`&AuthResURL=${`${this.serverHost}${this.callbackPath}`}&`);
    params.push('OrderDesc=');

    if (orderDesc) {
      params.push(iconv.encode(orderDesc.replace(/\s/g, ''), 'big5'));
    }

    params.push('&ProdCode=&');
    params.push('AutoCap=1&');
    params.push('customize=1&');
    params.push('NumberOfPay=&');
    params.push(`InMac=${mac}`);

    const encPayload = Buffer.concat(
      params.map(param => (Buffer.isBuffer(param) ? param : Buffer.from(param, 'utf8'))),
    );

    const enc = desMac(encPayload, this.txnKey);

    const order = new CTBCOrder({
      id: orderId,
      items: options.items,
      form: {
        [CTBCOrderFormKey.URLEnc]: enc,
        [CTBCOrderFormKey.merID]: this.merId,
      } satisfies CTBCPayOrderForm,
      gateway: this,
      clientBackUrl: options.clientBackUrl,
      cardType,
    });

    this.orderCache.set(orderId, order);

    debugPayment(`CTBCPayment Checkout URL: ${this.serverHost}${this.checkoutPath}/${orderId}`);

    return order as Order<N>;
  }

  async query<OO extends CTBCOrder>(id: string): Promise<OO> {
    // 先嘗試從快取中獲取訂單
    const order = await this.orderCache.get(id);

    if (this.isAmex) {
      throw new Error('Query AMEX Order From SOAP API is not implemented');
      // 使用 AMEX SOAP API 查詢
      // const amexInquiryParams: CTBCAmexInquiryParams = {
      //   merId: this.merId,
      //   lidm: id,
      //   IN_MAC_KEY: this.txnKey,
      // };

      // const result = await amexInquiry(this.amexApiConfig!, amexInquiryParams);

      // if (result.errCode !== '00') {
      //   debugPayment(`AMEX Query failed for order ${id}: ${result.errCode} - ${result.errDesc}`);
      //   throw new Error(`AMEX Query failed: ${result.errCode} - ${result.errDesc || 'Unknown error'}`);
      // }

      // debugPayment(`AMEX Query successful for order ${id}: ${JSON.stringify(result)}`);

      // // 如果快取中沒有訂單，根據查詢結果創建一個
      // if (!order) {
      //   // 這裡需要根據 AMEX 查詢結果創建訂單，但由於缺少必要資訊，暫時拋出錯誤
      //   throw new Error(`Order not found in cache and cannot reconstruct from AMEX query result: ${id}`);
      // }

      // return order as OO;
    } else {
      // 使用 POS API 查詢
      const posApiConfig: CTBCPosApiConfig = {
        URL: this.baseUrl,
        MacKey: this.txnKey,
      };

      // 建構查詢參數
      const queryParams: CTBCPosApiQueryParams = {
        MERID: this.merId,
        'LID-M': id,
        Tx_ATTRIBUTE: 'TX_AUTH',
      };

      // 執行查詢
      const result = await posApiQuery(posApiConfig, queryParams);

      if (typeof result === 'number') {
        throw new Error(`Query failed with error code: ${result}`);
      }

      // 檢查查詢結果
      if (result.ErrCode !== '00') {
        debugPayment(`Query failed for order ${id}: ${result.ErrCode} - ${result.ERRDESC || 'Unknown error'}`);
        throw new Error(`Query failed: ${result.ErrCode} - ${result.ERRDESC || 'Unknown error'}`);
      }

      debugPayment(`Query successful for order ${id}: ${JSON.stringify(result)}`);

      // 如果快取中沒有訂單，根據查詢結果創建一個
      if (!order) {
        // 解析金額：AuthAmt 格式為 "貨幣碼 金額 指數"，如 "901 1000 0"
        let amount = 0;

        if (result.AuthAmt) {
          const amountParts = result.AuthAmt.split(' ');

          if (amountParts.length >= 2) {
            amount = parseInt(amountParts[1], 10);
          }
        }

        // 從查詢結果重建訂單物件
        const reconstructedOrder = new CTBCOrder({
          id: id,
          gateway: this,
          items: [
            {
              name: 'Unknown Item', // API 查詢結果通常不包含商品詳情
              unitPrice: amount || 0,
              quantity: 1,
            },
          ],
          // 根據查詢結果設定訂單狀態
          createdAt: result.Txn_date ? new Date(`${result.Txn_date} ${result.Txn_time || '00:00:00'}`) : new Date(),
        });

        // 如果交易成功，直接設定已提交狀態（不使用 commit 方法以避免重複觸發事件）
        if (result.RespCode === '0' && result.QueryCode === '1') {
          // 建構 AdditionalInfo，包含查詢結果中的重要交易資訊
          const additionalInfo: AdditionalInfo<OrderCreditCardCommitMessage> = {
            channel: Channel.CREDIT_CARD,
            processDate: new Date(),
            amount: amount,
            // ECI 映射：API 回應格式（如 "05"）轉換為標準 CreditCardECI 枚舉值
            eci: this.mapECIValue(result.ECI),
            authCode: result.AuthCode || '',
            // 從 PAN 欄位提取卡號信息（格式如 "400361******7729"）
            card6Number: result.PAN ? result.PAN.substring(0, 6) : '',
            card4Number: result.PAN ? result.PAN.slice(-4) : '',
          };

          // 直接設定內部狀態，而不是調用 commit 方法
          // 這樣避免了重複觸發 PaymentEvents.ORDER_COMMITTED 事件
          (reconstructedOrder as unknown as { _state: OrderState })._state = OrderState.COMMITTED;
          (reconstructedOrder as unknown as { _committedAt: Date })._committedAt = new Date();
          (reconstructedOrder as unknown as { _additionalInfo: typeof additionalInfo })._additionalInfo =
            additionalInfo;

          // 保存 XID（由於 setPosApiInfo 現在只接受 xid 參數）
          if (result.XID?.trim()) {
            reconstructedOrder.setPosApiInfo(result.XID.trim());
          }
        }

        // 將重建的訂單加入快取
        await this.orderCache.set(id, reconstructedOrder);

        return reconstructedOrder as OO;
      }

      // 如果快取中有訂單，更新其 XID 資訊（如果有的話）
      if (result.XID?.trim()) {
        order.setPosApiInfo(result.XID.trim());
      }

      return order as OO;
    }
  }

  /**
   * 將 API 回應的 ECI 值映射為標準 CreditCardECI 枚舉值
   * CTBC API 回應的 ECI 格式為 "05", "07" 等，需要轉換為 "5", "7" 等標準格式
   */
  private mapECIValue(apiECI?: string): CreditCardECI {
    if (!apiECI) {
      return CreditCardECI.VISA_AE_JCB_3D; // 預設值
    }

    // 將字串轉為數字再轉回字串，這樣可以正確處理前導零
    // "05" -> 5 -> "5", "0" -> 0 -> "0", "00" -> 0 -> "0"
    const numericECI = parseInt(apiECI, 10);
    const normalizedECI = numericECI.toString();

    // 根據標準化後的 ECI 值映射到對應的枚舉
    switch (normalizedECI) {
      case '0':
        return CreditCardECI.MASTER_3D_FAILED;
      case '1':
        return CreditCardECI.MASTER_3D_PART;
      case '2':
        return CreditCardECI.MASTER_3D;
      case '5':
        return CreditCardECI.VISA_AE_JCB_3D;
      case '6':
        return CreditCardECI.VISA_AE_JCB_3D_PART;
      case '7':
        return CreditCardECI.VISA_AE_JCB_3D_FAILED;
      default:
        // 未知的 ECI 值，回傳預設值並記錄警告
        debugPayment(
          `Unknown ECI value from API: ${apiECI} (normalized: ${normalizedECI}), using default VISA_AE_JCB_3D`,
        );

        return CreditCardECI.VISA_AE_JCB_3D;
    }
  }

  get executeURL(): string {
    return `${this.baseUrl}/mFastPay/TxnServlet`;
  }

  getCheckoutUrl(order: CTBCOrder<CM>): string {
    return `${this.serverHost}${this.checkoutPath}/${order.id}`;
  }

  get boundCheckoutResultURL(): string {
    return `${this.serverHost}${this.boundCardCheckoutResultPath}`;
  }

  async checkoutWithBoundCard(options: CTBCCheckoutWithBoundCardOptions): Promise<CTBCOrder<CM>> {
    if (options.orderId && options.orderId.length > 19) {
      throw new Error('Order ID must be less than 20 characters');
    }

    if (options.orderId && /[^0-9a-z_]/i.test(options.orderId)) {
      throw new Error('Order ID can only contain alphanumeric characters and underscores');
    }

    const totalPrice = options.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

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
