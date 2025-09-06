import { Channel, CreditCardAuthInfo, CreditCardECI, OrderState } from '@rytass/payments';
import { DateTime } from 'luxon';
import http, { createServer } from 'http';
import {
  ECPayPayment,
  ECPayOrderItem,
  ECPayCallbackPaymentType,
  ECPayChannelCreditCard,
  ECPayChannelVirtualAccount,
  ECPayOrder,
  ECPayQueryResultStatus,
  ECPayCreditCardOrderStatus,
} from '../src';

describe('ECPayOrder', () => {
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

  const payment = new ECPayPayment();

  it('should calculate total price', async () => {
    const order = await payment.prepare<ECPayChannelCreditCard>({
      channel: Channel.CREDIT_CARD,
      items: [
        new ECPayOrderItem({
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }),
        new ECPayOrderItem({
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        }),
      ],
    });

    expect(order.totalPrice).toBe(70);
  });

  it('should get checkout url throw error when no server', async () => {
    const order = await payment.prepare<ECPayChannelCreditCard>({
      channel: Channel.CREDIT_CARD,
      items: [
        new ECPayOrderItem({
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        }),
        new ECPayOrderItem({
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        }),
      ],
    });

    expect(() => order.checkoutURL).toThrow();
  });

  it('should fallback channel to all', async () => {
    const allOrder = await payment.prepare<ECPayChannelCreditCard>({
      items: [
        {
          name: 'Test',
          unitPrice: 10,
          quantity: 1,
        },
        {
          name: '中文',
          unitPrice: 15,
          quantity: 4,
        },
      ],
    });

    expect(allOrder.paymentType).toBeUndefined();
    expect(allOrder.form.ChoosePayment).toBe('ALL');
  });

  it('should get valid checkout url', done => {
    const paymentWithServer = new ECPayPayment({
      withServer: true,
      serverHost: 'http://localhost:3001',
      onServerListen: async (): Promise<void> => {
        const withServerOrder = await paymentWithServer.prepare<ECPayChannelCreditCard>({
          channel: Channel.CREDIT_CARD,
          items: [
            {
              name: 'Test',
              unitPrice: 10,
              quantity: 1,
            },
            {
              name: '中文',
              unitPrice: 15,
              quantity: 4,
            },
          ],
        });

        const re = new RegExp(`${withServerOrder.id}$`);

        expect(withServerOrder.checkoutURL).toMatch(re);

        paymentWithServer._server?.close(done);
      },
    });
  });

  describe('Order Commit', () => {
    it('should represent pre commit state', async () => {
      const payment = new ECPayPayment({
        merchantId: 'mid',
      });

      const order = await payment.prepare<ECPayChannelCreditCard>({
        items: [
          {
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          },
          {
            name: '中文',
            unitPrice: 15,
            quantity: 4,
          },
        ],
      });

      expect(order.state).toBe(OrderState.INITED);
      order.formHTML;

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

    it('should block form getter after committed', async () => {
      const payment = new ECPayPayment({
        merchantId: 'mid',
      });

      const order = await payment.prepare<ECPayChannelCreditCard>({
        channel: Channel.CREDIT_CARD,
        items: [
          {
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          },
          {
            name: '中文',
            unitPrice: 15,
            quantity: 4,
          },
        ],
      });

      order.formHTML;

      order.commit({
        id: order.id,
        totalPrice: order.totalPrice,
        committedAt: new Date(),
        tradeDate: new Date(),
        tradeNumber: 'fakeid',
        merchantId: 'mid',
        paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
      });

      expect(() => order.form).toThrow();
      expect(() => order.formHTML).toThrow();
    });

    it('should get commit message after committed', async () => {
      const payment = new ECPayPayment({
        merchantId: 'mid',
      });

      const order = await payment.prepare<ECPayChannelCreditCard>({
        channel: Channel.CREDIT_CARD,
        items: [
          {
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          },
          {
            name: '中文',
            unitPrice: 15,
            quantity: 4,
          },
        ],
      });

      order.formHTML;

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

      order.commit(
        {
          id: order.id,
          totalPrice: order.totalPrice,
          committedAt,
          tradeDate: createdAt,
          tradeNumber: platformTradeNumber,
          merchantId: 'mid',
          paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        },
        creditCardAuthInfo,
      );

      expect(order.committedAt).toBe(committedAt);
      expect(order.createdAt).toBe(createdAt);
      expect(order.additionalInfo).toBe(creditCardAuthInfo);
      expect(order.platformTradeNumber).toBe(platformTradeNumber);
      expect(order.paymentType).toBe(ECPayCallbackPaymentType.CREDIT_CARD);
    });

    it('should reject commit if message data not match', async () => {
      const payment = new ECPayPayment<ECPayChannelCreditCard>({
        merchantId: 'mid',
      });

      const order = await payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [
          {
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          },
          {
            name: '中文',
            unitPrice: 15,
            quantity: 4,
          },
        ],
      });

      order.formHTML;

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
      }).toThrow();

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
      }).toThrow();

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
      }).toThrow();
    });

    it('should reject invalid state order', async () => {
      const payment = new ECPayPayment<ECPayChannelCreditCard | ECPayChannelVirtualAccount>({
        merchantId: 'mid',
      });

      const order = await payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [
          {
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          },
          {
            name: '中文',
            unitPrice: 15,
            quantity: 4,
          },
        ],
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
      }).toThrow();
    });
  });

  describe('Refund', () => {
    it('should reject if order not committed', async () => {
      const payment = new ECPayPayment<ECPayChannelCreditCard>();

      const order = await payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [
          {
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          },
          {
            name: '中文',
            unitPrice: 15,
            quantity: 4,
          },
        ],
      });

      expect(() => order.refund()).rejects.toThrow();
    });

    it('should reject non credit card order refund request', () => {
      const payment = new ECPayPayment<ECPayChannelVirtualAccount>();

      const order = new ECPayOrder({
        id: 'testorder',
        items: [
          {
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          },
          {
            name: '中文',
            unitPrice: 15,
            quantity: 4,
          },
        ],
        gateway: payment,
        createdAt: new Date(),
        committedAt: new Date(),
        platformTradeNumber: 'platformnumber',
        paymentType: ECPayCallbackPaymentType.BARCODE,
        status: ECPayQueryResultStatus.COMMITTED,
      });

      expect(() => order.refund()).rejects.toThrow();
    });

    it('should reject no gwsr credit card order', async () => {
      const payment = new ECPayPayment<ECPayChannelCreditCard>();

      const order = await payment.prepare({
        channel: Channel.CREDIT_CARD,
        items: [
          {
            name: 'Test',
            unitPrice: 10,
            quantity: 1,
          },
          {
            name: '中文',
            unitPrice: 15,
            quantity: 4,
          },
        ],
      });

      order.form;

      order.commit(
        {
          id: order.id,
          totalPrice: order.totalPrice,
          committedAt: new Date(),
          tradeDate: new Date(),
          tradeNumber: 'fakeid',
          merchantId: '2000132',
          paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
        },
        {
          channel: Channel.CREDIT_CARD,
          processDate: DateTime.fromFormat('2023/01/27 14:55:00', 'yyyy/MM/dd HH:mm:ss').toJSDate(),
          authCode: '123456',
          amount: 1800,
          eci: CreditCardECI.VISA_AE_JCB_3D,
          card4Number: '4230',
          card6Number: '401494',
          gwsr: '',
        } as CreditCardAuthInfo,
      );

      expect(() => order.refund()).rejects.toThrow();
    });

    describe('Refund Action Cases', () => {
      it('should represent R on credit card order CLOSED', async () => {
        const payment = new ECPayPayment<ECPayChannelCreditCard>();

        const order = await payment.prepare({
          channel: Channel.CREDIT_CARD,
          items: [
            {
              name: 'Test',
              unitPrice: 10,
              quantity: 1,
            },
            {
              name: '中文',
              unitPrice: 15,
              quantity: 4,
            },
          ],
        });

        order.form;

        order.commit(
          {
            id: order.id,
            totalPrice: order.totalPrice,
            committedAt: new Date(),
            tradeDate: new Date(),
            tradeNumber: 'fakeid',
            merchantId: '2000132',
            paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
          },
          {
            channel: Channel.CREDIT_CARD,
            processDate: DateTime.fromFormat('2023/01/27 14:55:00', 'yyyy/MM/dd HH:mm:ss').toJSDate(),
            authCode: '123456',
            amount: 1800,
            eci: CreditCardECI.VISA_AE_JCB_3D,
            card4Number: '4230',
            card6Number: '401494',
            gwsr: '789104',
          } as CreditCardAuthInfo,
        );

        const mockGetCreditCardTradeStatus = jest.spyOn(payment, 'getCreditCardTradeStatus');
        const mockDoAction = jest.spyOn(payment, 'doOrderAction');

        mockGetCreditCardTradeStatus.mockImplementationOnce(() => Promise.resolve(ECPayCreditCardOrderStatus.CLOSED));

        await new Promise<void>(pResolve => {
          mockDoAction.mockImplementationOnce(async (_order, action) => {
            expect(action).toBe('R');

            pResolve();
          });

          order.refund();
        });
      });

      it('should represent N on credit card order AUTHORIZED', async () => {
        const payment = new ECPayPayment<ECPayChannelCreditCard>();

        const order = await payment.prepare({
          channel: Channel.CREDIT_CARD,
          items: [
            {
              name: 'Test',
              unitPrice: 10,
              quantity: 1,
            },
            {
              name: '中文',
              unitPrice: 15,
              quantity: 4,
            },
          ],
        });

        order.form;

        order.commit(
          {
            id: order.id,
            totalPrice: order.totalPrice,
            committedAt: new Date(),
            tradeDate: new Date(),
            tradeNumber: 'fakeid',
            merchantId: '2000132',
            paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
          },
          {
            channel: Channel.CREDIT_CARD,
            processDate: DateTime.fromFormat('2023/01/27 14:55:00', 'yyyy/MM/dd HH:mm:ss').toJSDate(),
            authCode: '123456',
            amount: 1800,
            eci: CreditCardECI.VISA_AE_JCB_3D,
            card4Number: '4230',
            card6Number: '401494',
            gwsr: '789104',
          } as CreditCardAuthInfo,
        );

        const mockGetCreditCardTradeStatus = jest.spyOn(payment, 'getCreditCardTradeStatus');
        const mockDoAction = jest.spyOn(payment, 'doOrderAction');

        mockGetCreditCardTradeStatus.mockImplementationOnce(() =>
          Promise.resolve(ECPayCreditCardOrderStatus.AUTHORIZED),
        );

        await new Promise<void>(pResolve => {
          mockDoAction.mockImplementationOnce(async (_order, action) => {
            expect(action).toBe('N');

            pResolve();
          });

          order.refund();
        });
      });

      it('should throw error on credit card order UNAUTHORIZED', async () => {
        const payment = new ECPayPayment<ECPayChannelCreditCard>();

        const order = await payment.prepare({
          channel: Channel.CREDIT_CARD,
          items: [
            {
              name: 'Test',
              unitPrice: 10,
              quantity: 1,
            },
            {
              name: '中文',
              unitPrice: 15,
              quantity: 4,
            },
          ],
        });

        order.form;

        order.commit(
          {
            id: order.id,
            totalPrice: order.totalPrice,
            committedAt: new Date(),
            tradeDate: new Date(),
            tradeNumber: 'fakeid',
            merchantId: '2000132',
            paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
          },
          {
            channel: Channel.CREDIT_CARD,
            processDate: DateTime.fromFormat('2023/01/27 14:55:00', 'yyyy/MM/dd HH:mm:ss').toJSDate(),
            authCode: '123456',
            amount: 1800,
            eci: CreditCardECI.VISA_AE_JCB_3D,
            card4Number: '4230',
            card6Number: '401494',
            gwsr: '789104',
          } as CreditCardAuthInfo,
        );

        const mockGetCreditCardTradeStatus = jest.spyOn(payment, 'getCreditCardTradeStatus');

        mockGetCreditCardTradeStatus.mockImplementationOnce(() =>
          Promise.resolve(ECPayCreditCardOrderStatus.UNAUTHORIZED),
        );

        expect(() => order.refund()).rejects.toThrow();
      });

      it('should throw error on credit card order CANCELLED/MANUALLY_CANCELLED', async () => {
        const payment = new ECPayPayment<ECPayChannelCreditCard>();

        const order = await payment.prepare({
          channel: Channel.CREDIT_CARD,
          items: [
            {
              name: 'Test',
              unitPrice: 10,
              quantity: 1,
            },
            {
              name: '中文',
              unitPrice: 15,
              quantity: 4,
            },
          ],
        });

        order.form;

        order.commit(
          {
            id: order.id,
            totalPrice: order.totalPrice,
            committedAt: new Date(),
            tradeDate: new Date(),
            tradeNumber: 'fakeid',
            merchantId: '2000132',
            paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
          },
          {
            channel: Channel.CREDIT_CARD,
            processDate: DateTime.fromFormat('2023/01/27 14:55:00', 'yyyy/MM/dd HH:mm:ss').toJSDate(),
            authCode: '123456',
            amount: 1800,
            eci: CreditCardECI.VISA_AE_JCB_3D,
            card4Number: '4230',
            card6Number: '401494',
            gwsr: '789104',
          } as CreditCardAuthInfo,
        );

        const mockGetCreditCardTradeStatus = jest.spyOn(payment, 'getCreditCardTradeStatus');

        mockGetCreditCardTradeStatus.mockImplementationOnce(() =>
          Promise.resolve(ECPayCreditCardOrderStatus.CANCELLED),
        );

        mockGetCreditCardTradeStatus.mockImplementationOnce(() =>
          Promise.resolve(ECPayCreditCardOrderStatus.MANUALLY_CANCELLED),
        );

        expect(() => order.refund()).rejects.toThrow();
        expect(() => order.refund()).rejects.toThrow();
      });
    });
  });

  describe('prepareForBoundCardCommit', () => {
    it('should transition order from INITED to PRE_COMMIT state', () => {
      const order = new ECPayOrder({
        id: 'test-bound-card-1',
        items: [
          {
            name: 'Test Item',
            unitPrice: 100,
            quantity: 1,
          },
        ],
        gateway: payment,
        cardId: 'card-123',
        memberId: 'member-456',
      });

      expect(order.state).toBe(OrderState.INITED);

      order.prepareForBoundCardCommit();

      expect(order.state).toBe(OrderState.PRE_COMMIT);
    });

    it('should throw error if order is not in INITED state', () => {
      const order = new ECPayOrder({
        id: 'test-bound-card-2',
        items: [
          {
            name: 'Test Item',
            unitPrice: 100,
            quantity: 1,
          },
        ],
        gateway: payment,
        cardId: 'card-123',
        memberId: 'member-456',
      });

      // First transition to PRE_COMMIT
      order.prepareForBoundCardCommit();

      // Try to prepare again should throw
      expect(() => order.prepareForBoundCardCommit()).toThrow(
        'Only inited order can prepare for bound card commit, now: PRE_COMMIT',
      );
    });
  });

  describe('commit with bound card', () => {
    it('should commit order without form validation for bound card checkout', () => {
      const order = new ECPayOrder({
        id: 'test-bound-card-3',
        items: [
          {
            name: 'Test Item',
            unitPrice: 100,
            quantity: 1,
          },
        ],
        gateway: payment,
        cardId: 'card-123',
        memberId: 'member-456',
      });

      order.prepareForBoundCardCommit();

      const commitMessage = {
        id: 'test-bound-card-3',
        totalPrice: 100,
        committedAt: new Date(),
        merchantId: '2000214',
        tradeNumber: 'TRADE123',
        tradeDate: new Date(),
        paymentType: ECPayCallbackPaymentType.CREDIT_CARD,
      } as ECPayChannelCreditCard;

      expect(() => order.commit(commitMessage)).not.toThrow();
      expect(order.state).toBe(OrderState.COMMITTED);
      expect(order.committedAt).toEqual(commitMessage.committedAt);
      expect(order.platformTradeNumber).toBe('TRADE123');
    });
  });

  describe('checkoutMemberId and checkoutCardId', () => {
    it('should return member and card IDs for bound card checkout', () => {
      const order = new ECPayOrder({
        id: 'test-bound-card-4',
        items: [
          {
            name: 'Test Item',
            unitPrice: 100,
            quantity: 1,
          },
        ],
        gateway: payment,
        cardId: 'card-789',
        memberId: 'member-012',
      });

      expect(order.checkoutMemberId).toBe('member-012');
      expect(order.checkoutCardId).toBe('card-789');
    });

    it('should return null for regular checkout', () => {
      const order = new ECPayOrder({
        id: 'test-regular-checkout',
        items: [
          {
            name: 'Test Item',
            unitPrice: 100,
            quantity: 1,
          },
        ],
        gateway: payment,
      });

      expect(order.checkoutMemberId).toBeNull();
      expect(order.checkoutCardId).toBeNull();
    });
  });
});
