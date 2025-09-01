/* eslint-disable no-control-regex */
/**
 * @jest-environment node
 */

import { Channel, CreditCardECI, OrderState } from '@rytass/payments';
import { NewebPayCreditCardSpeedCheckoutMode } from '../src/typings';
import {
  NewebPayAdditionInfoCreditCard,
  NewebPayCreditCardBalanceStatus,
  NewebPayCreditCardCommitMessage,
  NewebPaymentChannel,
  NewebPayOrder,
  NewebPayOrderStatusFromAPI,
  NewebPayPayment,
} from '../src';
import axios from 'axios';
import { createDecipheriv, createHash } from 'crypto';

const MERCHANT_ID = 'MS154366906';
const AES_KEY = 'X4vM1RymaxkyzZ9mZHNE67Kba2gpv40c';
const AES_IV = '6ma4zu0UFWk54oyX';

describe('NewebPay Cancel Order', () => {
  const payment = new NewebPayPayment({
    merchantId: MERCHANT_ID,
    aesKey: AES_KEY,
    aesIv: AES_IV,
  });

  it('should cancel order', async () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (url: string, data: any) => {
      expect(url).toMatch(/\/API\/CreditCard\/Cancel$/);

      const payload = new URLSearchParams(data);

      expect(payload.get('MerchantID_')).toBe(MERCHANT_ID);

      const postData = payload.get('PostData_');

      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      decipher.setAutoPadding(false);

      const plainInfo =
        `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(
          /[\u0000-\u001F\u007F-\u009F]/g,
          '',
        );

      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('RespondType')).toBe('JSON');
      expect(requestBody.get('Version')).toBe('1.0');
      expect(requestBody.get('IndexType')).toBe('1');
      expect(requestBody.get('Amt')).toBe('100');
      expect(requestBody.get('MerchantOrderNo')).toBe('1291720470214');

      return {
        data: {
          Status: 'SUCCESS',
          Message: '',
          Result: {
            TradeNo: '1234567890',
            CheckCode: createHash('sha256')
              .update(
                `HashIV=${AES_IV}&Amt=${order.totalPrice}&MerchantID=${MERCHANT_ID}&MerchantOrderNo=${order.id}&TradeNo=1234567890&HashKey=${AES_KEY}`,
              )
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

    await order.refund();

    expect(order.state).toBe(OrderState.REFUNDED);
    expect(
      (order.additionalInfo as NewebPayAdditionInfoCreditCard).closeStatus,
    ).toBe(NewebPayCreditCardBalanceStatus.SETTLED);
  });

  it('should throw error if order closed', () => {
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
        speedCheckoutMode: NewebPayCreditCardSpeedCheckoutMode.USED,
        bonusAmount: 0,
        closeBalance: 100,
        closeStatus: NewebPayCreditCardBalanceStatus.SETTLED,
        remainingBalance: 0,
        refundStatus: NewebPayCreditCardBalanceStatus.UNSETTLED,
      } as NewebPayAdditionInfoCreditCard,
    );

    expect(() => payment.cancel(order)).rejects.toThrow(
      'Only unsettled order can be canceled',
    );
  });

  it('should throw error if CheckCode invalid', () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (url: string, data: any) => {
      expect(url).toMatch(/\/API\/CreditCard\/Cancel$/);

      const payload = new URLSearchParams(data);

      expect(payload.get('MerchantID_')).toBe(MERCHANT_ID);

      const postData = payload.get('PostData_');

      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      decipher.setAutoPadding(false);

      const plainInfo =
        `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(
          /[\u0000-\u001F\u007F-\u009F]/g,
          '',
        );

      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('RespondType')).toBe('JSON');
      expect(requestBody.get('Version')).toBe('1.0');
      expect(requestBody.get('IndexType')).toBe('1');
      expect(requestBody.get('Amt')).toBe('100');
      expect(requestBody.get('MerchantOrderNo')).toBe('1291720470214');

      return {
        data: {
          Status: 'SUCCESS',
          Message: '',
          Result: {
            CheckCode: createHash('sha256')
              .update(`H1ashKey=${AES_KEY}&${postData}&HashIV=${AES_IV}`)
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

    expect(() => order.refund()).rejects.toThrow('Invalid check code');
  });

  it('should throw error if cancel failed', () => {
    const mockedPost = jest.spyOn(axios, 'post');

    mockedPost.mockImplementation(async (url: string, data: any) => {
      expect(url).toMatch(/\/API\/CreditCard\/Cancel$/);

      const payload = new URLSearchParams(data);

      expect(payload.get('MerchantID_')).toBe(MERCHANT_ID);

      const postData = payload.get('PostData_');

      const decipher = createDecipheriv('aes-256-cbc', AES_KEY, AES_IV);

      decipher.setAutoPadding(false);

      const plainInfo =
        `${decipher.update(postData!, 'hex', 'utf8')}${decipher.final('utf8')}`.replace(
          /[\u0000-\u001F\u007F-\u009F]/g,
          '',
        );

      const requestBody = new URLSearchParams(plainInfo);

      expect(requestBody.get('RespondType')).toBe('JSON');
      expect(requestBody.get('Version')).toBe('1.0');
      expect(requestBody.get('IndexType')).toBe('1');
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

    expect(() => order.refund()).rejects.toThrow('Cancel order failed');
  });
});
