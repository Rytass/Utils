/**
 * @jest-environment node
 */

import { OrderState } from '@rytass/payments';
import axios, { AxiosRequestConfig } from 'axios';
import { createHash } from 'crypto';
import { ECPayPayment } from '.';
import { ECPayOrder } from './ecpay-order';
import { ECPayCommitMessage, ECPayQueryResultStatus } from './typings';

function addMac(payload: Record<string, string>) {
  const mac = createHash('sha256')
    .update(
      encodeURIComponent(
        [
          ['HashKey', '5294y06JbISpM5x9'],
          ...Object.entries(payload).sort(([aKey], [bKey]) => (aKey.toLowerCase() < bKey.toLowerCase() ? -1 : 1)),
          ['HashIV', 'v77hoKGq4kWxNNIS'],
        ]
          .map(([key, value]) => `${key}=${value}`)
          .join('&'),
      )
        .toLowerCase()
        .replace(/'/g, '%27')
        .replace(/~/g, '%7e')
        .replace(/%20/g, '+'),
    )
    .digest('hex')
    .toUpperCase();

  return {
    ...payload,
    CheckMacValue: mac,
  } as Record<string, string>;
}

function checkMac(payload: Record<string, string>): boolean {
  const { CheckMacValue: mac, ...res } = payload;
  const { CheckMacValue: computedMac } = addMac(
    Object.entries(res)
      .reduce((vars, [key, value]) => ({
        ...vars,
        [key]: (value as unknown as (string | number)).toString(),
      }),
        {}),
  );

  if (computedMac !== mac) return false;

  return true;
}

describe('ECPayPayment', () => {
  describe('Query order', () => {
    // Mock Query API
    const post = jest.spyOn(axios, 'post');

    const payment = new ECPayPayment();

    it('should order query response data', (done) => {
      post.mockImplementation(async (url: string, data: unknown, config?: AxiosRequestConfig<unknown> | undefined) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries())
          .reduce((vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }), {}) as {
            MerchantID: string;
            MerchantTradeNo: string;
            PlatformID: string;
            TimeStamp: string;
            CheckMacValue: string;
          };

        expect(checkMac(params)).toBeTruthy();

        const payload = addMac({
          AlipayID: '',
          AlipayTradeNo: '',
          amount: '70',
          ATMAccBank: '',
          ATMAccNo: '',
          auth_code: '777777',
          card4no: '2222',
          card6no: '431195',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
          eci: '0',
          ExecTimes: '',
          Frequency: '',
          gwsr: '11944770',
          HandlingCharge: '5',
          ItemName: 'Test x1#中文 x4',
          MerchantID: params.MerchantID,
          MerchantTradeNo: params.MerchantTradeNo,
          PayFrom: '',
          PaymentDate: '2022/04/19 17:21:21',
          PaymentNo: '',
          PaymentType: 'Credit_CreditCard',
          PaymentTypeChargeFee: '5',
          PeriodAmount: '',
          PeriodType: '',
          process_date: '2022/04/19 17:21:21',
          red_dan: '0',
          red_de_amt: '0',
          red_ok_amt: '0',
          red_yet: '0',
          staed: '0',
          stage: '0',
          stast: '0',
          StoreID: '',
          TenpayTradeNo: '',
          TotalSuccessAmount: '',
          TotalSuccessTimes: '',
          TradeAmt: '70',
          TradeDate: '2022/04/19 17:20:47',
          TradeNo: '2204191720475767',
          TradeStatus: '1',
          WebATMAccBank: '',
          WebATMAccNo: '',
          WebATMBankName: '',
        });

        return { data: payload };
      });

      payment.query('6df4782d4514241fcb6f')
        .then((order: ECPayOrder<ECPayCommitMessage>) => {
          expect(order.id).toBe('6df4782d4514241fcb6f');

          done();
        });
    });

    it('should order query failed record can be found', (done) => {
      post.mockImplementation(async (url: string, data: unknown, config?: AxiosRequestConfig<unknown> | undefined) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries())
          .reduce((vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }), {}) as {
            MerchantID: string;
            MerchantTradeNo: string;
            PlatformID: string;
            TimeStamp: string;
            CheckMacValue: string;
          };

        expect(checkMac(params)).toBeTruthy();

        const payload = addMac({
          AlipayID: '',
          AlipayTradeNo: '',
          amount: '70',
          ATMAccBank: '',
          ATMAccNo: '',
          auth_code: '777777',
          card4no: '2222',
          card6no: '431195',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
          eci: '0',
          ExecTimes: '',
          Frequency: '',
          gwsr: '11944770',
          HandlingCharge: '5',
          ItemName: 'Test x1#中文 x4',
          MerchantID: params.MerchantID,
          MerchantTradeNo: params.MerchantTradeNo,
          PayFrom: '',
          PaymentDate: '2022/04/19 17:21:21',
          PaymentNo: '',
          PaymentType: 'Credit_CreditCard',
          PaymentTypeChargeFee: '5',
          PeriodAmount: '',
          PeriodType: '',
          process_date: '2022/04/19 17:21:21',
          red_dan: '0',
          red_de_amt: '0',
          red_ok_amt: '0',
          red_yet: '0',
          staed: '0',
          stage: '0',
          stast: '0',
          StoreID: '',
          TenpayTradeNo: '',
          TotalSuccessAmount: '',
          TotalSuccessTimes: '',
          TradeAmt: '70',
          TradeDate: '2022/04/19 17:20:47',
          TradeNo: '2204191720475767',
          TradeStatus: '10200095',
          WebATMAccBank: '',
          WebATMAccNo: '',
          WebATMBankName: '',
        });

        return { data: payload };
      });

      payment.query('6df4782d4514241fcb6f')
        .then((order: ECPayOrder<ECPayCommitMessage>) => {
          expect(order.state).toBe(OrderState.FAILED);

          done();
        });
    });

    it('should order query not finished record can be found', (done) => {
      post.mockImplementation(async (url: string, data: unknown, config?: AxiosRequestConfig<unknown> | undefined) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries())
          .reduce((vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }), {}) as {
            MerchantID: string;
            MerchantTradeNo: string;
            PlatformID: string;
            TimeStamp: string;
            CheckMacValue: string;
          };

        expect(checkMac(params)).toBeTruthy();

        const payload = addMac({
          AlipayID: '',
          AlipayTradeNo: '',
          amount: '70',
          ATMAccBank: '',
          ATMAccNo: '',
          auth_code: '777777',
          card4no: '2222',
          card6no: '431195',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
          eci: '0',
          ExecTimes: '',
          Frequency: '',
          gwsr: '11944770',
          HandlingCharge: '5',
          ItemName: 'Test x1#中文 x4',
          MerchantID: params.MerchantID,
          MerchantTradeNo: params.MerchantTradeNo,
          PayFrom: '',
          PaymentDate: '2022/04/19 17:21:21',
          PaymentNo: '',
          PaymentType: 'Credit_CreditCard',
          PaymentTypeChargeFee: '5',
          PeriodAmount: '',
          PeriodType: '',
          process_date: '2022/04/19 17:21:21',
          red_dan: '0',
          red_de_amt: '0',
          red_ok_amt: '0',
          red_yet: '0',
          staed: '0',
          stage: '0',
          stast: '0',
          StoreID: '',
          TenpayTradeNo: '',
          TotalSuccessAmount: '',
          TotalSuccessTimes: '',
          TradeAmt: '70',
          TradeDate: '2022/04/19 17:20:47',
          TradeNo: '2204191720475767',
          TradeStatus: '0',
          WebATMAccBank: '',
          WebATMAccNo: '',
          WebATMBankName: '',
        });

        return { data: payload };
      });

      payment.query('6df4782d4514241fcb6f')
        .then((order: ECPayOrder<ECPayCommitMessage>) => {
          expect(order.state).toBe(OrderState.PRE_COMMIT);

          done();
        });
    });

    it('should order query invalid record can be found', (done) => {
      post.mockImplementation(async (url: string, data: unknown, config?: AxiosRequestConfig<unknown> | undefined) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries())
          .reduce((vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }), {}) as {
            MerchantID: string;
            MerchantTradeNo: string;
            PlatformID: string;
            TimeStamp: string;
            CheckMacValue: string;
          };

        expect(checkMac(params)).toBeTruthy();

        const payload = addMac({
          AlipayID: '',
          AlipayTradeNo: '',
          amount: '70',
          ATMAccBank: '',
          ATMAccNo: '',
          auth_code: '777777',
          card4no: '2222',
          card6no: '431195',
          CustomField1: '',
          CustomField2: '',
          CustomField3: '',
          CustomField4: '',
          eci: '0',
          ExecTimes: '',
          Frequency: '',
          gwsr: '11944770',
          HandlingCharge: '5',
          ItemName: 'Test x1#中文 x4',
          MerchantID: params.MerchantID,
          MerchantTradeNo: params.MerchantTradeNo,
          PayFrom: '',
          PaymentDate: '2022/04/19 17:21:21',
          PaymentNo: '',
          PaymentType: 'Credit_CreditCard',
          PaymentTypeChargeFee: '5',
          PeriodAmount: '',
          PeriodType: '',
          process_date: '2022/04/19 17:21:21',
          red_dan: '0',
          red_de_amt: '0',
          red_ok_amt: '0',
          red_yet: '0',
          staed: '0',
          stage: '0',
          stast: '0',
          StoreID: '',
          TenpayTradeNo: '',
          TotalSuccessAmount: '',
          TotalSuccessTimes: '',
          TradeAmt: '70',
          TradeDate: '2022/04/19 17:20:47',
          TradeNo: '2204191720475767',
          TradeStatus: '99999',
          WebATMAccBank: '',
          WebATMAccNo: '',
          WebATMBankName: '',
        });

        return { data: payload };
      });

      payment.query('6df4782d4514241fcb6f')
        .then((order: ECPayOrder<ECPayCommitMessage>) => {
          expect(order.state).toBe(OrderState.INITED);

          done();
        });
    });
  });
});
