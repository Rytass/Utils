/**
 * @jest-environment node
 */

import { CreditCardECI, OrderState } from '@rytass/payments';
import {
  NewebPaymentChannel,
  NewebPayVirtualAccountBank,
  NewebPayPayment,
  NewebPayWebATMBank,
  NewebPayWebATMCommitMessage,
  NewebPayAdditionInfoCreditCard,
  NewebPayCreditCardCommitMessage,
  NewebPayVirtualAccountCommitMessage,
} from '../src';
import {
  NewebPayAPIResponseWrapper,
  NewebPayCreditCardSpeedCheckoutMode,
  NewebPayInfoRetrieveEncryptedPayload,
  NewebPayNotifyEncryptedPayload,
} from '../src/typings';
import request from 'supertest';
import { DateTime } from 'luxon';
import http, { createServer } from 'http';
import { createCipheriv, createHash } from 'crypto';
import { App } from 'supertest/types';

const MERCHANT_ID = 'MS154366906';
const AES_KEY = 'X4vM1RymaxkyzZ9mZHNE67Kba2gpv40c';
const AES_IV = '6ma4zu0UFWk54oyX';

describe('NewebPay Payment Server', () => {
  const originCreateServer = createServer;
  const mockedCreateServer = jest.spyOn(http, 'createServer');

  mockedCreateServer.mockImplementation(requestHandler => {
    const mockServer = originCreateServer(requestHandler);

    const mockedListen = jest.spyOn(mockServer, 'listen');

    mockedListen.mockImplementationOnce((_port?: any, _hostname?: any, listeningListener?: () => void) => {
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

  describe('Default server listener', () => {
    it('should server received committed credit card callback', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        callbackPath: '/newebpay/callback',
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: NewebPaymentChannel.CREDIT,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
          });

          order.form;

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'CREDIT',
                RespondType: 'JSON',
                PayTime: '2023-02-02 14:38:50',
                IP: '127.0.0.1',
                EscrowBank: 'HNCB',
                RespondCode: '00',
                Auth: '928502',
                Card6No: '123456',
                Card4No: '0987',
                AuthBank: 'KGI',
                TokenUseStatus: NewebPayCreditCardSpeedCheckoutMode.NONE,
                ECI: CreditCardECI.MASTER_3D,
                PaymentMethod: 'CREDIT',
                ChannelID: 'CREDIT',
              },
            } as NewebPayAPIResponseWrapper<NewebPayNotifyEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/callback')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.COMMITTED);
          expect(order.committedAt?.getTime()).toBe(
            DateTime.fromFormat('2023-02-02 14:38:50', 'yyyy-MM-dd HH:mm:ss').toMillis(),
          );

          payment._server?.close(done);
        },
      });
    });

    it('should onCommit called after order commit', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        callbackPath: '/newebpay/callback',
        onCommit: async order => {
          expect(order.id).toBe('123456789');

          payment._server?.close(done);
        },
        onServerListen: async () => {
          const order = await payment.prepare({
            id: '123456789',
            channel: NewebPaymentChannel.CREDIT,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
          });

          order.form;

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'CREDIT',
                RespondType: 'JSON',
                PayTime: '2023-02-02 14:38:50',
                IP: '127.0.0.1',
                EscrowBank: 'HNCB',
                RespondCode: '00',
                Auth: '928502',
                Card6No: '123456',
                Card4No: '0987',
                AuthBank: 'KGI',
                TokenUseStatus: NewebPayCreditCardSpeedCheckoutMode.NONE,
                ECI: CreditCardECI.MASTER_3D,
                PaymentMethod: 'CREDIT',
                ChannelID: 'CREDIT',
              },
            } as NewebPayAPIResponseWrapper<NewebPayNotifyEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/callback')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.COMMITTED);
        },
      });
    });

    it('should server received committed installments credit card callback', done => {
      const payment = new NewebPayPayment<NewebPayCreditCardCommitMessage>({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        callbackPath: '/newebpay/callback',
        onServerListen: async () => {
          const order = await payment.prepare<NewebPayCreditCardCommitMessage>({
            channel: NewebPaymentChannel.CREDIT,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
          });

          order.form;

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'CREDIT',
                RespondType: 'JSON',
                PayTime: '2023-02-02 14:38:50',
                IP: '127.0.0.1',
                EscrowBank: 'HNCB',
                RespondCode: '00',
                Auth: '928502',
                Card6No: '123456',
                Card4No: '0987',
                AuthBank: 'KGI',
                TokenUseStatus: NewebPayCreditCardSpeedCheckoutMode.NONE,
                ECI: CreditCardECI.MASTER_3D,
                PaymentMethod: 'CREDIT',
                ChannelID: 'CREDIT',
                Inst: 3,
                InstFirst: 34,
                InstEach: 33,
              },
            } as NewebPayAPIResponseWrapper<NewebPayNotifyEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/callback')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.COMMITTED);
          expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).installments?.count).toBe(3);
          expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).installments?.firstAmount).toBe(34);
          expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).installments?.eachAmount).toBe(33);

          payment._server?.close(done);
        },
      });
    });

    it('should server received committed dcc credit card callback', done => {
      const payment = new NewebPayPayment<NewebPayCreditCardCommitMessage>({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        callbackPath: '/newebpay/callback',
        onServerListen: async () => {
          const order = await payment.prepare<NewebPayCreditCardCommitMessage>({
            channel: NewebPaymentChannel.CREDIT,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
          });

          order.form;

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'CREDIT',
                RespondType: 'JSON',
                PayTime: '2023-02-02 14:38:50',
                IP: '127.0.0.1',
                EscrowBank: 'HNCB',
                RespondCode: '00',
                Auth: '928502',
                Card6No: '123456',
                Card4No: '0987',
                AuthBank: 'KGI',
                TokenUseStatus: NewebPayCreditCardSpeedCheckoutMode.NONE,
                ECI: CreditCardECI.MASTER_3D,
                PaymentMethod: 'CREDIT',
                ChannelID: 'CREDIT',
                DCC_Amt: 100,
                DCC_Rate: 0.3,
                DCC_Markup: 2,
                DCC_Currency: 'TWD',
                DCC_Currency_Code: 12,
              },
            } as NewebPayAPIResponseWrapper<NewebPayNotifyEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/callback')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.COMMITTED);
          expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).dcc?.amount).toBe(100);
          expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).dcc?.rate).toBe(0.3);
          expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).dcc?.markup).toBe(2);
          expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).dcc?.currency).toBe('TWD');
          expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).dcc?.currencyCode).toBe(12);

          payment._server?.close(done);
        },
      });
    });

    it('should server received committed webatm callback', done => {
      const payment = new NewebPayPayment<NewebPayWebATMCommitMessage>({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        callbackPath: '/newebpay/callback',
        onServerListen: async () => {
          const order = await payment.prepare<NewebPayWebATMCommitMessage>({
            channel: NewebPaymentChannel.WEBATM,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
            bankTypes: [NewebPayWebATMBank.BANK_OF_TAIWAN],
          });

          order.form;

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'WEBATM',
                RespondType: 'JSON',
                PayTime: '2023-02-02 14:38:50',
                IP: '127.0.0.1',
                EscrowBank: 'HNCB',
                PayBankCode: '012',
                PayerAccount5Code: '51938',
              },
            } as NewebPayAPIResponseWrapper<NewebPayNotifyEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/callback')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.COMMITTED);
          expect(order.channel).toBe(NewebPaymentChannel.WEBATM);
          expect(order.additionalInfo?.buyerBankCode).toBe('012');
          expect(order.additionalInfo?.buyerAccountNumber).toBe('51938');

          payment._server?.close(done);
        },
      });
    });

    it('should server received committed virtual account callback', done => {
      const payment = new NewebPayPayment<NewebPayVirtualAccountCommitMessage>({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        callbackPath: '/newebpay/callback',
        onServerListen: async () => {
          const order = await payment.prepare<NewebPayVirtualAccountCommitMessage>({
            channel: NewebPaymentChannel.VACC,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
            bankTypes: [NewebPayVirtualAccountBank.BANK_OF_TAIWAN],
          });

          order.form;

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'VACC',
                RespondType: 'JSON',
                PayTime: '2023-02-02 14:38:50',
                IP: '127.0.0.1',
                EscrowBank: 'HNCB',
                PayBankCode: '012',
                PayerAccount5Code: '51938',
              },
            } as NewebPayAPIResponseWrapper<NewebPayNotifyEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/callback')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.COMMITTED);
          expect(order.channel).toBe(NewebPaymentChannel.VACC);
          expect(order.additionalInfo?.buyerBankCode).toBe('012');
          expect(order.additionalInfo?.buyerAccountNumber).toBe('51938');

          payment._server?.close(done);
        },
      });
    });

    it('should server ignore received committed callback if order not pre-commit', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        callbackPath: '/newebpay/callback',
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: NewebPaymentChannel.CREDIT,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
          });

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'CREDIT',
                RespondType: 'JSON',
                PayTime: '2023-02-02 14:38:50',
                IP: '127.0.0.1',
                EscrowBank: 'HNCB',
                RespondCode: '00',
                Auth: '928502',
                Card6No: '123456',
                Card4No: '0987',
                AuthBank: 'KGI',
                TokenUseStatus: NewebPayCreditCardSpeedCheckoutMode.NONE,
                ECI: CreditCardECI.MASTER_3D,
                PaymentMethod: 'CREDIT',
                ChannelID: 'CREDIT',
              },
            } as NewebPayAPIResponseWrapper<NewebPayNotifyEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/callback')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.INITED);

          payment._server?.close(done);
        },
      });
    });

    it('should commit callback return 404 on order not found', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        callbackPath: '/newebpay/callback',
        onServerListen: async () => {
          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: 'notexistedid',
                PaymentType: 'CREDIT',
                RespondType: 'JSON',
                PayTime: '2023-02-02 14:38:50',
                IP: '127.0.0.1',
                EscrowBank: 'HNCB',
                RespondCode: '00',
                Auth: '928502',
                Card6No: '123456',
                Card4No: '0987',
                AuthBank: 'KGI',
                TokenUseStatus: NewebPayCreditCardSpeedCheckoutMode.NONE,
                ECI: CreditCardECI.MASTER_3D,
                PaymentMethod: 'CREDIT',
                ChannelID: 'CREDIT',
              },
            } as NewebPayAPIResponseWrapper<NewebPayNotifyEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/callback')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(404);

          payment._server?.close(done);
        },
      });
    });

    it('should server received async information callback', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        asyncInfoPath: '/newebpay/async-informations',
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: NewebPaymentChannel.VACC,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
          });

          order.form;

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'VACC',
                ExpireDate: '2023-02-05',
                ExpireTime: '15:23:43',
                BankCode: '012',
                CodeNo: '686168251938',
              },
            } as NewebPayAPIResponseWrapper<NewebPayInfoRetrieveEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/async-informations')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
          expect(order.asyncInfo?.bankCode).toBe('012');
          expect(order.asyncInfo?.account).toBe('686168251938');
          expect(order.asyncInfo?.expiredAt.getTime()).toBe(
            DateTime.fromFormat('2023-02-05 15:23:43', 'yyyy-MM-dd HH:mm:ss').toJSDate().getTime(),
          );

          payment._server?.close(done);
        },
      });
    });

    it('should server ignore received async information callback if order not pre-commit', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        asyncInfoPath: '/newebpay/async-informations',
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: NewebPaymentChannel.VACC,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
          });

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'VACC',
                ExpireDate: '2023-02-05',
                ExpireTime: '15:23:43',
                BankCode: '012',
                CodeNo: '686168251938',
              },
            } as NewebPayAPIResponseWrapper<NewebPayInfoRetrieveEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/async-informations')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.INITED);

          payment._server?.close(done);
        },
      });
    });

    it('should async information callback return 404 on order not found', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        asyncInfoPath: '/newebpay/async-informations',
        onServerListen: async () => {
          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: 'notfoundid',
                PaymentType: 'VACC',
                ExpireDate: '2023-02-05',
                ExpireTime: '15:23:43',
                BankCode: '012',
                CodeNo: '686168251938',
              },
            } as NewebPayAPIResponseWrapper<NewebPayInfoRetrieveEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/async-informations')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(404);

          payment._server?.close(done);
        },
      });
    });

    it('should serve checkout order route', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        checkoutPath: '/newebpay/checkout',
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: NewebPaymentChannel.CREDIT,
            items: [
              {
                name: 'Test Item',
                unitPrice: 100,
                quantity: 2,
              },
            ],
          });

          const response = await request(payment._server as App)
            .get(`/newebpay/checkout/${order.id}`)
            .expect('Content-Type', 'text/html; charset=utf-8')
            .expect(200);

          expect(response.text).toBe(order.formHTML);

          payment._server?.close(done);
        },
      });
    });

    it('shuold return 404 on no implemented route', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        checkoutPath: '/newebpay/checkout',
        callbackPath: '/newebpay/callback',
        asyncInfoPath: '/newebpay/async-informations',
        onServerListen: async () => {
          await request(payment._server as App)
            .post('/notexist')
            .expect(404);

          await request(payment._server as App)
            .get('/newebpay/checkout/1')
            .expect(404);

          payment._server?.close(done);
        },
      });
    });

    it('should throw error on callback hash not valid', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        callbackPath: '/newebpay/callback',
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: NewebPaymentChannel.CREDIT,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
          });

          order.form;

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'CREDIT',
                RespondType: 'JSON',
                PayTime: '2023-02-02 14:38:50',
                IP: '127.0.0.1',
                EscrowBank: 'HNCB',
                RespondCode: '00',
                Auth: '928502',
                Card6No: '123456',
                Card4No: '0987',
                AuthBank: 'KGI',
                TokenUseStatus: NewebPayCreditCardSpeedCheckoutMode.NONE,
                ECI: CreditCardECI.MASTER_3D,
                PaymentMethod: 'CREDIT',
                ChannelID: 'CREDIT',
              },
            } as NewebPayAPIResponseWrapper<NewebPayNotifyEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          const response = await request(payment._server as App)
            .post('/newebpay/callback')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`1HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(400);

          expect(response.text).toBe('Checksum Invalid');

          payment._server?.close(done);
        },
      });
    });

    it('should throw error on async information hash not valid', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        asyncInfoPath: '/newebpay/async-informations',
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: NewebPaymentChannel.VACC,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
          });

          order.form;

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'SUCCESS',
              Message: '',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'VACC',
                ExpireDate: '2023-02-05',
                ExpireTime: '15:23:43',
                BankCode: '012',
                CodeNo: '686168251938',
              },
            } as NewebPayAPIResponseWrapper<NewebPayInfoRetrieveEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          const response = await request(payment._server as App)
            .post('/newebpay/async-informations')
            .send(
              new URLSearchParams({
                Status: 'SUCCESS',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`H1ashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(400);

          expect(response.text).toBe('Checksum Invalid');

          payment._server?.close(done);
        },
      });
    });

    it('should handling fail callback', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        callbackPath: '/newebpay/callback',
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: NewebPaymentChannel.CREDIT,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
          });

          order.form;

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'FAIL',
              Message: '失敗',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'CREDIT',
                RespondType: 'JSON',
                PayTime: '2023-02-02 14:38:50',
                IP: '127.0.0.1',
                EscrowBank: 'HNCB',
                RespondCode: '00',
                Auth: '928502',
                Card6No: '123456',
                Card4No: '0987',
                AuthBank: 'KGI',
                TokenUseStatus: NewebPayCreditCardSpeedCheckoutMode.NONE,
                ECI: CreditCardECI.MASTER_3D,
                PaymentMethod: 'CREDIT',
                ChannelID: 'CREDIT',
              },
            } as NewebPayAPIResponseWrapper<NewebPayNotifyEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/callback')
            .send(
              new URLSearchParams({
                Status: 'FAIL',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.FAILED);
          expect(order.failedMessage?.code).toBe('FAIL');
          expect(order.failedMessage?.message).toBe('失敗');

          payment._server?.close(done);
        },
      });
    });

    it('should handling fail async information callback', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        asyncInfoPath: '/newebpay/async-informations',
        onServerListen: async () => {
          const order = await payment.prepare({
            channel: NewebPaymentChannel.VACC,
            items: [
              {
                name: '湯麵',
                unitPrice: 50,
                quantity: 2,
              },
            ],
          });

          order.form;

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'FAIL',
              Message: '失敗',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: order.id,
                PaymentType: 'VACC',
                ExpireDate: '2023-02-05',
                ExpireTime: '15:23:43',
                BankCode: '012',
                CodeNo: '686168251938',
              },
            } as NewebPayAPIResponseWrapper<NewebPayInfoRetrieveEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/async-informations')
            .send(
              new URLSearchParams({
                Status: 'FAIL',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.FAILED);
          expect(order.failedMessage?.code).toBe('FAIL');
          expect(order.failedMessage?.message).toBe('失敗');

          payment._server?.close(done);
        },
      });
    });

    it('should handling invalid order fail callback', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        callbackPath: '/newebpay/callback',
        onServerListen: async () => {
          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'FAIL',
              Message: '失敗',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: '123123123123',
                PaymentType: 'CREDIT',
                RespondType: 'JSON',
                PayTime: '2023-02-02 14:38:50',
                IP: '127.0.0.1',
                EscrowBank: 'HNCB',
                RespondCode: '00',
                Auth: '928502',
                Card6No: '123456',
                Card4No: '0987',
                AuthBank: 'KGI',
                TokenUseStatus: NewebPayCreditCardSpeedCheckoutMode.NONE,
                ECI: CreditCardECI.MASTER_3D,
                PaymentMethod: 'CREDIT',
                ChannelID: 'CREDIT',
              },
            } as NewebPayAPIResponseWrapper<NewebPayNotifyEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/callback')
            .send(
              new URLSearchParams({
                Status: 'FAIL',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(400);

          payment._server?.close(done);
        },
      });
    });

    it('should handling invalid order fail async information callback', done => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        asyncInfoPath: '/newebpay/async-informations',
        onServerListen: async () => {
          const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

          const encryptedResponse = `${cipher.update(
            JSON.stringify({
              Status: 'FAIL',
              Message: '失敗',
              Result: {
                MerchantID: MERCHANT_ID,
                Amt: 100,
                TradeNo: '2098290G803',
                MerchantOrderNo: '123123',
                PaymentType: 'VACC',
                ExpireDate: '2023-02-05',
                ExpireTime: '15:23:43',
                BankCode: '012',
                CodeNo: '686168251938',
              },
            } as NewebPayAPIResponseWrapper<NewebPayInfoRetrieveEncryptedPayload>),
            'utf8',
            'hex',
          )}${cipher.final('hex')}`;

          await request(payment._server as App)
            .post('/newebpay/async-informations')
            .send(
              new URLSearchParams({
                Status: 'FAIL',
                MerchantID: MERCHANT_ID,
                Version: '2.0',
                TradeInfo: encryptedResponse,
                TradeSha: createHash('sha256')
                  .update(`HashKey=${AES_KEY}&${encryptedResponse}&HashIV=${AES_IV}`)
                  .digest('hex')
                  .toUpperCase(),
              }).toString(),
            )
            .expect(400);

          payment._server?.close(done);
        },
      });
    });
  });
});
