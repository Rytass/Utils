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

describe('NewebPay Settle Order', () => {
  const payment = new NewebPayPayment({
    merchantId: MERCHANT_ID,
    aesKey: AES_KEY,
    aesIv: AES_IV,
  });

  it('should settle order', async () => {
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
      expect(requestBody.get('CloseType')).toBe('1');
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
        closeStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    await order.creditCardSettle();

    expect(order.state).toBe(OrderState.COMMITTED);
    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus).toBe(
      NewebPayCreditCardBalanceStatus.WAITING,
    );
  });

  it('should throw error when settle uncommitted order', () => {
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
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => order.creditCardSettle()).rejects.toThrow('Only committed order can be settled');
  });

  it('should throw error when settle non credit card order', () => {
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

    expect(() => order.creditCardSettle()).rejects.toThrow('Only credit card order can be settled');
  });

  it('should throw error on settle failed', () => {
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
      expect(requestBody.get('CloseType')).toBe('1');
      expect(requestBody.get('Amt')).toBe('100');
      expect(requestBody.get('MerchantOrderNo')).toBe('1291720470214');

      return {
        data: {
          Status: 'FAILED',
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
        closeStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => order.creditCardSettle()).rejects.toThrow('Settle order failed');
  });

  it('should throw error when settle settled order', async () => {
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
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => payment.settle(order)).rejects.toThrow('Only unsettled order can be canceled');
  });

  it('should unsettle order', async () => {
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
      expect(requestBody.get('CloseType')).toBe('1');
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
        closeStatus: NewebPayCreditCardBalanceStatus.WAITING,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    await order.refund();

    expect(order.state).toBe(OrderState.REFUNDED);
    expect((order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus).toBe(
      NewebPayCreditCardBalanceStatus.UNSETTLED,
    );
  });

  it('should throw error on unsettle failed', () => {
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
      expect(requestBody.get('CloseType')).toBe('1');
      expect(requestBody.get('Cancel')).toBe('1');
      expect(requestBody.get('Amt')).toBe('100');
      expect(requestBody.get('MerchantOrderNo')).toBe('1291720470214');

      return {
        data: {
          Status: 'FAILED',
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
        closeStatus: NewebPayCreditCardBalanceStatus.WAITING,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => order.refund()).rejects.toThrow('Unsettle order failed');
  });

  it('should throw error when unsettle unsettled order', async () => {
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
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => payment.unsettle(order)).rejects.toThrow('Only waiting order can be unsettle');
  });
});
