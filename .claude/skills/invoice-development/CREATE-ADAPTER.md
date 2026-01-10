# Creating a New Invoice Adapter

Step-by-step guide to creating a new invoice adapter for `@rytass/invoice`.

## Overview

Each adapter package needs to implement three main classes:
1. **Gateway** - Implements `InvoiceGateway` interface
2. **Invoice** - Implements `Invoice` interface
3. **Allowance** - Implements `InvoiceAllowance` interface

## Package Structure

Create a new package with this structure:

```
packages/invoice-adapter-{provider}/
├── package.json
├── tsconfig.build.json
├── src/
│   ├── index.ts                    # Main exports
│   ├── {provider}-invoice-gateway.ts
│   ├── {provider}-invoice.ts
│   ├── {provider}-invoice-allowance.ts
│   └── typings.ts                  # Provider-specific types
└── __tests__/
    └── {provider}-invoice-gateway.spec.ts
```

## Step 1: Package Configuration

### package.json

```json
{
  "name": "@rytass/invoice-adapter-{provider}",
  "version": "0.1.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "license": "MIT",
  "peerDependencies": {
    "@rytass/invoice": "^0.1.0"
  },
  "devDependencies": {
    "@rytass/invoice": "^0.1.0"
  }
}
```

### tsconfig.build.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

---

## Step 2: Define Provider Types

### src/typings.ts

```typescript
import { PaymentItem, TaxType } from '@rytass/invoice';

// Provider-specific payment item
export interface {Provider}PaymentItem extends PaymentItem {
  name: string;
  unitPrice: number;
  quantity: number;
  unit?: string;
  taxType?: TaxType;
  remark?: string;
  // Add provider-specific fields
}

// Gateway configuration
export interface {Provider}InvoiceGatewayOptions {
  merchantId?: string;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
}

// Issue options
export interface {Provider}InvoiceIssueOptions {
  orderId: string;
  items: {Provider}PaymentItem[];
  carrier?: InvoiceCarrier;
  vatNumber?: string;
  buyerEmail?: string;
  buyerName?: string;
  // Add provider-specific options
}

// Query options
export type {Provider}InvoiceQueryOptions =
  | { orderId: string }
  | { invoiceNumber: string; issuedOn: Date };

// Void options
export interface {Provider}InvoiceVoidOptions {
  reason: string;
}

// Allowance options
export interface {Provider}InvoiceAllowanceOptions {
  taxType?: TaxType;
}

// Provider-specific constants
export enum {Provider}BaseUrls {
  DEVELOPMENT = 'https://test-api.provider.com',
  PRODUCTION = 'https://api.provider.com',
}
```

---

## Step 3: Implement Invoice Class

### src/{provider}-invoice.ts

```typescript
import {
  Invoice,
  InvoiceState,
  TaxType,
  InvoiceAwardType,
} from '@rytass/invoice';
import { {Provider}PaymentItem } from './typings';
import { {Provider}InvoiceAllowance } from './{provider}-invoice-allowance';

export interface {Provider}InvoiceOptions {
  invoiceNumber: string;
  randomCode: string;
  issuedOn: Date;
  issuedAmount: number;
  orderId: string;
  taxType: TaxType;
  items: {Provider}PaymentItem[];
  state?: InvoiceState;
  voidOn?: Date | null;
  awardType?: InvoiceAwardType;
}

export class {Provider}Invoice implements Invoice<{Provider}PaymentItem> {
  readonly invoiceNumber: string;
  readonly randomCode: string;
  readonly issuedOn: Date;
  readonly issuedAmount: number;
  readonly orderId: string;
  readonly taxType: TaxType;
  readonly items: {Provider}PaymentItem[];
  readonly awardType?: InvoiceAwardType;

  allowances: {Provider}InvoiceAllowance[] = [];
  state: InvoiceState;
  voidOn: Date | null;
  nowAmount: number;

  constructor(options: {Provider}InvoiceOptions) {
    this.invoiceNumber = options.invoiceNumber;
    this.randomCode = options.randomCode;
    this.issuedOn = options.issuedOn;
    this.issuedAmount = options.issuedAmount;
    this.orderId = options.orderId;
    this.taxType = options.taxType;
    this.items = options.items;
    this.state = options.state ?? InvoiceState.ISSUED;
    this.voidOn = options.voidOn ?? null;
    this.nowAmount = options.issuedAmount;
    this.awardType = options.awardType;
  }

  setVoid(): void {
    this.state = InvoiceState.VOID;
    this.voidOn = new Date();
  }

  addAllowance(allowance: {Provider}InvoiceAllowance): void {
    this.allowances.push(allowance);
    this.nowAmount -= allowance.allowancePrice;
    this.state = InvoiceState.ALLOWANCED;
  }
}
```

---

## Step 4: Implement Allowance Class

### src/{provider}-invoice-allowance.ts

```typescript
import {
  InvoiceAllowance,
  InvoiceAllowanceState,
} from '@rytass/invoice';
import { {Provider}PaymentItem } from './typings';
import { {Provider}Invoice } from './{provider}-invoice';

export interface {Provider}InvoiceAllowanceOptions {
  allowanceNumber: string;
  allowancePrice: number;
  allowancedOn: Date;
  items: {Provider}PaymentItem[];
  parentInvoice: {Provider}Invoice;
  status?: InvoiceAllowanceState;
}

export class {Provider}InvoiceAllowance
  implements InvoiceAllowance<{Provider}PaymentItem>
{
  readonly allowanceNumber: string;
  readonly allowancePrice: number;
  readonly allowancedOn: Date;
  readonly items: {Provider}PaymentItem[];
  readonly parentInvoice: {Provider}Invoice;

  status: InvoiceAllowanceState;
  invalidOn: Date | null = null;

  constructor(options: {Provider}InvoiceAllowanceOptions) {
    this.allowanceNumber = options.allowanceNumber;
    this.allowancePrice = options.allowancePrice;
    this.allowancedOn = options.allowancedOn;
    this.items = options.items;
    this.parentInvoice = options.parentInvoice;
    this.status = options.status ?? InvoiceAllowanceState.ISSUED;
  }

  get remainingAmount(): number {
    return this.parentInvoice.nowAmount;
  }

  invalid(): void {
    this.status = InvoiceAllowanceState.INVALID;
    this.invalidOn = new Date();
  }
}
```

---

## Step 5: Implement Gateway Class

### src/{provider}-invoice-gateway.ts

```typescript
import {
  InvoiceGateway,
  InvoiceCarrier,
  getTaxTypeFromItems,
} from '@rytass/invoice';
import {
  {Provider}PaymentItem,
  {Provider}InvoiceGatewayOptions,
  {Provider}InvoiceIssueOptions,
  {Provider}InvoiceQueryOptions,
  {Provider}InvoiceVoidOptions,
  {Provider}InvoiceAllowanceOptions,
  {Provider}BaseUrls,
} from './typings';
import { {Provider}Invoice } from './{provider}-invoice';
import { {Provider}InvoiceAllowance } from './{provider}-invoice-allowance';

export class {Provider}InvoiceGateway
  implements InvoiceGateway<
    {Provider}PaymentItem,
    {Provider}Invoice,
    {Provider}InvoiceQueryOptions
  >
{
  private readonly merchantId: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly baseUrl: string;

  constructor(options?: {Provider}InvoiceGatewayOptions) {
    // Use test credentials as defaults
    this.merchantId = options?.merchantId ?? 'TEST_MERCHANT';
    this.apiKey = options?.apiKey ?? 'TEST_KEY';
    this.apiSecret = options?.apiSecret ?? 'TEST_SECRET';
    this.baseUrl = options?.baseUrl ?? {Provider}BaseUrls.DEVELOPMENT;
  }

  async issue(options: {Provider}InvoiceIssueOptions): Promise<{Provider}Invoice> {
    // 1. Validate input
    this.validateIssueOptions(options);

    // 2. Determine tax type
    const taxType = getTaxTypeFromItems(options.items);

    // 3. Build API request payload
    const payload = this.buildIssuePayload(options, taxType);

    // 4. Call provider API
    const response = await this.callApi('/invoice/issue', payload);

    // 5. Parse response and create Invoice instance
    return new {Provider}Invoice({
      invoiceNumber: response.invoiceNumber,
      randomCode: response.randomCode,
      issuedOn: new Date(response.issuedOn),
      issuedAmount: this.calculateTotal(options.items),
      orderId: options.orderId,
      taxType,
      items: options.items,
    });
  }

  async void(
    invoice: {Provider}Invoice,
    options: {Provider}InvoiceVoidOptions
  ): Promise<{Provider}Invoice> {
    const payload = {
      invoiceNumber: invoice.invoiceNumber,
      reason: options.reason,
    };

    await this.callApi('/invoice/void', payload);

    invoice.setVoid();
    return invoice;
  }

  async allowance(
    invoice: {Provider}Invoice,
    allowanceItems: {Provider}PaymentItem[],
    options?: {Provider}InvoiceAllowanceOptions
  ): Promise<{Provider}Invoice> {
    const payload = {
      invoiceNumber: invoice.invoiceNumber,
      items: allowanceItems,
      taxType: options?.taxType,
    };

    const response = await this.callApi('/invoice/allowance', payload);

    const allowance = new {Provider}InvoiceAllowance({
      allowanceNumber: response.allowanceNumber,
      allowancePrice: this.calculateTotal(allowanceItems),
      allowancedOn: new Date(),
      items: allowanceItems,
      parentInvoice: invoice,
    });

    invoice.addAllowance(allowance);
    return invoice;
  }

  async invalidAllowance(
    allowance: {Provider}InvoiceAllowance
  ): Promise<{Provider}Invoice> {
    const payload = {
      allowanceNumber: allowance.allowanceNumber,
    };

    await this.callApi('/invoice/allowance/invalid', payload);

    allowance.invalid();
    return allowance.parentInvoice;
  }

  async query(options: {Provider}InvoiceQueryOptions): Promise<{Provider}Invoice> {
    const response = await this.callApi('/invoice/query', options);

    return new {Provider}Invoice({
      invoiceNumber: response.invoiceNumber,
      randomCode: response.randomCode,
      issuedOn: new Date(response.issuedOn),
      issuedAmount: response.amount,
      orderId: response.orderId,
      taxType: response.taxType,
      items: response.items,
      state: response.state,
      voidOn: response.voidOn ? new Date(response.voidOn) : null,
    });
  }

  async isMobileBarcodeValid(code: string): Promise<boolean> {
    // Implement provider-specific validation
    // Or throw error if not supported
    const response = await this.callApi('/carrier/validate/mobile', { code });
    return response.valid;
  }

  async isLoveCodeValid(code: string): Promise<boolean> {
    // Implement provider-specific validation
    // Or throw error if not supported
    const response = await this.callApi('/carrier/validate/lovecode', { code });
    return response.valid;
  }

  // Private helper methods

  private validateIssueOptions(options: {Provider}InvoiceIssueOptions): void {
    if (!options.orderId) {
      throw new Error('orderId is required');
    }
    if (!options.items?.length) {
      throw new Error('items cannot be empty');
    }
    // Add more validation as needed
  }

  private buildIssuePayload(
    options: {Provider}InvoiceIssueOptions,
    taxType: TaxType
  ): object {
    return {
      merchantId: this.merchantId,
      orderId: options.orderId,
      items: options.items,
      taxType,
      carrier: options.carrier,
      vatNumber: options.vatNumber,
      // Map to provider-specific format
    };
  }

  private calculateTotal(items: {Provider}PaymentItem[]): number {
    return items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
  }

  private async callApi(endpoint: string, payload: object): Promise<any> {
    // Implement API call with:
    // - Authentication (API key, signatures, etc.)
    // - Request encryption if required
    // - Response decryption if required
    // - Error handling

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }
}
```

---

## Step 6: Export Everything

### src/index.ts

```typescript
// Re-export base types
export {
  TaxType,
  InvoiceState,
  InvoiceAllowanceState,
  InvoiceCarrierType,
  CustomsMark,
  InvoiceCarriers,
  isValidVATNumber,
  getTaxTypeFromItems,
} from '@rytass/invoice';

// Export provider-specific types
export * from './typings';

// Export classes
export { {Provider}InvoiceGateway } from './{provider}-invoice-gateway';
export { {Provider}Invoice } from './{provider}-invoice';
export { {Provider}InvoiceAllowance } from './{provider}-invoice-allowance';
```

---

## Step 7: Write Tests

### \_\_tests\_\_/{provider}-invoice-gateway.spec.ts

```typescript
import {
  {Provider}InvoiceGateway,
  TaxType,
  InvoiceState,
} from '../src';

describe('{Provider}InvoiceGateway', () => {
  let gateway: {Provider}InvoiceGateway;

  beforeEach(() => {
    gateway = new {Provider}InvoiceGateway();
  });

  describe('issue', () => {
    it('should issue an invoice successfully', async () => {
      const invoice = await gateway.issue({
        orderId: 'TEST-ORDER-001',
        items: [
          { name: 'Test Item', quantity: 1, unitPrice: 100, unit: 'pcs' },
        ],
      });

      expect(invoice.invoiceNumber).toMatch(/^[A-Z]{2}\d{8}$/);
      expect(invoice.state).toBe(InvoiceState.ISSUED);
    });

    it('should throw error for empty items', async () => {
      await expect(
        gateway.issue({ orderId: 'TEST', items: [] })
      ).rejects.toThrow('items cannot be empty');
    });
  });

  describe('void', () => {
    it('should void an invoice', async () => {
      const invoice = await gateway.issue({
        orderId: 'TEST-ORDER-002',
        items: [{ name: 'Item', quantity: 1, unitPrice: 100 }],
      });

      const voided = await gateway.void(invoice, { reason: 'Test void' });

      expect(voided.state).toBe(InvoiceState.VOID);
      expect(voided.voidOn).toBeInstanceOf(Date);
    });
  });

  describe('allowance', () => {
    it('should create an allowance', async () => {
      const invoice = await gateway.issue({
        orderId: 'TEST-ORDER-003',
        items: [{ name: 'Item', quantity: 2, unitPrice: 100 }],
      });

      const updated = await gateway.allowance(invoice, [
        { name: 'Item', quantity: 1, unitPrice: 100 },
      ]);

      expect(updated.allowances).toHaveLength(1);
      expect(updated.nowAmount).toBe(100);
    });
  });

  describe('query', () => {
    it('should query by orderId', async () => {
      const issued = await gateway.issue({
        orderId: 'TEST-ORDER-004',
        items: [{ name: 'Item', quantity: 1, unitPrice: 100 }],
      });

      const queried = await gateway.query({ orderId: 'TEST-ORDER-004' });

      expect(queried.invoiceNumber).toBe(issued.invoiceNumber);
    });
  });
});
```

---

## Publish Checklist

Before publishing your adapter:

- [ ] All `InvoiceGateway` methods implemented
- [ ] Proper error handling for API failures
- [ ] Request/response encryption (if required by provider)
- [ ] Test credentials configured for development
- [ ] Unit tests written and passing
- [ ] Integration tests with provider sandbox
- [ ] README.md with usage examples
- [ ] TypeScript types properly exported
- [ ] Version number set appropriately

---

## Reference Implementations

Study existing adapters for implementation patterns:

| Adapter | Key Features |
|---------|--------------|
| `invoice-adapter-ecpay` | AES encryption, GUI validation |
| `invoice-adapter-ezpay` | B2B/B2C separation, platform carrier |
| `invoice-adapter-bank-pro` | Extensive validation, product metadata |
| `invoice-adapter-amego` | Explicit tax amounts, type codes |
