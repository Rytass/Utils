/* eslint-disable no-control-regex */
/**
 * @jest-environment node
 */

import { Channel, VirtualAccountInfo, WebATMPaymentInfo } from '@rytass/payments';
import { NewebPaymentChannel, NewebPayOrder, NewebPayOrderStatusFromAPI, NewebPayPayment, NewebPayVirtualAccountCommitMessage, NewebPayWebATMCommitMessage } from '../src';

const MERCHANT_ID = 'MS154366906';
const AES_KEY = 'X4vM1RymaxkyzZ9mZHNE67Kba2gpv40c';
const AES_IV = '6ma4zu0UFWk54oyX';

describe('NewebPay Order', () => {
  const payment = new NewebPayPayment({
    merchantId: MERCHANT_ID,
    aesKey: AES_KEY,
    aesIv: AES_IV,
  });

  it('should failed message return null on committed order', () => {
    const order = new NewebPayOrder({
      id: '123142',
      items: [{
        name: 'test',
        unitPrice: 100,
        quantity: 2,
      }],
      gateway: payment,
      platformTradeNumber: '213213213',
      createdAt: new Date(),
      committedAt: new Date(),
      channel: NewebPaymentChannel.CREDIT,
      status: NewebPayOrderStatusFromAPI.COMMITTED,
    });

    expect(order.failedMessage).toBeNull();
  });

  it('should get order platform trade number', () => {
    const order = new NewebPayOrder({
      id: '123142',
      items: [{
        name: 'test',
        unitPrice: 100,
        quantity: 2,
      }],
      gateway: payment,
      platformTradeNumber: '213213213',
      createdAt: new Date(),
      committedAt: new Date(),
      channel: NewebPaymentChannel.CREDIT,
      status: NewebPayOrderStatusFromAPI.COMMITTED,
    });

    expect(order.platformTradeNumber).toBe('213213213');
  });

  it('should throw error when get form if order committed', () => {
    const order = new NewebPayOrder({
      id: '123142',
      items: [{
        name: 'test',
        unitPrice: 100,
        quantity: 2,
      }],
      gateway: payment,
      platformTradeNumber: '213213213',
      createdAt: new Date(),
      committedAt: new Date(),
      channel: NewebPaymentChannel.CREDIT,
      status: NewebPayOrderStatusFromAPI.COMMITTED,
    });

    expect(() => order.form).toThrowError('Finished order cannot get submit form data');
    expect(() => order.formHTML).toThrowError('Finished order cannot get submit form url');
  });

  it('should throw error when get checkout url with no server', () => {
    const order = payment.prepare({
      id: '123142',
      items: [{
        name: 'test',
        unitPrice: 100,
        quantity: 2,
      }],
      channel: NewebPaymentChannel.CREDIT,
    });

    expect(() => order.checkoutURL).toThrowError('To use automatic checkout server, please initial payment with `withServer` options.');
  });

  it('should get checkout url with server', (done) => {
    const payment2 = new NewebPayPayment({
      merchantId: MERCHANT_ID,
      aesKey: AES_KEY,
      aesIv: AES_IV,
      withServer: true,
      serverHost: 'https://rytass.com',
      checkoutPath: '/newebpay/checkout',
      onServerListen: async () => {
        const order = payment2.prepare({
          id: '123142',
          items: [{
            name: 'test',
            unitPrice: 100,
            quantity: 2,
          }],
          channel: NewebPaymentChannel.CREDIT,
        });

        expect(order.checkoutURL).toBe('https://rytass.com/newebpay/checkout/123142');

        payment2._server?.close(done);
      },
    });
  });

  it('should throw error when info retrived method call on a not committable order', () => {
    const order = payment.prepare({
      id: '123142',
      items: [{
        name: 'test',
        unitPrice: 100,
        quantity: 2,
      }],
      channel: NewebPaymentChannel.VACC,
    });

    expect(() => order.infoRetrieved<NewebPayVirtualAccountCommitMessage>({
      channel: Channel.VIRTUAL_ACCOUNT,
      bankCode: '128',
      account: '89042',
      expiredAt: new Date(),
    } as VirtualAccountInfo)).toThrow();
  });

  it('should throw error when commit a not committable order', () => {
    const order = payment.prepare({
      id: '123142',
      items: [{
        name: 'test',
        unitPrice: 100,
        quantity: 2,
      }],
      channel: NewebPaymentChannel.WEBATM,
    });

    expect(() => order.commit<NewebPayWebATMCommitMessage>({
      id: '123142',
      totalPrice: 200,
      committedAt: new Date(),
      platformTradeNumber: '1243980127',
      channel: NewebPaymentChannel.WEBATM,
    }, {
      channel: Channel.WEB_ATM,
      buyerBankCode: '128',
      buyerAccountNumber: '89042',
    } as WebATMPaymentInfo)).toThrow();
  });

  it('should throw error when commit id not matched', () => {
    const order = payment.prepare({
      id: '123142',
      items: [{
        name: 'test',
        unitPrice: 100,
        quantity: 2,
      }],
      channel: NewebPaymentChannel.WEBATM,
    });

    order.form;

    expect(() => order.commit<NewebPayWebATMCommitMessage>({
      id: '123143',
      totalPrice: 200,
      committedAt: new Date(),
      platformTradeNumber: '1243980127',
      channel: NewebPaymentChannel.WEBATM,
    }, {
      channel: Channel.WEB_ATM,
      buyerBankCode: '128',
      buyerAccountNumber: '89042',
    } as WebATMPaymentInfo)).toThrow();
  });
});
