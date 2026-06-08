import axios from 'axios';
import debug from 'debug';
import { createCipheriv, createDecipheriv } from 'crypto';
import { EventEmitter } from 'events';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { LRUCache } from 'lru-cache';
import { DateTime } from 'luxon';
import { computeTicketCheckMacValue } from './ecpay-utils';
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
  ECPayTicketWriteOffAction,
  ECPayTicketWriteOffInput,
  ECPayTicketWriteOffRequestBody,
  ECPayTicketWriteOffResponseDecrypted,
  ECPayTicketWriteOffResult,
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
  private readonly backgroundPollingEnabled: boolean;

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

  // 追蹤所有背景輪詢計時器，供 destroy() 清理，避免測試 / 程式結束後計時器殘留觸發 axios
  private readonly pollTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(options?: ECPayTicketGatewayOptions) {
    this.merchantId = options?.merchantId ?? this.merchantId;
    this.hashKey = options?.hashKey ?? this.hashKey;
    this.hashIv = options?.hashIv ?? this.hashIv;
    this.baseUrl = options?.baseUrl ?? this.baseUrl;
    this.platformId = options?.platformId;

    if (Buffer.byteLength(this.hashKey, 'utf8') !== 16) {
      throw new Error(
        `[ECPayTicketGateway] hashKey must be exactly 16 bytes (ASCII) for AES-128-CBC; got ${Buffer.byteLength(this.hashKey, 'utf8')} bytes.`,
      );
    }

    if (Buffer.byteLength(this.hashIv, 'utf8') !== 16) {
      throw new Error(
        `[ECPayTicketGateway] hashIv must be exactly 16 bytes (ASCII) for AES-128-CBC; got ${Buffer.byteLength(this.hashIv, 'utf8')} bytes.`,
      );
    }

    this.backgroundPollingEnabled = options?.issuePoll !== false;

    const pollConfig = options?.issuePoll === false ? undefined : options?.issuePoll;

    this.pollIntervalMs = pollConfig?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.pollTimeoutMs = pollConfig?.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;

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

  private encrypt(plaintext: string): string {
    const encodedData = encodeURIComponent(plaintext);
    const cipher = createCipheriv('aes-128-cbc', this.hashKey, this.hashIv);

    cipher.setAutoPadding(true);

    return [cipher.update(encodedData, 'utf8', 'base64'), cipher.final('base64')].join('');
  }

  private decryptToPlaintext(encryptedData: string): string {
    const decipher = createDecipheriv('aes-128-cbc', this.hashKey, this.hashIv);

    return decodeURIComponent([decipher.update(encryptedData, 'base64', 'utf8'), decipher.final('utf8')].join(''));
  }

  private decrypt<T>(encryptedData: string): T {
    return JSON.parse(this.decryptToPlaintext(encryptedData));
  }

  // CheckMacValue 須以「加密前的原始明文字串」(而非重新序列化的物件)計算，
  // 避免 JSON round-trip(空白 / 欄位順序 / 跳脫)導致誤判。演算法統一委派 ecpay-utils.computeTicketCheckMacValue。
  private generateCheckMacValue(plaintext: string): string {
    return computeTicketCheckMacValue(plaintext, { hashKey: this.hashKey, hashIv: this.hashIv });
  }

  private verifyResponseEnvelope(plaintext: string, envelope: ECPayTicketResponseEnvelope): boolean {
    return this.generateCheckMacValue(plaintext) === envelope.CheckMacValue;
  }

  private buildEnvelope(plaintext: string, encryptedData: string): ECPayTicketRequestEnvelope {
    return {
      ...(this.platformId ? { PlatformID: this.platformId } : {}),
      MerchantID: this.merchantId,
      RqHeader: {
        Timestamp: Math.round(Date.now() / 1000),
      },
      Data: encryptedData,
      CheckMacValue: this.generateCheckMacValue(plaintext),
    };
  }

  private async postEnvelope<TBody, TDecrypted>(path: string, body: TBody): Promise<TDecrypted> {
    if (!this.isGatewayReady) {
      throw new Error(
        '[ECPayTicketGateway] Gateway is not ready yet. Wait for the SERVER_LISTENED event before calling API methods.',
      );
    }

    // 同一份明文字串同時用於加密與 CheckMacValue，確保兩者一致
    const plaintext = JSON.stringify(body);
    const encryptedData = this.encrypt(plaintext);
    const envelope = this.buildEnvelope(plaintext, encryptedData);

    const { data } = await axios.post<ECPayTicketResponseEnvelope>(`${this.baseUrl}${path}`, JSON.stringify(envelope), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (data.TransCode !== ECPAY_TICKET_TRANS_CODE_SUCCESS) {
      throw new Error(`ECPay ticket transport error: (${data.TransCode}) ${data.TransMsg}`);
    }

    // 對「解密後的原始明文字串」驗證 MAC，再行 parse，避免 round-trip 破壞 MAC 比對
    const decryptedPlaintext = this.decryptToPlaintext(data.Data);

    if (!this.verifyResponseEnvelope(decryptedPlaintext, data)) {
      throw new Error('Invalid CheckMacValue');
    }

    return JSON.parse(decryptedPlaintext) as TDecrypted;
  }

  private formatDate(date?: Date): string | undefined {
    if (!date) return undefined;

    return DateTime.fromJSDate(date).toFormat('yyyyMMdd');
  }

  private parseDateYMD(s?: string): Date | undefined {
    if (!s) return undefined;

    const dt = DateTime.fromFormat(s, 'yyyyMMdd');

    return dt.isValid ? dt.toJSDate() : undefined;
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

  // 釋放 gateway 持有的資源：取消所有背景輪詢計時器、關閉 callback server、移除事件監聽。
  // 在使用完畢(或測試 afterEach)時呼叫，避免殘留的計時器 / server handle 造成資源洩漏。
  async destroy(): Promise<void> {
    for (const timer of this.pollTimers) {
      clearTimeout(timer);
    }

    this.pollTimers.clear();

    this.emitter.removeAllListeners();

    if (this._server) {
      const server = this._server;

      this._server = undefined;

      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }

  private schedulePoll(poll: () => Promise<void>): void {
    const timer = setTimeout(() => {
      this.pollTimers.delete(timer);

      void poll();
    }, this.pollIntervalMs);

    // 不讓背景輪詢計時器阻擋 process / 測試環境結束
    timer.unref?.();

    this.pollTimers.add(timer);
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

          this.schedulePoll(poll);
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

      this.schedulePoll(poll);
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

    if (input.waitForIssuance) {
      return this.startBackgroundPolling(receipt.merchantTradeNo, receipt.freeTradeNo);
    }

    if (this.backgroundPollingEnabled) {
      void this.startBackgroundPolling(receipt.merchantTradeNo, receipt.freeTradeNo);
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

  /**
   * 核銷(或取消核銷)一張票券。
   *
   * 對應綠界電子票證「核銷票券 API」(POST /api/Ticket/WriteOff)。
   * 以 WriteOffNo(核銷代碼)為操作對象，透過 action 區分核銷 / 取消核銷。
   *
   * 失敗(RtnCode !== 1)時拋出 Error，與 issue() / query 系列方法一致。
   */
  async writeOff(input: ECPayTicketWriteOffInput): Promise<ECPayTicketWriteOffResult> {
    if (!input.writeOffNo) {
      throw new Error('writeOffNo must be provided');
    }

    const action = input.action ?? ECPayTicketWriteOffAction.WRITE_OFF;

    // 取消核銷時綠界要求帶上取消原因，提前驗證以免錯誤要等 RtnCode 才浮現。
    if (action === ECPayTicketWriteOffAction.CANCEL && !input.cancelReason) {
      throw new Error('cancelReason is required when action is CANCEL');
    }

    const body: ECPayTicketWriteOffRequestBody = {
      MerchantID: this.merchantId,
      WriteOffNo: input.writeOffNo,
      Action: action,
      ...(input.cancelReason ? { CancelReason: input.cancelReason } : {}),
      ...(input.storeId ? { StoreID: input.storeId } : {}),
      Operator: input.operator,
    };

    const decrypted = await this.postEnvelope<ECPayTicketWriteOffRequestBody, ECPayTicketWriteOffResponseDecrypted>(
      '/api/Ticket/WriteOff',
      body,
    );

    if (decrypted.RtnCode !== ECPAY_TICKET_RTN_CODE_SUCCESS) {
      throw new Error(`ECPay ticket write-off failed: (${decrypted.RtnCode}) ${decrypted.RtnMsg}`);
    }

    return {
      writeOffNo: input.writeOffNo,
      action,
      rtnCode: decrypted.RtnCode,
      rtnMsg: decrypted.RtnMsg,
    };
  }

  private mapTicket(raw: ECPayTicketListResponseItem): ECPayTicketInfo {
    const ticketType = TICKET_TYPE_MAP[raw.TicketType];

    if (!ticketType) {
      throw new Error(`Unknown ECPay ticket TicketType: ${raw.TicketType}`);
    }

    const startDate = this.parseDateYMD(raw.StartDate);
    const writeOffDate = this.parseDateYMD(raw.WriteOffDate);
    const refundDate = this.parseDateYMD(raw.RefundDate);
    const expiredDate = this.parseDateYMD(raw.ExpiredDate);

    return {
      ticketNo: raw.TicketNo,
      useStatus: parseTicketUseStatus(raw.UseStatus),
      ...(raw.ItemNo ? { itemNo: raw.ItemNo } : {}),
      ...(raw.ItemName ? { itemName: raw.ItemName } : {}),
      ticketType,
      ticketAmount: raw.TicketAmount,
      ...(startDate ? { startDate } : {}),
      ...(writeOffDate ? { writeOffDate } : {}),
      ...(refundDate ? { refundDate } : {}),
      ...(expiredDate ? { expiredDate } : {}),
      ...(raw.WriteOffNo ? { writeOffNo: raw.WriteOffNo } : {}),
    };
  }

  private mapOrderInfo(decrypted: ECPayTicketQueryOrderInfoResponseDecrypted): ECPayTicketOrderInfo {
    const issueDate = this.parseTimestamp(decrypted.IssueDate);
    const escrowExpiredDate = this.parseDateYMD(decrypted.EscrowExpiredDate);

    return {
      ...(decrypted.MerchantTradeNo ? { merchantTradeNo: decrypted.MerchantTradeNo } : {}),
      ...(decrypted.FreeTradeNo ? { freeTradeNo: decrypted.FreeTradeNo } : {}),
      ticketTradeNo: decrypted.TicketTradeNo,
      paymentProvider: decrypted.PaymentProvider,
      paymentType: decrypted.PaymentType,
      ...(decrypted.CreditTradeID !== undefined ? { creditTradeId: decrypted.CreditTradeID } : {}),
      status: decrypted.Status,
      remark: decrypted.Remark,
      ...(issueDate ? { issueDate } : {}),
      issueType: decrypted.IssueType,
      ...(decrypted.PrintType ? { printType: decrypted.PrintType } : {}),
      customer: {
        ...(decrypted.CustomerName ? { name: decrypted.CustomerName } : {}),
        ...(decrypted.CustomerPhone ? { phone: decrypted.CustomerPhone } : {}),
        ...(decrypted.CustomerEmail ? { email: decrypted.CustomerEmail } : {}),
      },
      ...(escrowExpiredDate ? { escrowExpiredDate } : {}),
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
          debugTicket('[ECPayTicketGateway] NGROK_AUTHTOKEN is not set. Please set it in your environment variables.');

          throw new Error(
            '[ECPayTicketGateway] NGROK_AUTHTOKEN is not set. Please set it in your environment variables.',
          );
        }

        try {
          await import('@ngrok/ngrok');
        } catch (ex) {
          debugTicket(
            '[ECPayTicketGateway] Failed to import @ngrok/ngrok. Please install it (npm i @ngrok/ngrok) to use the ngrok tunnel feature.',
          );

          throw ex;
        }

        const ngrok = (await import('@ngrok/ngrok')).default;

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
    let plaintext: string;

    try {
      plaintext = this.decryptToPlaintext(envelope.Data);
    } catch {
      throw new ECPayTicketCallbackError('INVALID_DATA', 'Failed to decrypt Data');
    }

    // 對「解密後的原始明文字串」驗證 MAC，再行 parse
    if (!this.verifyResponseEnvelope(plaintext, envelope)) {
      debugTicket('Invalid CheckMacValue on callback');
      throw new ECPayTicketCallbackError('INVALID_CHECKMAC', 'Invalid CheckMacValue');
    }

    try {
      return JSON.parse(plaintext) as Record<string, unknown>;
    } catch {
      throw new ECPayTicketCallbackError('INVALID_DATA', 'Failed to parse Data');
    }
  }

  private requireStringField(decrypted: Record<string, unknown>, field: string): string {
    const value = decrypted[field];

    if (typeof value !== 'string' || value.length === 0) {
      throw new ECPayTicketCallbackError('INVALID_PAYLOAD', `Missing or invalid string field: ${field}`);
    }

    return value;
  }

  private requireNumericField(decrypted: Record<string, unknown>, field: string): number {
    const value = decrypted[field];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.length > 0) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    throw new ECPayTicketCallbackError('INVALID_PAYLOAD', `Missing or invalid numeric field: ${field}`);
  }

  public handleRefundNotification(envelope: ECPayTicketResponseEnvelope): ECPayTicketRefundNotification {
    const decrypted = this.parseAndVerifyEnvelope(envelope);

    const ticketTradeNo = this.requireStringField(decrypted, 'TicketTradeNo');
    const refundAmount = this.requireNumericField(decrypted, 'RefundAmount');

    if (typeof decrypted.MerchantTradeNo !== 'string' && typeof decrypted.FreeTradeNo !== 'string') {
      throw new ECPayTicketCallbackError(
        'INVALID_PAYLOAD',
        'Either MerchantTradeNo or FreeTradeNo must be present in the callback payload',
      );
    }

    const notification: ECPayTicketRefundNotification = {
      ...(typeof decrypted.MerchantTradeNo === 'string' ? { merchantTradeNo: decrypted.MerchantTradeNo } : {}),
      ...(typeof decrypted.FreeTradeNo === 'string' ? { freeTradeNo: decrypted.FreeTradeNo } : {}),
      ticketTradeNo,
      refundAmount,
      ...(typeof decrypted.Remark === 'string' ? { remark: decrypted.Remark } : {}),
      raw: decrypted,
    };

    this.emitter.emit(ECPayTicketEvents.TICKET_REFUND_NOTIFIED, notification);

    return notification;
  }

  public handleUseStatusNotification(envelope: ECPayTicketResponseEnvelope): ECPayTicketUseStatusNotification {
    const decrypted = this.parseAndVerifyEnvelope(envelope);

    const ticketTradeNo = this.requireStringField(decrypted, 'TicketTradeNo');
    const ticketNo = this.requireStringField(decrypted, 'TicketNo');
    const useStatusCode = this.requireNumericField(decrypted, 'UseStatus');

    let useStatus: ECPayTicketUseStatusNotification['useStatus'];

    try {
      useStatus = parseTicketUseStatus(useStatusCode);
    } catch {
      throw new ECPayTicketCallbackError('INVALID_PAYLOAD', `Unknown UseStatus code: ${useStatusCode}`);
    }

    if (typeof decrypted.MerchantTradeNo !== 'string' && typeof decrypted.FreeTradeNo !== 'string') {
      throw new ECPayTicketCallbackError(
        'INVALID_PAYLOAD',
        'Either MerchantTradeNo or FreeTradeNo must be present in the callback payload',
      );
    }

    const notification: ECPayTicketUseStatusNotification = {
      ...(typeof decrypted.MerchantTradeNo === 'string' ? { merchantTradeNo: decrypted.MerchantTradeNo } : {}),
      ...(typeof decrypted.FreeTradeNo === 'string' ? { freeTradeNo: decrypted.FreeTradeNo } : {}),
      ticketTradeNo,
      ticketNo,
      useStatus,
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

          const tag =
            error.code === 'INVALID_CHECKMAC'
              ? 'InvalidCheckMacValue'
              : error.code === 'INVALID_PAYLOAD'
                ? 'InvalidPayload'
                : 'InvalidData';

          res.end(`0|${tag}`);

          return;
        }

        res.writeHead(500);
        res.end('0|InternalError');
      }
    });
  }
}

export type ECPayTicketCallbackErrorCode = 'INVALID_CHECKMAC' | 'INVALID_DATA' | 'INVALID_PAYLOAD';

export class ECPayTicketCallbackError extends Error {
  public readonly code: ECPayTicketCallbackErrorCode;

  constructor(code: ECPayTicketCallbackErrorCode, message: string) {
    super(message);
    this.name = 'ECPayTicketCallbackError';
    this.code = code;
  }
}
