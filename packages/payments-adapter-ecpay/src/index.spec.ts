/**
 * @jest-environment jsdom
 */

import request from 'supertest';
import { createHash } from 'crypto';
import { ECPayPayment } from '.';
import { ECPayOrder } from './ecpay-order';

function addMac(payload: Record<string, string>) {
  const mac = createHash('sha256')
    .update(
      encodeURIComponent(
        [
          ['HashKey', '5294y06JbISpM5x9'],
          ...Object.entries(payload).sort(([aKey], [bKey]) => (aKey.toLowerCase() < bKey.toLowerCase() ? -1 : 1)),
          ['HashIV', 'v77hoKGq4kWxNNIS'],
        ]
          .map(([key, value]) => `${key}=${value}`)
          .join('&'),
      )
        .toLowerCase()
        .replace(/'/g, '%27')
        .replace(/~/g, '%7e')
        .replace(/%20/g, '+'),
    )
    .digest('hex')
    .toUpperCase();

  return {
    ...payload,
    CheckMacValue: mac,
  } as Record<string, string>;
}

describe('ECPayPayment', () => {
  // Form Page HTML
  describe('Generate Form Page HTML', () => {
    const payment = new ECPayPayment();

    const order = payment.prepare({
      items: [{
        name: 'Test',
        unitPrice: 10,
        quantity: 1
      }, {
        name: '中文',
        unitPrice: 15,
        quantity: 4
      }],
    });

    document.body.innerHTML = order.formHTML;

    it('should only one form in page', () => {
      expect(document.forms).toHaveLength(1);
    });

    it('should set form submit action target', () => {
      const actionURL = document.forms[0].getAttribute('action');

      expect(actionURL).toMatch(/\/Cashier\/AioCheckOut\/V5$/);
    });

    it('should set form submit method to post', () => {
      const method = document.forms[0].getAttribute('method');

      expect(method).toBe('POST');
    });
  });

  describe('Serve checkout server', () => {
    const payment = new ECPayPayment({
      withServer: true,
      serverHost: 'localhost:3004',
    });

    const order = payment.prepare({
      items: [{
        name: 'Test',
        unitPrice: 10,
        quantity: 1
      }, {
        name: '中文',
        unitPrice: 15,
        quantity: 4
      }],
    });

    it('should serve checkout url', (done) => {
      request(payment._server)
        .get(`/payments/ecpay/checkout/${order.id}`)
        .expect('Content-Type', 'text/html')
        .expect(200)
        .then((res) => {
          expect(res.text).toEqual(order.formHTML);

          done();
        });
    });

    afterAll(() => {
      payment._server?.close();
    })
  });

  describe('Serve callback handler server', () => {
    it('should handle successful request', (done) => {
      const payment = new ECPayPayment({
        withServer: true,
        serverHost: 'localhost:3005',
      });

      const order = payment.prepare({
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1
        }, {
          name: '中文',
          unitPrice: 15,
          quantity: 4
        }],
      });

      // Get HTML to trigger pre commit
      const html = order.formHTML;

      const successfulResponse = addMac({
        amount: '70',
        auth_code: '777777',
        card4no: '2222',
        card6no: '431195',
        CustomField1: '',
        CustomField2: '',
        CustomField3: '',
        CustomField4: '',
        eci: '0',
        gwsr: '11943076',
        MerchantID: '2000132',
        MerchantTradeNo: order.id,
        PaymentDate: '2022/04/18 19:15:33',
        PaymentType: 'Credit_CreditCard',
        process_date: '2022/04/18 19:15:33',
        RtnCode: '1',
        RtnMsg: '交易成功',
        SimulatePaid: '0',
        TradeAmt: '70',
        TradeDate: '2022/04/18 19:14:51',
        TradeNo: '2204181914513433',
      });

      request(payment._server)
        .post('/payments/ecpay/checkout')
        .send(new URLSearchParams(successfulResponse).toString())
        .expect('Content-Type', 'text/plain')
        .expect(200)
        .then((res) => {
          expect(res.text).toEqual('1|OK');

          payment._server?.close();

          done();
        });
    });

    it('should check CheckMacValue on callback payload', (done) => {
      const payment = new ECPayPayment({
        withServer: true,
        serverHost: 'localhost:3004',
      });

      const successfulResponse = {
        amount: '70',
        auth_code: '777777',
        card4no: '2222',
        card6no: '431195',
        CustomField1: '',
        CustomField2: '',
        CustomField3: '',
        CustomField4: '',
        eci: '0',
        gwsr: '11943076',
        MerchantID: '2000132',
        MerchantTradeNo: 'ORDERID',
        PaymentDate: '2022/04/18 19:15:33',
        PaymentType: 'Credit_CreditCard',
        process_date: '2022/04/18 19:15:33',
        RtnCode: '1',
        RtnMsg: '交易成功',
        SimulatePaid: '0',
        TradeAmt: '70',
        TradeDate: '2022/04/18 19:14:51',
        TradeNo: '2204181914513433',
        CheckMacValue: '3CD5424E742BF5AB43D52A9E43F30F176A655F271730E1F5DBC13A03B346CBDCCCC' // Wrong
      };

      request(payment._server)
        .post('/payments/ecpay/checkout')
        .send(new URLSearchParams(successfulResponse).toString())
        .expect('Content-Type', 'text/plain')
        .expect(400)
        .then((res) => {
          expect(res.text).toEqual('0|CheckSumInvalid');

          payment._server?.close();

          done();
        });
    });

    it('should order commit with callback server', (done) => {
      const mockedOnCommit = jest.fn<void, [ECPayOrder]>((order) => { });

      const payment = new ECPayPayment({
        withServer: true,
        serverHost: 'localhost:3003',
        onCommit: mockedOnCommit,
      });

      const order = payment.prepare({
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1
        }, {
          name: '中文',
          unitPrice: 15,
          quantity: 4
        }],
      });

      // Get HTML to trigger pre commit
      const html = order.formHTML;

      const successfulResponse = addMac({
        amount: '70',
        auth_code: '777777',
        card4no: '2222',
        card6no: '431195',
        CustomField1: '',
        CustomField2: '',
        CustomField3: '',
        CustomField4: '',
        eci: '0',
        gwsr: '11943076',
        MerchantID: '2000132',
        MerchantTradeNo: order.id,
        PaymentDate: '2022/04/18 19:15:33',
        PaymentType: 'Credit_CreditCard',
        process_date: '2022/04/18 19:15:33',
        RtnCode: '1',
        RtnMsg: '交易成功',
        SimulatePaid: '0',
        TradeAmt: '70',
        TradeDate: '2022/04/18 19:14:51',
        TradeNo: '2204181914513433',
      });

      request(payment._server)
        .post('/payments/ecpay/checkout')
        .send(new URLSearchParams(successfulResponse).toString())
        .then((res) => {
          expect(mockedOnCommit.mock.calls.length).toBe(1);
          expect((mockedOnCommit.mock.calls[0][0] as unknown as ECPayOrder).id).toBe(order.id);

          payment._server?.close();

          done();
        });
    });
  });
});
