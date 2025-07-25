/**
 * @jest-environment node
 */
import { DateTime } from 'luxon';
import { AmegoBaseUrls, AmegoInvoiceGateway, TaxType } from '../src';
import axios from 'axios';

const DEFAULT_VAT_NUMBER = '12345678';
const DEFAULT_APP_KEY = 'sHeq7t8G1wiQvhAuIM27';
const baseUrl = AmegoBaseUrls.DEVELOPMENT;

describe('AmegoInvoiceGateway Issue Invoice', () => {
  describe('issue invoice with default options', () => {
    const post = jest.spyOn(axios, 'post');
    const invoiceGateway = new AmegoInvoiceGateway();

    beforeAll(() => {
      post.mockImplementation(async (url: string, data: any) => {
        expect(url).toEqual(`${baseUrl}/json/f0401`);

        return {
          data: {
            code: 0,
            msg: '',
            invoice_number: 'AC12367705',
            invoice_time: DateTime.now().toSeconds(),
            random_number: '6121',
            barcode: '11406AC123677056121',
            qrcode_left:
              'AC1236770511406096121000000ee000000fa5588071012345678Kl5uSAlhCfQMd3WjsCxKiQ==:**********:1:2:0:',
            qrcode_right: '**口香糖:10:10',
          },
        };
      });
    });

    it('should issue with default options success', async () => {
      const invoice = await invoiceGateway.issue({
        orderId: '202506091426231986',
        vatNumber: '55880710',
        buyerEmail: '',
        // carrier: { type: InvoiceCarrierType.MOBILE, code: '/DDPD7U2' },
        items: [
          {
            name: '口香糖',
            quantity: 10,
            unitPrice: 10,
            taxType: TaxType.TAXED,
          },
          {
            name: '巧克力',
            quantity: 10,
            unitPrice: 15,
            taxType: TaxType.TAXED,
          },
        ],
        taxType: TaxType.TAXED,
        detailVat: true,
      });

      expect(invoice.orderId).toBe('202506091426231986');
      expect(invoice.vatNumber).toBe('55880710');
      expect(invoice.invoiceNumber).toBe('AC12367705');
      expect(invoice.issuedAmount).toBe(250);
      expect(invoice.invoiceNumber.length).toBe(10);
    });
  });
});
