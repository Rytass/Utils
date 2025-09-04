/**
 * @jest-environment jsdom
 */

import request from 'supertest';
import { CVS, OrderState } from '@rytass/payments';
import { getAddMac } from '../__utils__/add-mac';
import { Channel, ECPayCallbackPaymentType, ECPayPayment } from '@rytass/payments-adapter-ecpay';
import http, { createServer } from 'http';
import { DateTime } from 'luxon';
import { ECPayChannelCVS } from 'payments-adapter-ecpay/src/typings';
import { App } from 'supertest/types';

const addMac = getAddMac();

describe('ECPayPayment (CVS)', () => {
  const originCreateServer = createServer;
  const mockedCreateServer = jest.spyOn(http, 'createServer');

  mockedCreateServer.mockImplementation(requestHandler => {
    const mockServer = originCreateServer(requestHandler);

    const mockedListen = jest.spyOn(mockServer, 'listen');

    mockedListen.mockImplementationOnce((port?: any, hostname?: any, listeningListener?: () => void) => {
      mockServer.listen(0, listeningListener);

      return mockServer;
    });

    const mockedClose = jest.spyOn(mockServer, 'close');

    mockedClose.mockImplementationOnce(onClosed => {
      mockServer.close(onClosed);

      return mockServer;
    });

    return mockServer;
  });

  describe('CVS', () => {
    it('should throw on not cvs channel set cvsExpireMinutes', done => {
      const payment = new ECPayPayment<ECPayChannelCVS>({
        withServer: true,
        onServerListen: () => {
          expect(() =>
            payment.prepare({
              // @ts-ignore: Unreachable code error
              channel: Channel.VIRTUAL_ACCOUNT,
              cvsExpireMinutes: 1100,
              items: [
                {
                  name: 'Test',
                  unitPrice: 100,
                  quantity: 1,
                },
              ],
            }),
          ).rejects.toThrow();

          payment._server?.close(done);
        },
      });
    });

    it('should `cvsExpireMinutes` between 1 and 43200', done => {
      const payment = new ECPayPayment<ECPayChannelCVS>({
        withServer: true,
        onServerListen: () => {
          expect(() =>
            payment.prepare({
              channel: Channel.CVS_KIOSK,
              cvsExpireMinutes: 0,
              items: [
                {
                  name: 'Test',
                  unitPrice: 100,
                  quantity: 1,
                },
              ],
            }),
          ).rejects.toThrow();

          expect(() =>
            payment.prepare({
              channel: Channel.CVS_KIOSK,
              cvsExpireMinutes: 99999,
              items: [
                {
                  name: 'Test',
                  unitPrice: 100,
                  quantity: 1,
                },
              ],
            }),
          ).rejects.toThrow();

          payment._server?.close(done);
        },
      });
    });

    it('should default virtual expire minutes is 10080', done => {
      const payment = new ECPayPayment<ECPayChannelCVS>({
        withServer: true,
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: Channel.CVS_KIOSK,
            items: [
              {
                name: 'Test',
                unitPrice: 100,
                quantity: 1,
              },
            ],
          });

          expect(order.form.StoreExpireDate).toBe('10080');

          payment._server?.close(done);
        },
      });
    });

    it('should throw if total aomunt between 33 and 6000', done => {
      const payment = new ECPayPayment<ECPayChannelCVS>({
        withServer: true,
        onServerListen: () => {
          expect(() =>
            payment.prepare({
              channel: Channel.CVS_KIOSK,
              items: [
                {
                  name: 'Test',
                  unitPrice: 10,
                  quantity: 1,
                },
              ],
            }),
          ).rejects.toThrow();

          expect(() =>
            payment.prepare({
              channel: Channel.CVS_KIOSK,
              items: [
                {
                  name: 'Test',
                  unitPrice: 9990,
                  quantity: 1,
                },
              ],
            }),
          ).rejects.toThrow();

          payment._server?.close(done);
        },
      });
    });

    it('should represent cvs config on form data', done => {
      const payment = new ECPayPayment<ECPayChannelCVS>({
        withServer: true,
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: Channel.CVS_KIOSK,
            cvsExpireMinutes: 19999,
            items: [
              {
                name: 'Test',
                unitPrice: 1000,
                quantity: 1,
              },
            ],
          });

          expect(order.form.StoreExpireDate).toBe('19999');
          expect(order.form.PaymentInfoURL).toBe('http://localhost:3000/payments/ecpay/async-informations');
          expect(order.form.ClientRedirectURL).toBe('');

          const clientOrder = await payment.prepare({
            channel: Channel.CVS_KIOSK,
            items: [
              {
                name: 'Test',
                unitPrice: 1000,
                quantity: 1,
              },
            ],
            clientBackUrl: 'https://rytass.com',
          });

          expect(clientOrder.form.ClientRedirectURL).toBe('https://rytass.com');

          payment._server?.close(done);
        },
      });
    });

    it('should default callback handler commit order', done => {
      const payment = new ECPayPayment<ECPayChannelCVS>({
        withServer: true,
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: Channel.CVS_KIOSK,
            items: [
              {
                name: 'Test',
                unitPrice: 1000,
                quantity: 1,
              },
            ],
          });

          expect(order.state).toBe(OrderState.INITED);

          // Get HTML to trigger pre commit

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

          const res = await request(payment._server as App)
            .post('/payments/ecpay/async-informations')
            .send(new URLSearchParams(successfulResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(200);

          expect(res.text).toEqual('1|OK');
          expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
          expect(order.asyncInfo?.paymentCode).toBe('LLL22167774958');
          expect(DateTime.fromJSDate(order.asyncInfo?.expiredAt!).toFormat('yyyy/MM/dd HH:mm:ss')).toBe(
            '2022/06/30 20:26:59',
          );

          payment._server?.close(done);
        },
      });
    });

    it('should default callback handler keep status if get code failed', done => {
      const payment = new ECPayPayment<ECPayChannelCVS>({
        withServer: true,
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: Channel.CVS_KIOSK,
            items: [
              {
                name: 'Test',
                unitPrice: 1000,
                quantity: 1,
              },
            ],
          });

          expect(order.state).toBe(OrderState.INITED);

          // Get HTML to trigger pre commit

          const html = order.formHTML;

          const successfulResponse = addMac({
            Barcode1: '',
            Barcode2: '',
            Barcode3: '',
            ExpireDate: '2022/06/30 20:26:59',
            MerchantID: '1',
            MerchantTradeNo: order.id,
            PaymentNo: 'LLL22167774958',
            PaymentType: ECPayCallbackPaymentType.CVS,
            RtnCode: '0',
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

          const res = await request(payment._server as App)
            .post('/payments/ecpay/async-informations')
            .send(new URLSearchParams(successfulResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(200);

          expect(res.text).toEqual('1|OK');
          expect(order.state).toBe(OrderState.FAILED);
          expect(order.failedMessage?.code).toBe('0');
          expect(order.failedMessage?.message).toBe('Get CVS Code Failed.');
          expect(order.asyncInfo).toBeUndefined();

          payment._server?.close(done);
        },
      });
    });

    it('should received callback of cvs payments', done => {
      const payment = new ECPayPayment<ECPayChannelCVS>({
        withServer: true,
        onServerListen: async () => {
          const order = await payment.prepare<ECPayChannelCVS>({
            channel: Channel.CVS_KIOSK,
            items: [
              {
                name: 'Test',
                unitPrice: 99,
                quantity: 1,
              },
            ],
          });

          // Get HTML to trigger pre commit

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

          const res = await request(payment._server as App)
            .post('/payments/ecpay/async-informations')
            .send(new URLSearchParams(successfulResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(200);

          expect(res.text).toEqual('1|OK');

          expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);

          const callbackResponse = addMac({
            TotalSuccessTimes: '',
            PaymentNo: 'LLL22167774958',
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
            PayFrom: 'family',
            ATMAccBank: '',
            PaymentType: ECPayCallbackPaymentType.CVS,
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

          const resCallback = await request(payment._server as App)
            .post('/payments/ecpay/callback')
            .send(new URLSearchParams(callbackResponse).toString())
            .expect('Content-Type', 'text/plain')
            .expect(200);

          expect(resCallback.text).toEqual('1|OK');
          expect(order.state).toBe(OrderState.COMMITTED);
          expect(order.additionalInfo?.cvsPayFrom).toBe(CVS.FAMILY_MART);

          payment._server?.close(done);
        },
      });
    });
  });
});
