import axios from 'axios';
import debug from 'debug';
import { createCipheriv, createDecipheriv } from 'crypto';
import { EventEmitter } from 'events';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { LRUCache } from 'lru-cache';
import { DateTime } from 'luxon';
import { ecpaySha256, ecpayUrlEncode } from './ecpay-utils';
import {
  ECPAY_TICKET_RTN_CODE_SUCCESS,
  ECPAY_TICKET_TRANS_CODE_SUCCESS,
  ECPayTicketBaseUrls,
  ECPayTicketEvents,
  ECPayTicketGatewayOptions,
  ECPayTicketInfo,
  ECPayTicketIssueInput,
  ECPayTicketIssueOutcome,
  ECPayTicketIssueReceipt,
  ECPayTicketIssueRequestBody,
  ECPayTicketIssueResponseDecrypted,
  ECPayTicketIssueStatusCode,
  ECPayTicketListResponseItem,
  ECPayTicketOrderInfo,
  ECPayTicketQueryIssueResultRequestBody,
  ECPayTicketQueryIssueResultResponseDecrypted,
  ECPayTicketQueryOrderInfoRequestBody,
  ECPayTicketQueryOrderInfoResponseDecrypted,
  ECPayTicketRefundNotification,
  ECPayTicketRequestEnvelope,
  ECPayTicketResponseEnvelope,
  ECPayTicketType,
  ECPayTicketUseStatusNotification,
  IssuedTicketRecord,
  IssuedTicketsCache,
  parseTicketUseStatus,
} from './ecpay-ticket-typings';

const debugTicket = debug('Rytass:Payment:ECPay:Ticket');

const DEFAULT_POLL_INTERVAL_MS = 30_000;
const DEFAULT_POLL_TIMEOUT_MS = 6 * 60_000;
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TICKET_TYPE_MAP: Record<string, ECPayTicketType> = {
  '1': ECPayTicketType.REDEMPTION,
  '2': ECPayTicketType.GIFT,
};

export class ECPayTicketGateway {
  private readonly merchantId: string = '2000132';
  private readonly hashKey: string = '5294y06JbISpM5x9';
  private readonly hashIv: string = 'v77hoKGq4kWxNNIS';
  private readonly baseUrl: string = ECPayTicketBaseUrls.DEVELOPMENT;
  private readonly platformId?: string;

  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;

  private readonly issuedTicketsCache: IssuedTicketsCache;

  private readonly withServer: boolean | 'ngrok' = false;
  private serverHost: string = 'http://localhost:3000';
  private readonly refundNotifyPath: string = '/payments/ecpay/ticket/refund';
  private readonly useStatusNotifyPath: string = '/payments/ecpay/ticket/use-status';
  private readonly serverListener: (req: IncomingMessage, res: ServerResponse) => void = (req, res) =>
    this.defaultServerListener(req, res);

  private isGatewayReady = false;

  readonly emitter = new EventEmitter();
  _server?: Server;

  constructor(options?: ECPayTicketGatewayOptions) {
    this.merchantId = options?.merchantId ?? this.merchantId;
    this.hashKey = options?.hashKey ?? this.hashKey;
    this.hashIv = options?.hashIv ?? this.hashIv;
    this.baseUrl = options?.baseUrl ?? this.baseUrl;
    this.platformId = options?.platformId;

    this.pollIntervalMs = options?.issuePoll?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.pollTimeoutMs = options?.issuePoll?.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;

    this.serverHost = options?.serverHost ?? this.serverHost;
    this.refundNotifyPath = options?.refundNotifyPath ?? this.refundNotifyPath;
    this.useStatusNotifyPath = options?.useStatusNotifyPath ?? this.useStatusNotifyPath;

    if (options?.serverListener) {
      this.serverListener = options.serverListener;
    }

    const lruCache = options?.issuedTicketsCache
      ? undefined
      : new LRUCache<string, IssuedTicketRecord>({
          ttlAutopurge: true,
          ttl: options?.issuedTicketsCacheTTL ?? DEFAULT_CACHE_TTL_MS,
        });

    this.issuedTicketsCache = options?.issuedTicketsCache ?? {
      get: async (key: string): Promise<IssuedTicketRecord | undefined> => lruCache!.get(key),
      set: async (key: string, value: IssuedTicketRecord): Promise<void> => {
        lruCache!.set(key, value);
      },
    };

    if (options?.onServerListen) {
      this.emitter.on(ECPayTicketEvents.SERVER_LISTENED, options.onServerListen);
    }

    this.emitter.on(ECPayTicketEvents.SERVER_LISTENED, () => {
      this.isGatewayReady = true;
    });

    if (options?.withServer) {
      this.withServer = options.withServer;

      this.createCallbackServer(options.withServer === 'ngrok');
    } else {
      this.isGatewayReady = true;
    }
  }

  private encrypt<T>(data: T): string {
    const encodedData = encodeURIComponent(JSON.stringify(data));
    const cipher = createCipheriv('aes-128-cbc', this.hashKey, this.hashIv);

    cipher.setAutoPadding(true);

    return [cipher.update(encodedData, 'utf8', 'base64'), cipher.final('base64')].join('');
  }

  private decrypt<T>(encryptedData: string): T {
    const decipher = createDecipheriv('aes-128-cbc', this.hashKey, this.hashIv);

    return JSON.parse(
      decodeURIComponent([decipher.update(encryptedData, 'base64', 'utf8'), decipher.final('utf8')].join('')),
    );
  }

  private generateCheckMacValue(encryptedData: string): string {
    return ecpaySha256(ecpayUrlEncode(`HashKey=${this.hashKey}&Data=${encryptedData}&HashIV=${this.hashIv}`));
  }

  private verifyResponseEnvelope(envelope: ECPayTicketResponseEnvelope): boolean {
    return this.generateCheckMacValue(envelope.Data) === envelope.CheckMacValue;
  }

  private buildEnvelope(encryptedData: string): ECPayTicketRequestEnvelope {
    return {
      ...(this.platformId ? { PlatformID: this.platformId } : {}),
      MerchantID: this.merchantId,
      RqHeader: {
        Timestamp: Math.round(Date.now() / 1000),
      },
      Data: encryptedData,
      CheckMacValue: this.generateCheckMacValue(encryptedData),
    };
  }

  private async postEnvelope<TBody, TDecrypted>(path: string, body: TBody): Promise<TDecrypted> {
    if (!this.isGatewayReady) {
      throw new Error('Please waiting gateway ready');
    }

    const encryptedData = this.encrypt<TBody>(body);
    const envelope = this.buildEnvelope(encryptedData);

    const { data } = await axios.post<ECPayTicketResponseEnvelope>(`${this.baseUrl}${path}`, JSON.stringify(envelope), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (data.TransCode !== ECPAY_TICKET_TRANS_CODE_SUCCESS) {
      throw new Error(`ECPay ticket transport error: (${data.TransCode}) ${data.TransMsg}`);
    }

    if (!this.verifyResponseEnvelope(data)) {
      throw new Error('Invalid CheckMacValue');
    }

    return this.decrypt<TDecrypted>(data.Data);
  }

  private formatDate(date?: Date): string | undefined {
    if (!date) return undefined;

    return DateTime.fromJSDate(date).toFormat('yyyyMMdd');
  }

  private parseDateYMD(s?: string): Date | undefined {
    if (!s) return undefined;

    return DateTime.fromFormat(s, 'yyyyMMdd').toJSDate();
  }

  private parseTimestamp(s?: string): Date | undefined {
    if (!s) return undefined;

    const dt = DateTime.fromFormat(s, 'yyyy/MM/dd HH:mm:ss');

    return dt.isValid ? dt.toJSDate() : undefined;
  }

  private validateIssueInput(input: ECPayTicketIssueInput): void {
    if (!input.merchantTradeNo && !input.freeTradeNo) {
      throw new Error('Either merchantTradeNo or freeTradeNo must be provided');
    }

    if (input.tickets.length === 0) {
      throw new Error('At least one ticket entry is required');
    }

    // TODO(user): IssueType-specific required-field validation.
    // 不同的 IssueType 在綠界文件上有不同的條件必填欄位：
    //   - CVS (1)         → CustomerEmail（取貨通知信）必填
    //   - PAPER (2)       → printType 必填；若 PrintType=MERCHANT，CustomerName/CustomerAddress 必填
    //   - ELECTRONIC (3)  → isImmediate 必填；CustomerName/CustomerPhone/CustomerEmail 必填
    //   - SERIAL_ONLY (4) → 每筆 ticket 的 itemName 與 ticketPrice 必填
    //
    // 請在這裡補上前置驗證並拋出清楚的 Error。
    // 設計權衡：太嚴格會擋住未來綠界放寬規則的情境；太寬鬆則錯誤要等綠界 RtnCode 才浮現。
  }

  private buildIssueRequestBody(input: ECPayTicketIssueInput): ECPayTicketIssueRequestBody {
    const refundNotifyUrl =
      input.refundNotifyUrl ?? (this.withServer ? `${this.serverHost}${this.refundNotifyPath}` : undefined);

    const useStatusNotifyUrl =
      input.useStatusNotifyUrl ?? (this.withServer ? `${this.serverHost}${this.useStatusNotifyPath}` : undefined);

    return {
      MerchantID: this.merchantId,
      ...(input.merchantTradeNo ? { MerchantTradeNo: input.merchantTradeNo } : {}),
      ...(input.freeTradeNo ? { FreeTradeNo: input.freeTradeNo } : {}),
      IssueType: input.issueType,
      ...(input.printType ? { PrintType: input.printType } : {}),
      ...(input.isImmediate ? { IsImmediate: input.isImmediate } : {}),
      ...(refundNotifyUrl ? { RefundNotifyURL: refundNotifyUrl } : {}),
      ...(useStatusNotifyUrl ? { UseStatusNotifyURL: useStatusNotifyUrl } : {}),
      ...(input.storeId ? { StoreID: input.storeId } : {}),
      Operator: input.operator,
      ...(input.customer?.name ? { CustomerName: input.customer.name } : {}),
      ...(input.customer?.phone ? { CustomerPhone: input.customer.phone } : {}),
      ...(input.customer?.email ? { CustomerEmail: input.customer.email } : {}),
      ...(input.customer?.address ? { CustomerAddress: input.customer.address } : {}),
      TicketInfo: input.tickets.map(t => ({
        ...(t.itemNo ? { ItemNo: t.itemNo } : {}),
        ...(t.itemName ? { ItemName: t.itemName } : {}),
        ...(t.ticketPrice !== undefined ? { TicketPrice: t.ticketPrice } : {}),
        TicketAmount: t.ticketAmount,
        ...(this.formatDate(t.startDate) ? { StartDate: this.formatDate(t.startDate) } : {}),
        ...(this.formatDate(t.expireDate) ? { ExpireDate: this.formatDate(t.expireDate) } : {}),
      })),
    };
  }

  private toOutcome(decrypted: ECPayTicketQueryIssueResultResponseDecrypted): ECPayTicketIssueOutcome {
    const ids = {
      ...(decrypted.MerchantTradeNo ? { merchantTradeNo: decrypted.MerchantTradeNo } : {}),
      ...(decrypted.FreeTradeNo ? { freeTradeNo: decrypted.FreeTradeNo } : {}),
    };

    switch (decrypted.Status) {
      case ECPayTicketIssueStatusCode.SUCCESS:
        return { status: 'success', ...ids };
      case ECPayTicketIssueStatusCode.FAILED:
        return { status: 'failed', remark: decrypted.Remark, ...ids };
      case ECPayTicketIssueStatusCode.PROCESSING:
        return { status: 'processing', ...ids };
      default:
        throw new Error(`Unknown Status from ECPay: ${decrypted.Status}`);
    }
  }

  private startBackgroundPolling(merchantTradeNo?: string, freeTradeNo?: string): Promise<ECPayTicketIssueOutcome> {
    const deadline = Date.now() + this.pollTimeoutMs;

    return new Promise(resolve => {
      const poll = async (): Promise<void> => {
        try {
          const outcome = await this.queryIssueResult({ merchantTradeNo, freeTradeNo });

          if (outcome.status === 'success') {
            this.emitter.emit(ECPayTicketEvents.TICKET_ISSUED, outcome);
            resolve(outcome);

            return;
          }

          if (outcome.status === 'failed') {
            this.emitter.emit(ECPayTicketEvents.TICKET_ISSUE_FAILED, outcome);
            resolve(outcome);

            return;
          }

          if (Date.now() >= deadline) {
            const timeoutOutcome: ECPayTicketIssueOutcome = {
              status: 'failed',
              remark: 'Ticket issuance polling timed out',
              ...(merchantTradeNo ? { merchantTradeNo } : {}),
              ...(freeTradeNo ? { freeTradeNo } : {}),
            };

            this.emitter.emit(ECPayTicketEvents.TICKET_ISSUE_FAILED, timeoutOutcome);
            resolve(timeoutOutcome);

            return;
          }

          setTimeout(poll, this.pollIntervalMs);
        } catch (error) {
          const errorOutcome: ECPayTicketIssueOutcome = {
            status: 'failed',
            remark: error instanceof Error ? error.message : 'Polling error',
            ...(merchantTradeNo ? { merchantTradeNo } : {}),
            ...(freeTradeNo ? { freeTradeNo } : {}),
          };

          this.emitter.emit(ECPayTicketEvents.TICKET_ISSUE_FAILED, errorOutcome);
          resolve(errorOutcome);
        }
      };

      setTimeout(poll, this.pollIntervalMs);
    });
  }

  async issue(input: ECPayTicketIssueInput): Promise<ECPayTicketIssueReceipt | ECPayTicketIssueOutcome> {
    this.validateIssueInput(input);

    const body = this.buildIssueRequestBody(input);
    const decrypted = await this.postEnvelope<ECPayTicketIssueRequestBody, ECPayTicketIssueResponseDecrypted>(
      '/api/Ticket/Issue',
      body,
    );

    if (decrypted.RtnCode !== ECPAY_TICKET_RTN_CODE_SUCCESS) {
      throw new Error(`ECPay ticket issue failed: (${decrypted.RtnCode}) ${decrypted.RtnMsg}`);
    }

    const receipt: ECPayTicketIssueReceipt = {
      ...(decrypted.MerchantTradeNo ? { merchantTradeNo: decrypted.MerchantTradeNo } : {}),
      ...(decrypted.FreeTradeNo ? { freeTradeNo: decrypted.FreeTradeNo } : {}),
      ticketTradeNo: decrypted.TicketTradeNo,
      tickets: decrypted.TicketData.map(t => ({
        ...(t.ItemNo ? { itemNo: t.ItemNo } : {}),
        ...(t.ItemName ? { itemName: t.ItemName } : {}),
        ...(t.TicketPrice !== undefined ? { ticketPrice: t.TicketPrice } : {}),
        ticketAmount: t.TicketAmount,
      })),
    };

    const cacheKey = receipt.merchantTradeNo ?? receipt.freeTradeNo;

    if (cacheKey) {
      await this.issuedTicketsCache.set(cacheKey, {
        ...(receipt.merchantTradeNo ? { merchantTradeNo: receipt.merchantTradeNo } : {}),
        ...(receipt.freeTradeNo ? { freeTradeNo: receipt.freeTradeNo } : {}),
        issueType: input.issueType,
        ticketTradeNo: receipt.ticketTradeNo,
        issuedAt: new Date(),
      });
    }

    const pollingPromise = this.startBackgroundPolling(receipt.merchantTradeNo, receipt.freeTradeNo);

    if (input.waitForIssuance) {
      return pollingPromise;
    }

    return receipt;
  }

  async queryIssueResult(args: { merchantTradeNo?: string; freeTradeNo?: string }): Promise<ECPayTicketIssueOutcome> {
    if (!args.merchantTradeNo && !args.freeTradeNo) {
      throw new Error('Either merchantTradeNo or freeTradeNo must be provided');
    }

    const body: ECPayTicketQueryIssueResultRequestBody = {
      MerchantID: this.merchantId,
      ...(args.merchantTradeNo ? { MerchantTradeNo: args.merchantTradeNo } : {}),
      ...(args.freeTradeNo ? { FreeTradeNo: args.freeTradeNo } : {}),
    };

    const decrypted = await this.postEnvelope<
      ECPayTicketQueryIssueResultRequestBody,
      ECPayTicketQueryIssueResultResponseDecrypted
    >('/api/Ticket/QueryIssueResult', body);

    if (decrypted.RtnCode !== ECPAY_TICKET_RTN_CODE_SUCCESS) {
      throw new Error(`ECPay ticket query failed: (${decrypted.RtnCode}) ${decrypted.RtnMsg}`);
    }

    return this.toOutcome(decrypted);
  }

  async queryOrderInfo(args: {
    merchantTradeNo?: string;
    freeTradeNo?: string;
    pageNum?: number;
  }): Promise<ECPayTicketOrderInfo> {
    if (!args.merchantTradeNo && !args.freeTradeNo) {
      throw new Error('Either merchantTradeNo or freeTradeNo must be provided');
    }

    const body: ECPayTicketQueryOrderInfoRequestBody = {
      MerchantID: this.merchantId,
      ...(args.merchantTradeNo ? { MerchantTradeNo: args.merchantTradeNo } : {}),
      ...(args.freeTradeNo ? { FreeTradeNo: args.freeTradeNo } : {}),
      ...(args.pageNum !== undefined ? { PageNum: args.pageNum } : {}),
    };

    const decrypted = await this.postEnvelope<
      ECPayTicketQueryOrderInfoRequestBody,
      ECPayTicketQueryOrderInfoResponseDecrypted
    >('/api/Ticket/QueryOrderInfo', body);

    if (decrypted.RtnCode !== ECPAY_TICKET_RTN_CODE_SUCCESS) {
      throw new Error(`ECPay ticket order info query failed: (${decrypted.RtnCode}) ${decrypted.RtnMsg}`);
    }

    return this.mapOrderInfo(decrypted);
  }

  private mapTicket(raw: ECPayTicketListResponseItem): ECPayTicketInfo {
    const ticketType = TICKET_TYPE_MAP[raw.TicketType];

    if (!ticketType) {
      throw new Error(`Unknown ECPay ticket TicketType: ${raw.TicketType}`);
    }

    return {
      ticketNo: raw.TicketNo,
      useStatus: parseTicketUseStatus(raw.UseStatus),
      ...(raw.ItemNo ? { itemNo: raw.ItemNo } : {}),
      ...(raw.ItemName ? { itemName: raw.ItemName } : {}),
      ticketType,
      ticketAmount: raw.TicketAmount,
      ...(this.parseDateYMD(raw.StartDate) ? { startDate: this.parseDateYMD(raw.StartDate) } : {}),
      ...(this.parseDateYMD(raw.WriteOffDate) ? { writeOffDate: this.parseDateYMD(raw.WriteOffDate) } : {}),
      ...(this.parseDateYMD(raw.RefundDate) ? { refundDate: this.parseDateYMD(raw.RefundDate) } : {}),
      ...(this.parseDateYMD(raw.ExpiredDate) ? { expiredDate: this.parseDateYMD(raw.ExpiredDate) } : {}),
      ...(raw.WriteOffNo ? { writeOffNo: raw.WriteOffNo } : {}),
    };
  }

  private mapOrderInfo(decrypted: ECPayTicketQueryOrderInfoResponseDecrypted): ECPayTicketOrderInfo {
    return {
      ...(decrypted.MerchantTradeNo ? { merchantTradeNo: decrypted.MerchantTradeNo } : {}),
      ...(decrypted.FreeTradeNo ? { freeTradeNo: decrypted.FreeTradeNo } : {}),
      ticketTradeNo: decrypted.TicketTradeNo,
      paymentProvider: decrypted.PaymentProvider,
      paymentType: decrypted.PaymentType,
      ...(decrypted.CreditTradeID !== undefined ? { creditTradeId: decrypted.CreditTradeID } : {}),
      status: decrypted.Status,
      remark: decrypted.Remark,
      ...(this.parseTimestamp(decrypted.IssueDate) ? { issueDate: this.parseTimestamp(decrypted.IssueDate) } : {}),
      issueType: decrypted.IssueType,
      ...(decrypted.PrintType ? { printType: decrypted.PrintType } : {}),
      customer: {
        ...(decrypted.CustomerName ? { name: decrypted.CustomerName } : {}),
        ...(decrypted.CustomerPhone ? { phone: decrypted.CustomerPhone } : {}),
        ...(decrypted.CustomerEmail ? { email: decrypted.CustomerEmail } : {}),
      },
      ...(this.parseDateYMD(decrypted.EscrowExpiredDate)
        ? { escrowExpiredDate: this.parseDateYMD(decrypted.EscrowExpiredDate) }
        : {}),
      totalCount: decrypted.TotalCount,
      tradeAmount: decrypted.TradeAmount,
      redeemCount: decrypted.RedeemCount,
      redeemAmount: decrypted.RedeemAmount,
      refundCount: decrypted.RefundCount,
      refundAmount: decrypted.RefundAmount,
      totalRefundFee: decrypted.TotalRefundFee,
      unUsedCount: decrypted.UnUsedCount,
      unUsedAmount: decrypted.UnUsedAmount,
      expiredCount: decrypted.ExpiredCount,
      tickets: decrypted.TicketList.map(t => this.mapTicket(t)),
    };
  }

  private createCallbackServer(useNgrok: boolean): void {
    const url = new URL(this.serverHost);

    this._server = createServer((req, res) => this.serverListener(req, res));

    const port = Number(url.port || 3000);

    this._server.listen(port, '0.0.0.0', async () => {
      if (useNgrok) {
        if (!process.env.NGROK_AUTHTOKEN) {
          throw new Error('[ECPayTicketGateway] NGROK_AUTHTOKEN is not set.');
        }

        const ngrokModule = await import('@ngrok/ngrok');
        const ngrok = ngrokModule.default;

        await ngrok.authtoken(process.env.NGROK_AUTHTOKEN);

        const forwarder = await ngrok.forward(port);

        this.serverHost = forwarder.url() as string;

        debugTicket(`ECPayTicket Callback Server Listen on port ${port} with ngrok url: ${this.serverHost}`);
      } else {
        debugTicket(`ECPayTicket Callback Server Listen on port ${port}`);
      }

      this.emitter.emit(ECPayTicketEvents.SERVER_LISTENED, { url: this.serverHost });
    });
  }

  private parseAndVerifyEnvelope(envelope: ECPayTicketResponseEnvelope): Record<string, unknown> {
    if (!this.verifyResponseEnvelope(envelope)) {
      debugTicket('Invalid CheckMacValue on callback');
      throw new ECPayTicketCallbackError('INVALID_CHECKMAC', 'Invalid CheckMacValue');
    }

    try {
      return this.decrypt<Record<string, unknown>>(envelope.Data);
    } catch {
      throw new ECPayTicketCallbackError('INVALID_DATA', 'Failed to decrypt Data');
    }
  }

  public handleRefundNotification(envelope: ECPayTicketResponseEnvelope): ECPayTicketRefundNotification {
    const decrypted = this.parseAndVerifyEnvelope(envelope);

    const notification: ECPayTicketRefundNotification = {
      ...(typeof decrypted.MerchantTradeNo === 'string' ? { merchantTradeNo: decrypted.MerchantTradeNo } : {}),
      ...(typeof decrypted.FreeTradeNo === 'string' ? { freeTradeNo: decrypted.FreeTradeNo } : {}),
      ticketTradeNo: String(decrypted.TicketTradeNo ?? ''),
      refundAmount: Number(decrypted.RefundAmount ?? 0),
      ...(typeof decrypted.Remark === 'string' ? { remark: decrypted.Remark } : {}),
      raw: decrypted,
    };

    this.emitter.emit(ECPayTicketEvents.TICKET_REFUND_NOTIFIED, notification);

    return notification;
  }

  public handleUseStatusNotification(envelope: ECPayTicketResponseEnvelope): ECPayTicketUseStatusNotification {
    const decrypted = this.parseAndVerifyEnvelope(envelope);

    const notification: ECPayTicketUseStatusNotification = {
      ...(typeof decrypted.MerchantTradeNo === 'string' ? { merchantTradeNo: decrypted.MerchantTradeNo } : {}),
      ...(typeof decrypted.FreeTradeNo === 'string' ? { freeTradeNo: decrypted.FreeTradeNo } : {}),
      ticketTradeNo: String(decrypted.TicketTradeNo ?? ''),
      ticketNo: String(decrypted.TicketNo ?? ''),
      useStatus: parseTicketUseStatus(Number(decrypted.UseStatus ?? 1)),
      raw: decrypted,
    };

    this.emitter.emit(ECPayTicketEvents.TICKET_USE_STATUS_CHANGED, notification);

    return notification;
  }

  public async defaultServerListener(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!req.url || req.method !== 'POST' || !~[this.refundNotifyPath, this.useStatusNotifyPath].indexOf(req.url)) {
      res.writeHead(404);
      res.end();

      return;
    }

    const bufferArray: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      bufferArray.push(chunk);
    });

    req.on('end', () => {
      let envelope: ECPayTicketResponseEnvelope;

      try {
        envelope = JSON.parse(Buffer.concat(bufferArray).toString('utf8')) as ECPayTicketResponseEnvelope;
      } catch {
        res.writeHead(400);
        res.end('0|InvalidPayload');

        return;
      }

      try {
        if (req.url === this.refundNotifyPath) {
          this.handleRefundNotification(envelope);
        } else {
          this.handleUseStatusNotification(envelope);
        }

        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('1|OK');
      } catch (error) {
        if (error instanceof ECPayTicketCallbackError) {
          res.writeHead(400);
          res.end(`0|${error.code === 'INVALID_CHECKMAC' ? 'InvalidCheckMacValue' : 'InvalidData'}`);

          return;
        }

        res.writeHead(500);
        res.end('0|InternalError');
      }
    });
  }
}

export type ECPayTicketCallbackErrorCode = 'INVALID_CHECKMAC' | 'INVALID_DATA';

export class ECPayTicketCallbackError extends Error {
  public readonly code: ECPayTicketCallbackErrorCode;

  constructor(code: ECPayTicketCallbackErrorCode, message: string) {
    super(message);
    this.name = 'ECPayTicketCallbackError';
    this.code = code;
  }
}
