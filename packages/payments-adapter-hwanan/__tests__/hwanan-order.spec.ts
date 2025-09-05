/**
 * @jest-environment node
 */

import { AsyncOrderInformation } from '@rytass/payments';
import {
  HwaNanAutoCapMode,
  HwaNanCreditCardCommitMessage,
  HwaNanCustomizePageType,
  HwaNanOrder,
  HwaNanPayment,
  HwaNanPaymentChannel,
  HwaNanTransactionType,
} from '../src';

const MERCHANT_ID = '326650918560582';
const TERMINAL_ID = '87345985';
const MER_ID = '22343';
const IDENTIFIER = '8949bf87c8d710a0';

describe('Hwa Nan Order', () => {
  const payment = new HwaNanPayment({
    merchantId: MERCHANT_ID,
    terminalId: TERMINAL_ID,
    merID: MER_ID,
    merchantName: 'Rytass Shop',
    identifier: IDENTIFIER,
  });

  it('should get null if order not failed', () => {
    const order = new HwaNanOrder({
      id: 'test',
      items: [
        {
          name: 'A',
          unitPrice: 10,
          quantity: 1,
        },
      ],
      gateway: payment,
      makePayload: {
        MerchantID: MERCHANT_ID,
        TerminalID: TERMINAL_ID,
        MerchantName: 'Rytass',
        lidm: 'test',
        merID: MER_ID,
        customize: HwaNanCustomizePageType.ZH_TW,
        purchAmt: 10,
        txType: HwaNanTransactionType.ONE_TIME,
        AutoCap: HwaNanAutoCapMode.AUTO,
        AuthResURL: 'https://rytass.com/callback',
        AuthInfoPage: 'N',
        checkValue: '49385208c89b89fd',
      },
    });

    expect(order.failedMessage).toBeNull();
  });

  it('should throw error on retrieve order info', () => {
    const order = new HwaNanOrder({
      id: 'test',
      items: [
        {
          name: 'A',
          unitPrice: 10,
          quantity: 1,
        },
      ],
      gateway: payment,
      makePayload: {
        MerchantID: MERCHANT_ID,
        TerminalID: TERMINAL_ID,
        MerchantName: 'Rytass',
        lidm: 'test',
        merID: MER_ID,
        customize: HwaNanCustomizePageType.ZH_TW,
        purchAmt: 10,
        txType: HwaNanTransactionType.ONE_TIME,
        AutoCap: HwaNanAutoCapMode.AUTO,
        AuthResURL: 'https://rytass.com/callback',
        AuthInfoPage: 'N',
        checkValue: '49385208c89b89fd',
      },
    });

    expect(() => order.infoRetrieved({} as AsyncOrderInformation<HwaNanCreditCardCommitMessage>)).toThrow();
  });

  it('should throw error on refund order', () => {
    const order = new HwaNanOrder({
      id: 'test',
      items: [
        {
          name: 'A',
          unitPrice: 10,
          quantity: 1,
        },
      ],
      gateway: payment,
      makePayload: {
        MerchantID: MERCHANT_ID,
        TerminalID: TERMINAL_ID,
        MerchantName: 'Rytass',
        lidm: 'test',
        merID: MER_ID,
        customize: HwaNanCustomizePageType.ZH_TW,
        purchAmt: 10,
        txType: HwaNanTransactionType.ONE_TIME,
        AutoCap: HwaNanAutoCapMode.AUTO,
        AuthResURL: 'https://rytass.com/callback',
        AuthInfoPage: 'N',
        checkValue: '49385208c89b89fd',
      },
    });

    expect(() => order.refund()).rejects.toThrow();
  });

  it('should get createdAt after order prepared', () => {
    const order = new HwaNanOrder({
      id: 'test',
      items: [
        {
          name: 'A',
          unitPrice: 10,
          quantity: 1,
        },
      ],
      gateway: payment,
      makePayload: {
        MerchantID: MERCHANT_ID,
        TerminalID: TERMINAL_ID,
        MerchantName: 'Rytass',
        lidm: 'test',
        merID: MER_ID,
        customize: HwaNanCustomizePageType.ZH_TW,
        purchAmt: 10,
        txType: HwaNanTransactionType.ONE_TIME,
        AutoCap: HwaNanAutoCapMode.AUTO,
        AuthResURL: 'https://rytass.com/callback',
        AuthInfoPage: 'N',
        checkValue: '49385208c89b89fd',
      },
    });

    expect(order.createdAt).not.toBeNull();
  });

  it('should formHTML getter throw error if an order committed or failed', () => {
    const order = new HwaNanOrder({
      id: 'test',
      items: [
        {
          name: 'A',
          unitPrice: 10,
          quantity: 1,
        },
      ],
      gateway: payment,
      makePayload: {
        MerchantID: MERCHANT_ID,
        TerminalID: TERMINAL_ID,
        MerchantName: 'Rytass',
        lidm: 'test',
        merID: MER_ID,
        customize: HwaNanCustomizePageType.ZH_TW,
        purchAmt: 10,
        txType: HwaNanTransactionType.ONE_TIME,
        AutoCap: HwaNanAutoCapMode.AUTO,
        AuthResURL: 'https://rytass.com/callback',
        AuthInfoPage: 'N',
        checkValue: '49385208c89b89fd',
      },
    });

    expect(order.form).not.toBeNull();

    order.commit({
      id: order.id,
      totalPrice: order.totalPrice,
      committedAt: new Date(),
      platformTradeNumber: '123456',
      channel: HwaNanPaymentChannel.CREDIT,
    });

    expect(() => order.form).toThrow();
    expect(() => order.formHTML).toThrow();
  });

  it('should throw error on commit at not pre-committed order', () => {
    const order = new HwaNanOrder({
      id: 'test',
      items: [
        {
          name: 'A',
          unitPrice: 10,
          quantity: 1,
        },
      ],
      gateway: payment,
      makePayload: {
        MerchantID: MERCHANT_ID,
        TerminalID: TERMINAL_ID,
        MerchantName: 'Rytass',
        lidm: 'test',
        merID: MER_ID,
        customize: HwaNanCustomizePageType.ZH_TW,
        purchAmt: 10,
        txType: HwaNanTransactionType.ONE_TIME,
        AutoCap: HwaNanAutoCapMode.AUTO,
        AuthResURL: 'https://rytass.com/callback',
        AuthInfoPage: 'N',
        checkValue: '49385208c89b89fd',
      },
    });

    expect(() =>
      order.commit({
        id: order.id,
        totalPrice: order.totalPrice,
        committedAt: new Date(),
        platformTradeNumber: '123456',
        channel: HwaNanPaymentChannel.CREDIT,
      }),
    ).toThrow();
  });

  it('should throw error when commit id not match', () => {
    const order = new HwaNanOrder({
      id: 'test',
      items: [
        {
          name: 'A',
          unitPrice: 10,
          quantity: 1,
        },
      ],
      gateway: payment,
      makePayload: {
        MerchantID: MERCHANT_ID,
        TerminalID: TERMINAL_ID,
        MerchantName: 'Rytass',
        lidm: 'test',
        merID: MER_ID,
        customize: HwaNanCustomizePageType.ZH_TW,
        purchAmt: 10,
        txType: HwaNanTransactionType.ONE_TIME,
        AutoCap: HwaNanAutoCapMode.AUTO,
        AuthResURL: 'https://rytass.com/callback',
        AuthInfoPage: 'N',
        checkValue: '49385208c89b89fd',
      },
    });

    expect(order.form).not.toBeNull();

    expect(() =>
      order.commit({
        id: 'OTHER',
        totalPrice: order.totalPrice,
        committedAt: new Date(),
        platformTradeNumber: '123456',
        channel: HwaNanPaymentChannel.CREDIT,
      }),
    ).toThrow();
  });
});
