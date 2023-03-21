import { OrderCommitMessage, OrderCreditCardCommitMessage, PaymentItem, PrepareOrderInput } from '@rytass/payments';
import { IncomingMessage, ServerResponse } from 'http';
import { HwaNanOrder } from './hwanan-order';
import { HwaNanPayment } from './hwanan-payment';

export enum HwaNanPaymentChannel {
  CREDIT = 1,
}

export interface HwaNanCommitMessage extends OrderCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date | null;
  platformTradeNumber: string;
  channel: HwaNanPaymentChannel;
}

export interface HwaNanCreditCardOrderInput extends PrepareOrderInput {
  id?: string;
  items: PaymentItem[];
}

export interface HwaNanCreditCardCommitMessage extends OrderCreditCardCommitMessage, HwaNanCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date;
  platformTradeNumber: string;
}

export type HwaNanOrderInput<CM extends HwaNanCommitMessage> = CM extends HwaNanCreditCardCommitMessage ? HwaNanCreditCardOrderInput : never;

export enum HwaNanCustomizePageType {
  ZH_TW = 1,
  ZH_CN = 2,
  EN_US = 3,
  JA_JP = 4,
  OTHER = 5,
}

export enum HwaNanTransactionType {
  ONE_TIME = 0,
  INSTALLMENTS = 1,
}

export enum HwaNanAutoCapMode {
  MANUALLY = 0,
  AUTO = 1,
}

export interface HwaNanMakeOrderPayload {
  MerchantID: string;
  TerminalID: string;
  MerchantName: string;
  lidm: string; // 訂單編號
  merID: string;
  customize?: HwaNanCustomizePageType;
  PageVer?: string;
  purchAmt: number;
  txType: HwaNanTransactionType;
  checkValue: string;
  NumberOfPay?: number; // txType === 1 時必填，Minimum 3
  AutoCap: HwaNanAutoCapMode;
  AuthResURL: string;
  AuthInfoPage: 'Y' | 'N'; // Y 先顯示銀行頁才跳轉回商店，N 直接跳轉回商店
}

export interface HwaNanOrderInit<OCM extends HwaNanCommitMessage> {
  id: string;
  items: PaymentItem[];
  gateway: HwaNanPayment<OCM>;
}

export interface HwaNanPrepareOrderInit<OCM extends HwaNanCommitMessage> extends HwaNanOrderInit<OCM> {
  makePayload: HwaNanMakeOrderPayload;
}

export interface GetCheckCodeArgs {
  id: string;
  totalPrice: number;
}

export interface HwaNanPaymentInitOptions<O extends HwaNanOrder<HwaNanCommitMessage>> {
  baseUrl?: string;
  customizePageType?: HwaNanCustomizePageType;
  customizePageVersion?: string;
  merchantId: string;
  terminalId: string;
  merchantName: string;
  merID: string;
  identifier: string;
  serverHost?: string;
  callbackPath?: string;
  checkoutPath?: string;
  withServer?: boolean | 'ngrok';
  ttl?: number;
  serverListener?: (req: IncomingMessage, res: ServerResponse) => void;
  onCommit?: (order: O) => void;
  onServerListen?: () => void;
}

export interface HwaNanNotifyPayload {
  status: string;
  errcode: string;
  authCode: string;
  authAmt: string;
  xid: string;
  lidm: string;
  merID: string;
  Last4digitPAN: string;
  errDesc: string;
  encOut: string;
  checkValue: string;
  Einvoice: string;
}
