/**
 * @jest-environment jsdom
 */

import request from 'supertest';
import { OrderState } from '@rytass/payments';
import { addMac } from '../__utils__/add-mac';
import { Channel, ECPayCallbackPaymentType, ECPayPayment } from '@rytass/payments-adapter-ecpay';
import http, { createServer } from 'http';
import { ECPayChannelBarcode } from 'payments-adapter-ecpay/src/typings';

describe('ECPayPayment (Barcode)', () => {
  const originCreateServer = createServer;
  const mockedCreateServer = jest.spyOn(http, 'createServer');

  mockedCreateServer.mockImplementation((requestHandler) => {
    const mockServer = originCreateServer(requestHandler);

    const mockedListen = jest.spyOn(mockServer, 'listen');

    mockedListen.mockImplementationOnce((port?: any, hostname?: any, listeningListener?: () => void) => {
      mockServer.listen(0, listeningListener);

      return mockServer;
    });

    const mockedClose = jest.spyOn(mockServer, 'close');

    mockedClose.mockImplementationOnce((onClosed) => {
      mockServer.close(onClosed);

      return mockServer;
    });

    return mockServer;
  });

  describe('Barcode', () => {
    let payment: ECPayPayment<ECPayChannelBarcode>;

    beforeAll(() => new Promise<void>((resolve) => {
      payment = new ECPayPayment<ECPayChannelBarcode>({
        withServer: true,
        onServerListen: resolve,
      });
    }));

    it('should throw on not barcode channel set cvsBarcodeExpireDays', () => {
      expect(() => {
        payment.prepare({
          // @ts-ignore: Unreachable code error
          channel: Channel.VIRTUAL_ACCOUNT,
          cvsBarcodeExpireDays: 1100,
          items: [{
            name: 'Test',
            unitPrice: 100,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should `cvsBarcodeExpireDays` between 1 and 7', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.CVS_BARCODE,
          cvsBarcodeExpireDays: 0,
          items: [{
            name: 'Test',
            unitPrice: 100,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CVS_BARCODE,
          cvsBarcodeExpireDays: 99999,
          items: [{
            name: 'Test',
            unitPrice: 100,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should default virtual expire days is 7', () => {
      const order = payment.prepare({
        channel: Channel.CVS_BARCODE,
        items: [{
          name: 'Test',
          unitPrice: 100,
          quantity: 1,
        }],
      });

      expect(order.form.StoreExpireDate).toBe('7');
    });

    it('should throw if total aomunt between 17 and 20000', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.CVS_BARCODE,
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CVS_BARCODE,
          items: [{
            name: 'Test',
            unitPrice: 99900,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should represent barcode config on form data', () => {
      const order = payment.prepare({
        channel: Channel.CVS_BARCODE,
        cvsBarcodeExpireDays: 3,
        items: [{
          name: 'Test',
          unitPrice: 1000,
          quantity: 1,
        }],
      });

      expect(order.form.StoreExpireDate).toBe('3');
      expect(order.form.PaymentInfoURL).toBe('http://localhost:3000/payments/ecpay/callback');
      expect(order.form.ClientRedirectURL).toBe('');

      const clientOrder = payment.prepare({
        channel: Channel.CVS_BARCODE,
        items: [{
          name: 'Test',
          unitPrice: 1000,
          quantity: 1,
        }],
        clientBackUrl: 'https://rytass.com',
      });

      expect(clientOrder.form.ClientRedirectURL).toBe('https://rytass.com');
    });

    it('should default callback handler commit order', (done) => {
      const order = payment.prepare({
        channel: Channel.CVS_BARCODE,
        cvsBarcodeExpireDays: 1,
        items: [{
          name: 'Test',
          unitPrice: 1000,
          quantity: 1,
        }],
      });

      expect(order.state).toBe(OrderState.INITED);

      // Get HTML to trigger pre commit
      // eslint-disable-next-line no-unused-vars
      const html = order.formHTML;

      const successfulResponse = addMac({
        Barcode1: '1106176EA',
        Barcode2: '3453010377039404',
        Barcode3: '061616000001000',
        ExpireDate: '2022/06/30 20:26:59',
        MerchantID: '2000132',
        MerchantTradeNo: order.id,
        PaymentNo: '',
        PaymentType: ECPayCallbackPaymentType.BARCODE,
        RtnCode: '10100073',
        RtnMsg: 'Get CVS Code Succeeded.',
        TradeAmt: order.totalPrice.toString(),
        TradeDate: '2022/06/16 23:07:58',
        TradeNo: '2204201729498436',
        StoreID: '',
        CustomField1: '',
        CustomField2: '',
        CustomField3: '',
        CustomField4: '',
      });

      expect(order.state).toBe(OrderState.PRE_COMMIT);

      request(payment._server)
        .post('/payments/ecpay/callback')
        .send(new URLSearchParams(successfulResponse).toString())
        .expect('Content-Type', 'text/plain')
        .expect(200)
        .then((res) => {
          expect(res.text).toEqual('1|OK');
          expect(order.state).toBe(OrderState.COMMITTED);
          expect(order.additionalInfo?.barcodes.length).toBe(3);
          expect(order.additionalInfo?.barcodes[0]).toBe('1106176EA');
          expect(order.additionalInfo?.barcodes[1]).toBe('3453010377039404');
          expect(order.additionalInfo?.barcodes[2]).toBe('061616000001000');
          expect(order.additionalInfo?.expiredAt).toBe('2022/06/30 20:26:59');
          expect(order.paymentType).toBe(ECPayCallbackPaymentType.BARCODE);

          done();
        });
    });

    it('should default callback handler keep order status when get barcode failed', (done) => {
      const order = payment.prepare({
        channel: Channel.CVS_BARCODE,
        cvsBarcodeExpireDays: 1,
        items: [{
          name: 'Test',
          unitPrice: 1000,
          quantity: 1,
        }],
      });

      expect(order.state).toBe(OrderState.INITED);

      // Get HTML to trigger pre commit
      // eslint-disable-next-line no-unused-vars
      const html = order.formHTML;

      const successfulResponse = addMac({
        Barcode1: '1106176EA',
        Barcode2: '3453010377039404',
        Barcode3: '061616000001000',
        ExpireDate: '2022/06/30 20:26:59',
        MerchantID: '2000132',
        MerchantTradeNo: order.id,
        PaymentNo: '',
        PaymentType: ECPayCallbackPaymentType.BARCODE,
        RtnCode: '1010007322',
        RtnMsg: 'Get CVS Code Failed.',
        TradeAmt: order.totalPrice.toString(),
        TradeDate: '2022/06/16 23:07:58',
        TradeNo: '2204201729498436',
        StoreID: '',
        CustomField1: '',
        CustomField2: '',
        CustomField3: '',
        CustomField4: '',
      });

      expect(order.state).toBe(OrderState.PRE_COMMIT);

      request(payment._server)
        .post('/payments/ecpay/callback')
        .send(new URLSearchParams(successfulResponse).toString())
        .expect('Content-Type', 'text/plain')
        .expect(200)
        .then((res) => {
          expect(res.text).toEqual('1|OK');
          expect(order.state).toBe(OrderState.PRE_COMMIT);
          expect(order.additionalInfo).toBeUndefined();

          done();
        });
    });

    afterAll(() => new Promise((resolve) => {
      payment._server?.close(resolve);
    }));
  });
});
