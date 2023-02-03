/**
 * @jest-environment node
 */

import axios from 'axios';
import { createHash } from 'crypto';
import { DateTime } from 'luxon';
import { ECPayPayment, OrderState, ECPayQueryOrderPayload, ECPayCredirCardOrderCloseStatus, ECPayCreditCardDetailQueryPayload, ECPayCreditCardOrderStatus, ECPayOrderActionPayload, ECPayOrder, ECPayOrderForm } from '../src';

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
      }), {}),
  );

  if (computedMac !== mac) return false;

  return true;
}

const CREDIT_CHECK_CODE = '417241';
const VALID_ORDER_ID = 'e93b51dea2f5a8d88b52';
const WILL_REJECT_REFUND_ORDER_ID = '1209819069024802';
const WILL_THROW_UNKNOWN_ERROR_REFUND_ORDER_ID = '1209819069024809';

describe('ECPayPayment Refund', () => {
  describe('Waiting withServer mode server listen', () => {
    it('should reject credit card trade status getter on server not ready', (done) => {
      const payment = new ECPayPayment({
        withServer: true,
        onServerListen: async () => {
          await payment._server?.close();

          done();
        },
      });

      expect(() => payment.getCreditCardTradeStatus('123123', 90)).rejects.toThrow();
    });

    it('should reject order do action request on server not ready', (done) => {
      const payment = new ECPayPayment({
        withServer: true,
        onServerListen: () => {
          payment._server?.close(done);
        },
      });

      expect(() => payment.doOrderAction(new ECPayOrder({
        id: '123709129038123',
        items: [],
        form: {} as ECPayOrderForm,
        gateway: payment,
      }), 'R', 1000)).rejects.toThrow();
    });
  });

  beforeEach(() => {
    const axiosPost = jest.spyOn(axios, 'post');

    axiosPost.mockImplementation(async (url, payload) => {
      if (/\/Cashier\/QueryTradeInfo\/V5$/.test(url)) {
        const params = Array.from(new URLSearchParams(payload as string).entries())
          .reduce((vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }), {}) as ECPayQueryOrderPayload;

        expect(checkMac(params)).toBeTruthy();

        const responseData = addMac({
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

        return { data: responseData };
      }

      if (/\/CreditDetail\/QueryTrade\/V2$/.test(url)) {
        const params = Array.from(new URLSearchParams(payload as string).entries())
          .reduce((vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }), {}) as ECPayCreditCardDetailQueryPayload;

        expect(checkMac(params)).toBeTruthy();
        expect(params.CreditCheckCode).toBe(CREDIT_CHECK_CODE);

        return {
          data: {
            RtnMsg: '',
            RtnValue: {
              TradeID: Date.now().toString(),
              amount: params.CreditAmount,
              clsamt: params.CreditAmount,
              authtime: DateTime.local().toFormat('yyyy/M/dd tt'),
              status: ECPayCreditCardOrderStatus.CLOSED,
              close_data: [
                {
                  status: ECPayCredirCardOrderCloseStatus.COMMITTED,
                  sno: Date.now().toString(),
                  amount: params.CreditAmount,
                  datetime: DateTime.local().toFormat('yyyy/M/dd tt'),
                },
              ],
            },
          },
        };
      }

      if (/\/CreditDetail\/DoAction$/.test(url)) {
        const params = Array.from(new URLSearchParams(payload as string).entries())
          .reduce((vars, [key, value]) => ({
            ...vars,
            [key]: value,
          }), {}) as ECPayOrderActionPayload;

        expect(checkMac(params)).toBeTruthy();

        return {
          data: {
            MerchantID: params.MerchantID,
            MerchantTradeNo: params.MerchantTradeNo,
            TradeNo: params.TradeNo,
            RtnCode: ~[WILL_THROW_UNKNOWN_ERROR_REFUND_ORDER_ID, WILL_REJECT_REFUND_ORDER_ID].indexOf(params.MerchantTradeNo) ? -999 : 1,
            RtnMsg: params.MerchantTradeNo === WILL_REJECT_REFUND_ORDER_ID ? 'Refund Failed' : '',
          },
        };
      }
    });
  });

  it('should refund successfully on emulate mode', async () => {
    const payment = new ECPayPayment({
      merchantCheckCode: CREDIT_CHECK_CODE,
      emulateRefund: true,
    });

    const order = await payment.query(VALID_ORDER_ID);

    expect(order.state).toBe(OrderState.COMMITTED);

    await order.refund();

    expect(order.state).toBe(OrderState.REFUNDED);

    // Second refund but no effect on emulated refund

    const order2 = await payment.query(VALID_ORDER_ID);

    await order2.refund();
  });

  it('should refund on live mode', async () => {
    const payment = new ECPayPayment({
      merchantCheckCode: CREDIT_CHECK_CODE,
    });

    const order = await payment.query(VALID_ORDER_ID);

    expect(order.state).toBe(OrderState.COMMITTED);

    await order.refund();

    expect(order.state).toBe(OrderState.REFUNDED);
  });

  it('should reject on refund failed', async () => {
    const payment = new ECPayPayment({
      merchantCheckCode: CREDIT_CHECK_CODE,
    });

    const order = await payment.query(WILL_REJECT_REFUND_ORDER_ID);

    expect(order.state).toBe(OrderState.COMMITTED);

    expect(() => order.refund()).rejects.toThrow();
  });

  it('should reject on refund failed with unknown error', async () => {
    const payment = new ECPayPayment({
      merchantCheckCode: CREDIT_CHECK_CODE,
    });

    const order = await payment.query(WILL_THROW_UNKNOWN_ERROR_REFUND_ORDER_ID);

    expect(order.state).toBe(OrderState.COMMITTED);

    expect(() => order.refund()).rejects.toThrow();
  });
});
