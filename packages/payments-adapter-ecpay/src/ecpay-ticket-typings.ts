import { IncomingMessage, ServerResponse } from 'http';

export enum ECPayTicketBaseUrls {
  DEVELOPMENT = 'https://ecticket-stage.ecpay.com.tw',
  PRODUCTION = 'https://ecticket.ecpay.com.tw',
}

export enum ECPayTicketEvents {
  TICKET_ISSUED = 'TICKET_ISSUED',
  TICKET_ISSUE_FAILED = 'TICKET_ISSUE_FAILED',
  TICKET_REFUND_NOTIFIED = 'TICKET_REFUND_NOTIFIED',
  TICKET_USE_STATUS_CHANGED = 'TICKET_USE_STATUS_CHANGED',
  SERVER_LISTENED = 'SERVER_LISTENED',
}

export enum ECPayIssueType {
  CVS = '1',
  PAPER = '2',
  ELECTRONIC = '3',
  SERIAL_ONLY = '4',
}

export enum ECPayPrintType {
  ECPAY = '1',
  MERCHANT = '2',
}

export enum ECPayIsImmediate {
  IMMEDIATE = '1',
  SCHEDULED = '2',
}

export enum ECPayTicketIssueStatusCode {
  SUCCESS = 1,
  FAILED = 2,
  PROCESSING = 3,
}

export enum ECPayTicketUseStatus {
  UNUSED = 'unused',
  REDEEMED = 'redeemed',
  REFUNDED = 'refunded',
  EXPIRED = 'expired',
}

const TICKET_USE_STATUS_MAP: Record<number, ECPayTicketUseStatus> = {
  1: ECPayTicketUseStatus.UNUSED,
  2: ECPayTicketUseStatus.REDEEMED,
  3: ECPayTicketUseStatus.REFUNDED,
  4: ECPayTicketUseStatus.EXPIRED,
};

export function parseTicketUseStatus(code: number): ECPayTicketUseStatus {
  const mapped = TICKET_USE_STATUS_MAP[code];

  if (!mapped) {
    throw new Error(`Unknown ECPay ticket UseStatus code: ${code}`);
  }

  return mapped;
}

export enum ECPayTicketType {
  REDEMPTION = 'redemption',
  GIFT = 'gift',
}

export interface IssuedTicketRecord {
  merchantTradeNo?: string;
  freeTradeNo?: string;
  issueType: ECPayIssueType;
  ticketTradeNo?: string;
  issuedAt: Date;
}

export interface IssuedTicketsCache {
  get(key: string): Promise<IssuedTicketRecord | undefined>;
  set(key: string, value: IssuedTicketRecord): Promise<void>;
}

export interface ECPayTicketGatewayOptions {
  merchantId?: string;
  hashKey?: string;
  hashIv?: string;
  baseUrl?: ECPayTicketBaseUrls | string;
  platformId?: string;

  /**
   * Background-polling configuration for `issue()`.
   *
   * - `undefined` (default) — gateway polls every 30s up to 6min after `issue()`
   *   resolves, then emits `TICKET_ISSUED` or `TICKET_ISSUE_FAILED`.
   * - `{ intervalMs, timeoutMs }` — override the defaults.
   * - `false` — disable background polling entirely. `issue()` returns the
   *   receipt and does NOT emit issuance events. You must drive polling
   *   yourself by calling `queryIssueResult()`. `waitForIssuance: true` still
   *   works per call (it triggers a one-shot poll loop using the default
   *   interval/timeout regardless of this setting).
   */
  issuePoll?:
    | false
    | {
        intervalMs?: number;
        timeoutMs?: number;
      };

  issuedTicketsCache?: IssuedTicketsCache;
  issuedTicketsCacheTTL?: number;

  withServer?: boolean | 'ngrok';
  serverHost?: string;
  refundNotifyPath?: string;
  useStatusNotifyPath?: string;
  onServerListen?: () => void;
  serverListener?: (req: IncomingMessage, res: ServerResponse) => void;
}

export interface ECPayTicketItemInput {
  itemNo?: string;
  itemName?: string;
  ticketPrice?: number;
  ticketAmount: number;
  startDate?: Date;
  expireDate?: Date;
}

export interface ECPayTicketIssueInput {
  merchantTradeNo?: string;
  freeTradeNo?: string;
  issueType: ECPayIssueType;
  printType?: ECPayPrintType;
  isImmediate?: ECPayIsImmediate;
  operator: string;
  storeId?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  refundNotifyUrl?: string;
  useStatusNotifyUrl?: string;
  tickets: ECPayTicketItemInput[];
  /**
   * 若為 true，issue() 會等候背景輪詢完成才 resolve；
   * 否則立即回傳 receipt，最終結果以 event 通知。
   */
  waitForIssuance?: boolean;
}

export interface ECPayTicketIssueReceipt {
  merchantTradeNo?: string;
  freeTradeNo?: string;
  ticketTradeNo: string;
  tickets: Array<{
    itemNo?: string;
    itemName?: string;
    ticketPrice?: number;
    ticketAmount: number;
  }>;
}

export type ECPayTicketIssueOutcome =
  | {
      status: 'success';
      merchantTradeNo?: string;
      freeTradeNo?: string;
    }
  | {
      status: 'failed';
      merchantTradeNo?: string;
      freeTradeNo?: string;
      remark: string;
    }
  | {
      status: 'processing';
      merchantTradeNo?: string;
      freeTradeNo?: string;
    };

export interface ECPayTicketInfo {
  ticketNo: string;
  useStatus: ECPayTicketUseStatus;
  itemNo?: string;
  itemName?: string;
  ticketType: ECPayTicketType;
  ticketAmount: number;
  startDate?: Date;
  writeOffDate?: Date;
  refundDate?: Date;
  expiredDate?: Date;
  writeOffNo?: string;
}

export interface ECPayTicketOrderInfo {
  merchantTradeNo?: string;
  freeTradeNo?: string;
  ticketTradeNo: string;
  paymentProvider: string;
  paymentType: string;
  creditTradeId?: number;
  status: ECPayTicketIssueStatusCode;
  remark: string;
  issueDate?: Date;
  issueType: ECPayIssueType;
  printType?: ECPayPrintType;
  customer: {
    name?: string;
    phone?: string;
    email?: string;
  };
  escrowExpiredDate?: Date;
  totalCount: number;
  tradeAmount: number;
  redeemCount: number;
  redeemAmount: number;
  refundCount: number;
  refundAmount: number;
  totalRefundFee: number;
  unUsedCount: number;
  unUsedAmount: number;
  expiredCount: number;
  tickets: ECPayTicketInfo[];
}

export interface ECPayTicketRefundNotification {
  merchantTradeNo?: string;
  freeTradeNo?: string;
  ticketTradeNo: string;
  refundAmount: number;
  remark?: string;
  raw: Record<string, unknown>;
}

export interface ECPayTicketUseStatusNotification {
  merchantTradeNo?: string;
  freeTradeNo?: string;
  ticketTradeNo: string;
  ticketNo: string;
  useStatus: ECPayTicketUseStatus;
  raw: Record<string, unknown>;
}

/* ------- Wire-level (request/response body) types ------- */

export interface ECPayTicketRequestEnvelope {
  PlatformID?: string;
  MerchantID: string;
  RqHeader: {
    Timestamp: number;
  };
  Data: string;
  CheckMacValue: string;
}

export interface ECPayTicketResponseEnvelope {
  PlatformID?: string;
  MerchantID: string;
  RpHeader: {
    Timestamp: number;
  };
  TransCode: number;
  TransMsg: string;
  Data: string;
  CheckMacValue: string;
}

export interface ECPayTicketItemRequestBody {
  ItemNo?: string;
  ItemName?: string;
  TicketPrice?: number;
  TicketAmount: number;
  StartDate?: string;
  ExpireDate?: string;
}

export interface ECPayTicketIssueRequestBody {
  MerchantID: string;
  MerchantTradeNo?: string;
  FreeTradeNo?: string;
  IssueType: ECPayIssueType;
  PrintType?: ECPayPrintType;
  IsImmediate?: ECPayIsImmediate;
  RefundNotifyURL?: string;
  UseStatusNotifyURL?: string;
  StoreID?: string;
  Operator: string;
  CustomerName?: string;
  CustomerPhone?: string;
  CustomerEmail?: string;
  CustomerAddress?: string;
  TicketInfo: ECPayTicketItemRequestBody[];
}

export interface ECPayTicketIssueResponseDecrypted {
  RtnCode: number;
  RtnMsg: string;
  MerchantTradeNo?: string;
  FreeTradeNo?: string;
  TicketTradeNo: string;
  TicketData: Array<{
    ItemNo?: string;
    ItemName?: string;
    TicketPrice?: number;
    TicketAmount: number;
  }>;
}

export interface ECPayTicketQueryIssueResultRequestBody {
  MerchantID: string;
  MerchantTradeNo?: string;
  FreeTradeNo?: string;
}

export interface ECPayTicketQueryIssueResultResponseDecrypted {
  RtnCode: number;
  RtnMsg: string;
  MerchantTradeNo?: string;
  FreeTradeNo?: string;
  Status: ECPayTicketIssueStatusCode;
  Remark: string;
}

export interface ECPayTicketQueryOrderInfoRequestBody {
  MerchantID: string;
  MerchantTradeNo?: string;
  FreeTradeNo?: string;
  PageNum?: number;
}

export interface ECPayTicketListResponseItem {
  TicketNo: string;
  UseStatus: number;
  ItemNo?: string;
  ItemName?: string;
  TicketType: string;
  TicketAmount: number;
  StartDate?: string;
  WriteOffDate?: string;
  RefundDate?: string;
  ExpiredDate?: string;
  WriteOffNo?: string;
}

export interface ECPayTicketQueryOrderInfoResponseDecrypted {
  RtnCode: number;
  RtnMsg: string;
  MerchantID: string;
  MerchantTradeNo?: string;
  FreeTradeNo?: string;
  TicketTradeNo: string;
  PaymentProvider: string;
  PaymentType: string;
  CreditTradeID?: number;
  Status: ECPayTicketIssueStatusCode;
  Remark: string;
  IssueDate?: string;
  IssueType: ECPayIssueType;
  PrintType?: ECPayPrintType;
  CustomerName?: string;
  CustomerPhone?: string;
  CustomerEmail?: string;
  EscrowExpiredDate?: string;
  TotalCount: number;
  TradeAmount: number;
  RedeemCount: number;
  RedeemAmount: number;
  RefundCount: number;
  RefundAmount: number;
  TotalRefundFee: number;
  UnUsedCount: number;
  UnUsedAmount: number;
  ExpiredCount: number;
  TicketList: ECPayTicketListResponseItem[];
}

export const ECPAY_TICKET_TRANS_CODE_SUCCESS = 1;
export const ECPAY_TICKET_RTN_CODE_SUCCESS = 1;
