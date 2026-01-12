/**
 * @jest-environment node
 */
import { InvoiceAllowanceState, TaxType } from '@rytass/invoice';
import { BankProAllowance } from '../src/bank-pro-allowance';
import { BankProInvoice } from '../src/bank-pro-invoice';
import { BankProPaymentItem } from '../src/typings';

describe('BankProAllowance', () => {
  let parentInvoice: BankProInvoice;
  let allowance: BankProAllowance;
  const items: BankProPaymentItem[] = [
    {
      name: 'Test Item',
      unitPrice: 100,
      quantity: 2,
    },
  ];

  beforeEach(() => {
    parentInvoice = new BankProInvoice({
      invoiceNumber: 'AB12345678',
      randomCode: '1234',
      issuedOn: new Date('2025-01-10'),
      orderId: 'ORDER123',
      taxType: TaxType.TAXED,
      items: [{ name: 'Item 1', unitPrice: 500, quantity: 1 }],
    });

    allowance = new BankProAllowance({
      allowanceNumber: 'ALW123456',
      allowancePrice: 200,
      allowancedOn: new Date('2025-01-10'),
      items,
      parentInvoice,
      status: InvoiceAllowanceState.ISSUED,
      invalidOn: null,
    });
  });

  describe('constructor', () => {
    it('should initialize with correct allowance number', () => {
      expect(allowance.allowanceNumber).toBe('ALW123456');
    });

    it('should initialize with correct allowance price', () => {
      expect(allowance.allowancePrice).toBe(200);
    });

    it('should initialize with correct allowanced on date', () => {
      expect(allowance.allowancedOn).toEqual(new Date('2025-01-10'));
    });

    it('should initialize with correct parent invoice', () => {
      expect(allowance.parentInvoice).toBe(parentInvoice);
    });

    it('should initialize with correct status', () => {
      expect(allowance.status).toBe(InvoiceAllowanceState.ISSUED);
    });

    it('should initialize with null invalidOn', () => {
      expect(allowance.invalidOn).toBeNull();
    });

    it('should calculate remaining amount correctly', () => {
      // parentInvoice.issuedAmount = 500, allowancePrice = 200
      // remainingAmount = 500 - 200 = 300
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      expect(allowance.remainingAmount).toBe(300);
      expect(consoleSpy).toHaveBeenCalledWith(
        'BankPro not support remainingAmount query, this value is cached when allowance is created.',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('items getter', () => {
    it('should return items with warning', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const result = allowance.items;

      expect(result).toEqual(items);
      expect(consoleSpy).toHaveBeenCalledWith(
        'BankPro not support items query, this value is cached when allowance is created.',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('invalidOn', () => {
    it('should accept invalidOn date in constructor', () => {
      const invalidDate = new Date('2025-01-15');
      const allowanceWithInvalidOn = new BankProAllowance({
        allowanceNumber: 'ALW789',
        allowancePrice: 100,
        allowancedOn: new Date('2025-01-10'),
        items,
        parentInvoice,
        status: InvoiceAllowanceState.INVALID,
        invalidOn: invalidDate,
      });

      expect(allowanceWithInvalidOn.invalidOn).toEqual(invalidDate);
      expect(allowanceWithInvalidOn.status).toBe(InvoiceAllowanceState.INVALID);
    });
  });
});
