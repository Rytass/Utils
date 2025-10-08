import { ICashPayPayment } from '../src/icash-pay-payment';
import { ICashPayOrder } from '../src/icash-pay-order';
import { ICashPayCommitMessage, ICashPayPaymentType } from '../src/typing';
import { OrderFailMessage, OrderState, PaymentEvents } from '../../payments/src/typings';
import { ICashPayOrderItem } from '../src/icash-pay-order-item';

jest.mock('../src/icash-pay-payment');

describe('ICashPayOrder', () => {
  const mockItems = [
    {
      name: 'Product A',
      unitPrice: 1000,
      quantity: 2,
    },
    {
      name: 'Product B',
      unitPrice: 500,
      quantity: 1,
    },
  ];

  const mockOrderOptions = {
    id: 'order-1',
    items: mockItems,
    gateway: {} as ICashPayPayment<ICashPayCommitMessage>,
    createdAt: new Date(),
    committedAt: new Date(),
    transactionId: 'transaction-1',
    icpAccount: 'icp-account-1',
    paymentType: ICashPayPaymentType.BANK,
    boundMemberId: 'member-1',
    invoiceMobileCarrier: 'carrier-1',
    creditCardFirstSix: '123456',
    creditCardLastFour: '7890',
    isTWQRCode: false,
    twqrIssueCode: undefined,
    uniGID: 'gid-1',
    isRefunded: false,
    deductEncData: undefined,
    paidAmount: 2000,
    bonusAmount: 100,
  };

  describe('constructor', () => {
    it('should set _state to PRE_COMMIT if deductEncData is present', () => {
      const order = new ICashPayOrder({ ...mockOrderOptions, deductEncData: 'deduct-enc-data' });

      expect(Reflect.get(order, '_state')).toBe(OrderState.PRE_COMMIT);
    });

    it('should set _state to REFUNDED if isRefunded is present', () => {
      const order = new ICashPayOrder({ ...mockOrderOptions, isRefunded: true });

      expect(Reflect.get(order, '_state')).toBe(OrderState.REFUNDED);
    });

    it('should call fail if failedCode is present', () => {
      const failSpy = jest.spyOn(ICashPayOrder.prototype, 'fail').mockImplementation(() => {});

      new ICashPayOrder({
        ...mockOrderOptions,
        failedCode: 'failed-code',
        failedMessage: 'failed-message',
      });

      expect(failSpy).toHaveBeenCalledWith('failed-code', 'failed-message');

      failSpy.mockRestore();
    });

    it('should change state to COMMITTED if committedAt is present', () => {
      const order = new ICashPayOrder({ ...mockOrderOptions, committedAt: new Date() });

      expect(Reflect.get(order, '_state')).toBe(OrderState.COMMITTED);
    });

    it('should change state to INITED if committedAt is not present', () => {
      const order = new ICashPayOrder({ ...mockOrderOptions, committedAt: null });

      expect(Reflect.get(order, '_state')).toBe(OrderState.INITED);
    });
  });

  describe('Function', () => {
    let order: ICashPayOrder;

    const mockResponse = {
      PaymentDate: '2025/09/30 12:34:56',
      TransactionID: 'TXN123456',
      ICPAccount: 'ICP-ACC-001',
      PaymentType: 'CREDIT_CARD',
      MMemberID: 'MEMBER-999',
      MobileInvoiceCarry: 'MOBILE-CARRIER',
      MaskedPan: '123456******7890',
      IsFiscTWQC: 1,
      FiscTWQRIssCode: 'TWQRCODE-001',
      GID: 'UNIGID-001',
      ICPAmount: '1500',
      BonusAmt: '500',
    };

    describe('ICashPayOrder.commit', () => {
      beforeEach(() => {
        order = new ICashPayOrder({ ...mockOrderOptions, deductEncData: 'deduct-enc-data' });

        Reflect.set(order, '_gateway', {
          commit: jest.fn().mockResolvedValue(mockResponse),
          emitter: { emit: jest.fn() },
        });
      });

      it('should throw error if order is not committable', async () => {
        Reflect.set(order, '_state', OrderState.INITED);
        await expect(order.commit()).rejects.toThrow('Order is not committable');
      });

      it('should emit order committed in gateway', async () => {
        await order.commit();
        expect(order.gateway.emitter.emit).toHaveBeenCalledWith(PaymentEvents.ORDER_COMMITTED, order);
      });

      it('should emit order committed event when optional fields are missing', async () => {
        Reflect.set(order, '_gateway', {
          commit: jest.fn().mockResolvedValue({
            PaymentDate: '2025/09/30 12:34:56',
            TransactionID: 'TXN123456',
            ICPAccount: 'ICP-ACC-001',
            PaymentType: 'CREDIT_CARD',
            IsFiscTWQC: 1,
            ICPAmount: undefined,
            BonusAmt: undefined,
          }),
          emitter: { emit: jest.fn() },
        });

        await order.commit();
        expect(order.gateway.emitter.emit).toHaveBeenCalledWith(PaymentEvents.ORDER_COMMITTED, order);
      });

      it('should fail if commit fails', async () => {
        Reflect.set(order, '_gateway', {
          commit: jest.fn().mockRejectedValue(new Error('commit failed')),
          emitter: { emit: jest.fn() },
        });

        await expect(order.commit());

        expect(Reflect.get(order, '_state')).toBe(OrderState.FAILED);
      });
    });

    describe('ICashPayOrder.refund', () => {
      beforeEach(() => {
        order = new ICashPayOrder({ ...mockOrderOptions, deductEncData: 'deduct-enc-data' });
      });

      it('should call gateway.refund with options', async () => {
        const mockRefundOptions = {
          requestRefundCollectedAmount: 100,
          requestRefundConsignmentAmount: 200,
          refundOrderId: 'refund-order-id',
          storeId: 'store-id',
          storeName: 'store-name',
        };

        const refund = jest.fn().mockResolvedValue(undefined);
        const mockGateway = { refund };

        const gatewayGetterSpy = jest
          .spyOn(ICashPayOrder.prototype as unknown as { gateway: unknown }, 'gateway', 'get')
          .mockReturnValue(mockGateway);

        await order.refund(500, mockRefundOptions);
        expect(refund).toHaveBeenCalledWith({
          id: 'order-1',
          transactionId: 'transaction-1',
          storeId: 'store-id',
          storeName: 'store-name',
          requestRefundAmount: 500,
          requestRefundCollectedAmount: 100,
          requestRefundConsignmentAmount: 200,
          refundOrderId: 'refund-order-id',
        });

        gatewayGetterSpy.mockRestore();
      });

      it('should call gateway.refund with no options', async () => {
        const refund = jest.fn().mockResolvedValue(undefined);
        const mockGateway = { refund };

        const gatewayGetterSpy = jest
          .spyOn(ICashPayOrder.prototype as unknown as { gateway: unknown }, 'gateway', 'get')
          .mockReturnValue(mockGateway);

        await order.refund(500);
        expect(refund).toHaveBeenCalledWith({
          id: 'order-1',
          transactionId: 'transaction-1',
          storeId: undefined,
          storeName: '',
          requestRefundAmount: 500,
          requestRefundCollectedAmount: 0,
          requestRefundConsignmentAmount: 0,
          refundOrderId: undefined,
        });

        gatewayGetterSpy.mockRestore();
      });
    });

    describe('other functions', () => {
      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('should id getter is called and returns value', () => {
        const order = new ICashPayOrder(mockOrderOptions);

        const getterSpy = jest.spyOn(Object.getPrototypeOf(order) as { id: string }, 'id', 'get');

        const result = order.id;

        expect(getterSpy).toHaveBeenCalled();
        expect(result).toBe('order-1');
      });

      it('should items getter is called and returns value', () => {
        const order = new ICashPayOrder(mockOrderOptions);

        const getterSpy = jest.spyOn(Object.getPrototypeOf(order) as { items: ICashPayOrderItem }, 'items', 'get');

        const result = order.items;

        expect(getterSpy).toHaveBeenCalled();
        expect(result).toBe(mockItems);
      });

      it('should state getter is called and returns value', () => {
        const order = new ICashPayOrder(mockOrderOptions);

        const getterSpy = jest.spyOn(Object.getPrototypeOf(order) as { state: OrderState }, 'state', 'get');

        const result = order.state;

        expect(getterSpy).toHaveBeenCalled();
        expect(result).toBe(OrderState.COMMITTED);
      });

      it('should createdAt getter is called and returns value', () => {
        const date = new Date();
        const order = new ICashPayOrder({ ...mockOrderOptions, createdAt: date });

        const getterSpy = jest.spyOn(Object.getPrototypeOf(order) as { createdAt: Date | null }, 'createdAt', 'get');

        const result = order.createdAt;

        expect(getterSpy).toHaveBeenCalled();
        expect(result).toBe(date);
      });

      it('should committedAt getter is called and returns value', () => {
        const date = new Date();
        const order = new ICashPayOrder({ ...mockOrderOptions, committedAt: date });

        const getterSpy = jest.spyOn(
          Object.getPrototypeOf(order) as { committedAt: Date | null },
          'committedAt',
          'get',
        );

        const result = order.committedAt;

        expect(getterSpy).toHaveBeenCalled();
        expect(result).toBe(date);
      });

      it('should failedMessage getter is called and returns null', () => {
        const order = new ICashPayOrder({ ...mockOrderOptions, failedMessage: 'failed-message' });

        const getterSpy = jest.spyOn(
          Object.getPrototypeOf(order) as { failedMessage: OrderFailMessage | null },
          'failedMessage',
          'get',
        );

        const result = order.failedMessage;

        expect(getterSpy).toHaveBeenCalled();
        expect(result).toBe(null);
      });

      it('should failedMessage getter is called and returns code and message', () => {
        jest.spyOn(ICashPayOrder.prototype, 'fail').mockImplementation(() => {});

        const order = new ICashPayOrder({
          ...mockOrderOptions,
          failedMessage: 'failed-message',
          failedCode: 'failed-code',
        });

        Reflect.set(order, '_state', OrderState.FAILED);

        const getterSpy = jest.spyOn(
          Object.getPrototypeOf(order) as { failedMessage: OrderFailMessage | null },
          'failedMessage',
          'get',
        );

        const result = order.failedMessage;

        expect(getterSpy).toHaveBeenCalled();
        expect(result).toEqual({ code: 'failed-code', message: 'failed-message' });
      });

      it('should totalAmount getter is called and returns value', () => {
        const order = new ICashPayOrder(mockOrderOptions);

        const getterSpy = jest.spyOn(Object.getPrototypeOf(order) as { totalAmount: number }, 'totalAmount', 'get');

        const result = order.totalAmount;

        expect(getterSpy).toHaveBeenCalled();
        expect(result).toBe(2100);
      });

      it('should paidAmount getter is called and returns value', () => {
        const order = new ICashPayOrder(mockOrderOptions);

        const getterSpy = jest.spyOn(Object.getPrototypeOf(order) as { paidAmount: number }, 'paidAmount', 'get');

        const result = order.paidAmount;

        expect(getterSpy).toHaveBeenCalled();
        expect(result).toBe(2000);
      });

      it('should bonusAmount getter is called and returns value', () => {
        const order = new ICashPayOrder(mockOrderOptions);

        const getterSpy = jest.spyOn(Object.getPrototypeOf(order) as { bonusAmount: number }, 'bonusAmount', 'get');

        const result = order.bonusAmount;

        expect(getterSpy).toHaveBeenCalled();
        expect(result).toBe(100);
      });

      it('should bonusAmount getter is called and returns value also warns if order is PRE_COMMIT', () => {
        const order = new ICashPayOrder(mockOrderOptions);

        const getterSpy = jest.spyOn(Object.getPrototypeOf(order) as { bonusAmount: number }, 'bonusAmount', 'get');
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        Reflect.set(order, '_state', OrderState.PRE_COMMIT);

        const result = order.bonusAmount;

        expect(getterSpy).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        expect(result).toBe(100);
      });

      it('should throw error if infoRetreived is called', () => {
        const order = new ICashPayOrder(mockOrderOptions);

        expect(order.infoRetrieved).toThrow('iCash Pay order does not support async info');
      });
    });
  });
});

describe('ICashPayOrderItem', () => {
  it('should set order items based on options', () => {
    const options = {
      name: 'Product A',
      unitPrice: 1000,
      quantity: 2,
    };

    const orderItems = new ICashPayOrderItem(options);

    expect(orderItems).toEqual({
      name: 'Product A',
      unitPrice: 1000,
      quantity: 2,
    });
  });
});
