import { EventEmitter } from 'events';

export interface PaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface PrepareOrderInput<I extends PaymentItem = PaymentItem> {
  items: I[];
}

export interface OrderCreditCardCommitMessage extends OrderCommitMessage {
  type?: Channel.CREDIT_CARD;
  id: string;
  totalPrice: number;
  committedAt: Date;
  cardType?: CardType;
}

export interface OrderVirtualAccountCommitMessage extends OrderCommitMessage {
  type?: Channel.VIRTUAL_ACCOUNT;
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

export interface OrderCVSCommitMessage extends OrderCommitMessage {
  type?: Channel.CVS_KIOSK;
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

export interface OrderBarcodeCommitMessage extends OrderCommitMessage {
  type?: Channel.CVS_BARCODE;
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

export interface OrderApplePayCommitMessage extends OrderCommitMessage {
  type?: Channel.APPLE_PAY;
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

export interface OrderLinePayCommitMessage extends OrderCommitMessage {
  type?: Channel.LINE_PAY;
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

export interface OrderWebATMCommitMessage extends OrderCommitMessage {
  type?: Channel.WEB_ATM;
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

export interface OrderCommitMessage {
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

export type AsyncOrderInformation<OCM extends OrderCommitMessage> =
  OCM extends OrderVirtualAccountCommitMessage
  ? VirtualAccountInfo
  : OCM extends OrderCVSCommitMessage
  ? CVSInfo
  : OCM extends OrderBarcodeCommitMessage
  ? BarcodeInfo
  : never;

export type AdditionalInfo<OCM extends OrderCommitMessage> =
  OCM extends OrderCreditCardCommitMessage
  ? CreditCardAuthInfo
  : OCM extends OrderVirtualAccountCommitMessage
  ? VirtualAccountPaymentInfo
  : OCM extends OrderWebATMCommitMessage
  ? WebATMPaymentInfo
  : OCM extends OrderCVSCommitMessage
  ? CVSPaymentInfo
  : OCM extends OrderBarcodeCommitMessage
  ? BarcodeInfo
  : OCM extends OrderApplePayCommitMessage
  ? undefined
  : never;

export interface Order<OCM extends OrderCommitMessage>
  extends PrepareOrderInput {
  // Order State
  state: OrderState;

  // Order created at (send to gateway time)
  createdAt: Date | null;

  // Order committed at
  committedAt: Date | null;

  // Additional info
  additionalInfo?: AdditionalInfo<OCM>;

  // Async info
  asyncInfo?: AsyncOrderInformation<OCM>;

  failedMessage: OrderFailMessage | null;

  id: string;
  items: PaymentItem[];
  committable: boolean;

  infoRetrieved<T extends OCM>(
    asyncInformation: AsyncOrderInformation<T>,
  ): void;
  fail(code: string, message: string): void;
  commit<T extends OCM>(message: T, additionalInfo?: AdditionalInfo<T>): void;

  refund(amount?: number, options?: any): Promise<void>;
}

export enum CardType {
  VMJ = 'VMJ',
  AE = 'AE',
}

export interface InputFromOrderCommitMessage<OCM extends OrderCommitMessage>
  extends PrepareOrderInput {
  id?: string;
  shopName?: string;
  clientBackUrl?: string;
  cardType?: CardType;
}

export interface PaymentGateway<
  OCM extends OrderCommitMessage = OrderCommitMessage,
  O extends Order<OCM> = Order<OCM>,
> {
  emitter: EventEmitter;

  prepare<N extends OCM>(
    input: InputFromOrderCommitMessage<N>,
  ): Promise<Order<N>>;

  query<OO extends O>(id: string, options?: any): Promise<OO>;
}

export interface BindCardRequest {
  cardId: string | undefined;
  memberId: string;
}

export interface CheckoutWithBoundCardOptions {
  cardId: string; // 綁定的卡片 ID
  memberId: string; // 綁定會員 ID
  items: PaymentItem[];
  orderId?: string; // 可選的訂單 ID，若未提供則自動生成
}

export interface BindCardPaymentGateway<
  CM extends OrderCommitMessage = OrderCommitMessage,
  R extends BindCardRequest = BindCardRequest,
  O extends Order<CM> = Order<CM>,
> {
  prepareBindCard(memberId: string): Promise<R>;

  checkoutWithBoundCard(options: CheckoutWithBoundCardOptions): Promise<O>;
}

export enum Channel {
  CREDIT_CARD = 'CREDIT_CARD',
  WEB_ATM = 'WEB_ATM',
  VIRTUAL_ACCOUNT = 'VIRTUAL_ACCOUNT',
  CVS_KIOSK = 'CVS_KIOSK',
  CVS_BARCODE = 'CVS_BARCODE',
  APPLE_PAY = 'APPLE_PAY',
  LINE_PAY = 'LINE_PAY',
}

export enum CreditCardECI {
  MASTER_3D = '2',
  MASTER_3D_PART = '1',
  MASTER_3D_FAILED = '0',
  VISA_AE_JCB_3D = '5',
  VISA_AE_JCB_3D_PART = '6',
  VISA_AE_JCB_3D_FAILED = '7',
}

export enum CVS {
  FAMILY_MART = 'FAMILY_MART',
  HILIFE = 'HILIFE',
  OK_MART = 'OK_MART',
  SEVEN_ELEVEN = 'SEVEN_ELEVEN',
}

export interface CreditCardAuthInfo {
  channel: Channel.CREDIT_CARD;
  processDate: Date;
  authCode: string; // Credit Card Auth Code (6 digits)
  amount: number;
  eci: CreditCardECI;
  card4Number: string;
  card6Number: string;
  gwsr?: string;
}

export interface WebATMPaymentInfo {
  channel: Channel.WEB_ATM;
  buyerAccountNumber: string;
  buyerBankCode: string;
}

export interface VirtualAccountPaymentInfo {
  channel: Channel.VIRTUAL_ACCOUNT;
  buyerAccountNumber: string;
  buyerBankCode: string;
}

export interface VirtualAccountInfo {
  channel: Channel.VIRTUAL_ACCOUNT;
  bankCode: string;
  account: string;
  expiredAt: Date;
}

export interface CVSPaymentInfo {
  channel: Channel.CVS_KIOSK;
  cvsPayFrom: CVS;
}

export interface CVSInfo {
  channel: Channel.CVS_KIOSK;
  paymentCode: string;
  expiredAt: Date;
}

export interface BarcodeInfo {
  channel: Channel.CVS_BARCODE;
  barcodes: [string, string, string];
  expiredAt: Date;
}

export enum OrderState {
  INITED = 'INITED',
  PRE_COMMIT = 'PRE_COMMIT', // Created
  ASYNC_INFO_RETRIEVED = 'ASYNC_INFO_RETRIEVED', // Async Payment Information Retrieved (ATM/CVS/Barcode...)
  COMMITTED = 'COMMITTED', // Fulfilled
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface OrderFailMessage {
  code: string;
  message: string;
}

export enum PaymentEvents {
  SERVER_LISTENED = 'LISTENED',
  ORDER_INFO_RETRIEVED = 'INFO_RETRIEVED',
  ORDER_PRE_COMMIT = 'PRE_COMMIT',
  ORDER_COMMITTED = 'COMMITTED',
  ORDER_FAILED = 'FAILED',
  CARD_BOUND = 'CARD_BOUND',
  CARD_BINDING_FAILED = 'CARD_BINDING_FAILED',
}

export enum PaymentPeriodType {
  DAY = 'DAY',
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

export interface PaymentPeriod {
  amountPerPeriod: number;
  type: PaymentPeriodType;
  frequency?: number;
  times: number;
}
