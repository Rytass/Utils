import { Channel, CreditCardAuthInfo, CreditCardECI, OrderState } from '@rytass/payments';
import { DateTime } from 'luxon';
import { ECPayPayment, ECPayOrderItem, ECPayCallbackPaymentType, ECPayChannelCreditCard, ECPayChannelVirtualAccount, ECPayOrder, ECPayQueryResultStatus, ECPayCreditCardOrderStatus } from '../src';

describe('ECPayOrder', () => {
  const payment = new ECPayPayment();

  const order = payment.prepare<ECPayChannelCreditCard>({
    channel: Channel.CREDIT_CARD,
    items: [new ECPayOrderItem({
      name: 'Test',
      unitPrice: 10,
      quantity: 1,
    }), new ECPayOrderItem({
      name: '中文',
      unitPrice: 15,
      quantity: 4,
    })],
  });

  it('should calculate total price', () => {
    expect(order.totalPrice).toBe(70);
  });

  it('should get checkout url throw error when no server', () => {
    expect(() => order.checkoutURL).toThrowError();
  });

  it('should fallback channel to all', () => {
    const allOrder = payment.prepare<ECPayChannelCreditCard>({
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
    const paymentWithServer = new ECPayPayment({
      withServer: true,
      serverHost: 'http://localhost:3001',
      onServerListen: () => {
        const withServerOrder = paymentWithServer.prepare<ECPayChannelCreditCard>({
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

        paymentWithServer._server?.close(done);
      },
    });
  });

  describe('Order Commit', () => {
    it('should represent pre commit state', () => {
      const payment = new ECPayPayment({
        merchantId: 'mid',
      });

      const order = payment.prepare<ECPayChannelCreditCard>({
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

      const order = payment.prepare<ECPayChannelCreditCard>({
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

      const order = payment.prepare<ECPayChannelCreditCard>({
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
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        authCode: '470293',
        amount: order.totalPrice,
        eci: CreditCardECI.MASTER_3D,
        card4Number: '4311',
        card6Number: '222222',
      } as CreditCardAuthInfo;

      const platformTradeNumber = '517079903259023';

      order.commit({
        id: order.id,
        totalPrice: order.totalPrice,
        committedAt,
        tradeDate: createdAt,
        tradeNumber: platformTradeNumber,
        merchantId: 'mid',
        paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
      }, creditCardAuthInfo);

      expect(order.committedAt).toBe(committedAt);
      expect(order.createdAt).toBe(createdAt);
      expect(order.additionalInfo).toBe(creditCardAuthInfo);
      expect(order.platformTradeNumber).toBe(platformTradeNumber);
      expect(order.paymentType).toBe(ECPayCallbackPaymentType.CREDIT_CARD);
    });

    it('should reject commit if message data not match', () => {
      const payment = new ECPayPayment<ECPayChannelCreditCard>({
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
      const payment = new ECPayPayment<ECPayChannelCreditCard | ECPayChannelVirtualAccount>({
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

  describe('Refund', () => {
    it('should reject if order not committed', () => {
      const payment = new ECPayPayment<ECPayChannelCreditCard>();

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

      expect(() => order.refund()).rejects.toThrow();
    });

    it('should reject non credit card order refund request', () => {
      const payment = new ECPayPayment<ECPayChannelVirtualAccount>();

      const order = new ECPayOrder({
        id: 'testorder',
        items: [{
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }, {
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        }],
        gateway: payment,
        createdAt: new Date(),
        committedAt: new Date(),
        platformTradeNumber: 'platformnumber',
        paymentType: ECPayCallbackPaymentType.BARCODE,
        status: ECPayQueryResultStatus.COMMITTED,
      });

      expect(() => order.refund()).rejects.toThrow();
    });

    it('should reject no gwsr credit card order', () => {
      const payment = new ECPayPayment<ECPayChannelCreditCard>();

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

      order.form;

      order.commit({
        id: order.id,
        totalPrice: order.totalPrice,
        committedAt: new Date(),
        tradeDate: new Date(),
        tradeNumber: 'fakeid',
        merchantId: '2000132',
        paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
      }, {
        channel: Channel.CREDIT_CARD,
        processDate: DateTime.fromFormat('2023/01/27 14:55:00', 'yyyy/MM/dd HH:mm:ss').toJSDate(),
        authCode: '123456',
        amount: 1800,
        eci: CreditCardECI.VISA_AE_JCB_3D,
        card4Number: '4230',
        card6Number: '401494',
        gwsr: '',
      } as CreditCardAuthInfo);

      expect(() => order.refund()).rejects.toThrow();
    });

    describe('Refund Action Cases', () => {
      it('should represent R on credit card order CLOSED', (done) => {
        const payment = new ECPayPayment<ECPayChannelCreditCard>();

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

        order.form;

        order.commit({
          id: order.id,
          totalPrice: order.totalPrice,
          committedAt: new Date(),
          tradeDate: new Date(),
          tradeNumber: 'fakeid',
          merchantId: '2000132',
          paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        }, {
          channel: Channel.CREDIT_CARD,
          processDate: DateTime.fromFormat('2023/01/27 14:55:00', 'yyyy/MM/dd HH:mm:ss').toJSDate(),
          authCode: '123456',
          amount: 1800,
          eci: CreditCardECI.VISA_AE_JCB_3D,
          card4Number: '4230',
          card6Number: '401494',
          gwsr: '789104',
        } as CreditCardAuthInfo);

        const mockGetCreditCardTradeStatus = jest.spyOn(payment, 'getCreditCardTradeStatus');
        const mockDoAction = jest.spyOn(payment, 'doOrderAction');

        mockGetCreditCardTradeStatus.mockImplementationOnce(() => Promise.resolve(ECPayCreditCardOrderStatus.CLOSED));
        mockDoAction.mockImplementationOnce(async (order, action) => {
          expect(action).toBe('R');

          done();
        });

        order.refund();
      });

      it('should represent N on credit card order AUTHORIZED', (done) => {
        const payment = new ECPayPayment<ECPayChannelCreditCard>();

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

        order.form;

        order.commit({
          id: order.id,
          totalPrice: order.totalPrice,
          committedAt: new Date(),
          tradeDate: new Date(),
          tradeNumber: 'fakeid',
          merchantId: '2000132',
          paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        }, {
          channel: Channel.CREDIT_CARD,
          processDate: DateTime.fromFormat('2023/01/27 14:55:00', 'yyyy/MM/dd HH:mm:ss').toJSDate(),
          authCode: '123456',
          amount: 1800,
          eci: CreditCardECI.VISA_AE_JCB_3D,
          card4Number: '4230',
          card6Number: '401494',
          gwsr: '789104',
        } as CreditCardAuthInfo);

        const mockGetCreditCardTradeStatus = jest.spyOn(payment, 'getCreditCardTradeStatus');
        const mockDoAction = jest.spyOn(payment, 'doOrderAction');

        mockGetCreditCardTradeStatus.mockImplementationOnce(() => Promise.resolve(ECPayCreditCardOrderStatus.AUTHORIZED));
        mockDoAction.mockImplementationOnce(async (order, action) => {
          expect(action).toBe('N');

          done();
        });

        order.refund();
      });

      it('should throw error on credit card order UNAUTHORIZED', () => {
        const payment = new ECPayPayment<ECPayChannelCreditCard>();

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

        order.form;

        order.commit({
          id: order.id,
          totalPrice: order.totalPrice,
          committedAt: new Date(),
          tradeDate: new Date(),
          tradeNumber: 'fakeid',
          merchantId: '2000132',
          paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        }, {
          channel: Channel.CREDIT_CARD,
          processDate: DateTime.fromFormat('2023/01/27 14:55:00', 'yyyy/MM/dd HH:mm:ss').toJSDate(),
          authCode: '123456',
          amount: 1800,
          eci: CreditCardECI.VISA_AE_JCB_3D,
          card4Number: '4230',
          card6Number: '401494',
          gwsr: '789104',
        } as CreditCardAuthInfo);

        const mockGetCreditCardTradeStatus = jest.spyOn(payment, 'getCreditCardTradeStatus');

        mockGetCreditCardTradeStatus.mockImplementationOnce(() => Promise.resolve(ECPayCreditCardOrderStatus.UNAUTHORIZED));

        expect(() => order.refund()).rejects.toThrow();
      });

      it('should throw error on credit card order CANCELLED/MANUALLY_CANCELLED', () => {
        const payment = new ECPayPayment<ECPayChannelCreditCard>();

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

        order.form;

        order.commit({
          id: order.id,
          totalPrice: order.totalPrice,
          committedAt: new Date(),
          tradeDate: new Date(),
          tradeNumber: 'fakeid',
          merchantId: '2000132',
          paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        }, {
          channel: Channel.CREDIT_CARD,
          processDate: DateTime.fromFormat('2023/01/27 14:55:00', 'yyyy/MM/dd HH:mm:ss').toJSDate(),
          authCode: '123456',
          amount: 1800,
          eci: CreditCardECI.VISA_AE_JCB_3D,
          card4Number: '4230',
          card6Number: '401494',
          gwsr: '789104',
        } as CreditCardAuthInfo);

        const mockGetCreditCardTradeStatus = jest.spyOn(payment, 'getCreditCardTradeStatus');

        mockGetCreditCardTradeStatus.mockImplementationOnce(() => Promise.resolve(ECPayCreditCardOrderStatus.CANCELLED));
        mockGetCreditCardTradeStatus.mockImplementationOnce(() => Promise.resolve(ECPayCreditCardOrderStatus.MANUALLY_CANCELLED));

        expect(() => order.refund()).rejects.toThrow();
        expect(() => order.refund()).rejects.toThrow();
      });
    });
  });
});
