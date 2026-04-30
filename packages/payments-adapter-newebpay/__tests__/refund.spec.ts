/* eslint-disable no-control-regex */
/**
 * @jest-environment node
 */

import { Channel, CreditCardECI, OrderState, WebATMPaymentInfo } from '@rytass/payments';
import { NewebPayCreditCardSpeedCheckoutMode } from '../src/typings';
import {
  NewebPayAdditionInfoCreditCard,
  NewebPayCreditCardBalanceStatus,
  NewebPayCreditCardCommitMessage,
  NewebPaymentChannel,
  NewebPayOrder,
  NewebPayOrderStatusFromAPI,
  NewebPayPayment,
  NewebPayWebATMCommitMessage,
} from '../src';
import axios from 'axios';
import { createDecipheriv, createHash } from 'crypto';

const MERCHANT_ID = 'MS154366906';
const AES_KEY = 'X4vM1RymaxkyzZ9mZHNE67Kba2gpv40c';
const AES_IV = '6ma4zu0UFWk54oyX';

describe('NewebPay Refund Order', () => {
  const payment = new NewebPayPayment({
    merchantId: MERCHANT_ID,
    aesKey: AES_KEY,
    aesIv: AES_IV,
  });

  it('should refund order', async () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (url: string, data: string) => {
      expect(url).toMatch(/\/API\/CreditCard\/Close$/);

      const payload = new URLSearchParams(data);

      expect(payload.get('MerchantID_')).toBe(MERCHANT_ID);

      const postData = payload.get('PostData_');

      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      decipher.setAutoPadding(false);

      const plainInfo = `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(
        /[\u0000-\u001F\u007F-\u009F]/g,
        '',
      );

      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('RespondType')).toBe('JSON');
      expect(requestBody.get('Version')).toBe('1.0');
      expect(requestBody.get('IndexType')).toBe('1');
      expect(requestBody.get('CloseType')).toBe('2');
      expect(requestBody.get('Amt')).toBe('100');
      expect(requestBody.get('MerchantOrderNo')).toBe('1291720470214');

      return {
        data: {
          Status: 'SUCCESS',
          Message: '',
          Result: {
            CheckCode: createHash('sha256')
              .update(`HashKey=${AES_KEY}&${postData}&HashIV=${AES_IV}`)
              .digest('hex')
              .toUpperCase(),
          },
        },
      };
    });

    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 100,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    await order.refund();

    expect(order.state).toBe(OrderState.REFUNDED);
    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus).toBe(
      NewebPayCreditCardBalanceStatus.SETTLED,
    );

    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).refundStatus).toBe(
      NewebPayCreditCardBalanceStatus.WAITING,
    );
  });

  it('should refund working order', async () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (url: string, data: string) => {
      expect(url).toMatch(/\/API\/CreditCard\/Close$/);

      const payload = new URLSearchParams(data);

      expect(payload.get('MerchantID_')).toBe(MERCHANT_ID);

      const postData = payload.get('PostData_');

      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      decipher.setAutoPadding(false);

      const plainInfo = `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(
        /[\u0000-\u001F\u007F-\u009F]/g,
        '',
      );

      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('RespondType')).toBe('JSON');
      expect(requestBody.get('Version')).toBe('1.0');
      expect(requestBody.get('IndexType')).toBe('1');
      expect(requestBody.get('CloseType')).toBe('2');
      expect(requestBody.get('Amt')).toBe('100');
      expect(requestBody.get('MerchantOrderNo')).toBe('1291720470214');

      return {
        data: {
          Status: 'SUCCESS',
          Message: '',
          Result: {
            CheckCode: createHash('sha256')
              .update(`HashKey=${AES_KEY}&${postData}&HashIV=${AES_IV}`)
              .digest('hex')
              .toUpperCase(),
          },
        },
      };
    });

    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.WORKING,
        remainingBalance: 100,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    await order.refund();

    expect(order.state).toBe(OrderState.REFUNDED);
    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus).toBe(
      NewebPayCreditCardBalanceStatus.SETTLED,
    );

    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).refundStatus).toBe(
      NewebPayCreditCardBalanceStatus.WAITING,
    );
  });

  it('should throw error when refund a fully-refunded order (state=REFUNDED, balance=0)', async () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.REFUNDED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.WORKING,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.SETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    await expect(order.refund()).rejects.toThrow('Only committed order can be refunded');
  });

  it('should throw error when refund non credit card order', () => {
    const order = new NewebPayOrder<NewebPayWebATMCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.WEBATM,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.WEB_ATM,
        buyerAccountNumber: '123123123',
        buyerBankCode: '011',
      } as WebATMPaymentInfo,
    );

    expect(() => order.refund()).rejects.toThrow('Only credit card order can be refunded');
  });

  it('should throw error on refund order failed', async () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (url: string, data: string) => {
      expect(url).toMatch(/\/API\/CreditCard\/Close$/);

      const payload = new URLSearchParams(data);

      expect(payload.get('MerchantID_')).toBe(MERCHANT_ID);

      const postData = payload.get('PostData_');

      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      decipher.setAutoPadding(false);

      const plainInfo = `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(
        /[\u0000-\u001F\u007F-\u009F]/g,
        '',
      );

      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('RespondType')).toBe('JSON');
      expect(requestBody.get('Version')).toBe('1.0');
      expect(requestBody.get('IndexType')).toBe('1');
      expect(requestBody.get('CloseType')).toBe('2');
      expect(requestBody.get('Amt')).toBe('100');
      expect(requestBody.get('MerchantOrderNo')).toBe('1291720470214');

      return {
        data: {
          Status: 'FAIL',
          Message: '失敗',
        },
      };
    });

    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 100,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => order.refund()).rejects.toThrow('Refund order failed');
  });

  it('should throw error when refund unsettled order', async () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
        remainingBalance: 100,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => payment.refund(order)).rejects.toThrow('Only working/settled order can be refunded');
  });

  it('should throw error when refund a refunding order', async () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.WAITING,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => payment.refund(order)).rejects.toThrow('Order refunding.');
  });

  it('should refunded order can be cancel', async () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (url: string, data: string) => {
      expect(url).toMatch(/\/API\/CreditCard\/Close$/);

      const payload = new URLSearchParams(data);

      expect(payload.get('MerchantID_')).toBe(MERCHANT_ID);

      const postData = payload.get('PostData_');

      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      decipher.setAutoPadding(false);

      const plainInfo = `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(
        /[\u0000-\u001F\u007F-\u009F]/g,
        '',
      );

      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('RespondType')).toBe('JSON');
      expect(requestBody.get('Version')).toBe('1.0');
      expect(requestBody.get('IndexType')).toBe('1');
      expect(requestBody.get('CloseType')).toBe('2');
      expect(requestBody.get('Cancel')).toBe('1');
      expect(requestBody.get('Amt')).toBe('100');
      expect(requestBody.get('MerchantOrderNo')).toBe('1291720470214');

      return {
        data: {
          Status: 'SUCCESS',
          Message: '',
          Result: {
            CheckCode: createHash('sha256')
              .update(`HashKey=${AES_KEY}&${postData}&HashIV=${AES_IV}`)
              .digest('hex')
              .toUpperCase(),
          },
        },
      };
    });

    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.REFUNDED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.WAITING,
      } as NewebPayAdditionInfoCreditCard,
    );

    await order.cancelRefund();

    expect(order.state).toBe(OrderState.COMMITTED);
    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).refundStatus).toBe(
      NewebPayCreditCardBalanceStatus.UNSETTLED,
    );
  });

  it('should throw error on cancel refund failed', async () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (url: string, data: string) => {
      expect(url).toMatch(/\/API\/CreditCard\/Close$/);

      const payload = new URLSearchParams(data);

      expect(payload.get('MerchantID_')).toBe(MERCHANT_ID);

      const postData = payload.get('PostData_');

      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      decipher.setAutoPadding(false);

      const plainInfo = `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(
        /[\u0000-\u001F\u007F-\u009F]/g,
        '',
      );

      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('RespondType')).toBe('JSON');
      expect(requestBody.get('Version')).toBe('1.0');
      expect(requestBody.get('IndexType')).toBe('1');
      expect(requestBody.get('CloseType')).toBe('2');
      expect(requestBody.get('Cancel')).toBe('1');
      expect(requestBody.get('Amt')).toBe('100');
      expect(requestBody.get('MerchantOrderNo')).toBe('1291720470214');

      return {
        data: {
          Status: 'FAIL',
          Message: '失敗',
        },
      };
    });

    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.REFUNDED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.WAITING,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => order.cancelRefund()).rejects.toThrow('Refund order failed');
  });

  it('should throw error on cancel refund a not settled order', () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.REFUNDED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.WAITING,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => payment.cancelRefund(order)).rejects.toThrow('Only settled order can be cancel refund');
  });

  it('should throw error on cancel refund a never refund order', () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 100,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => payment.cancelRefund(order)).rejects.toThrow('Order not refunding.');
  });

  it('should throw error on cancel refund a not refunded order', () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.WAITING,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => payment.cancelRefund(order)).rejects.toThrow('Only refunded order can be cancel refund');
  });

  it('should refund partial amount when amount is provided', async () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (url: string, data: string) => {
      expect(url).toMatch(/\/API\/CreditCard\/Close$/);

      const payload = new URLSearchParams(data);
      const postData = payload.get('PostData_');
      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      const plainInfo = `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(/[ --]/g, '');

      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('CloseType')).toBe('2');
      expect(requestBody.get('Amt')).toBe('40');
      expect(requestBody.get('MerchantOrderNo')).toBe('1291720470214');

      return {
        data: {
          Status: 'SUCCESS',
          Message: '',
          Result: {
            CheckCode: createHash('sha256')
              .update(`HashKey=${AES_KEY}&${postData}&HashIV=${AES_IV}`)
              .digest('hex')
              .toUpperCase(),
          },
        },
      };
    });

    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 100,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    await order.refund(40);

    expect(order.state).toBe(OrderState.REFUNDED);
  });

  it('should throw error when partial refund amount exceeds total price', async () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 100,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    await expect(payment.refund(order, 200)).rejects.toThrow(
      'Refund amount cannot exceed remaining refundable balance',
    );
  });

  it('should throw error when partial refund amount is not a positive integer', async () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 100,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    await expect(payment.refund(order, 0)).rejects.toThrow('Refund amount must be a positive integer');
    await expect(payment.refund(order, -10)).rejects.toThrow('Refund amount must be a positive integer');
    await expect(payment.refund(order, 12.5)).rejects.toThrow('Refund amount must be a positive integer');
  });

  it('should throw error when partial refund requested on unsettled order', async () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
        remainingBalance: 100,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    await expect(order.refund(40)).rejects.toThrow('Partial refund only supported on working/settled orders');
  });

  it('should cancel refund partial amount when amount is provided', async () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (url: string, data: string) => {
      expect(url).toMatch(/\/API\/CreditCard\/Close$/);

      const payload = new URLSearchParams(data);
      const postData = payload.get('PostData_');
      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      const plainInfo = `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(/[ --]/g, '');

      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('CloseType')).toBe('2');
      expect(requestBody.get('Cancel')).toBe('1');
      expect(requestBody.get('Amt')).toBe('30');
      expect(requestBody.get('MerchantOrderNo')).toBe('1291720470214');

      return {
        data: {
          Status: 'SUCCESS',
          Message: '',
          Result: {
            CheckCode: createHash('sha256')
              .update(`HashKey=${AES_KEY}&${postData}&HashIV=${AES_IV}`)
              .digest('hex')
              .toUpperCase(),
          },
        },
      };
    });

    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.REFUNDED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        // 30 was refunded (pending) → remainingBalance=70.  Cancelling that 30
        // restores remainingBalance to 100 and returns the order to COMMITTED.
        remainingBalance: 70,
        refundStatus: NewebPayCreditCardBalanceStatus.WAITING,
      } as NewebPayAdditionInfoCreditCard,
    );

    await order.cancelRefund(30);

    expect(order.state).toBe(OrderState.COMMITTED);
    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).remainingBalance).toBe(100);
  });

  it('should throw error when partial cancel refund amount exceeds total price', async () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.REFUNDED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.WAITING,
      } as NewebPayAdditionInfoCreditCard,
    );

    await expect(payment.cancelRefund(order, 200)).rejects.toThrow(
      'Cancel refund amount cannot exceed refunded amount',
    );
  });

  it('should throw error when partial cancel refund amount is not a positive integer', async () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: '1291720470214',
        channel: NewebPaymentChannel.CREDIT,
        items: [
          {
            name: 'Test',
            quantity: 1,
            unitPrice: 100,
          },
        ],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.REFUNDED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.WAITING,
      } as NewebPayAdditionInfoCreditCard,
    );

    await expect(payment.cancelRefund(order, 0)).rejects.toThrow('Cancel refund amount must be a positive integer');
    await expect(payment.cancelRefund(order, 25.5)).rejects.toThrow('Cancel refund amount must be a positive integer');
  });

  it('should allow another partial refund after a previous refund completed (BackBalance > 0)', async () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (_url: string, data: string) => {
      const payload = new URLSearchParams(data);
      const postData = payload.get('PostData_');
      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      const plainInfo = `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`;
      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('CloseType')).toBe('2');
      expect(requestBody.get('Amt')).toBe('30');

      return {
        data: {
          Status: 'SUCCESS',
          Message: '',
          Result: {
            CheckCode: createHash('sha256')
              .update(`HashKey=${AES_KEY}&${postData}&HashIV=${AES_IV}`)
              .digest('hex')
              .toUpperCase(),
          },
        },
      };
    });

    // Order that has been partially refunded once: original 100, refunded 40, balance 60.
    // refundStatus=SETTLED means the previous refund completed.
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: 'order-with-prior-refund',
        channel: NewebPaymentChannel.CREDIT,
        items: [{ name: 'Test', quantity: 1, unitPrice: 100 }],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 60, // 100 - prior 40 refund
        refundStatus: NewebPayCreditCardBalanceStatus.SETTLED, // prior refund completed
      } as NewebPayAdditionInfoCreditCard,
    );

    await payment.refund(order, 30); // 30 of remaining 60
  });

  it('should throw when refund amount exceeds remaining refundable balance', async () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: 'over-balance',
        channel: NewebPaymentChannel.CREDIT,
        items: [{ name: 'Test', quantity: 1, unitPrice: 100 }],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 60,
        refundStatus: NewebPayCreditCardBalanceStatus.SETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    // 70 > remaining 60 — even though 70 < totalPrice 100
    await expect(payment.refund(order, 70)).rejects.toThrow('Refund amount cannot exceed remaining refundable balance');
  });

  it('should throw when remaining refundable balance is zero', async () => {
    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: 'fully-refunded',
        channel: NewebPaymentChannel.CREDIT,
        items: [{ name: 'Test', quantity: 1, unitPrice: 100 }],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.SETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    await expect(payment.refund(order)).rejects.toThrow('Order has no remaining refundable balance');
    await expect(payment.refund(order, 10)).rejects.toThrow('Order has no remaining refundable balance');
  });

  it('should default refundAmount to remainingBalance when amount omitted on partially refunded order', async () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (_url: string, data: string) => {
      const payload = new URLSearchParams(data);
      const postData = payload.get('PostData_');
      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      const plainInfo = `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`;
      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('CloseType')).toBe('2');
      // Should send remaining 60, not original totalPrice 100
      expect(requestBody.get('Amt')).toBe('60');

      return {
        data: {
          Status: 'SUCCESS',
          Message: '',
          Result: {
            CheckCode: createHash('sha256')
              .update(`HashKey=${AES_KEY}&${postData}&HashIV=${AES_IV}`)
              .digest('hex')
              .toUpperCase(),
          },
        },
      };
    });

    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: 'default-to-remaining',
        channel: NewebPaymentChannel.CREDIT,
        items: [{ name: 'Test', quantity: 1, unitPrice: 100 }],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 60,
        refundStatus: NewebPayCreditCardBalanceStatus.SETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    await payment.refund(order);
  });

  it('should round-trip refund(40) → cancelRefund(40) → refund(60) restoring then re-spending balance', async () => {
    const mockedPost = jest.spyOn(axios, 'post');

    const sentAmts: string[] = [];

    mockedPost.mockImplementation(async (_url: string, data: string) => {
      const payload = new URLSearchParams(data);
      const postData = payload.get('PostData_');
      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      const plainInfo = `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`;
      const requestBody = new URLSearchParams(plainInfo);

      sentAmts.push(`${requestBody.get('Amt')}${requestBody.get('Cancel') ? '/cancel' : ''}`);

      return {
        data: {
          Status: 'SUCCESS',
          Message: '',
          Result: {
            CheckCode: createHash('sha256')
              .update(`HashKey=${AES_KEY}&${postData}&HashIV=${AES_IV}`)
              .digest('hex')
              .toUpperCase(),
          },
        },
      };
    });

    const order = new NewebPayOrder<NewebPayCreditCardCommitMessage>(
      {
        id: 'round-trip',
        channel: NewebPaymentChannel.CREDIT,
        items: [{ name: 'Test', quantity: 1, unitPrice: 100 }],
        gateway: payment,
        platformTradeNumber: '12937917203',
        createdAt: new Date(),
        committedAt: new Date(),
        status: NewebPayOrderStatusFromAPI.COMMITTED,
      },
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '123123',
        amount: 100,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '9234',
        card6Number: '124902',
        authBank: 'Taishin',
        subChannel: 'CREDIT',
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.NONE,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 100,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    // First refund of 40 → remainingBalance 60, refundStatus WAITING
    await order.refund(40);
    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).remainingBalance).toBe(60);
    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).refundStatus).toBe(
      NewebPayCreditCardBalanceStatus.WAITING,
    );

    // Cancel that 40 → remainingBalance back to 100, refundStatus UNSETTLED, state COMMITTED
    await order.cancelRefund();
    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).remainingBalance).toBe(100);
    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).refundStatus).toBe(
      NewebPayCreditCardBalanceStatus.UNSETTLED,
    );

    expect(order.state).toBe(OrderState.COMMITTED);

    // New refund of 60 should be allowed and use the restored balance
    await order.refund(60);
    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).remainingBalance).toBe(40);

    expect(sentAmts).toEqual(['40', '40/cancel', '60']);
  });
});
