/**
 * @jest-environment node
 */
import { BankProInvoiceGateway } from '../src/bank-pro-invoice-gateway';
import { BankProInvoice } from '../src/bank-pro-invoice';
import { BankProBaseUrls, BankProInvoiceGatewayOptions, BankProInvoiceIssueOptions } from '../src/typings';
import { InvoiceAllowanceState, InvoiceCarrierType, InvoiceState, TaxType } from '@rytass/invoice';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BankProInvoiceGateway API Tests', () => {
  let gateway: BankProInvoiceGateway;

  const mockOptions: BankProInvoiceGatewayOptions = {
    user: 'testuser',
    password: 'testpassword',
    systemOID: 108,
    sellerBAN: '12345675',
    baseUrl: BankProBaseUrls.DEVELOPMENT,
  };

  const mockIssueOptions: BankProInvoiceIssueOptions = {
    orderId: 'ORDER123',
    buyerEmail: 'test@example.com',
    items: [
      {
        name: 'Test Item',
        unitPrice: 100,
        quantity: 2,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new BankProInvoiceGateway(mockOptions);
  });

  describe('issue', () => {
    it('should issue invoice successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      const invoice = await gateway.issue(mockIssueOptions);

      expect(invoice.invoiceNumber).toBe('AB12345678');
      expect(invoice.randomCode).toBe('1234');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/B2B2CInvoice_AddOrders'),
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should throw error when API returns empty array', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: [] });

      await expect(gateway.issue(mockIssueOptions)).rejects.toThrow('Failed to issue invoice');
    });

    it('should throw error when API returns error message', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            ErrorMessage: 'Some error occurred',
          },
        ],
      });

      await expect(gateway.issue(mockIssueOptions)).rejects.toThrow('Some error occurred');
    });

    it('should handle mobile carrier type', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      const invoice = await gateway.issue({
        ...mockIssueOptions,
        carrier: {
          type: InvoiceCarrierType.MOBILE,
          code: '/ABC+123',
        },
      });

      expect(invoice).toBeDefined();
      const callArg = mockedAxios.post.mock.calls[0][1] as string;
      const payload = JSON.parse(callArg);

      expect(payload.Orders[0].CarrierType).toBe('3J0002');
      expect(payload.Orders[0].CarrierId1).toBe('/ABC+123');
    });

    it('should handle MOICA carrier type', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      const invoice = await gateway.issue({
        ...mockIssueOptions,
        carrier: {
          type: InvoiceCarrierType.MOICA,
          code: 'MOICA1234567890',
        },
      });

      expect(invoice).toBeDefined();
      const callArg = mockedAxios.post.mock.calls[0][1] as string;
      const payload = JSON.parse(callArg);

      expect(payload.Orders[0].CarrierType).toBe('CQ0001');
    });

    it('should handle love code (donate) carrier type', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      const invoice = await gateway.issue({
        ...mockIssueOptions,
        carrier: {
          type: InvoiceCarrierType.LOVE_CODE,
          code: '168001',
        },
      });

      expect(invoice).toBeDefined();
      const callArg = mockedAxios.post.mock.calls[0][1] as string;
      const payload = JSON.parse(callArg);

      expect(payload.Orders[0].DonateMark).toBe('168001');
    });

    it('should include VAT number when provided', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      await gateway.issue({
        ...mockIssueOptions,
        vatNumber: '12345675', // Valid VAT number
        companyName: 'Test Company',
      });

      const callArg = mockedAxios.post.mock.calls[0][1] as string;
      const payload = JSON.parse(callArg);

      expect(payload.Orders[0].BuyerBAN).toBe('12345675');
      expect(payload.Orders[0].BuyerCompanyName).toBe('Test Company');
    });

    it('should handle issue without carrier (use default empty values)', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      const invoice = await gateway.issue({
        ...mockIssueOptions,
        // No carrier provided - should use empty CarrierId1/CarrierId2
      });

      expect(invoice).toBeDefined();
      const callArg = mockedAxios.post.mock.calls[0][1] as string;
      const payload = JSON.parse(callArg);

      expect(payload.Orders[0].CarrierType).toBe('');
      expect(payload.Orders[0].CarrierId1).toBe('');
      expect(payload.Orders[0].CarrierId2).toBe('');
    });

    it('should handle issue with MEMBER carrier type', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      const invoice = await gateway.issue({
        ...mockIssueOptions,
        carrier: {
          type: InvoiceCarrierType.MEMBER,
          code: 'MEMBER123',
        },
      });

      expect(invoice).toBeDefined();
      const callArg = mockedAxios.post.mock.calls[0][1] as string;
      const payload = JSON.parse(callArg);

      // MEMBER type uses orderId as Members.ID (indexOf returns 0 which is falsy)
      expect(payload.Orders[0].Members[0].ID).toBe('ORDER123');
    });

    it('should handle issue with MOBILE carrier but undefined code (fallback to empty string)', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      const invoice = await gateway.issue({
        ...mockIssueOptions,
        carrier: {
          type: InvoiceCarrierType.MOBILE,
          // code is intentionally undefined - should fallback to empty string via ??
        } as { type: InvoiceCarrierType; code: string },
      });

      expect(invoice).toBeDefined();
      const callArg = mockedAxios.post.mock.calls[0][1] as string;
      const payload = JSON.parse(callArg);

      expect(payload.Orders[0].CarrierType).toBe('3J0002');
      expect(payload.Orders[0].CarrierId1).toBe('');
      expect(payload.Orders[0].CarrierId2).toBe('');
    });

    it('should handle issue without buyerEmail for platform carrier', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      const invoice = await gateway.issue({
        orderId: 'ORDER123',
        items: [{ name: 'Test', unitPrice: 100, quantity: 1 }],
        carrier: {
          type: InvoiceCarrierType.PLATFORM,
          code: 'PLATFORM123',
        },
        // No buyerEmail - should use empty string as fallback
      });

      expect(invoice).toBeDefined();
      const callArg = mockedAxios.post.mock.calls[0][1] as string;
      const payload = JSON.parse(callArg);

      expect(payload.Orders[0].CarrierId1).toBe('');
      expect(payload.Orders[0].CarrierId2).toBe('');
    });
  });

  describe('isMobileBarcodeValid', () => {
    it('should throw not supported error', async () => {
      await expect(gateway.isMobileBarcodeValid('/ABC+123')).rejects.toThrow(
        'Bank Pro does not support mobile barcode validation',
      );
    });
  });

  describe('isLoveCodeValid', () => {
    it('should throw not supported error', async () => {
      await expect(gateway.isLoveCodeValid('168001')).rejects.toThrow('Bank Pro does not support love code validation');
    });
  });

  describe('void', () => {
    let invoice: BankProInvoice;

    beforeEach(() => {
      invoice = new BankProInvoice({
        invoiceNumber: 'AB12345678',
        randomCode: '1234',
        issuedOn: new Date('2025-01-10'),
        orderId: 'ORDER123',
        taxType: TaxType.TAXED,
        items: [{ name: 'Item 1', unitPrice: 100, quantity: 2 }],
      });
    });

    it('should void invoice successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [{ ErrorMessage: '' }],
      });

      const result = await gateway.void(invoice);

      expect(result.state).toBe(InvoiceState.VOID);
      expect(result.voidOn).not.toBeNull();
    });

    it('should throw error when invoice is not issued', async () => {
      invoice.setVoid();

      await expect(gateway.void(invoice)).rejects.toThrow('Invoice is not issued');
    });

    it('should throw error when API returns empty array', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: [] });

      await expect(gateway.void(invoice)).rejects.toThrow('Failed to void invoice');
    });

    it('should throw error when API returns error', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [{ ErrorMessage: 'Void failed' }],
      });

      await expect(gateway.void(invoice)).rejects.toThrow('Void failed');
    });

    it('should include sellerCode when provided', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [{ ErrorMessage: '' }],
      });

      await gateway.void(invoice, { sellerCode: 'SELLER001' });

      const callArg = mockedAxios.post.mock.calls[0][1] as string;
      const payload = JSON.parse(callArg);

      expect(payload.Orders[0].SellerCode).toBe('SELLER001');
    });
  });

  describe('allowance', () => {
    let invoice: BankProInvoice;

    beforeEach(() => {
      invoice = new BankProInvoice({
        invoiceNumber: 'AB12345678',
        randomCode: '1234',
        issuedOn: new Date('2025-01-10'),
        orderId: 'ORDER123',
        taxType: TaxType.TAXED,
        items: [{ name: 'Item 1', unitPrice: 100, quantity: 2 }],
      });
    });

    it('should create allowance successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            AllowanceNo: '  ALW123456  ', // With whitespace to test trim
            AllowanceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      const allowanceItems = [{ name: 'Refund Item', unitPrice: 50, quantity: 1 }];
      const result = await gateway.allowance(invoice, allowanceItems);

      expect(result.allowances).toHaveLength(1);
      expect(result.allowances[0].allowanceNumber).toBe('ALW123456');
      expect(result.allowances[0].allowancePrice).toBe(50);
    });

    it('should throw error when invoice is not issued', async () => {
      invoice.setVoid();

      await expect(gateway.allowance(invoice, [{ name: 'Item', unitPrice: 50, quantity: 1 }])).rejects.toThrow(
        'Invoice is not issued',
      );
    });

    it('should throw error when allowance amount is zero', async () => {
      await expect(gateway.allowance(invoice, [{ name: 'Item', unitPrice: 0, quantity: 1 }])).rejects.toThrow(
        'Allowance amount should more than zero',
      );
    });

    it('should throw error when API returns empty array', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: [] });

      await expect(gateway.allowance(invoice, [{ name: 'Item', unitPrice: 50, quantity: 1 }])).rejects.toThrow(
        'Failed to allowance invoice',
      );
    });

    it('should throw error when API returns error', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [{ ErrorMessage: 'Allowance failed' }],
      });

      await expect(gateway.allowance(invoice, [{ name: 'Item', unitPrice: 50, quantity: 1 }])).rejects.toThrow(
        'Allowance failed',
      );
    });
  });

  describe('invalidAllowance', () => {
    let invoice: BankProInvoice;

    beforeEach(() => {
      invoice = new BankProInvoice({
        invoiceNumber: 'AB12345678',
        randomCode: '1234',
        issuedOn: new Date('2025-01-10'),
        orderId: 'ORDER123',
        taxType: TaxType.TAXED,
        items: [{ name: 'Item 1', unitPrice: 100, quantity: 2 }],
      });
    });

    it('should invalidate allowance successfully', async () => {
      // First create an allowance
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            AllowanceNo: 'ALW123456',
            AllowanceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      await gateway.allowance(invoice, [{ name: 'Item', unitPrice: 50, quantity: 1 }]);

      // Then invalidate it
      mockedAxios.post.mockResolvedValueOnce({
        data: [{ ErrorMessage: '' }],
      });

      const result = await gateway.invalidAllowance(invoice.allowances[0]);

      expect(result).toBe(invoice);
      expect(invoice.allowances[0].status).toBe(InvoiceAllowanceState.INVALID);
      expect(invoice.allowances[0].invalidOn).not.toBeNull();
    });

    it('should throw error when allowance is not issued', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            AllowanceNo: 'ALW123456',
            AllowanceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      await gateway.allowance(invoice, [{ name: 'Item', unitPrice: 50, quantity: 1 }]);
      invoice.allowances[0].status = InvoiceAllowanceState.INVALID;

      await expect(gateway.invalidAllowance(invoice.allowances[0])).rejects.toThrow('Allowance is not issued');
    });

    it('should throw error when API returns empty array', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            AllowanceNo: 'ALW123456',
            AllowanceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      await gateway.allowance(invoice, [{ name: 'Item', unitPrice: 50, quantity: 1 }]);

      mockedAxios.post.mockResolvedValueOnce({ data: [] });

      await expect(gateway.invalidAllowance(invoice.allowances[0])).rejects.toThrow('Failed to allowance invoice');
    });

    it('should throw error when API returns error', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            AllowanceNo: 'ALW123456',
            AllowanceDate: '2025/01/10 10:00:00',
            ErrorMessage: '',
          },
        ],
      });

      await gateway.allowance(invoice, [{ name: 'Item', unitPrice: 50, quantity: 1 }]);

      mockedAxios.post.mockResolvedValueOnce({
        data: [{ ErrorMessage: 'Invalid failed' }],
      });

      await expect(gateway.invalidAllowance(invoice.allowances[0])).rejects.toThrow('Invalid failed');
    });
  });

  describe('query', () => {
    it('should query by order ID successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10',
            OrderNo: 'ORDER123',
            RateType: '應稅',
            InvoiceDetails: [
              {
                ProductName: 'Test Item',
                UnitPrice: '100',
                Qty: '2',
              },
            ],
          },
        ],
      });

      const invoice = await gateway.query({ orderId: 'ORDER123' });

      expect(invoice.invoiceNumber).toBe('AB12345678');
      expect(invoice.randomCode).toBe('1234');
      expect(invoice.orderId).toBe('ORDER123');
      expect(invoice.taxType).toBe(TaxType.TAXED);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/B2B2CInvoice_GetByOrderNo'),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should query by invoice number successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10',
            OrderNo: 'ORDER123',
            RateType: '免稅',
            InvoiceDetails: [
              {
                ProductName: 'Test Item',
                UnitPrice: '100',
                Qty: '2',
              },
            ],
          },
        ],
      });

      const invoice = await gateway.query({ invoiceNumber: 'AB12345678' });

      expect(invoice.invoiceNumber).toBe('AB12345678');
      expect(invoice.taxType).toBe(TaxType.TAX_FREE);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/B2B2CInvoice_GetByInvoiceNo'),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('should handle zero tax type', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [
          {
            InvoiceNo: 'AB12345678',
            RandomNumber: '1234',
            InvoiceDate: '2025/01/10',
            OrderNo: 'ORDER123',
            RateType: '零稅',
            InvoiceDetails: [],
          },
        ],
      });

      const invoice = await gateway.query({ orderId: 'ORDER123' });

      expect(invoice.taxType).toBe(TaxType.ZERO_TAX);
    });

    it('should throw error when invoice not found', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: [] });

      await expect(gateway.query({ orderId: 'ORDER123' })).rejects.toThrow('Invoice not found');
    });

    it('should throw error when multiple invoices returned', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: [{ InvoiceNo: 'AB12345678' }, { InvoiceNo: 'AB12345679' }],
      });

      await expect(gateway.query({ orderId: 'ORDER123' })).rejects.toThrow('Invoice not found');
    });
  });
});
