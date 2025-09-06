/**
 * @jest-environment node
 */

import { Channel, CVS, OrderState } from '@rytass/payments';
import axios from 'axios';
import http, { createServer } from 'http';
import { DateTime } from 'luxon';
import {
  ECPayCommitMessage,
  ECPayPayment,
  ECPayOrder,
  ECPayCallbackPaymentType,
  ECPayOrderCreditCardCommitMessage,
  ECPayOrderVirtualAccountCommitMessage,
  ECPayOrderCVSCommitMessage,
} from '../src';
import { getAddMac } from '../__utils__/add-mac';

const addMac = getAddMac();

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

describe('ECPayPayment', () => {
  const originCreateServer = createServer;
  const mockedCreateServer = jest.spyOn(http, 'createServer');

  mockedCreateServer.mockImplementation(requestHandler => {
    const mockServer = originCreateServer(requestHandler);

    const mockedListen = jest.spyOn(mockServer, 'listen');

    mockedListen.mockImplementationOnce((_port?: number, _hostname?: string, listeningListener?: () => void) => {
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

  describe('Waiting withServer mode server listen', () => {
    it('should reject query on server not ready', done => {
      const payment = new ECPayPayment({
        withServer: true,
        onServerListen: (): void => {
          payment._server?.close(done);
        },
      });

      expect(() => payment.query('fakeId')).rejects.toThrow();
    });
  });

  describe('Query order', () => {
    // Mock Query API
    const post = jest.spyOn(axios, 'post');

    const payment = new ECPayPayment();

    it('should order query response data', done => {
      post.mockImplementation(async (url: string, data: unknown) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
          (vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }),
          {},
        ) as {
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
          CustomField4: '30#10',
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

      payment.query('6df4782d4514241fcb6f').then((order: ECPayOrder<ECPayOrderCreditCardCommitMessage>) => {
        expect(order.id).toBe('6df4782d4514241fcb6f');
        expect(order.additionalInfo?.channel).toBe(Channel.CREDIT_CARD);
        expect(DateTime.fromJSDate(order.additionalInfo!.processDate).toFormat('yyyy/MM/dd HH:mm:ss')).toBe(
          '2022/04/19 17:21:21',
        );

        expect(order.additionalInfo?.authCode).toBe('777777');
        expect(order.additionalInfo?.amount).toBe(70);
        expect(order.additionalInfo?.eci).toBe('0');
        expect(order.additionalInfo?.card4Number).toBe('2222');
        expect(order.additionalInfo?.card6Number).toBe('431195');
        expect(order.additionalInfo?.gwsr).toBe('11944770');

        done();
      });
    });

    it('should order query response data in atm mode', done => {
      post.mockImplementation(async (url: string, data: unknown) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
          (vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }),
          {},
        ) as {
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
          ATMAccBank: '412',
          ATMAccNo: '49318901423',
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
          PaymentType: ECPayCallbackPaymentType.ATM_BOT,
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

      payment.query('6df4782d4514241fcb6f').then((order: ECPayOrder<ECPayOrderVirtualAccountCommitMessage>) => {
        expect(order.id).toBe('6df4782d4514241fcb6f');
        expect(order.additionalInfo?.channel).toBe(Channel.VIRTUAL_ACCOUNT);
        expect(order.additionalInfo?.buyerBankCode).toBe('412');
        expect(order.additionalInfo?.buyerAccountNumber).toBe('49318901423');

        done();
      });
    });

    it('should order query response data in cvs mode', done => {
      post.mockImplementation(async (url: string, data: unknown) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
          (vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }),
          {},
        ) as {
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
          ATMAccBank: '412',
          ATMAccNo: '49318901423',
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
          PayFrom: 'family',
          PaymentDate: '2022/04/19 17:21:21',
          PaymentNo: '',
          PaymentType: ECPayCallbackPaymentType.CVS,
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

      payment.query('6df4782d4514241fcb6f').then((order: ECPayOrder<ECPayOrderCVSCommitMessage>) => {
        expect(order.id).toBe('6df4782d4514241fcb6f');
        expect(order.additionalInfo?.channel).toBe(Channel.CVS_KIOSK);
        expect(order.additionalInfo?.cvsPayFrom).toBe(CVS.FAMILY_MART);

        done();
      });
    });

    it('should order query response data in barcode mode', done => {
      post.mockImplementation(async (url: string, data: unknown) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
          (vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }),
          {},
        ) as {
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
          ATMAccBank: '412',
          ATMAccNo: '49318901423',
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
          PayFrom: 'family',
          PaymentDate: '2022/04/19 17:21:21',
          PaymentNo: '',
          PaymentType: ECPayCallbackPaymentType.BARCODE,
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

      payment.query('6df4782d4514241fcb6f').then((order: ECPayOrder<ECPayOrderCVSCommitMessage>) => {
        expect(order.id).toBe('6df4782d4514241fcb6f');
        expect(order.additionalInfo).toBeUndefined();

        done();
      });
    });

    it('should reject invalid checksum', async () => {
      post.mockImplementation(async (url: string, data: unknown) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
          (vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }),
          {},
        ) as {
          MerchantID: string;
          MerchantTradeNo: string;
          PlatformID: string;
          TimeStamp: string;
          CheckMacValue: string;
        };

        expect(checkMac(params)).toBeTruthy();

        const payload = {
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
          CheckMacValue: '0000000',
        };

        return { data: payload };
      });

      await expect(payment.query('6df4782d4514241fcb6f')).rejects.toThrow();
    });

    it('should order commit time nullable', done => {
      post.mockImplementation(async (url: string, data: unknown) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
          (vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }),
          {},
        ) as {
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
          PaymentDate: '',
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

      payment.query('6df4782d4514241fcb6f').then((order: ECPayOrder<ECPayCommitMessage>) => {
        expect(order.id).toBe('6df4782d4514241fcb6f');
        expect(order.committedAt).toBeNull();

        done();
      });
    });

    it('should order query failed record can be found', done => {
      post.mockImplementation(async (url: string, data: unknown) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
          (vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }),
          {},
        ) as {
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

      payment.query('6df4782d4514241fcb6f').then((order: ECPayOrder<ECPayCommitMessage>) => {
        expect(order.state).toBe(OrderState.FAILED);

        done();
      });
    });

    it('should order query not finished record can be found', done => {
      post.mockImplementation(async (url: string, data: unknown) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
          (vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }),
          {},
        ) as {
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

      payment.query('6df4782d4514241fcb6f').then((order: ECPayOrder<ECPayCommitMessage>) => {
        expect(order.state).toBe(OrderState.PRE_COMMIT);

        done();
      });
    });

    it('should order query invalid record can be found', done => {
      post.mockImplementation(async (url: string, data: unknown) => {
        expect(url).toEqual('https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5');

        const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
          (vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }),
          {},
        ) as {
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

      payment.query('6df4782d4514241fcb6f').then((order: ECPayOrder<ECPayCommitMessage>) => {
        expect(order.state).toBe(OrderState.INITED);

        done();
      });
    });
  });
});
