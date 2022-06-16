/**
 * @jest-environment jsdom
 */

import request from 'supertest';
import { OrderState } from '@rytass/payments';
import { addMac } from '../__utils__/add-mac';
import { Channel, ECPayCallbackPaymentType, ECPayPayment } from '@rytass/payments-adapter-ecpay';
import http, { createServer } from 'http';
import { ECPayChannelCVS } from 'payments-adapter-ecpay/src/typings';

describe('ECPayPayment (CVS)', () => {
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

  describe('CVS', () => {
    let payment: ECPayPayment<ECPayChannelCVS>;

    beforeAll(() => new Promise<void>((resolve) => {
      payment = new ECPayPayment<ECPayChannelCVS>({
        withServer: true,
        onServerListen: resolve,
      });
    }));

    it('should throw on not cvs channel set cvsExpireMinutes', () => {
      expect(() => {
        payment.prepare({
          // @ts-ignore: Unreachable code error
          channel: Channel.VIRTUAL_ACCOUNT,
          cvsExpireMinutes: 1100,
          items: [{
            name: 'Test',
            unitPrice: 100,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should `cvsExpireMinutes` between 1 and 43200', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.CVS_KIOSK,
          cvsExpireMinutes: 0,
          items: [{
            name: 'Test',
            unitPrice: 100,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CVS_KIOSK,
          cvsExpireMinutes: 99999,
          items: [{
            name: 'Test',
            unitPrice: 100,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should default virtual expire minutes is 10080', () => {
      const order = payment.prepare({
        channel: Channel.CVS_KIOSK,
        items: [{
          name: 'Test',
          unitPrice: 100,
          quantity: 1,
        }],
      });

      expect(order.form.StoreExpireDate).toBe('10080');
    });

    it('should throw if total aomunt between 33 and 6000', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.CVS_KIOSK,
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.CVS_KIOSK,
          items: [{
            name: 'Test',
            unitPrice: 9990,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should represent virtual account config on form data', () => {
      const order = payment.prepare({
        channel: Channel.CVS_KIOSK,
        cvsExpireMinutes: 19999,
        items: [{
          name: 'Test',
          unitPrice: 1000,
          quantity: 1,
        }],
      });

      expect(order.form.StoreExpireDate).toBe('19999');
      expect(order.form.PaymentInfoURL).toBe('http://localhost:3000/payments/ecpay/callback');
      expect(order.form.ClientRedirectURL).toBe('');

      const clientOrder = payment.prepare({
        channel: Channel.CVS_KIOSK,
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
        channel: Channel.CVS_KIOSK,
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
        Barcode1: '',
        Barcode2: '',
        Barcode3: '',
        ExpireDate: '2022/06/30 20:26:59',
        MerchantID: '2000132',
        MerchantTradeNo: order.id,
        PaymentNo: 'LLL22167774958',
        PaymentType: ECPayCallbackPaymentType.CVS,
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
          expect(order.additionalInfo?.paymentCode).toBe('LLL22167774958');
          expect(order.additionalInfo?.paymentURL).toBeUndefined();
          expect(order.additionalInfo?.expiredAt).toBe('2022/06/30 20:26:59');
          expect(order.paymentType).toBe(ECPayCallbackPaymentType.CVS);

          done();
        });
    });

    afterAll(() => new Promise((resolve) => {
      payment._server?.close(resolve);
    }));
  });
});
