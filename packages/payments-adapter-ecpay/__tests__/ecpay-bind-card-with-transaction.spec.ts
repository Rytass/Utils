/**
 * @jest-environment node
 */

import axios from 'axios';
import { ECPayPayment } from '../src/ecpay-payment';
import { getAddMac } from '../__utils__/add-mac';
import { DateTime } from 'luxon';

const BASE_URL = 'https://payment-stage.ecpay.com.tw';
const MERCHANT_ID = '2000214';
const HASH_KEY = '5294y06JbISpM5x9';
const HASH_IV = 'v77hoKGq4kWxNNIS';
const _MEMBER_ID = 'rytass';

const addMac = getAddMac(HASH_KEY, HASH_IV);

function checkMac(payload: Record<string, string>): boolean {
  const { CheckMacValue: mac, ...res } = payload;
  const { CheckMacValue: computedMac } = addMac(
    Object.entries(res).reduce(
      (vars, [key, value]) => ({
        ...vars,
        [key]: (value as unknown as string | number).toString(),
      }),
      {},
    ),
  );

  if (computedMac !== mac) return false;

  return true;
}

describe('ECPayPayment Card Binding With Transaction', () => {
  const payment = new ECPayPayment({
    merchantId: MERCHANT_ID,
    hashKey: HASH_KEY,
    hashIv: HASH_IV,
    baseUrl: BASE_URL,
  });

  const post = jest.spyOn(axios, 'post');

  beforeEach(() => {
    post.mockReset();
  });

  it('should card binding with transaction', async () => {
    const memberId = 'rytass';
    const orderIdFromECPay = '1303151740582564';
    const cardId = '41234';
    const cardNumberPrefix = '431131';
    const cardNumberSuffix = '1233';
    const bindingDate = DateTime.now().toFormat('yyyy/MM/dd HH:mm:ss');

    post.mockImplementation(async (url: string, data: unknown) => {
      expect(url).toEqual(`${BASE_URL}/MerchantMember/BindingTrade`);

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        MerchantID: string;
        MerchantMemberID: string;
        MerchantTradeNo: string;
        AllpayTradeNo: string;
        CheckMacValue: string;
      };

      expect(checkMac(params)).toBeTruthy();

      expect(params.MerchantID).toEqual(MERCHANT_ID);
      expect(params.MerchantMemberID).toEqual(`${MERCHANT_ID}${memberId}`);
      expect(params.AllpayTradeNo).toEqual(orderIdFromECPay);
      expect(params.MerchantTradeNo.length).toBeLessThanOrEqual(20);

      return {
        data: addMac({
          RtnCode: '1',
          RtnMsg: 'SUCCESS',
          MerchantID: MERCHANT_ID,
          MerchantTradeNo: params.MerchantTradeNo,
          AllpayTradeNo: orderIdFromECPay,
          MerchantMemberID: `${MERCHANT_ID}${memberId}`,
          CardID: cardId,
          Card6No: cardNumberPrefix,
          Card4No: cardNumberSuffix,
          BindingDate: bindingDate,
        }),
      };
    });

    const request = await payment.bindCardWithTransaction(memberId, orderIdFromECPay);

    expect(request.cardId).toEqual(cardId);
    expect(request.cardNumberPrefix).toEqual(cardNumberPrefix);
    expect(request.cardNumberSuffix).toEqual(cardNumberSuffix);
    expect(DateTime.fromJSDate(request.bindingDate!).toFormat('yyyy/MM/dd HH:mm:ss')).toEqual(bindingDate);
  });

  it('should card binding with transaction', async () => {
    const memberId = 'rytass';
    const orderIdFromECPay = '1303151740582564';
    const cardId = '41234';
    const cardNumberPrefix = '431131';
    const cardNumberSuffix = '1233';
    const bindingDate = DateTime.now().toFormat('yyyy/MM/dd HH:mm:ss');

    post.mockImplementation(async (url: string, data: unknown) => {
      expect(url).toEqual(`${BASE_URL}/MerchantMember/BindingTrade`);

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        MerchantID: string;
        MerchantMemberID: string;
        MerchantTradeNo: string;
        AllpayTradeNo: string;
        CheckMacValue: string;
      };

      expect(checkMac(params)).toBeTruthy();

      expect(params.MerchantID).toEqual(MERCHANT_ID);
      expect(params.MerchantMemberID).toEqual(`${MERCHANT_ID}${memberId}`);
      expect(params.AllpayTradeNo).toEqual(orderIdFromECPay);
      expect(params.MerchantTradeNo.length).toBeLessThanOrEqual(20);

      return {
        data: addMac({
          RtnCode: '10100112',
          RtnMsg: 'CardNo is existed.',
          MerchantID: MERCHANT_ID,
          MerchantTradeNo: params.MerchantTradeNo,
          AllpayTradeNo: orderIdFromECPay,
          MerchantMemberID: `${MERCHANT_ID}${memberId}`,
          CardID: cardId,
          Card6No: cardNumberPrefix,
          Card4No: cardNumberSuffix,
          BindingDate: bindingDate,
        }),
      };
    });

    const request = await payment.bindCardWithTransaction(memberId, orderIdFromECPay);

    expect(request.cardId).toEqual(cardId);
    expect(request.cardNumberPrefix).toEqual(cardNumberPrefix);
    expect(request.cardNumberSuffix).toEqual(cardNumberSuffix);
    expect(DateTime.fromJSDate(request.bindingDate!).toFormat('yyyy/MM/dd HH:mm:ss')).toEqual(bindingDate);
  });

  it('should send custom merchant trade number', async () => {
    const memberId = 'rytass';
    const orderIdFromECPay = '1303151740582564';
    const cardId = '41234';
    const cardNumberPrefix = '431131';
    const cardNumberSuffix = '1233';
    const merchantTradeNo = '2049790237512';
    const bindingDate = DateTime.now().toFormat('yyyy/MM/dd HH:mm:ss');

    post.mockImplementation(async (url: string, data: unknown) => {
      expect(url).toEqual(`${BASE_URL}/MerchantMember/BindingTrade`);

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        MerchantID: string;
        MerchantMemberID: string;
        MerchantTradeNo: string;
        AllpayTradeNo: string;
        CheckMacValue: string;
      };

      expect(checkMac(params)).toBeTruthy();

      expect(params.MerchantID).toEqual(MERCHANT_ID);
      expect(params.MerchantMemberID).toEqual(`${MERCHANT_ID}${memberId}`);
      expect(params.AllpayTradeNo).toEqual(orderIdFromECPay);
      expect(params.MerchantTradeNo).toEqual(merchantTradeNo);

      return {
        data: addMac({
          RtnCode: '1',
          RtnMsg: 'SUCCESS',
          MerchantID: MERCHANT_ID,
          MerchantTradeNo: params.MerchantTradeNo,
          AllpayTradeNo: orderIdFromECPay,
          MerchantMemberID: `${MERCHANT_ID}${memberId}`,
          CardID: cardId,
          Card6No: cardNumberPrefix,
          Card4No: cardNumberSuffix,
          BindingDate: bindingDate,
        }),
      };
    });

    const request = await payment.bindCardWithTransaction(memberId, orderIdFromECPay, merchantTradeNo);

    expect(request.cardId).toEqual(cardId);
    expect(request.cardNumberPrefix).toEqual(cardNumberPrefix);
    expect(request.cardNumberSuffix).toEqual(cardNumberSuffix);
    expect(DateTime.fromJSDate(request.bindingDate!).toFormat('yyyy/MM/dd HH:mm:ss')).toEqual(bindingDate);
  });

  it('should throw when request failed', async () => {
    const memberId = 'rytass';
    const orderIdFromECPay = '1303151740582564';

    post.mockImplementation(async (url: string, data: unknown) => {
      expect(url).toEqual(`${BASE_URL}/MerchantMember/BindingTrade`);

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        MerchantID: string;
        MerchantMemberID: string;
        MerchantTradeNo: string;
        AllpayTradeNo: string;
        CheckMacValue: string;
      };

      expect(checkMac(params)).toBeTruthy();

      expect(params.MerchantID).toEqual(MERCHANT_ID);
      expect(params.MerchantMemberID).toEqual(`${MERCHANT_ID}${memberId}`);
      expect(params.AllpayTradeNo).toEqual(orderIdFromECPay);
      expect(params.MerchantTradeNo.length).toBeLessThanOrEqual(20);

      return {
        data: addMac({
          RtnCode: '99999',
          RtnMsg: 'FAILED',
          MerchantID: MERCHANT_ID,
          MerchantTradeNo: params.MerchantTradeNo,
          AllpayTradeNo: orderIdFromECPay,
          MerchantMemberID: `${MERCHANT_ID}${memberId}`,
          CardID: '',
          Card6No: '',
          Card4No: '',
          BindingDate: '',
        }),
      };
    });

    expect(payment.bindCardWithTransaction(memberId, orderIdFromECPay)).rejects.toThrow();
  });

  it('should throw when check sum failed', async () => {
    const memberId = 'rytass';
    const orderIdFromECPay = '1303151740582564';
    const cardId = '41234';
    const cardNumberPrefix = '431131';
    const cardNumberSuffix = '1233';
    const bindingDate = DateTime.now().toFormat('yyyy/MM/dd HH:mm:ss');

    post.mockImplementation(async (url: string, data: unknown) => {
      expect(url).toEqual(`${BASE_URL}/MerchantMember/BindingTrade`);

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        MerchantID: string;
        MerchantMemberID: string;
        MerchantTradeNo: string;
        AllpayTradeNo: string;
        CheckMacValue: string;
      };

      expect(checkMac(params)).toBeTruthy();

      expect(params.MerchantID).toEqual(MERCHANT_ID);
      expect(params.MerchantMemberID).toEqual(`${MERCHANT_ID}${memberId}`);
      expect(params.AllpayTradeNo).toEqual(orderIdFromECPay);
      expect(params.MerchantTradeNo.length).toBeLessThanOrEqual(20);

      const payload = addMac({
        RtnCode: '1',
        RtnMsg: 'SUCCESS',
        MerchantID: MERCHANT_ID,
        MerchantTradeNo: params.MerchantTradeNo,
        AllpayTradeNo: orderIdFromECPay,
        MerchantMemberID: `${MERCHANT_ID}${memberId}`,
        CardID: cardId,
        Card6No: cardNumberPrefix,
        Card4No: cardNumberSuffix,
        BindingDate: bindingDate,
      });

      payload.CheckMacValue = `${payload.CheckMacValue}99`;

      return {
        data: payload,
      };
    });

    expect(payment.bindCardWithTransaction(memberId, orderIdFromECPay)).rejects.toThrow();
  });
});
