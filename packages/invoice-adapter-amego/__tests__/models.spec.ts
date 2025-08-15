/**
 * @jest-environment node
 */

import { InvoiceAllowanceState, InvoiceState, TaxType } from '../src';
import { AmegoInvoice } from '../src/amego-invoice';
import { AmegoAllowance } from '../src/amego-allowance';

describe('AmegoInvoice Model', () => {
  describe('constructor', () => {
    it('should create invoice with all required fields', () => {
      const invoice = new AmegoInvoice({
        orderId: 'test-order-123',
        invoiceNumber: 'AC12345678',
        randomCode: '1234',
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        items: [
          {
            name: '測試商品',
            quantity: 2,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
      });

      expect(invoice.orderId).toBe('test-order-123');
      expect(invoice.invoiceNumber).toBe('AC12345678');
      expect(invoice.randomCode).toBe('1234');
      expect(invoice.taxType).toBe(TaxType.TAXED);
      expect(invoice.state).toBe(InvoiceState.ISSUED);
      expect(invoice.issuedAmount).toBe(200);
      expect(invoice.nowAmount).toBe(200);
      expect(invoice.vatNumber).toBe('0000000000');
      expect(invoice.taxRate).toBe(0.05);
      expect(invoice.voidOn).toBeNull();
      expect(invoice.allowances).toEqual([]);
      expect(invoice.items).toHaveLength(1);
    });

    it('should create invoice with VAT number', () => {
      const invoice = new AmegoInvoice({
        orderId: 'test-order-124',
        invoiceNumber: 'AC12345679',
        randomCode: '5678',
        taxType: TaxType.TAXED,
        vatNumber: '12345678',
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 105,
            taxType: TaxType.TAXED,
          },
        ],
      });

      expect(invoice.vatNumber).toBe('12345678');
      expect(invoice.taxAmount).toBe(5); // Tax amount calculation
    });

    it('should create invoice with carrier information', () => {
      const invoice = new AmegoInvoice({
        orderId: 'test-order-125',
        invoiceNumber: 'AC12345680',
        randomCode: '9012',
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        carrier: {
          type: 'mobile',
          code: '/DDPD7U2',
        },
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
      });

      expect(invoice.carrier).toEqual({
        type: 'mobile',
        code: '/DDPD7U2',
      });
    });

    it('should create invoice with allowances', () => {
      const invoice = new AmegoInvoice({
        orderId: 'test-order-126',
        invoiceNumber: 'AC12345681',
        randomCode: '3456',
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
      });

      const allowance = new AmegoAllowance({
        allowanceNumber: 'AC12345681AL0001',
        allowancedOn: new Date('2025-01-02T10:00:00.000Z'),
        allowancePrice: 20,
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 20,
            taxType: TaxType.TAXED,
          },
        ],
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice: invoice,
      });

      invoice.allowances.push(allowance);

      expect(invoice.allowances).toHaveLength(1);
      expect(invoice.allowances[0]).toBeInstanceOf(AmegoAllowance);
    });

    it('should create invoice with different tax types', () => {
      const taxFreeInvoice = new AmegoInvoice({
        orderId: 'test-order-127',
        invoiceNumber: 'AC12345682',
        randomCode: '7890',
        taxType: TaxType.TAX_FREE,
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        items: [
          {
            name: '免稅商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAX_FREE,
          },
        ],
      });

      expect(taxFreeInvoice.taxType).toBe(TaxType.TAX_FREE);
      expect(taxFreeInvoice.taxAmount).toBe(0);

      const zeroTaxInvoice = new AmegoInvoice({
        orderId: 'test-order-128',
        invoiceNumber: 'AC12345683',
        randomCode: '2468',
        taxType: TaxType.ZERO_TAX,
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        items: [
          {
            name: '零稅率商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.ZERO_TAX,
          },
        ],
      });

      expect(zeroTaxInvoice.taxType).toBe(TaxType.ZERO_TAX);
      expect(zeroTaxInvoice.taxAmount).toBe(0);
    });

    it('should create invoice with custom tax rate', () => {
      const invoice = new AmegoInvoice({
        orderId: 'test-order-129',
        invoiceNumber: 'AC12345684',
        randomCode: '1357',
        taxType: TaxType.TAXED,
        taxRate: 0.1,
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        items: [
          {
            name: '高稅率商品',
            quantity: 1,
            unitPrice: 110,
            taxType: TaxType.TAXED,
          },
        ],
      });

      expect(invoice.taxRate).toBe(0.1);
      expect(invoice.taxAmount).toBe(10); // Tax amount with 10% rate
    });

    it('should calculate nowAmount correctly with allowances', () => {
      const invoice = new AmegoInvoice({
        orderId: 'test-order-130',
        invoiceNumber: 'AC12345685',
        randomCode: '9753',
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
      });

      const allowance = new AmegoAllowance({
        allowanceNumber: 'AC12345685AL0001',
        allowancedOn: new Date('2025-01-02T10:00:00.000Z'),
        allowancePrice: 30,
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 30,
            taxType: TaxType.TAXED,
          },
        ],
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice: invoice,
      });

      const invoiceWithAllowance = new AmegoInvoice({
        orderId: 'test-order-130',
        invoiceNumber: 'AC12345685',
        randomCode: '9753',
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        allowances: [allowance],
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
      });

      expect(invoiceWithAllowance.issuedAmount).toBe(100);
      expect(invoiceWithAllowance.nowAmount).toBe(70); // 100 - 30
    });
  });

  describe('setVoid method', () => {
    it('should set invoice as void with default date', () => {
      const invoice = new AmegoInvoice({
        orderId: 'test-order-131',
        invoiceNumber: 'AC12345686',
        randomCode: '1111',
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
      });

      invoice.setVoid();

      expect(invoice.state).toBe(InvoiceState.VOID);
      expect(invoice.voidOn).toBeInstanceOf(Date);
    });

    it('should set invoice as void with custom date', () => {
      const invoice = new AmegoInvoice({
        orderId: 'test-order-132',
        invoiceNumber: 'AC12345687',
        randomCode: '2222',
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
      });

      const customVoidDate = new Date('2025-01-15T15:30:00.000Z');
      invoice.setVoid(customVoidDate);

      expect(invoice.state).toBe(InvoiceState.VOID);
      expect(invoice.voidOn).toBe(customVoidDate);
    });
  });

  describe('mixed item types', () => {
    it('should handle mixed tax types correctly', () => {
      const invoice = new AmegoInvoice({
        orderId: 'test-order-133',
        invoiceNumber: 'AC12345688',
        randomCode: '3333',
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-01-01T10:00:00.000Z'),
        voidOn: null,
        items: [
          {
            name: '課稅商品',
            quantity: 1,
            unitPrice: 105,
            taxType: TaxType.TAXED,
          },
          {
            name: '免稅商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAX_FREE,
          },
          {
            name: '零稅率商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.ZERO_TAX,
          },
        ],
      });

      expect(invoice.issuedAmount).toBe(305);
      expect(invoice.taxAmount).toBe(5); // Only from taxed item
    });
  });
});

describe('AmegoAllowance Model', () => {
  let parentInvoice: AmegoInvoice;

  beforeEach(() => {
    parentInvoice = new AmegoInvoice({
      orderId: 'test-order-allowance',
      invoiceNumber: 'AC99999999',
      randomCode: '0000',
      taxType: TaxType.TAXED,
      issuedOn: new Date('2025-01-01T10:00:00.000Z'),
      voidOn: null,
      items: [
        {
          name: '父發票商品',
          quantity: 1,
          unitPrice: 100,
          taxType: TaxType.TAXED,
        },
      ],
    });
  });

  describe('constructor', () => {
    it('should create allowance with all required fields', () => {
      const allowance = new AmegoAllowance({
        allowanceNumber: 'AC99999999AL0001',
        allowancedOn: new Date('2025-01-02T10:00:00.000Z'),
        allowancePrice: 50,
        items: [
          {
            name: '折讓商品',
            quantity: 1,
            unitPrice: 50,
            taxType: TaxType.TAXED,
          },
        ],
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice,
      });

      expect(allowance.allowanceNumber).toBe('AC99999999AL0001');
      expect(allowance.allowancePrice).toBe(50);
      expect(allowance.allowancedOn).toEqual(new Date('2025-01-02T10:00:00.000Z'));
      expect(allowance.items).toHaveLength(1);
      expect(allowance.status).toBe(InvoiceAllowanceState.ISSUED);
      expect(allowance.invalidOn).toBeNull();
      expect(allowance.parentInvoice).toBe(parentInvoice);
      expect(allowance.invoiceType).toBe('G0401');
      expect(allowance.remainingAmount).toBe(100);
    });

    it('should create allowance with custom invoice type', () => {
      const allowance = new AmegoAllowance({
        allowanceNumber: 'AC99999999AL0002',
        allowancedOn: new Date('2025-01-02T10:00:00.000Z'),
        allowancePrice: 30,
        items: [
          {
            name: '折讓商品',
            quantity: 1,
            unitPrice: 30,
            taxType: TaxType.TAXED,
          },
        ],
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice,
        invoiceType: 'D0401',
      });

      expect(allowance.invoiceType).toBe('D0401');
    });

    it('should calculate remaining amount with existing allowances', () => {
      // Create first allowance
      const firstAllowance = new AmegoAllowance({
        allowanceNumber: 'AC99999999AL0001',
        allowancedOn: new Date('2025-01-02T10:00:00.000Z'),
        allowancePrice: 20,
        items: [
          {
            name: '第一次折讓',
            quantity: 1,
            unitPrice: 20,
            taxType: TaxType.TAXED,
          },
        ],
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice,
      });

      // Add to accumulated allowances
      parentInvoice.accumulatedAllowances.push(firstAllowance);

      // Create second allowance
      const secondAllowance = new AmegoAllowance({
        allowanceNumber: 'AC99999999AL0002',
        allowancedOn: new Date('2025-01-03T10:00:00.000Z'),
        allowancePrice: 30,
        items: [
          {
            name: '第二次折讓',
            quantity: 1,
            unitPrice: 30,
            taxType: TaxType.TAXED,
          },
        ],
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice,
      });

      expect(secondAllowance.remainingAmount).toBe(80); // 100 - 20
    });
  });

  describe('invalid method', () => {
    it('should mark allowance as invalid', () => {
      const allowance = new AmegoAllowance({
        allowanceNumber: 'AC99999999AL0003',
        allowancedOn: new Date('2025-01-02T10:00:00.000Z'),
        allowancePrice: 40,
        items: [
          {
            name: '待作廢折讓',
            quantity: 1,
            unitPrice: 40,
            taxType: TaxType.TAXED,
          },
        ],
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice,
      });

      // Set initial nowAmount
      parentInvoice.nowAmount = 60; // 100 - 40

      allowance.invalid();

      expect(allowance.status).toBe(InvoiceAllowanceState.INVALID);
      expect(allowance.invalidOn).toBeInstanceOf(Date);
      expect(parentInvoice.nowAmount).toBe(100); // Restored after invalid
    });

    it('should handle different allowance states', () => {
      const allowance = new AmegoAllowance({
        allowanceNumber: 'AC99999999AL0004',
        allowancedOn: new Date('2025-01-02T10:00:00.000Z'),
        allowancePrice: 25,
        items: [
          {
            name: '測試折讓',
            quantity: 1,
            unitPrice: 25,
            taxType: TaxType.TAXED,
          },
        ],
        status: InvoiceAllowanceState.INITED,
        invalidOn: null,
        parentInvoice,
      });

      expect(allowance.status).toBe(InvoiceAllowanceState.INITED);

      allowance.invalid();

      expect(allowance.status).toBe(InvoiceAllowanceState.INVALID);
    });
  });

  describe('allowance with different tax types', () => {
    it('should handle tax-free allowance', () => {
      const allowance = new AmegoAllowance({
        allowanceNumber: 'AC99999999AL0005',
        allowancedOn: new Date('2025-01-02T10:00:00.000Z'),
        allowancePrice: 50,
        items: [
          {
            name: '免稅折讓',
            quantity: 1,
            unitPrice: 50,
            taxType: TaxType.TAX_FREE,
          },
        ],
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice,
      });

      expect(allowance.allowancePrice).toBe(50);
      expect(allowance.items[0].taxType).toBe(TaxType.TAX_FREE);
    });

    it('should handle zero-tax allowance', () => {
      const allowance = new AmegoAllowance({
        allowanceNumber: 'AC99999999AL0006',
        allowancedOn: new Date('2025-01-02T10:00:00.000Z'),
        allowancePrice: 30,
        items: [
          {
            name: '零稅率折讓',
            quantity: 1,
            unitPrice: 30,
            taxType: TaxType.ZERO_TAX,
          },
        ],
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice,
      });

      expect(allowance.allowancePrice).toBe(30);
      expect(allowance.items[0].taxType).toBe(TaxType.ZERO_TAX);
    });

    it('should handle invalid allowances when calculating remaining amount', () => {
      const parentInvoice = new AmegoInvoice({
        orderId: 'test456',
        invoiceNumber: 'AC99999999',
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-01-01T00:00:00.000Z'),
        allowances: [],
        randomCode: '1234',
        state: InvoiceState.ISSUED,
        voidOn: null,
      });

      // Add an invalid allowance to accumulatedAllowances to test the line 44 branch
      const invalidAllowance = new AmegoAllowance({
        allowanceNumber: 'AC99999999AL0001',
        allowancedOn: new Date('2025-01-02T10:00:00.000Z'),
        allowancePrice: 30,
        items: [
          {
            name: '無效的折讓',
            quantity: 1,
            unitPrice: 30,
            taxType: TaxType.TAXED,
          },
        ],
        invoiceType: 'G0401',
        status: InvoiceAllowanceState.INVALID, // Invalid status
        invalidOn: new Date('2025-01-03T00:00:00.000Z'),
        parentInvoice,
      });

      // Put the invalid allowance in the parent invoice accumulatedAllowances
      parentInvoice.accumulatedAllowances.push(invalidAllowance);

      // Create a new allowance which should test the line 44 branch (ignoring invalid allowances)
      const newAllowance = new AmegoAllowance({
        allowanceNumber: 'AC99999999AL0002',
        allowancedOn: new Date('2025-01-02T11:00:00.000Z'),
        allowancePrice: 10,
        items: [
          {
            name: '新的折讓',
            quantity: 1,
            unitPrice: 10,
            taxType: TaxType.TAXED,
          },
        ],
        invoiceType: 'G0401',
        status: InvoiceAllowanceState.ISSUED,
        invalidOn: null,
        parentInvoice,
      });

      // Should calculate remaining amount ignoring the invalid allowance
      expect(newAllowance.remainingAmount).toBe(100); // 100 - 0 (invalid allowance ignored)
    });

    it('should handle invalid allowances when constructing invoice', () => {
      // Create a dummy parent invoice first
      const dummyParentInvoice = new AmegoInvoice({
        orderId: 'dummy',
        invoiceNumber: 'AC99999997',
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 50,
            taxType: TaxType.TAXED,
          },
        ],
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-01-01T00:00:00.000Z'),
        allowances: [],
        randomCode: '1234',
        state: InvoiceState.ISSUED,
        voidOn: null,
      });

      const invalidAllowance = new AmegoAllowance({
        allowanceNumber: 'AC99999999AL0001',
        allowancedOn: new Date('2025-01-02T10:00:00.000Z'),
        allowancePrice: 30,
        items: [
          {
            name: '無效的折讓',
            quantity: 1,
            unitPrice: 30,
            taxType: TaxType.TAXED,
          },
        ],
        invoiceType: 'G0401',
        status: InvoiceAllowanceState.INVALID, // Invalid status
        invalidOn: new Date('2025-01-03T00:00:00.000Z'),
        parentInvoice: dummyParentInvoice,
      });

      // Create invoice with invalid allowance to test line 54 branch
      const invoice = new AmegoInvoice({
        orderId: 'test789',
        invoiceNumber: 'AC99999998',
        items: [
          {
            name: '測試商品',
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.TAXED,
          },
        ],
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-01-01T00:00:00.000Z'),
        allowances: [invalidAllowance], // Include invalid allowance
        randomCode: '1234',
        state: InvoiceState.ISSUED,
        voidOn: null,
      });

      // nowAmount should be equal to issuedAmount since invalid allowance is ignored
      expect(invoice.nowAmount).toBe(100); // 100 - 0 (invalid allowance ignored)
    });
  });
});
