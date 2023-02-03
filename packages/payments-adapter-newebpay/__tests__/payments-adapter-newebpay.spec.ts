/* eslint-disable no-control-regex */
/**
 * @jest-environment node
 */

import ngrok from 'ngrok';
import axios from 'axios';
import { OrderState } from '@rytass/payments';
import { createHash, createDecipheriv, randomBytes } from 'crypto';
import { NewebPayCreditCardBalanceStatus, NewebPayMPGMakeOrderPayload, NewebPaymentChannel, NewebPayOrder, NewebPayPayment, NewebPayOrderStatusFromAPI, NewebPayWebATMCommitMessage, NewebPayAdditionInfoCreditCard, NewebPayCreditCardCommitMessage } from '../src';

const MERCHANT_ID = 'MS154366906';
const AES_KEY = 'X4vM1RymaxkyzZ9mZHNE67Kba2gpv40c';
const AES_IV = '6ma4zu0UFWk54oyX';

describe('NewebPay Payments', () => {
  describe('Property', () => {
    it('should checkActionUrl property return gateway url', () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        baseUrl: 'https://rytass.com',
      });

      expect(payment.checkoutActionUrl).toBe('https://rytass.com/MPG/mpg_gateway');
    });
  });

  describe('With Ngrok Server', () => {
    const mockConnect = jest.spyOn(ngrok, 'connect');

    it('should start ngrok to proxy built-in server', (done) => {
      mockConnect.mockImplementation(async () => {
        return 'http://127.0.0.1';
      });

      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: 'ngrok',
        serverHost: 'http://0.0.0.0',
        onServerListen: async () => {
          expect(mockConnect).toBeCalledWith(3000);

          await payment._server?.close();

          done();
        },
      });
    });

    it('should start ngrok with custom port server listen', (done) => {
      mockConnect.mockImplementation(async () => {
        return 'http://127.0.0.1';
      });

      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: 'ngrok',
        serverHost: 'http://0.0.0.0:3005',
        onServerListen: async () => {
          expect(mockConnect).toBeCalledWith(3005);

          await payment._server?.close();

          done();
        },
      });
    });

    it('should ngrok connect failed not effect built-in server', (done) => {
      mockConnect.mockImplementation(async () => {
        throw new Error('Error');
      });

      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: 'ngrok',
        serverHost: 'http://0.0.0.0:3005',
        onServerListen: async () => {
          expect(mockConnect).toBeCalled();

          await payment._server?.close();

          done();
        },
      });
    });

    afterEach(async () => {
      await mockConnect.mockReset();
    });
  });

  describe('Prepare Order', () => {
    const payment = new NewebPayPayment({
      merchantId: MERCHANT_ID,
      aesKey: AES_KEY,
      aesIv: AES_IV,
    });

    it('should checkout url represent `serverHost` and `checkoutPath`', () => {
      const payment2 = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://rytass.com',
        checkoutPath: '/best/team/in/taiwan',
      });

      expect(payment2.getCheckoutUrl(new NewebPayOrder({
        gateway: payment2,
        id: 'Yap',
        items: [{
          name: '鉛筆',
          unitPrice: 10,
          quantity: 1,
        }],
        makePayload: {} as NewebPayMPGMakeOrderPayload,
      }))).toBe('https://rytass.com/best/team/in/taiwan/Yap');
    });

    it('should prepare order get encrypted payload', async () => {
      const order = payment.prepare({
        channel: NewebPaymentChannel.CREDIT,
        items: [{
          name: '鉛筆',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      expect(order).toHaveProperty('id');
      expect(order.state).toBe(OrderState.INITED);
      expect(order.items.length).toBe(1);
      expect(order.items[0].name).toBe('鉛筆');
      expect(order.items[0].unitPrice).toBe(10);
      expect(order.items[0].quantity).toBe(1);

      expect(order.form.MerchantID).toBe(MERCHANT_ID);
      expect(order.form.EncryptType).toBe(0);
      expect(order.form.Version).toBe('2.0');

      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      const plainInfo = `${decipher.update(order.form.TradeInfo, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(/\x1E/g, '').replace(/\x14/g, '');
      const payload = new URLSearchParams(plainInfo);

      expect(Number(payload.get('Amt'))).toBe(order.totalPrice);
      expect(payload.get('MerchantOrderNo')).toBe(order.id);
      expect(payload.get('ItemDesc')).toBe('鉛筆');
      expect(order.form.TradeSha).toBe(createHash('sha256').update(`HashKey=${AES_KEY}&${order.form.TradeInfo}&HashIV=${AES_IV}`).digest('hex').toUpperCase());
    });

    it('should prepare order represent other pay channels', () => {
      const order = payment.prepare({
        channel: NewebPaymentChannel.ANDROID_PAY | NewebPaymentChannel.SAMSUNG_PAY | NewebPaymentChannel.UNION_PAY | NewebPaymentChannel.WEBATM | NewebPaymentChannel.VACC,
        items: [{
          name: '鉛筆',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      const plainInfo = `${decipher.update(order.form.TradeInfo, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(/\x1E/g, '').replace(/\x14/g, '');
      const payload = new URLSearchParams(plainInfo);

      expect(payload.get('CREDIT')).toBe('0');
      expect(payload.get('ANDROIDPAY')).toBe('1');
      expect(payload.get('SAMSUNGPAY')).toBe('1');
      expect(payload.get('UNIONPAY')).toBe('1');
      expect(payload.get('WEBATM')).toBe('1');
      expect(payload.get('VACC')).toBe('1');
    });

    it('should throw error on trade limit not valid', () => {
      expect(() => payment.prepare({
        channel: NewebPaymentChannel.CREDIT,
        items: [{
          name: '鉛筆',
          unitPrice: 10,
          quantity: 1,
        }],
        tradeLimit: 20,
      })).toThrowError('`tradeLimit` should between 60 and 900 (seconds)');

      expect(() => payment.prepare({
        channel: NewebPaymentChannel.CREDIT,
        items: [{
          name: '鉛筆',
          unitPrice: 10,
          quantity: 1,
        }],
        tradeLimit: 2000,
      })).toThrowError('`tradeLimit` should between 60 and 900 (seconds)');
    });

    it('should throw error on invalid expire date', () => {
      expect(() => payment.prepare({
        channel: NewebPaymentChannel.CREDIT,
        items: [{
          name: '鉛筆',
          unitPrice: 10,
          quantity: 1,
        }],
        expireDate: '2023-01-31',
      })).toThrowError('`expireDate` should be in format of `YYYYMMDD`');
    });

    it('should throw error before server ready prepare', (done) => {
      const paymentServer = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        withServer: true,
        onServerListen: async () => {
          await paymentServer._server!.close();

          done();
        },
      });

      expect(() => paymentServer.prepare({
        channel: NewebPaymentChannel.CREDIT,
        items: [{
          name: '鉛筆',
          unitPrice: 10,
          quantity: 1,
        }],
      })).toThrowError('Please waiting gateway ready');
    });
  });

  describe('Query', () => {
    const payment = new NewebPayPayment({
      merchantId: MERCHANT_ID,
      aesKey: AES_KEY,
      aesIv: AES_IV,
    });

    const mockPost = jest.spyOn(axios, 'post');

    it('should throw error on check code invalid', () => {
      mockPost.mockImplementationOnce(async (url: string, data: any) => {
        expect(url).toMatch(/\/API\/QueryTradeInfo/);

        const payload = new URLSearchParams(data);

        const amt = payload.get('Amt');
        const merchantId = payload.get('MerchantID');
        const merchantOrderNo = payload.get('MerchantOrderNo');

        const checkValue = createHash('sha256').update(`IV=${AES_IV}&Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}&Key=${AES_KEY}`).digest('hex').toUpperCase();

        expect(payload.get('CheckValue')).toBe(checkValue);

        return {
          data: {
            Status: 'SUCCESS',
            Message: '',
            Result: {
              MerchantID: payload.get('MerchantID'),
              Amt: payload.get('Amt'),
              TradeNo: 'MS197067234',
              MerchantOrderNo: payload.get('MerchantOrderNo'),
              TradeStatus: NewebPayOrderStatusFromAPI.COMMITTED,
              PaymentType: 'CREDIT',
              CreateTime: '2023-02-01 21:54:47',
              PayTime: '2023-02-01 21:54:58',
              CheckCode: createHash('sha256').update(`1HashIV=${AES_IV}&Amt=${amt}&MerchantID=${MERCHANT_ID}&MerchantOrderNo=${merchantOrderNo}&TradeNo=MS197067234&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
              FundTime: '2023-02-25',
              RespondCode: '00',
              Auth: '123456',
              ECI: '2',
              CloseAmt: payload.get('Amt'),
              CloseStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              BackBalance: payload.get('Amt'),
              BackStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              RespondMsg: '',
              Inst: '0',
              InstFirst: '',
              InstEach: '',
              PaymentMethod: 'CREDIT',
              Card6No: '000000',
              Card4No: '8888',
              AuthBank: 'KGI',
            },
          },
        };
      });

      expect(() => payment.query(randomBytes(10).toString('hex'), 200)).rejects.toThrowError('CheckCode is not valid');
    });

    it('should send Composite on gateway is merchantId start with MS5', () => {
      const payment2 = new NewebPayPayment({
        merchantId: 'MS54366906',
        aesKey: AES_KEY,
        aesIv: AES_IV,
      });

      mockPost.mockImplementationOnce(async (url: string, data: any) => {
        expect(url).toMatch(/\/API\/QueryTradeInfo/);

        const payload = new URLSearchParams(data);

        const amt = payload.get('Amt');
        const merchantId = payload.get('MerchantID');
        const merchantOrderNo = payload.get('MerchantOrderNo');

        const checkValue = createHash('sha256').update(`IV=${AES_IV}&Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}&Key=${AES_KEY}`).digest('hex').toUpperCase();

        expect(payload.get('CheckValue')).toBe(checkValue);
        expect(payload.get('Gateway')).toBe('Composite');

        return {
          data: {
            Status: 'SUCCESS',
            Message: '',
            Result: {
              MerchantID: payload.get('MerchantID'),
              Amt: payload.get('Amt'),
              TradeNo: 'MS197067234',
              MerchantOrderNo: payload.get('MerchantOrderNo'),
              TradeStatus: NewebPayOrderStatusFromAPI.COMMITTED,
              PaymentType: 'CREDIT',
              CreateTime: '2023-02-01 21:54:47',
              PayTime: '2023-02-01 21:54:58',
              CheckCode: createHash('sha256').update(`1HashIV=${AES_IV}&Amt=${amt}&MerchantID=${MERCHANT_ID}&MerchantOrderNo=${merchantOrderNo}&TradeNo=MS197067234&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
              FundTime: '2023-02-25',
              RespondCode: '00',
              Auth: '123456',
              ECI: '2',
              CloseAmt: payload.get('Amt'),
              CloseStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              BackBalance: payload.get('Amt'),
              BackStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              RespondMsg: '',
              Inst: '0',
              InstFirst: '',
              InstEach: '',
              PaymentMethod: 'CREDIT',
              Card6No: '000000',
              Card4No: '8888',
              AuthBank: 'KGI',
            },
          },
        };
      });

      expect(() => payment2.query(randomBytes(10).toString('hex'), 200)).rejects.toThrowError('CheckCode is not valid');
    });

    it('should query order info from NewebPay server', async () => {
      mockPost.mockImplementationOnce(async (url: string, data: any) => {
        expect(url).toMatch(/\/API\/QueryTradeInfo/);

        const payload = new URLSearchParams(data);

        const amt = payload.get('Amt');
        const merchantId = payload.get('MerchantID');
        const merchantOrderNo = payload.get('MerchantOrderNo');

        const checkValue = createHash('sha256').update(`IV=${AES_IV}&Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}&Key=${AES_KEY}`).digest('hex').toUpperCase();

        expect(payload.get('CheckValue')).toBe(checkValue);

        return {
          data: {
            Status: 'SUCCESS',
            Message: '',
            Result: {
              MerchantID: payload.get('MerchantID'),
              Amt: payload.get('Amt'),
              TradeNo: 'MS197067234',
              MerchantOrderNo: payload.get('MerchantOrderNo'),
              TradeStatus: NewebPayOrderStatusFromAPI.COMMITTED,
              PaymentType: 'CREDIT',
              CreateTime: '2023-02-01 21:54:47',
              PayTime: '2023-02-01 21:54:58',
              CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&Amt=${amt}&MerchantID=${MERCHANT_ID}&MerchantOrderNo=${merchantOrderNo}&TradeNo=MS197067234&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
              FundTime: '2023-02-25',
              RespondCode: '00',
              Auth: '123456',
              ECI: '2',
              CloseAmt: payload.get('Amt'),
              CloseStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              BackBalance: payload.get('Amt'),
              BackStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              RespondMsg: '',
              Inst: '',
              InstFirst: '',
              InstEach: '',
              PaymentMethod: 'CREDIT',
              Card6No: '000000',
              Card4No: '8888',
              AuthBank: 'KGI',
            },
          },
        };
      });

      const id = randomBytes(10).toString('hex');
      const order = await payment.query<NewebPayOrder<NewebPayCreditCardCommitMessage>>(id, 200);

      expect(order.totalPrice).toBe(200);
      expect(order.id).toBe(id);
      expect(order.items.length).toBe(1);
      expect(order.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)).toBe(200);
      expect(order.additionalInfo?.card4Number).toBe('8888');
      expect(order.additionalInfo?.card6Number).toBe('000000');
      expect(order.channel).toBe(NewebPaymentChannel.CREDIT);
      expect(mockPost).toBeCalledTimes(1);
    });

    it('should query refunded order info from NewebPay server', async () => {
      mockPost.mockImplementationOnce(async (url: string, data: any) => {
        expect(url).toMatch(/\/API\/QueryTradeInfo/);

        const payload = new URLSearchParams(data);

        const amt = payload.get('Amt');
        const merchantId = payload.get('MerchantID');
        const merchantOrderNo = payload.get('MerchantOrderNo');

        const checkValue = createHash('sha256').update(`IV=${AES_IV}&Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}&Key=${AES_KEY}`).digest('hex').toUpperCase();

        expect(payload.get('CheckValue')).toBe(checkValue);
        expect(payload.get('Gateway')).toBe('');

        return {
          data: {
            Status: 'SUCCESS',
            Message: '',
            Result: {
              MerchantID: payload.get('MerchantID'),
              Amt: payload.get('Amt'),
              TradeNo: 'MS197067234',
              MerchantOrderNo: payload.get('MerchantOrderNo'),
              TradeStatus: NewebPayOrderStatusFromAPI.REFUNDED,
              PaymentType: 'ANDROIDPAY',
              CreateTime: '2023-02-01 21:54:47',
              PayTime: '2023-02-01 21:54:58',
              CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&Amt=${amt}&MerchantID=${MERCHANT_ID}&MerchantOrderNo=${merchantOrderNo}&TradeNo=MS197067234&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
              FundTime: '2023-02-25',
              RespondCode: '00',
              Auth: '123456',
              ECI: '2',
              CloseAmt: payload.get('Amt'),
              CloseStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              BackBalance: '0',
              BackStatus: NewebPayCreditCardBalanceStatus.SETTLED,
              RespondMsg: '',
              Inst: '',
              InstFirst: '',
              InstEach: '',
              PaymentMethod: 'CREDIT',
              Card6No: '000000',
              Card4No: '8888',
              AuthBank: 'KGI',
            },
          },
        };
      });

      const id = randomBytes(10).toString('hex');
      const order = await payment.query<NewebPayOrder<NewebPayCreditCardCommitMessage>>(id, 200);

      expect(order.totalPrice).toBe(200);
      expect(order.id).toBe(id);
      expect(order.state).toBe(OrderState.REFUNDED);
      expect(order.channel).toBe(NewebPaymentChannel.ANDROID_PAY);
      expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).refundStatus).toBe(NewebPayCreditCardBalanceStatus.SETTLED);
      expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).remainingBalance).toBe(0);
      expect(mockPost).toBeCalledTimes(1);
    });

    it('should query samsung pay order info from NewebPay server', async () => {
      mockPost.mockImplementationOnce(async (url: string, data: any) => {
        expect(url).toMatch(/\/API\/QueryTradeInfo/);

        const payload = new URLSearchParams(data);

        const amt = payload.get('Amt');
        const merchantId = payload.get('MerchantID');
        const merchantOrderNo = payload.get('MerchantOrderNo');

        const checkValue = createHash('sha256').update(`IV=${AES_IV}&Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}&Key=${AES_KEY}`).digest('hex').toUpperCase();

        expect(payload.get('CheckValue')).toBe(checkValue);

        return {
          data: {
            Status: 'SUCCESS',
            Message: '',
            Result: {
              MerchantID: payload.get('MerchantID'),
              Amt: payload.get('Amt'),
              TradeNo: 'MS197067234',
              MerchantOrderNo: payload.get('MerchantOrderNo'),
              TradeStatus: NewebPayOrderStatusFromAPI.COMMITTED,
              PaymentType: 'SAMSUNGPAY',
              CreateTime: '2023-02-01 21:54:47',
              PayTime: '2023-02-01 21:54:58',
              CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&Amt=${amt}&MerchantID=${MERCHANT_ID}&MerchantOrderNo=${merchantOrderNo}&TradeNo=MS197067234&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
              FundTime: '2023-02-25',
              RespondCode: '00',
              Auth: '123456',
              ECI: '2',
              CloseAmt: payload.get('Amt'),
              CloseStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              BackBalance: payload.get('Amt'),
              BackStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              RespondMsg: '',
              Inst: '',
              InstFirst: '',
              InstEach: '',
              PaymentMethod: 'CREDIT',
              Card6No: '000000',
              Card4No: '8888',
              AuthBank: 'KGI',
            },
          },
        };
      });

      const id = randomBytes(10).toString('hex');
      const order = await payment.query<NewebPayOrder<NewebPayCreditCardCommitMessage>>(id, 200);

      expect(order.totalPrice).toBe(200);
      expect(order.id).toBe(id);
      expect(order.channel).toBe(NewebPaymentChannel.SAMSUNG_PAY);
      expect(mockPost).toBeCalledTimes(1);
    });

    it('should query union pay order info from NewebPay server', async () => {
      mockPost.mockImplementationOnce(async (url: string, data: any) => {
        expect(url).toMatch(/\/API\/QueryTradeInfo/);

        const payload = new URLSearchParams(data);

        const amt = payload.get('Amt');
        const merchantId = payload.get('MerchantID');
        const merchantOrderNo = payload.get('MerchantOrderNo');

        const checkValue = createHash('sha256').update(`IV=${AES_IV}&Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}&Key=${AES_KEY}`).digest('hex').toUpperCase();

        expect(payload.get('CheckValue')).toBe(checkValue);

        return {
          data: {
            Status: 'SUCCESS',
            Message: '',
            Result: {
              MerchantID: payload.get('MerchantID'),
              Amt: payload.get('Amt'),
              TradeNo: 'MS197067234',
              MerchantOrderNo: payload.get('MerchantOrderNo'),
              TradeStatus: NewebPayOrderStatusFromAPI.COMMITTED,
              PaymentType: 'UNIONPAY',
              CreateTime: '2023-02-01 21:54:47',
              PayTime: '2023-02-01 21:54:58',
              CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&Amt=${amt}&MerchantID=${MERCHANT_ID}&MerchantOrderNo=${merchantOrderNo}&TradeNo=MS197067234&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
              FundTime: '2023-02-25',
              RespondCode: '00',
              Auth: '123456',
              ECI: '2',
              CloseAmt: payload.get('Amt'),
              CloseStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              BackBalance: payload.get('Amt'),
              BackStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              RespondMsg: '',
              Inst: '',
              InstFirst: '',
              InstEach: '',
              PaymentMethod: 'CREDIT',
              Card6No: '000000',
              Card4No: '8888',
              AuthBank: 'KGI',
            },
          },
        };
      });

      const id = randomBytes(10).toString('hex');
      const order = await payment.query<NewebPayOrder<NewebPayCreditCardCommitMessage>>(id, 200);

      expect(order.totalPrice).toBe(200);
      expect(order.id).toBe(id);
      expect(order.channel).toBe(NewebPaymentChannel.UNION_PAY);
      expect(mockPost).toBeCalledTimes(1);
    });

    it('should query failed installments credit card order info from NewebPay server', async () => {
      mockPost.mockImplementationOnce(async (url: string, data: any) => {
        expect(url).toMatch(/\/API\/QueryTradeInfo/);

        const payload = new URLSearchParams(data);

        const amt = payload.get('Amt');
        const merchantId = payload.get('MerchantID');
        const merchantOrderNo = payload.get('MerchantOrderNo');

        const checkValue = createHash('sha256').update(`IV=${AES_IV}&Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}&Key=${AES_KEY}`).digest('hex').toUpperCase();

        expect(payload.get('CheckValue')).toBe(checkValue);

        return {
          data: {
            Status: 'SUCCESS',
            Message: '',
            Result: {
              MerchantID: payload.get('MerchantID'),
              Amt: payload.get('Amt'),
              TradeNo: 'MS197067234',
              MerchantOrderNo: payload.get('MerchantOrderNo'),
              TradeStatus: NewebPayOrderStatusFromAPI.FAILED,
              PaymentType: 'CREDIT',
              CreateTime: '2023-02-01 21:54:47',
              PayTime: '',
              CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&Amt=${amt}&MerchantID=${MERCHANT_ID}&MerchantOrderNo=${merchantOrderNo}&TradeNo=MS197067234&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
              FundTime: '2023-02-25',
              RespondCode: '00',
              Auth: '123456',
              ECI: '2',
              CloseAmt: payload.get('Amt'),
              CloseStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              BackBalance: payload.get('Amt'),
              BackStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
              RespondMsg: '',
              Inst: 3,
              InstFirst: 67,
              InstEach: 66,
              PaymentMethod: 'CREDIT',
              Card6No: '000000',
              Card4No: '8888',
              AuthBank: 'KGI',
            },
          },
        };
      });

      const id = randomBytes(10).toString('hex');
      const order = await payment.query<NewebPayOrder<NewebPayCreditCardCommitMessage>>(id, 200);

      expect(order.totalPrice).toBe(200);
      expect(order.id).toBe(id);
      expect(order.additionalInfo?.processDate.getTime()).toBe(order.createdAt?.getTime());
      expect(order.additionalInfo?.card4Number).toBe('8888');
      expect(order.additionalInfo?.card6Number).toBe('000000');
      expect(order.channel).toBe(NewebPaymentChannel.CREDIT);
      expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).installments?.count).toBe(3);
      expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).installments?.firstAmount).toBe(67);
      expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).installments?.eachAmount).toBe(66);
      expect(mockPost).toBeCalledTimes(1);
    });

    it('should query unknown type order info from NewebPay server', async () => {
      mockPost.mockImplementationOnce(async (url: string, data: any) => {
        expect(url).toMatch(/\/API\/QueryTradeInfo/);

        const payload = new URLSearchParams(data);

        const amt = payload.get('Amt');
        const merchantId = payload.get('MerchantID');
        const merchantOrderNo = payload.get('MerchantOrderNo');

        const checkValue = createHash('sha256').update(`IV=${AES_IV}&Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}&Key=${AES_KEY}`).digest('hex').toUpperCase();

        expect(payload.get('CheckValue')).toBe(checkValue);

        return {
          data: {
            Status: 'SUCCESS',
            Message: '',
            Result: {
              MerchantID: payload.get('MerchantID'),
              Amt: payload.get('Amt'),
              TradeNo: 'MS197067234',
              MerchantOrderNo: payload.get('MerchantOrderNo'),
              TradeStatus: NewebPayOrderStatusFromAPI.COMMITTED,
              PaymentType: 'UNKNOWN',
              CreateTime: '2023-02-01 21:54:47',
              PayTime: '',
              CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&Amt=${amt}&MerchantID=${MERCHANT_ID}&MerchantOrderNo=${merchantOrderNo}&TradeNo=MS197067234&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
              FundTime: '2023-02-25',
            },
          },
        };
      });

      const id = randomBytes(10).toString('hex');
      const order = await payment.query(id, 200);

      expect(order.totalPrice).toBe(200);
      expect(order.channel).toBe(NewebPaymentChannel.CREDIT);
      expect(mockPost).toBeCalledTimes(1);
    });

    it('should query webatm order info from NewebPay server', async () => {
      mockPost.mockImplementationOnce(async (url: string, data: any) => {
        expect(url).toMatch(/\/API\/QueryTradeInfo/);

        const payload = new URLSearchParams(data);

        const amt = payload.get('Amt');
        const merchantId = payload.get('MerchantID');
        const merchantOrderNo = payload.get('MerchantOrderNo');

        const checkValue = createHash('sha256').update(`IV=${AES_IV}&Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}&Key=${AES_KEY}`).digest('hex').toUpperCase();

        expect(payload.get('CheckValue')).toBe(checkValue);

        return {
          data: {
            Status: 'SUCCESS',
            Message: '',
            Result: {
              MerchantID: payload.get('MerchantID'),
              Amt: payload.get('Amt'),
              TradeNo: 'MS197067234',
              MerchantOrderNo: payload.get('MerchantOrderNo'),
              TradeStatus: NewebPayOrderStatusFromAPI.COMMITTED,
              PaymentType: 'WEBATM',
              CreateTime: '2023-02-01 21:54:47',
              PayTime: '',
              CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&Amt=${amt}&MerchantID=${MERCHANT_ID}&MerchantOrderNo=${merchantOrderNo}&TradeNo=MS197067234&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
              FundTime: '2023-02-25',
              PayInfo: '(012)686168251938',
              ExpireDate: '2023-02-05 23:59:59',
              OrderStatus: NewebPayOrderStatusFromAPI.INITED,
            },
          },
        };
      });

      const id = randomBytes(10).toString('hex');
      const order = await payment.query<NewebPayOrder<NewebPayWebATMCommitMessage>>(id, 200);

      expect(order.totalPrice).toBe(200);
      expect(order.id).toBe(id);
      expect(mockPost).toBeCalledTimes(1);
      expect(order.channel).toBe(NewebPaymentChannel.WEBATM);
      expect(order.additionalInfo?.buyerAccountNumber).toBe('686168251938');
      expect(order.additionalInfo?.buyerBankCode).toBe('012');
    });

    it('should query virtual account order info from NewebPay server', async () => {
      mockPost.mockImplementationOnce(async (url: string, data: any) => {
        expect(url).toMatch(/\/API\/QueryTradeInfo/);

        const payload = new URLSearchParams(data);

        const amt = payload.get('Amt');
        const merchantId = payload.get('MerchantID');
        const merchantOrderNo = payload.get('MerchantOrderNo');

        const checkValue = createHash('sha256').update(`IV=${AES_IV}&Amt=${amt}&MerchantID=${merchantId}&MerchantOrderNo=${merchantOrderNo}&Key=${AES_KEY}`).digest('hex').toUpperCase();

        expect(payload.get('CheckValue')).toBe(checkValue);

        return {
          data: {
            Status: 'SUCCESS',
            Message: '',
            Result: {
              MerchantID: payload.get('MerchantID'),
              Amt: payload.get('Amt'),
              TradeNo: 'MS197067234',
              MerchantOrderNo: payload.get('MerchantOrderNo'),
              TradeStatus: NewebPayOrderStatusFromAPI.COMMITTED,
              PaymentType: 'VACC',
              CreateTime: '2023-02-01 21:54:47',
              PayTime: '',
              CheckCode: createHash('sha256').update(`HashIV=${AES_IV}&Amt=${amt}&MerchantID=${MERCHANT_ID}&MerchantOrderNo=${merchantOrderNo}&TradeNo=MS197067234&HashKey=${AES_KEY}`).digest('hex').toUpperCase(),
              FundTime: '2023-02-25',
              PayInfo: '(012)686168251938',
              ExpireDate: '2023-02-05 23:59:59',
              OrderStatus: NewebPayOrderStatusFromAPI.INITED,
            },
          },
        };
      });

      const id = randomBytes(10).toString('hex');
      const order = await payment.query<NewebPayOrder<NewebPayWebATMCommitMessage>>(id, 200);

      expect(order.totalPrice).toBe(200);
      expect(order.id).toBe(id);
      expect(mockPost).toBeCalledTimes(1);
      expect(order.channel).toBe(NewebPaymentChannel.VACC);
      expect(order.additionalInfo?.buyerAccountNumber).toBe('686168251938');
      expect(order.additionalInfo?.buyerBankCode).toBe('012');
    });

    afterEach(() => {
      mockPost.mockClear();
    });
  });
});
