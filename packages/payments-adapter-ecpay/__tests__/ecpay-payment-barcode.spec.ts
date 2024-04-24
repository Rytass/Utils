/**
 * @jest-environment jsdom
 */

import request from 'supertest';
import { OrderState } from '@rytass/payments';
import { DateTime } from 'luxon';
import { getAddMac } from '../__utils__/add-mac';
import { Channel, ECPayCallbackPaymentType, ECPayPayment } from '@rytass/payments-adapter-ecpay';
import http, { createServer } from 'http';
import { ECPayChannelBarcode } from 'payments-adapter-ecpay/src/typings';

const addMac = getAddMac();

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
    it('should throw on not barcode channel set cvsBarcodeExpireDays', (done) => {
      const payment = new ECPayPayment<ECPayChannelBarcode>({
        withServer: true,
        onServerListen: () => {
          expect(() => payment.prepare({
            // @ts-ignore: Unreachable code error
            channel: Channel.VIRTUAL_ACCOUNT,
            cvsBarcodeExpireDays: 1100,
            items: [{
              name: 'Test',
              unitPrice: 100,
              quantity: 1,
            }],
          })).rejects.toThrowError();

          payment._server?.close(done);
        },
      });
    });

    it('should `cvsBarcodeExpireDays` between 1 and 7', (done) => {
      const payment = new ECPayPayment<ECPayChannelBarcode>({
        withServer: true,
        onServerListen: () => {
          expect(() => payment.prepare({
            channel: Channel.CVS_BARCODE,
            cvsBarcodeExpireDays: 0,
            items: [{
              name: 'Test',
              unitPrice: 100,
              quantity: 1,
            }],
          })).rejects.toThrowError();

          expect(() => payment.prepare({
            channel: Channel.CVS_BARCODE,
            cvsBarcodeExpireDays: 99999,
            items: [{
              name: 'Test',
              unitPrice: 100,
              quantity: 1,
            }],
          })).rejects.toThrowError();

          payment._server?.close(done);
        },
      });
    });

    it('should default virtual expire days is 7', (done) => {
      const payment = new ECPayPayment<ECPayChannelBarcode>({
        withServer: true,
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: Channel.CVS_BARCODE,
            items: [{
              name: 'Test',
              unitPrice: 100,
              quantity: 1,
            }],
          });

          expect(order.form.StoreExpireDate).toBe('7');

          payment._server?.close(done)
        },
      });
    });

    it('should throw if total aomunt between 17 and 20000', (done) => {
      const payment = new ECPayPayment<ECPayChannelBarcode>({
        withServer: true,
        onServerListen: () => {
          expect(() => payment.prepare({
            channel: Channel.CVS_BARCODE,
            items: [{
              name: 'Test',
              unitPrice: 10,
              quantity: 1,
            }],
          })).rejects.toThrowError();

          expect(() => payment.prepare({
            channel: Channel.CVS_BARCODE,
            items: [{
              name: 'Test',
              unitPrice: 99900,
              quantity: 1,
            }],
          })).rejects.toThrowError();

          payment._server?.close(done);
        },
      });
    });

    it('should represent barcode config on form data', (done) => {
      const payment = new ECPayPayment<ECPayChannelBarcode>({
        withServer: true,
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: Channel.CVS_BARCODE,
            cvsBarcodeExpireDays: 3,
            items: [{
              name: 'Test',
              unitPrice: 1000,
              quantity: 1,
            }],
          });

          expect(order.form.StoreExpireDate).toBe('3');
          expect(order.form.PaymentInfoURL).toBe('http://localhost:3000/payments/ecpay/async-informations');
          expect(order.form.ClientRedirectURL).toBe('');

          const clientOrder = await payment.prepare({
            channel: Channel.CVS_BARCODE,
            items: [{
              name: 'Test',
              unitPrice: 1000,
              quantity: 1,
            }],
            clientBackUrl: 'https://rytass.com',
          });

          expect(clientOrder.form.ClientRedirectURL).toBe('https://rytass.com');

          payment._server?.close(done);
        },
      });
    });

    it('should default callback handler commit order', (done) => {
      const payment = new ECPayPayment<ECPayChannelBarcode>({
        withServer: true,
        onServerListen: async () => {
          const order = await payment.prepare({
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

          const res = await request(payment._server)
            .post('/payments/ecpay/async-informations')
            .send(new URLSearchParams(successfulResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(200);

          expect(res.text).toEqual('1|OK');
          expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
          expect(order.asyncInfo?.barcodes.length).toBe(3);
          expect(order.asyncInfo?.barcodes[0]).toBe('1106176EA');
          expect(order.asyncInfo?.barcodes[1]).toBe('3453010377039404');
          expect(order.asyncInfo?.barcodes[2]).toBe('061616000001000');
          expect(DateTime.fromJSDate(order.asyncInfo?.expiredAt!).toFormat('yyyy/MM/dd HH:mm:ss')).toBe('2022/06/30 20:26:59');

          payment._server?.close(done);
        },
      });
    });

    it('should default callback handler keep order status when get barcode failed', (done) => {
      const payment = new ECPayPayment<ECPayChannelBarcode>({
        withServer: true,
        onServerListen: async () => {
          const order = await payment.prepare({
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
            RtnMsg: 'Get Barcode Code Failed.',
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

          const res = await request(payment._server)
            .post('/payments/ecpay/async-informations')
            .send(new URLSearchParams(successfulResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(200);

          expect(res.text).toEqual('1|OK');
          expect(order.state).toBe(OrderState.FAILED);
          expect(order.failedMessage?.code).toBe('1010007322')
          expect(order.failedMessage?.message).toBe('Get Barcode Code Failed.');
          expect(order.asyncInfo).toBeUndefined();

          payment._server?.close(done);
        },
      })
    });

    it('should received callback of cvs payments', (done) => {
      const payment = new ECPayPayment<ECPayChannelBarcode>({
        withServer: true,
        onServerListen: async () => {
          const order = await payment.prepare<ECPayChannelBarcode>({
            channel: Channel.CVS_BARCODE,
            items: [{
              name: 'Test',
              unitPrice: 99,
              quantity: 1,
            }],
          });

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

          const res = await request(payment._server)
            .post('/payments/ecpay/async-informations')
            .send(new URLSearchParams(successfulResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(200);

          expect(res.text).toEqual('1|OK');
          expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);

          const callbackResponse = addMac({
            TotalSuccessTimes: '',
            PaymentNo: '',
            red_dan: '',
            red_yet: '',
            gwsr: '',
            red_ok_amt: '',
            PeriodType: '',
            SimulatePaid: '1',
            AlipayTradeNo: '',
            MerchantID: '2000132',
            TenpayTradeNo: '',
            WebATMAccNo: '',
            TradeDate: '2022/06/17 14:20:09',
            PaymentTypeChargeFee: '0',
            RtnMsg: '付款成功',
            CustomField4: '',
            PayFrom: '',
            ATMAccBank: '',
            PaymentType: ECPayCallbackPaymentType.BARCODE,
            TotalSuccessAmount: '',
            MerchantTradeNo: order.id,
            StoreID: '',
            stage: '',
            WebATMAccBank: '',
            CustomField1: '',
            PeriodAmount: '',
            TradeNo: '2204201729498436',
            card4no: '',
            card6no: '',
            auth_code: '',
            stast: '',
            PaymentDate: '2022/06/17 14:21:09',
            RtnCode: '1',
            eci: '',
            TradeAmt: order.totalPrice.toString(),
            Frequency: '',
            red_de_amt: '',
            process_date: '',
            amount: '',
            CustomField2: '',
            ATMAccNo: '',
            ExecTimes: '',
            CustomField3: '',
            staed: '',
            WebATMBankName: '',
            AlipayID: '',
          });

          const resCallback = await request(payment._server)
            .post('/payments/ecpay/callback')
            .send(new URLSearchParams(callbackResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(200);

          expect(resCallback.text).toEqual('1|OK');
          expect(order.state).toBe(OrderState.COMMITTED);

          payment._server?.close(done);
        },
      });
    });
  });
});
