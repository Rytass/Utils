/**
 * @jest-environment node
 */
import axios from 'axios';
import { AmegoBaseUrls, AmegoInvoice, AmegoInvoiceGateway, InvoiceState, TaxType } from '../src';

const baseUrl = AmegoBaseUrls.DEVELOPMENT;

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AmegoInvoiceGateway Void Invoice', () => {
  let invoiceGateway: AmegoInvoiceGateway;

  beforeEach(() => {
    invoiceGateway = new AmegoInvoiceGateway();
    jest.clearAllMocks();
  });

  describe('void invoice', () => {
    it('should void invoice successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          code: 0,
          msg: '',
        },
      });

      const voidInvoice = new AmegoInvoice({
        orderId: '3g49n0',
        invoiceNumber: 'AC12346555',
        items: [
          {
            quantity: 1,
            unitPrice: 10,
            taxType: TaxType.TAXED,
            name: '橡皮擦',
          },
        ],
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-05-28T11:28:10.000Z'),
        allowances: [],
        randomCode: '2014',
        state: InvoiceState.ISSUED,
        voidOn: null,
      });

      const result = await invoiceGateway.void(voidInvoice);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${baseUrl}/json/f0501`,
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      expect(result.orderId).toBe('3g49n0');
      expect(result.state).toBe(InvoiceState.VOID);
      expect(result.voidOn).toBeInstanceOf(Date);
    });

    it('should throw error when API returns error code', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          code: 1001,
          msg: 'Invoice cannot be voided',
        },
      });

      const voidInvoice = new AmegoInvoice({
        orderId: '3g49n1',
        invoiceNumber: 'AC12346556',
        items: [
          {
            quantity: 1,
            unitPrice: 10,
            taxType: TaxType.TAXED,
            name: '橡皮擦',
          },
        ],
        taxType: TaxType.TAXED,
        issuedOn: new Date('2025-05-28T11:28:10.000Z'),
        allowances: [],
        randomCode: '2014',
        state: InvoiceState.ISSUED,
        voidOn: null,
      });

      await expect(invoiceGateway.void(voidInvoice)).rejects.toThrow(
        'Amego invoice void failed: Invoice cannot be voided',
      );
    });

    it('should handle different invoice states', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          code: 0,
          msg: '',
        },
      });

      const voidInvoice = new AmegoInvoice({
        orderId: '3g49n2',
        invoiceNumber: 'AC12346557',
        items: [
          {
            quantity: 2,
            unitPrice: 50,
            taxType: TaxType.TAX_FREE,
            name: '免稅商品',
          },
        ],
        taxType: TaxType.TAX_FREE,
        issuedOn: new Date('2025-05-28T11:28:10.000Z'),
        allowances: [],
        randomCode: '3456',
        state: InvoiceState.ISSUED,
        voidOn: null,
      });

      const result = await invoiceGateway.void(voidInvoice);

      expect(result.orderId).toBe('3g49n2');
      expect(result.state).toBe(InvoiceState.VOID);
      expect(result.invoiceNumber).toBe('AC12346557');
      expect(result.issuedAmount).toBe(100);
    });

    it('should void invoice with custom void date', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          code: 0,
          msg: '',
        },
      });

      const voidInvoice = new AmegoInvoice({
        orderId: '3g49n3',
        invoiceNumber: 'AC12346558',
        items: [
          {
            quantity: 1,
            unitPrice: 100,
            taxType: TaxType.ZERO_TAX,
            name: '零稅率商品',
          },
        ],
        taxType: TaxType.ZERO_TAX,
        issuedOn: new Date('2025-05-28T11:28:10.000Z'),
        allowances: [],
        randomCode: '7890',
        state: InvoiceState.ISSUED,
        voidOn: null,
      });

      // Test the setVoid method with custom date
      const customVoidDate = new Date('2025-06-01T10:00:00.000Z');

      voidInvoice.setVoid(customVoidDate);

      expect(voidInvoice.state).toBe(InvoiceState.VOID);
      expect(voidInvoice.voidOn).toBe(customVoidDate);

      // Reset for actual void test
      voidInvoice.state = InvoiceState.ISSUED;
      voidInvoice.voidOn = null;

      const result = await invoiceGateway.void(voidInvoice);

      expect(result.state).toBe(InvoiceState.VOID);
      expect(result.voidOn).toBeInstanceOf(Date);
    });
  });
});
