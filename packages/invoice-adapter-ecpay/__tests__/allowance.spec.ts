/**
 * @jest-environment node
 */

import { ECPayInvoice, ECPayInvoiceAllowance, ECPayInvoiceAllowanceRequestBody, ECPayInvoiceGateway, ECPayInvoiceInvalidAllowanceRequestBody, InvoiceAllowanceState, InvoiceState, TaxType } from '../src';
import axios from 'axios';
import { DateTime } from 'luxon';
import { randomBytes, createDecipheriv, createCipheriv } from 'crypto';

const DEFAULT_AES_IV = 'q9jcZX8Ib9LM8wYk';
const DEFAULT_AES_KEY = 'ejCk326UnaZWKisg';
const DEFAULT_MERCHANT_ID = '2000132';

const INVOICE_REMAINING_AMOUNT: Record<string, number> = {};
const allowanceSet = new Set<string>();
const taxTypeCheckByCustomer = new Map<string, '1' | '2' | '3'>();
const notifyTargetByCustomer = new Map<string, 'A' | 'E' | 'N' | 'S'>();

describe('ECPayInvoiceGateway:Allowance', () => {
  const post = jest.spyOn(axios, 'post');
  const invoiceGateway = new ECPayInvoiceGateway();

  const FAKE_INVOICE_NUMBER = 'JJ00050096';
  const FAKE_RANDOM_CODE = '9527';
  const FAKE_ORDER_ID = '202212260100401';
  const SHOULD_THROW_INVOICE_NUMBER = 'JJ00050099';
  const SHOULD_THROW_INVALID_ALLOWANCE_INVOICE_NUMBER = 'JJ00050098';

  beforeAll(() => {
    post.mockImplementation(async (url: string, data: unknown) => {
      const payload = JSON.parse(data as string) as {
        MerchantID: string;
        RqHeader: {
          Timestamp: number;
          Revision: '3.0.0';
        };
        Data: string;
      };

      const decipher = createDecipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

      const cipher = createCipheriv('aes-128-cbc', DEFAULT_AES_KEY, DEFAULT_AES_IV);

      cipher.setAutoPadding(true);

      if (/AllowanceInvalid$/.test(url)) {
        const plainPayload = JSON.parse(
          decodeURIComponent(
            [
              decipher.update(payload.Data, 'base64', 'utf8'),
              decipher.final('utf8'),
            ].join('')
          )
        ) as ECPayInvoiceInvalidAllowanceRequestBody;

        if (!allowanceSet.has(plainPayload.AllowanceNo)) {
          return {
            data: {
              MerchantID: DEFAULT_MERCHANT_ID,
              RpHeader: {
                Timestamp: Math.round(Date.now() / 1000),
                Revision: '3.0.0',
              },
              TransCode: 1,
              TransMsg: 'Success',
              Data: [
                cipher.update(encodeURIComponent(JSON.stringify({
                  RtnCode: 2000039,
                  RtnMsg: '查無折讓單資料，請確認!',
                  IA_Invoice_No: null,
                })), 'utf8', 'base64'),
                cipher.final('base64'),
              ].join(''),
            },
          };
        }

        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            RpHeader: {
              Timestamp: Math.round(Date.now() / 1000),
              Revision: '3.0.0',
            },
            TransCode: SHOULD_THROW_INVALID_ALLOWANCE_INVOICE_NUMBER === plainPayload.InvoiceNo ? 999 : 1,
            TransMsg: SHOULD_THROW_INVALID_ALLOWANCE_INVOICE_NUMBER ? 'Error' : 'Success',
            Data: [
              cipher.update(encodeURIComponent(JSON.stringify({
                RtnCode: 1,
                RtnMsg: '該折讓單已作廢',
                IA_Invoice_No: plainPayload.InvoiceNo,
              })), 'utf8', 'base64'),
              cipher.final('base64'),
            ].join(''),
          },
        };
      }

      const plainPayload = JSON.parse(
        decodeURIComponent(
          [
            decipher.update(payload.Data, 'base64', 'utf8'),
            decipher.final('utf8'),
          ].join('')
        )
      ) as ECPayInvoiceAllowanceRequestBody;

      const targetTaxType = taxTypeCheckByCustomer.get(plainPayload.CustomerName ?? '');

      if (targetTaxType) {
        expect(targetTaxType).toBe(plainPayload.Items[0].ItemTaxType);
      }

      const notifyTarget = notifyTargetByCustomer.get(plainPayload.CustomerName ?? '');

      if (notifyTarget) {
        expect(notifyTarget).toBe(plainPayload.AllowanceNotify);
      }

      const allowanceAmount = plainPayload.AllowanceAmount;

      INVOICE_REMAINING_AMOUNT[plainPayload.InvoiceNo] = INVOICE_REMAINING_AMOUNT[plainPayload.InvoiceNo] || 0;

      INVOICE_REMAINING_AMOUNT[plainPayload.InvoiceNo] -= allowanceAmount;

      if (!~[FAKE_INVOICE_NUMBER, SHOULD_THROW_INVALID_ALLOWANCE_INVOICE_NUMBER].indexOf(plainPayload.InvoiceNo)) {
        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            RpHeader: {
              Timestamp: Math.round(Date.now() / 1000),
              Revision: '3.0.0',
            },
            TransCode: SHOULD_THROW_INVOICE_NUMBER === plainPayload.InvoiceNo ? 999 : 1,
            TransMsg: SHOULD_THROW_INVOICE_NUMBER === plainPayload.InvoiceNo ? 'Error' : 'Success',
            Data: [
              cipher.update(encodeURIComponent(JSON.stringify({
                RtnCode: SHOULD_THROW_INVOICE_NUMBER === plainPayload.InvoiceNo ? 999999 : 2000018,
                RtnMsg: SHOULD_THROW_INVOICE_NUMBER === plainPayload.InvoiceNo ? '未知問題' : '無該筆發票資料!',
                IA_Allow_No: null,
                IA_Invoice_No: null,
                ID_Date: null,
                IA_Remain_Allowance_Amt: 0,
              })), 'utf8', 'base64'),
              cipher.final('base64'),
            ].join(''),
          },
        };
      }

      if (INVOICE_REMAINING_AMOUNT[plainPayload.InvoiceNo] < 0) {
        return {
          data: {
            MerchantID: DEFAULT_MERCHANT_ID,
            RpHeader: {
              Timestamp: Math.round(Date.now() / 1000),
              Revision: '3.0.0',
            },
            TransCode: allowanceAmount < 0 ? 999 : 1,
            TransMsg: 'Success',
            Data: [
              cipher.update(encodeURIComponent(JSON.stringify({
                RtnCode: 2000034,
                RtnMsg: '無足夠金額可以折讓，請確認',
                IA_Allow_No: null,
                IA_Invoice_No: null,
                ID_Date: null,
                IA_Remain_Allowance_Amt: 0,
              })), 'utf8', 'base64'),
              cipher.final('base64'),
            ].join(''),
          },
        };
      }

      const allowanceNumber = Date.now().toString();

      allowanceSet.add(allowanceNumber);

      return {
        data: {
          MerchantID: DEFAULT_MERCHANT_ID,
          RpHeader: {
            Timestamp: Math.round(Date.now() / 1000),
            Revision: '3.0.0',
          },
          TransCode: allowanceAmount < 0 ? 999 : 1,
          TransMsg: 'Success',
          Data: [
            cipher.update(encodeURIComponent(JSON.stringify({
              RtnCode: 1,
              RtnMsg: '折讓單資料新增成功',
              IA_Allow_No: allowanceNumber,
              IA_Invoice_No: plainPayload.InvoiceNo,
              IA_Date: DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss'),
              IA_Remain_Allowance_Amt: INVOICE_REMAINING_AMOUNT[plainPayload.InvoiceNo],
            })), 'utf8', 'base64'),
            cipher.final('base64'),
          ].join(''),
        },
      };
    });
  });

  it('should allowance an invoice', async () => {
    const invoice = new ECPayInvoice({
      orderId: FAKE_ORDER_ID,
      taxType: TaxType.TAXED,
      issuedOn: new Date(),
      invoiceNumber: FAKE_INVOICE_NUMBER,
      randomCode: FAKE_RANDOM_CODE,
      items: [{
        name: '橡皮擦',
        quantity: 2,
        unitPrice: 10,
      }],
    });

    INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

    expect(invoice.allowances.length).toBe(0);

    await invoiceGateway.allowance(invoice, [{
      name: '橡皮擦',
      quantity: 1,
      unitPrice: 5,
    }]);

    expect(invoice.allowances.length).toBe(1);
    expect(invoice.nowAmount).toBe(15);
  });

  it('should throw error when allowance amount is greater than invoice amount', () => {
    const invoice = new ECPayInvoice({
      orderId: FAKE_ORDER_ID,
      taxType: TaxType.TAXED,
      issuedOn: new Date(),
      invoiceNumber: FAKE_INVOICE_NUMBER,
      randomCode: FAKE_RANDOM_CODE,
      items: [{
        name: '橡皮擦',
        quantity: 2,
        unitPrice: 10,
      }],
    });

    INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

    expect(() => invoiceGateway.allowance(invoice, [{
      name: '橡皮擦',
      quantity: 3,
      unitPrice: 10,
    }])).rejects.toThrow();
  });

  it('should reject on invoice not found', () => {
    const invoice = new ECPayInvoice({
      orderId: FAKE_ORDER_ID,
      taxType: TaxType.TAXED,
      issuedOn: new Date(),
      invoiceNumber: 'GG40489999',
      randomCode: FAKE_RANDOM_CODE,
      items: [{
        name: '橡皮擦',
        quantity: 2,
        unitPrice: 10,
      }],
    });

    INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

    expect(invoice.allowances.length).toBe(0);

    expect(() => invoiceGateway.allowance(invoice, [{
      name: '橡皮擦',
      quantity: 1,
      unitPrice: 5,
    }])).rejects.toThrow();
  });

  it('should invalid allowance', async () => {
    const invoice = new ECPayInvoice({
      orderId: FAKE_ORDER_ID,
      taxType: TaxType.TAXED,
      issuedOn: new Date(),
      invoiceNumber: FAKE_INVOICE_NUMBER,
      randomCode: FAKE_RANDOM_CODE,
      items: [{
        name: '橡皮擦',
        quantity: 2,
        unitPrice: 10,
      }],
    });

    INVOICE_REMAINING_AMOUNT[FAKE_INVOICE_NUMBER] = 20;

    expect(invoice.allowances.length).toBe(0);

    await invoiceGateway.allowance(invoice, [{
      name: '橡皮擦',
      quantity: 1,
      unitPrice: 5,
    }]);

    expect(invoice.allowances[0].invalidOn).toBeNull();

    await invoiceGateway.invalidAllowance(invoice.allowances[0], '測試作廢');

    expect(invoice.allowances[0].invalidOn).not.toBeNull();
  });

  it('should reject on allowance not found', () => {
    const invoice = new ECPayInvoice({
      orderId: FAKE_ORDER_ID,
      taxType: TaxType.TAXED,
      issuedOn: new Date(),
      invoiceNumber: FAKE_INVOICE_NUMBER,
      randomCode: FAKE_RANDOM_CODE,
      items: [{
        name: '橡皮擦',
        quantity: 2,
        unitPrice: 10,
      }],
    });

    const allowance = new ECPayInvoiceAllowance({
      allowanceNumber: '123871952435',
      allowancePrice: 5,
      allowancedOn: DateTime.now().toJSDate(),
      remainingAmount: 15,
      items: [{
        name: '橡皮擦',
        quantity: 1,
        unitPrice: 5,
      }],
      parentInvoice: invoice,
      status: InvoiceAllowanceState.ISSUED,
    });

    invoice.addAllowance(allowance);

    expect(() => invoiceGateway.invalidAllowance(invoice.allowances[0])).rejects.toThrow();
  });

  describe('Misc', () => {
    it('should request taxType on allowance request when mixed taxed invoice', () => {
      const invoice = new ECPayInvoice({
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.MIXED,
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        items: [{
          name: '橡皮擦',
          quantity: 2,
          unitPrice: 10,
        }],
      });

      expect(() => invoiceGateway.allowance(invoice, [{
        name: '橡皮擦',
        quantity: 2,
        unitPrice: 10,
      }])).rejects.toThrow();
    });

    it('should represent allowance notify', async () => {
      const invoice = new ECPayInvoice({
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        items: [{
          name: '橡皮擦',
          quantity: 2,
          unitPrice: 10,
        }],
      });

      notifyTargetByCustomer.set('ZZ', 'S');
      notifyTargetByCustomer.set('YY', 'E');
      notifyTargetByCustomer.set('XX', 'A');
      notifyTargetByCustomer.set('WW', 'N');

      await invoiceGateway.allowance(invoice, [{
        name: '橡皮擦',
        quantity: 1,
        unitPrice: 2,
      }], {
        notifyPhone: '0912345678',
        buyerName: 'ZZ',
      });

      await invoiceGateway.allowance(invoice, [{
        name: '橡皮擦',
        quantity: 1,
        unitPrice: 2,
      }], {
        notifyEmail: 'hello@rytass.com',
        buyerName: 'YY',
      });

      await invoiceGateway.allowance(invoice, [{
        name: '橡皮擦',
        quantity: 1,
        unitPrice: 2,
      }], {
        notifyPhone: '0912345678',
        notifyEmail: 'hello@rytass.com',
        buyerName: 'XX',
      });

      await invoiceGateway.allowance(invoice, [{
        name: '橡皮擦',
        quantity: 1,
        unitPrice: 2,
      }], {
        buyerName: 'WW',
      });
    });

    it('should represent tax type in allowance items on mixed taxed invoice', async () => {
      const invoice = new ECPayInvoice({
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.MIXED,
        issuedOn: new Date(),
        invoiceNumber: FAKE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        items: [{
          name: '橡皮擦',
          quantity: 2,
          unitPrice: 10,
        }],
      });

      taxTypeCheckByCustomer.set('ZZZ', '1');
      taxTypeCheckByCustomer.set('YYY', '2');
      taxTypeCheckByCustomer.set('XXX', '3');

      await invoiceGateway.allowance(invoice, [{
        name: '橡皮擦',
        quantity: 1,
        unitPrice: 2,
      }], {
        taxType: TaxType.TAXED,
        buyerName: 'ZZZ',
      });

      await invoiceGateway.allowance(invoice, [{
        name: '橡皮擦',
        quantity: 1,
        unitPrice: 2,
      }], {
        taxType: TaxType.ZERO_TAX,
        buyerName: 'YYY',
      });

      await invoiceGateway.allowance(invoice, [{
        name: '橡皮擦',
        quantity: 1,
        unitPrice: 2,
      }], {
        taxType: TaxType.TAX_FREE,
        buyerName: 'XXX',
      });
    });

    it('should throw on allowance failed without predefined reason', () => {
      const invoice = new ECPayInvoice({
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
        issuedOn: new Date(),
        invoiceNumber: SHOULD_THROW_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        items: [{
          name: '橡皮擦',
          quantity: 2,
          unitPrice: 10,
        }],
      });

      expect(() => invoiceGateway.allowance(invoice, [{
        name: '橡皮擦',
        quantity: 1,
        unitPrice: 2,
      }])).rejects.toThrow();
    });

    it('should throw on allowance failed without predefined reason', async () => {
      const invoice = new ECPayInvoice({
        orderId: FAKE_ORDER_ID,
        taxType: TaxType.TAXED,
        issuedOn: new Date(),
        invoiceNumber: SHOULD_THROW_INVALID_ALLOWANCE_INVOICE_NUMBER,
        randomCode: FAKE_RANDOM_CODE,
        items: [{
          name: '橡皮擦',
          quantity: 2,
          unitPrice: 10,
        }],
      });

      INVOICE_REMAINING_AMOUNT[SHOULD_THROW_INVALID_ALLOWANCE_INVOICE_NUMBER] = 20;

      await invoiceGateway.allowance(invoice, [{
        name: '橡皮擦',
        quantity: 1,
        unitPrice: 2,
      }]);

      expect(() => invoiceGateway.invalidAllowance(invoice.allowances[0])).rejects.toThrow();
    });
  });
});
