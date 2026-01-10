# Base Interfaces Reference

Complete type definitions for the `@rytass/payments` package.

## Core Interfaces

### Order\<OCM\>

The main order entity interface that all order implementations must satisfy.

```typescript
interface Order<OCM extends OrderCommitMessage> extends PrepareOrderInput {
  // Order State
  state: OrderState;                           // Current order state

  // Timestamps
  createdAt: Date | null;                      // Order creation time (when sent to gateway)
  committedAt: Date | null;                    // Payment commit time

  // Additional Information
  additionalInfo?: AdditionalInfo<OCM>;        // Channel-specific payment info
  asyncInfo?: AsyncOrderInformation<OCM>;      // Async payment info (ATM/CVS)
  failedMessage: OrderFailMessage | null;      // Error details if failed

  // Order Details
  id: string;                                  // Unique order identifier
  items: PaymentItem[];                        // Order line items
  committable: boolean;                        // Whether order can be committed

  // Methods
  infoRetrieved<T extends OCM>(
    asyncInformation: AsyncOrderInformation<T>
  ): void;                                     // Set async payment info

  fail(code: string, message: string): void;   // Mark order as failed

  commit<T extends OCM>(
    message: T,
    additionalInfo?: AdditionalInfo<T>
  ): void;                                     // Commit the order

  refund(amount?: number, options?: unknown): Promise<void>; // Process refund
}
```

---

### PaymentGateway\<OCM, O\>

The gateway interface defining all operations an adapter must implement.

```typescript
interface PaymentGateway<
  OCM extends OrderCommitMessage = OrderCommitMessage,
  O extends Order<OCM> = Order<OCM>,
> {
  /**
   * Event emitter for payment notifications
   * Emits: ORDER_PRE_COMMIT, ORDER_INFO_RETRIEVED, ORDER_COMMITTED, ORDER_FAILED, etc.
   */
  emitter: EventEmitter;

  /**
   * Prepare a new order
   * @param input - Order configuration including items and channel
   * @returns Promise resolving to the prepared order
   */
  prepare<N extends OCM>(input: InputFromOrderCommitMessage<N>): Promise<Order<N>>;

  /**
   * Query an existing order by ID
   * @param id - Order identifier
   * @param options - Provider-specific query options
   * @returns Promise resolving to the found order
   */
  query<OO extends O>(id: string, options?: unknown): Promise<OO>;
}
```

---

### BindCardPaymentGateway\<CM, R, O\>

Optional interface for adapters supporting card binding functionality.

```typescript
interface BindCardPaymentGateway<
  CM extends OrderCommitMessage = OrderCommitMessage,
  R extends BindCardRequest = BindCardRequest,
  O extends Order<CM> = Order<CM>,
> {
  /**
   * Prepare card binding for a member
   * @param memberId - Member identifier
   * @returns Promise resolving to bind card request
   */
  prepareBindCard(memberId: string): Promise<R>;

  /**
   * Checkout using a previously bound card
   * @param options - Checkout configuration with cardId and memberId
   * @returns Promise resolving to the created order
   */
  checkoutWithBoundCard(options: CheckoutWithBoundCardOptions): Promise<O>;
}
```

---

## Order Commit Messages

### OrderCommitMessage (Base)

Base interface for all commit messages.

```typescript
interface OrderCommitMessage {
  id: string;              // Order ID
  totalPrice: number;      // Total payment amount
  committedAt: Date | null; // Payment time (null for pending)
}
```

### Channel-Specific Commit Messages

```typescript
// Credit Card
interface OrderCreditCardCommitMessage extends OrderCommitMessage {
  type?: Channel.CREDIT_CARD;
  id: string;
  totalPrice: number;
  committedAt: Date;                    // Always has commit time
  cardType?: CardType;                  // Card type (VMJ/AE)
}

// Virtual Account (ATM)
interface OrderVirtualAccountCommitMessage extends OrderCommitMessage {
  type?: Channel.VIRTUAL_ACCOUNT;
  id: string;
  totalPrice: number;
  committedAt: Date | null;             // Null until paid
}

// Web ATM
interface OrderWebATMCommitMessage extends OrderCommitMessage {
  type?: Channel.WEB_ATM;
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

// CVS Kiosk (代碼)
interface OrderCVSCommitMessage extends OrderCommitMessage {
  type?: Channel.CVS_KIOSK;
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

// CVS Barcode (條碼)
interface OrderBarcodeCommitMessage extends OrderCommitMessage {
  type?: Channel.CVS_BARCODE;
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

// Apple Pay
interface OrderApplePayCommitMessage extends OrderCommitMessage {
  type?: Channel.APPLE_PAY;
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}

// LINE Pay
interface OrderLinePayCommitMessage extends OrderCommitMessage {
  type?: Channel.LINE_PAY;
  id: string;
  totalPrice: number;
  committedAt: Date | null;
}
```

---

## Enums

### Channel

Payment channel types.

```typescript
enum Channel {
  CREDIT_CARD = 'CREDIT_CARD',           // 信用卡
  WEB_ATM = 'WEB_ATM',                   // 網路 ATM
  VIRTUAL_ACCOUNT = 'VIRTUAL_ACCOUNT',   // ATM 虛擬帳號
  CVS_KIOSK = 'CVS_KIOSK',               // 超商代碼
  CVS_BARCODE = 'CVS_BARCODE',           // 超商條碼
  APPLE_PAY = 'APPLE_PAY',               // Apple Pay
  LINE_PAY = 'LINE_PAY',                 // LINE Pay
}
```

### OrderState

Current state of an order in its lifecycle.

```typescript
enum OrderState {
  INITED = 'INITED',                         // Initialized
  PRE_COMMIT = 'PRE_COMMIT',                 // Created (form/URL ready)
  ASYNC_INFO_RETRIEVED = 'ASYNC_INFO_RETRIEVED', // Async info ready (ATM/CVS)
  COMMITTED = 'COMMITTED',                   // Payment successful
  FAILED = 'FAILED',                         // Payment failed
  REFUNDED = 'REFUNDED',                     // Order refunded
}
```

### PaymentEvents

Events emitted by the payment gateway.

```typescript
enum PaymentEvents {
  SERVER_LISTENED = 'LISTENED',           // Built-in server started
  ORDER_INFO_RETRIEVED = 'INFO_RETRIEVED', // Async payment info ready
  ORDER_PRE_COMMIT = 'PRE_COMMIT',        // Order created
  ORDER_COMMITTED = 'COMMITTED',          // Payment successful
  ORDER_FAILED = 'FAILED',                // Payment failed
  CARD_BOUND = 'CARD_BOUND',              // Card bound successfully
  CARD_BINDING_FAILED = 'CARD_BINDING_FAILED', // Card binding failed
}
```

### CardType

Credit card types.

```typescript
enum CardType {
  VMJ = 'VMJ',   // VISA, MasterCard, JCB
  AE = 'AE',     // American Express
}
```

### CreditCardECI

3D Secure verification status codes.

```typescript
enum CreditCardECI {
  MASTER_3D = '2',                   // MasterCard 3D verified
  MASTER_3D_PART = '1',              // MasterCard 3D partial
  MASTER_3D_FAILED = '0',            // MasterCard 3D failed
  VISA_AE_JCB_3D = '5',              // VISA/AE/JCB 3D verified
  VISA_AE_JCB_3D_PART = '6',         // VISA/AE/JCB 3D partial
  VISA_AE_JCB_3D_FAILED = '7',       // VISA/AE/JCB 3D failed
}
```

### CVS

Convenience store types.

```typescript
enum CVS {
  FAMILY_MART = 'FAMILY_MART',       // 全家
  HILIFE = 'HILIFE',                 // 萊爾富
  OK_MART = 'OK_MART',               // OK 超商
  SEVEN_ELEVEN = 'SEVEN_ELEVEN',     // 7-11
}
```

### PaymentPeriodType

Recurring payment period types.

```typescript
enum PaymentPeriodType {
  DAY = 'DAY',       // Daily
  MONTH = 'MONTH',   // Monthly
  YEAR = 'YEAR',     // Yearly
}
```

---

## Info Types

### AsyncOrderInformation

Conditional type for async payment information.

```typescript
type AsyncOrderInformation<OCM extends OrderCommitMessage> =
  OCM extends OrderVirtualAccountCommitMessage
    ? VirtualAccountInfo
    : OCM extends OrderCVSCommitMessage
      ? CVSInfo
      : OCM extends OrderBarcodeCommitMessage
        ? BarcodeInfo
        : never;
```

### VirtualAccountInfo

Virtual account information for ATM payment.

```typescript
interface VirtualAccountInfo {
  channel: Channel.VIRTUAL_ACCOUNT;
  bankCode: string;        // Bank code (e.g., '004' for 台灣銀行)
  account: string;         // Virtual account number
  expiredAt: Date;         // Payment deadline
}
```

### CVSInfo

Convenience store payment code information.

```typescript
interface CVSInfo {
  channel: Channel.CVS_KIOSK;
  paymentCode: string;     // Payment code for kiosk
  expiredAt: Date;         // Payment deadline
}
```

### BarcodeInfo

Convenience store barcode information.

```typescript
interface BarcodeInfo {
  channel: Channel.CVS_BARCODE;
  barcodes: [string, string, string]; // Three barcode numbers
  expiredAt: Date;                     // Payment deadline
}
```

---

## Additional Info Types

### AdditionalInfo

Conditional type for channel-specific payment information.

```typescript
type AdditionalInfo<OCM extends OrderCommitMessage> =
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
```

### CreditCardAuthInfo

Credit card authorization information.

```typescript
interface CreditCardAuthInfo {
  channel: Channel.CREDIT_CARD;
  processDate: Date;       // Authorization date/time
  authCode: string;        // Authorization code (6 digits)
  amount: number;          // Authorized amount
  eci: CreditCardECI;      // 3D Secure status
  card4Number: string;     // Last 4 digits of card
  card6Number: string;     // First 6 digits of card (BIN)
  gwsr?: string;           // Gateway specific reference
  xid?: string;            // 3D Secure transaction ID
  aetId?: string;          // Additional transaction ID
}
```

### VirtualAccountPaymentInfo

Virtual account payment information after user paid.

```typescript
interface VirtualAccountPaymentInfo {
  channel: Channel.VIRTUAL_ACCOUNT;
  buyerAccountNumber: string;  // Buyer's account number
  buyerBankCode: string;       // Buyer's bank code
}
```

### WebATMPaymentInfo

Web ATM payment information.

```typescript
interface WebATMPaymentInfo {
  channel: Channel.WEB_ATM;
  buyerAccountNumber: string;  // Buyer's account number
  buyerBankCode: string;       // Buyer's bank code
}
```

### CVSPaymentInfo

CVS payment information after user paid.

```typescript
interface CVSPaymentInfo {
  channel: Channel.CVS_KIOSK;
  cvsPayFrom: CVS;             // Which CVS chain was used
}
```

---

## Type Aliases

### PaymentItem

Base payment item type.

```typescript
interface PaymentItem {
  name: string;          // Item name
  unitPrice: number;     // Price per unit (in cents)
  quantity: number;      // Quantity
  // Additional fields can be added by adapters
}
```

### PrepareOrderInput

Input for order preparation.

```typescript
interface PrepareOrderInput<I extends PaymentItem = PaymentItem> {
  items: I[];            // Line items
}
```

### InputFromOrderCommitMessage

Extended input for order creation.

```typescript
interface InputFromOrderCommitMessage<OCM extends OrderCommitMessage>
  extends PrepareOrderInput {
  id?: string;               // Optional order ID
  shopName?: string;         // Shop/Store name
  clientBackUrl?: string;    // Return URL after payment
  cardType?: CardType;       // Restrict card type
}
```

### BindCardRequest

Card binding request information.

```typescript
interface BindCardRequest {
  cardId: string | undefined;  // Bound card ID (after binding)
  memberId: string;            // Member identifier
}
```

### CheckoutWithBoundCardOptions

Options for checkout with bound card.

```typescript
interface CheckoutWithBoundCardOptions {
  cardId: string;        // Bound card ID
  memberId: string;      // Member identifier
  items: PaymentItem[];  // Order items
  orderId?: string;      // Optional order ID
}
```

### OrderFailMessage

Order failure information.

```typescript
interface OrderFailMessage {
  code: string;          // Error code
  message: string;       // Error message
}
```

### PaymentPeriod

Recurring payment period configuration.

```typescript
interface PaymentPeriod {
  amountPerPeriod: number;   // Amount to charge per period
  type: PaymentPeriodType;   // Period type (DAY/MONTH/YEAR)
  frequency?: number;        // Frequency within period (optional)
  times: number;             // Total number of charges
}
```

---

## Export Structure

The package exports all types from a single entry point:

```typescript
// src/index.ts
export * from './typings';
```

All interfaces, enums, and types are exported from `./typings.ts`.

---

## Usage Patterns

### Event Listening

```typescript
import { PaymentEvents } from '@rytass/payments';

payment.emitter.on(PaymentEvents.ORDER_PRE_COMMIT, (order) => {
  console.log('Order created:', order.id);
  console.log('Form HTML:', order.formHTML);
});

payment.emitter.on(PaymentEvents.ORDER_INFO_RETRIEVED, (order) => {
  console.log('Async info ready:', order.asyncInfo);
});

payment.emitter.on(PaymentEvents.ORDER_COMMITTED, (order) => {
  console.log('Payment successful:', order.id);
  console.log('Auth info:', order.additionalInfo);
});

payment.emitter.on(PaymentEvents.ORDER_FAILED, (order) => {
  console.error('Payment failed:', order.failedMessage);
});
```

### Order Lifecycle

```typescript
// 1. Prepare order (INITED → PRE_COMMIT)
const order = await payment.prepare({
  items: [{ name: 'Product', unitPrice: 10000, quantity: 1 }],
});

// 2. For async channels, info retrieved (PRE_COMMIT → ASYNC_INFO_RETRIEVED)
order.infoRetrieved(virtualAccountInfo);

// 3. User completes payment, gateway calls commit (ASYNC_INFO_RETRIEVED → COMMITTED)
order.commit(commitMessage, additionalInfo);

// 4. Optional: Process refund (COMMITTED → REFUNDED)
await order.refund(5000);
```

### Type Guards

```typescript
import { Channel } from '@rytass/payments';

if (order.asyncInfo?.channel === Channel.VIRTUAL_ACCOUNT) {
  const { bankCode, account, expiredAt } = order.asyncInfo;
  console.log(`請於 ${expiredAt} 前轉帳至 ${bankCode} ${account}`);
}

if (order.additionalInfo?.channel === Channel.CREDIT_CARD) {
  const { authCode, card4Number } = order.additionalInfo;
  console.log(`授權碼: ${authCode}, 卡號末四碼: ${card4Number}`);
}
```
