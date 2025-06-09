/**
 * @jest-environment node
 */
import axios from 'axios';
import { AmegoBaseUrls, AmegoInvoiceGateway } from '../src';

const DEFAULT_VAT_NUMBER = '12345678';
const DEFAULT_APP_KEY = 'sHeq7t8G1wiQvhAuIM27';
const baseUrl = AmegoBaseUrls.DEVELOPMENT

describe('Amego Invoice Query', () => {
  const post = jest.spyOn(axios, 'post');

  describe('check mobile barcode with default gateway options success', () => {
    const invoiceGateway = new AmegoInvoiceGateway();

    beforeAll(() => {
      post.mockImplementation(async (url: string, data: any) => {
        expect(url).toEqual(`${baseUrl}/json/barcode`);

        return {
          data: {
            code: 0,
            msg: '',
          },
        };
      });
    });

    it('should query invoice valid barcode ', async () => {
      const validBarcode = await invoiceGateway.isMobileBarcodeValid('/DDPD7U2');

      expect(validBarcode).toBe(true);
    });
  })

  describe('check mobile barcode with default gateway options fail', () => {
    const invoiceGateway = new AmegoInvoiceGateway();

    beforeAll(() => {
      post.mockImplementation(async (url: string, data: any) => {
        expect(url).toEqual(`${baseUrl}/json/barcode`);

        return {
          data: {
            code: 9000113,
            msg: '',
          },
        };
      });
    });

    it('should query invoice invalid barcode ', async () => {
      const invalidBarcode = await invoiceGateway.isMobileBarcodeValid('/DDPD7U3');

      expect(invalidBarcode).toBe(false);
    });
  });

  describe('check mobile barcode with specific gateway options success', () => {
    const invoiceGateway = new AmegoInvoiceGateway({
      appKey: DEFAULT_APP_KEY,
      vatNumber: DEFAULT_VAT_NUMBER,
      baseUrl: AmegoBaseUrls.DEVELOPMENT,
    });

    beforeAll(() => {
      post.mockImplementation(async (url: string, data: any) => {
        expect(url).toEqual(`${baseUrl}/json/barcode`);

        return {
          data: {
            code: 0,
            msg: '',
          },
        };
      });
    });

    it('should query invoice valid barcode ', async () => {
      const validBarcode = await invoiceGateway.isMobileBarcodeValid('/DDPD7U2');

      expect(validBarcode).toBe(true);
    });
  });

  describe('check mobile barcode with specific gateway options fail', () => {
    const invoiceGateway = new AmegoInvoiceGateway({
      appKey: DEFAULT_APP_KEY,
      vatNumber: DEFAULT_VAT_NUMBER,
      baseUrl: AmegoBaseUrls.DEVELOPMENT,
    });

    beforeAll(() => {
      post.mockImplementation(async (url: string, data: any) => {
        expect(url).toEqual(`${baseUrl}/json/barcode`);

        return {
          data: {
            code: 9000113,
            msg: '',
          },
        };
      });
    });

    it('should query invoice invalid barcode ', async () => {
      const invalidBarcode = await invoiceGateway.isMobileBarcodeValid('/DDPD7U3');

      expect(invalidBarcode).toBe(false);
    });
  });

  describe('query invoice with default gateway options by orderId', () => {
    const invoiceGateway = new AmegoInvoiceGateway({
      appKey: DEFAULT_APP_KEY,
      vatNumber: DEFAULT_VAT_NUMBER,
      baseUrl: AmegoBaseUrls.DEVELOPMENT,
    });

    beforeAll(() => {
      post.mockImplementation(async (url: string, data: any) => {
        expect(url).toEqual(`${baseUrl}/json/invoice_query`);

        //     {
        //   code: 0,
        //   msg: '',
        //   data: {
        //     invoice_number: 'AC12364096',
        //     invoice_type: 'C0401',
        //     invoice_status: 99,
        //     invoice_date: 20250606,
        //     invoice_time: '14:30:54',
        //     buyer_identifier: '55880710',
        //     buyer_name: '55880710',
        //     buyer_zip: 0,
        //     buyer_address: '',
        //     buyer_telephone_number: '',
        //     buyer_email_address: '',
        //     sales_amount: 238,
        //     free_tax_sales_amount: 0,
        //     zero_tax_sales_amount: 0,
        //     tax_type: 1,
        //     tax_rate: '0.05',
        //     tax_amount: 12,
        //     total_amount: 250,
        //     print_mark: 'Y',
        //     random_number: '6476',
        //     main_remark: '',
        //     customs_clearance_mark: 0,
        //     carrier_type: '',
        //     carrier_id1: '',
        //     carrier_id2: '',
        //     npoban: '',
        //     cancel_date: 0,
        //     invoice_lottery: 0,
        //     order_id: '3g49n3',
        //     detail_vat: 1,
        //     detail_amount_round: 1,
        //     create_date: 1749191454,
        //     product_item: [ [Object], [Object] ],
        //     wait: [],
        //     allowance: [ [Object], [Object] ]
        //   }
        // }

        return {
          data: {
            code: 0,
            msg: '',
            data: {
              invoice_number: 'AC12364096',
              invoice_type: 'C0401',
              invoice_status: 99,
              invoice_date: 20250606,
              invoice_time: '14:30:54',
              buyer_identifier: '55880710',
              buyer_name: '55880710',
              sales_amount: 238,
              tax_type: 1,
              tax_rate: '0.05',
              tax_amount: 12,
              total_amount: 250,
              random_number: '6476',
              order_id: '3g49n3',
              create_date: 1749191454,
              product_item: [
                { name: '口香糖', quantity: 10, unit_price: 10, tax_type: 1 },
                { name: '巧克力', quantity: 10, unit_price: 15, tax_type: 1 },
              ],
              allowance: [],
            },
          },
        };
      });
    });

    it('should query invoice by orderId ', async () => {
      const data = await invoiceGateway.query({ orderId: '3g49n3' });

      console.log(`Query Result by orderId: ${JSON.stringify(data)}`);

      expect(data.orderId).toBe('3g49n3');
      expect(data.invoiceNumber).toBe('AC12364096');
    });

    it('should query invoice by invoiceNumber ', async () => {
      const data = await invoiceGateway.query({ invoiceNumber: 'AC12364096' });

      console.log(`Query Result by invoiceNumber: ${JSON.stringify(data)}`);
      expect(data.orderId).toBe('3g49n3');
      expect(data.invoiceNumber).toBe('AC12364096');
    });
  });

});
