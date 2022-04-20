import { Channel, CreditCardECI, OrderState } from '@rytass/payments';
import { ECPayPayment } from '.';
import { ECPayCallbackPaymentType } from './typings';

describe('ECPayOrder', () => {
  const payment = new ECPayPayment();

  const order = payment.prepare({
    channel: Channel.CREDIT_CARD,
    items: [{
      name: 'Test',
      unitPrice: 10,
      quantity: 1,
    }, {
      name: '中文',
      unitPrice: 15,
      quantity: 4,
    }],
  });

  it('should calculate total price', () => {
    expect(order.totalPrice).toBe(70);
  });

  it('should get checkout url throw error when no server', () => {
    expect(() => order.checkoutURL).toThrowError();
  });

  it('should fallback channel to all', () => {
    const allOrder = payment.prepare({
      items: [{
        name: 'Test',
        unitPrice: 10,
        quantity: 1,
      }, {
        name: '中文',
        unitPrice: 15,
        quantity: 4,
      }],
    });

    expect(allOrder.paymentType).toBeUndefined();
    expect(allOrder.form.ChoosePayment).toBe('ALL');
  });

  it('should get valid checkout url', (done) => {
    let finishable = false;

    const paymentWithServer = new ECPayPayment({
      withServer: true,
      serverHost: 'http://localhost:3001',
      onServerListen: () => {
        if (finishable) {
          paymentWithServer._server?.close(() => {
            done();
          });
        } else {
          finishable = true;
        }
      },
    });

    const withServerOrder = paymentWithServer.prepare({
      channel: Channel.CREDIT_CARD,
      items: [{
        name: 'Test',
        unitPrice: 10,
        quantity: 1,
      }, {
        name: '中文',
        unitPrice: 15,
        quantity: 4,
      }],
    });

    const re = new RegExp(`${withServerOrder.id}$`);

    expect(withServerOrder.checkoutURL).toMatch(re);

    if (finishable) {
      paymentWithServer._server?.close(() => {
        done();
      });
    }

    finishable = true;
  });

  describe('Order Commit', () => {
    it('should represent pre commit state', () => {
      const payment = new ECPayPayment({
        merchantId: 'mid',
      });

      const order = payment.prepare({
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }, {
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        }],
      });

      expect(order.state).toBe(OrderState.INITED);

      // eslint-disable-next-line no-unused-vars
      const html = order.formHTML;

      expect(order.state).toBe(OrderState.PRE_COMMIT);

      order.commit({
        id: order.id,
        totalPrice: order.totalPrice,
        committedAt: new Date(),
        tradeDate: new Date(),
        tradeNumber: 'fakeid',
        merchantId: 'mid',
        paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
      });

      expect(order.state).toBe(OrderState.COMMITTED);
    });

    it('should block form getter after committed', () => {
      const payment = new ECPayPayment({
        merchantId: 'mid',
      });

      const order = payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }, {
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        }],
      });

      // eslint-disable-next-line no-unused-vars
      const html = order.formHTML;

      order.commit({
        id: order.id,
        totalPrice: order.totalPrice,
        committedAt: new Date(),
        tradeDate: new Date(),
        tradeNumber: 'fakeid',
        merchantId: 'mid',
        paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
      });

      expect(() => order.form).toThrowError();
      expect(() => order.formHTML).toThrowError();
    });

    it('should get commit message after committed', () => {
      const payment = new ECPayPayment({
        merchantId: 'mid',
      });

      const order = payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }, {
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        }],
      });

      // eslint-disable-next-line no-unused-vars
      const html = order.formHTML;

      const createdAt = new Date();
      const committedAt = new Date();

      const creditCardAuthInfo = {
        processDate: new Date(),
        authCode: '470293',
        amount: order.totalPrice,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '4311',
        card6Number: '222222',
      };

      const platformTradeNumber = '517079903259023';

      order.commit({
        id: order.id,
        totalPrice: order.totalPrice,
        committedAt,
        tradeDate: createdAt,
        tradeNumber: platformTradeNumber,
        merchantId: 'mid',
        paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
      }, {
        creditCardAuthInfo,
      });

      expect(order.committedAt).toBe(committedAt);
      expect(order.createdAt).toBe(createdAt);
      expect(order.creditCardAuthInfo).toBe(creditCardAuthInfo);
      expect(order.platformTradeNumber).toBe(platformTradeNumber);
      expect(order.paymentType).toBe(ECPayCallbackPaymentType.CREDIT_CARD);
    });

    it('should reject commit if message data not match', () => {
      const payment = new ECPayPayment({
        merchantId: 'mid',
      });

      const order = payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }, {
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        }],
      });

      // eslint-disable-next-line no-unused-vars
      const html = order.formHTML;

      expect(() => {
        order.commit({
          id: order.id,
          totalPrice: order.totalPrice,
          committedAt: new Date(),
          tradeDate: new Date(),
          tradeNumber: 'fakeid',
          merchantId: 'wrongMerchantId',
          paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        });
      }).toThrowError();

      expect(() => {
        order.commit({
          id: order.id,
          totalPrice: order.totalPrice + 1,
          committedAt: new Date(),
          tradeDate: new Date(),
          tradeNumber: 'fakeid',
          merchantId: 'mid',
          paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        });
      }).toThrowError();

      expect(() => {
        order.commit({
          id: 'wrongId',
          totalPrice: order.totalPrice,
          committedAt: new Date(),
          tradeDate: new Date(),
          tradeNumber: 'fakeid',
          merchantId: 'mid',
          paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        });
      }).toThrowError();
    });

    it('should reject invalid state order', () => {
      const payment = new ECPayPayment({
        merchantId: 'mid',
      });

      const order = payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }, {
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        }],
      });

      expect(() => {
        order.commit({
          id: order.id,
          totalPrice: order.totalPrice,
          committedAt: new Date(),
          tradeDate: new Date(),
          tradeNumber: 'fakeid',
          merchantId: 'mid',
          paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        });
      }).toThrowError();
    });
  });
});
