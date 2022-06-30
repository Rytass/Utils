/**
 * @jest-environment jsdom
 */

import request from 'supertest';
import { OrderState } from '@rytass/payments';
import { addMac } from '../__utils__/add-mac';
import { Channel, ECPayCallbackPaymentType, ECPayChannelCreditCard, ECPayChannelVirtualAccount, ECPayCommitMessage, ECPayOrder, ECPayPayment } from '@rytass/payments-adapter-ecpay';
import http, { createServer } from 'http';

describe('ECPayPayment (Virtual Account)', () => {
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

  describe('Virtual account', () => {
    const payment = new ECPayPayment<ECPayChannelVirtualAccount | ECPayChannelCreditCard>({
      serverHost: 'http://localhost:9999',
      asyncInfoPath: '/callback',
    });

    it('should throw error on invalid channel', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.CREDIT_CARD,
          // @ts-ignore: Unreachable code error
          virtualAccountExpireDays: 9,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should `virtualAccountExpireDays` between 1 and 60', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 0,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 99,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should throw if total aomunt between 11 and 49999', () => {
      expect(() => {
        payment.prepare({
          channel: Channel.VIRTUAL_ACCOUNT,
          items: [{
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          }],
        });
      }).toThrowError();

      expect(() => {
        payment.prepare({
          channel: Channel.VIRTUAL_ACCOUNT,
          items: [{
            name: 'Test',
            unitPrice: 99990,
            quantity: 1,
          }],
        });
      }).toThrowError();
    });

    it('should default virtual expire day is 3', () => {
      const order = payment.prepare({
        channel: Channel.VIRTUAL_ACCOUNT,
        items: [{
          name: 'Test',
          unitPrice: 15,
          quantity: 1,
        }],
      });

      expect(order.form.ExpireDate).toBe('3');
    });

    it('should represent virtual account config on form data', () => {
      const order = payment.prepare({
        channel: Channel.VIRTUAL_ACCOUNT,
        virtualAccountExpireDays: 7,
        items: [{
          name: 'Test',
          unitPrice: 15,
          quantity: 1,
        }],
      });

      expect(order.form.ExpireDate).toBe('7');
      expect(order.form.PaymentInfoURL).toBe('http://localhost:9999/callback');
      expect(order.form.ClientRedirectURL).toBe('');

      const clientOrder = payment.prepare({
        channel: Channel.VIRTUAL_ACCOUNT,
        virtualAccountExpireDays: 7,
        items: [{
          name: 'Test',
          unitPrice: 15,
          quantity: 1,
        }],
        clientBackUrl: 'https://rytass.com',
      });

      expect(clientOrder.form.ClientRedirectURL).toBe('https://rytass.com');
    });

    describe('Vistual Account Banks', () => {
      let testPayment: ECPayPayment<ECPayChannelCreditCard | ECPayChannelVirtualAccount>;

      const mockedOnInfoRetrieved = jest.fn<void, [ECPayOrder<ECPayCommitMessage>]>(() => { });

      beforeAll(() => new Promise<void>((resolve) => {
        testPayment = new ECPayPayment({
          withServer: true,
          onServerListen: resolve,
          onInfoRetrieved: mockedOnInfoRetrieved,
        });
      }));

      it('should reject invalid channel type', (done) => {
        const order = testPayment.prepare({
          channel: Channel.CREDIT_CARD,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_PANHSIN,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(400)
          .then((res) => {
            expect(res.text).toEqual('0|OrderNotFound');

            done();
          });
      });

      it('should default callback handler commit TAISHIN virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_PANHSIN,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
            expect(order.asyncInfo?.bankCode).toBe('806');
            expect(order.asyncInfo?.account).toBe('3453721178769211');

            expect(mockedOnInfoRetrieved.mock.calls.length).toBe(1);
            expect((mockedOnInfoRetrieved.mock.calls[0][0] as unknown as ECPayOrder<ECPayCommitMessage>).id).toBe(order.id);

            done();
          });
      });

      it('should default callback handler commit ESUN virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_LAND,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
            expect(order.asyncInfo?.bankCode).toBe('806');
            expect(order.asyncInfo?.account).toBe('3453721178769211');

            done();
          });
      });

      it('should default callback handler commit BOT virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 1000,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_BOT,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
            expect(order.asyncInfo?.bankCode).toBe('806');
            expect(order.asyncInfo?.account).toBe('3453721178769211');

            done();
          });
      });

      it('should default callback handler commit FUBON virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_FIRST,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
            expect(order.asyncInfo?.bankCode).toBe('806');
            expect(order.asyncInfo?.account).toBe('3453721178769211');

            done();
          });
      });

      it('should default callback handler commit CHINATRUST virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_CHINATRUST,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
            expect(order.asyncInfo?.bankCode).toBe('806');
            expect(order.asyncInfo?.account).toBe('3453721178769211');

            done();
          });
      });

      it('should default callback handler commit FIRST virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_FIRST,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
            expect(order.asyncInfo?.bankCode).toBe('806');
            expect(order.asyncInfo?.account).toBe('3453721178769211');

            done();
          });
      });

      it('should default callback handler commit LAND virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_LAND,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
            expect(order.asyncInfo?.bankCode).toBe('806');
            expect(order.asyncInfo?.account).toBe('3453721178769211');

            done();
          });
      });

      it('should default callback handler commit CATHAY virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_CHINATRUST,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
            expect(order.asyncInfo?.bankCode).toBe('806');
            expect(order.asyncInfo?.account).toBe('3453721178769211');

            done();
          });
      });

      it('should default callback handler commit TACHONG virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_TACHONG,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
            expect(order.asyncInfo?.bankCode).toBe('806');
            expect(order.asyncInfo?.account).toBe('3453721178769211');
            expect(order.asyncInfo?.expiredAt).toBe('2022/04/27');

            done();
          });
      });

      it('should default callback handler commit PANHSIN virtual account order', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_PANHSIN,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
            expect(order.asyncInfo?.bankCode).toBe('806');
            expect(order.asyncInfo?.account).toBe('3453721178769211');

            done();
          });
      });

      it('should reject info retrived if order not pre-commited', () => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        expect(() => order.infoRetrieved({
          bankCode: '806',
          account: '3453721178769211',
          expiredAt: '2022/04/27',
        }, ECPayCallbackPaymentType.ATM_PANHSIN)).toThrowError();
      });

      it('should default async information handler not change status when failed', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_PANHSIN,
          RtnCode: '44444',
          RtnMsg: 'Get VirtualAccount Failed',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.FAILED);
            expect(order.failedMessage?.code).toBe(44444)
            expect(order.failedMessage?.message).toBe('Get VirtualAccount Failed');
            expect(order.asyncInfo).toBeUndefined();

            done();
          });
      });

      it('should received callback of virtual account payments', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_PANHSIN,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Succeeded',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
            expect(order.asyncInfo?.bankCode).toBe('806');
            expect(order.asyncInfo?.account).toBe('3453721178769211');

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
              ATMAccBank: '987',
              PaymentType: ECPayCallbackPaymentType.ATM_PANHSIN,
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
              ATMAccNo: '1111111111',
              ExecTimes: '',
              CustomField3: '',
              staed: '',
              WebATMBankName: '',
              AlipayID: '',
            });

            request(testPayment._server)
              .post('/payments/ecpay/callback')
              .send(new URLSearchParams(callbackResponse).toString())
              .expect('Content-Type', 'text/plain')
              .expect(200)
              .then((res) => {
                expect(res.text).toEqual('1|OK');
                expect(order.state).toBe(OrderState.COMMITTED);
                expect(order.additionalInfo?.buyerAccountNumber).toBe('1111111111');
                expect(order.additionalInfo?.buyerBankCode).toBe('987');

                done();
              });
          });
      });

      it('should async information duplicate received be ignored', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_PANHSIN,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Success',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');
            expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);

            const successfulResponse2 = addMac({
              BankCode: '806',
              ExpireDate: '2022/04/27',
              MerchantID: '2000132',
              MerchantTradeNo: order.id,
              PaymentType: ECPayCallbackPaymentType.ATM_PANHSIN,
              RtnCode: '2',
              RtnMsg: 'Get VirtualAccount Success',
              TradeAmt: order.totalPrice.toString(),
              TradeDate: '2022/04/20 17:30:52',
              TradeNo: '2204201729498436',
              vAccount: '3453721178769212',
              StoreID: '',
              CustomField1: '',
              CustomField2: '',
              CustomField3: '',
              CustomField4: '',
            });

            request(testPayment._server)
              .post('/payments/ecpay/async-informations')
              .send(new URLSearchParams(successfulResponse2).toString())
              .expect('Content-Type', 'text/plain')
              .expect(200)
              .then((res) => {
                expect(res.text).toEqual('1|OK');
                expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
                expect(order.asyncInfo?.account).toBe('3453721178769211');

                done();
              });
          });
      });

      it('should reject if virtual account bank not matched', (done) => {
        const order = testPayment.prepare<ECPayChannelVirtualAccount>({
          channel: Channel.VIRTUAL_ACCOUNT,
          virtualAccountExpireDays: 7,
          items: [{
            name: 'Test',
            unitPrice: 15,
            quantity: 1,
          }],
        });

        // Get HTML to trigger pre commit
        // eslint-disable-next-line no-unused-vars
        const html = order.formHTML;

        const successfulResponse = addMac({
          BankCode: '806',
          ExpireDate: '2022/04/27',
          MerchantID: '2000132',
          MerchantTradeNo: order.id,
          PaymentType: ECPayCallbackPaymentType.ATM_PANHSIN,
          RtnCode: '2',
          RtnMsg: 'Get VirtualAccount Success',
          TradeAmt: order.totalPrice.toString(),
          TradeDate: '2022/04/20 17:30:52',
          TradeNo: '2204201729498436',
          vAccount: '3453721178769211',
          StoreID: '',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
        });

        request(testPayment._server)
          .post('/payments/ecpay/async-informations')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
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
              ATMAccBank: '987',
              PaymentType: ECPayCallbackPaymentType.ATM_BOT,
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
              ATMAccNo: '1111111111',
              ExecTimes: '',
              CustomField3: '',
              staed: '',
              WebATMBankName: '',
              AlipayID: '',
            });

            request(testPayment._server)
              .post('/payments/ecpay/callback')
              .send(new URLSearchParams(callbackResponse).toString())
              .expect('Content-Type', 'text/plain')
              .expect(400)
              .then((res) => {
                expect(res.text).toEqual('0|OrderNotFound');
                expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
                expect(order.asyncInfo?.account).toBe('3453721178769211');
                expect(order.paymentType).toBe(ECPayCallbackPaymentType.ATM_PANHSIN);

                done();
              });
          });
      });

      afterAll(() => new Promise((resolve) => {
        testPayment._server?.close(resolve);
      }));
    });
  });
});
