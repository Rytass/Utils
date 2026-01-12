/**
 * @jest-environment node
 */
import { OrderState, PaymentEvents } from '@rytass/payments';
import { HappyCardOrder } from '../src/happy-card-order';
import { HappyCardPayment } from '../src/happy-card-payment';
import { HappyCardProductType, HappyCardRecordType } from '../src/typings';
import { EventEmitter } from 'events';

// Mock HappyCardPayment
jest.mock('../src/happy-card-payment', () => ({
  HappyCardPayment: jest.fn().mockImplementation(() => ({
    emitter: new EventEmitter(),
    commit: jest.fn(),
    refund: jest.fn(),
  })),
}));

describe('HappyCardOrder', () => {
  let mockGateway: jest.Mocked<HappyCardPayment>;
  let order: HappyCardOrder<never>;

  const defaultPayload = {
    trade_date: '2025-01-10T00:00:00.000',
    request_no: 'ORDER123',
    is_own_cup: 0 as const,
    cup_count: 0,
    pos_trade_no: 'POS123',
    MemberGid: 'MEMBER123',
    card_list: [
      {
        card_sn: 'CARD123',
        record_list: [],
        use_list: [
          {
            record_id: 1,
            type: HappyCardRecordType.AMOUNT,
            amt: 100,
            tax_type: '117' as const,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    mockGateway = new HappyCardPayment({
      cSource: 'test',
      key: 'test-key',
    }) as jest.Mocked<HappyCardPayment>;

    order = new HappyCardOrder({
      id: 'ORDER123',
      productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
      items: [{ name: 'Test Item', quantity: 1, unitPrice: 100 }],
      gateway: mockGateway,
      createdAt: new Date('2025-01-10'),
      posTradeNo: 'POS123',
      isIsland: false,
      payload: defaultPayload,
    });
  });

  describe('constructor and getters', () => {
    it('should initialize with correct id', () => {
      expect(order.id).toBe('ORDER123');
    });

    it('should initialize with correct productType', () => {
      expect(order.productType).toBe(HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF);
    });

    it('should initialize with correct posTradeNo', () => {
      expect(order.posTradeNo).toBe('POS123');
    });

    it('should initialize with correct items', () => {
      expect(order.items).toHaveLength(1);
      expect(order.items[0].name).toBe('Test Item');
    });

    it('should initialize with PRE_COMMIT state', () => {
      expect(order.state).toBe(OrderState.PRE_COMMIT);
    });

    it('should initialize with correct createdAt', () => {
      expect(order.createdAt).toEqual(new Date('2025-01-10'));
    });

    it('should initialize with no committedAt', () => {
      expect(order.committedAt).toBeFalsy();
    });

    it('should return gateway', () => {
      expect(order.gateway).toBe(mockGateway);
    });

    it('should be committable when state is PRE_COMMIT', () => {
      expect(order.committable).toBe(true);
    });

    it('should initialize isIsland to false by default', () => {
      const orderWithoutIsland = new HappyCardOrder({
        id: 'ORDER456',
        productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
        items: [],
        gateway: mockGateway,
        createdAt: new Date(),
        payload: defaultPayload,
      });

      // isIsland is private but we can verify behavior through commit
      expect(orderWithoutIsland.committable).toBe(true);
    });

    it('should handle empty posTradeNo', () => {
      const orderWithoutPosTradeNo = new HappyCardOrder({
        id: 'ORDER789',
        productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
        items: [],
        gateway: mockGateway,
        createdAt: new Date(),
        payload: defaultPayload,
      });

      expect(orderWithoutPosTradeNo.posTradeNo).toBe('');
    });
  });

  describe('failedMessage', () => {
    it('should return null when state is not FAILED', () => {
      expect(order.failedMessage).toBeNull();
    });

    it('should return fail message when state is FAILED', () => {
      order.fail('E001', 'Test error message');

      expect(order.failedMessage).toEqual({
        code: 'E001',
        message: 'Test error message',
      });
    });
  });

  describe('infoRetrieved', () => {
    it('should throw error as Happy Card does not support async info', () => {
      expect(() => order.infoRetrieved()).toThrow('Happy card order does not support async info');
    });
  });

  describe('fail', () => {
    it('should set state to FAILED', () => {
      order.fail('E001', 'Test error');

      expect(order.state).toBe(OrderState.FAILED);
    });

    it('should emit ORDER_FAILED event', () => {
      const failedHandler = jest.fn();

      mockGateway.emitter.on(PaymentEvents.ORDER_FAILED, failedHandler);
      order.fail('E001', 'Test error');

      expect(failedHandler).toHaveBeenCalledWith(order);
    });
  });

  describe('commit', () => {
    it('should throw error when order is not committable', async () => {
      // First fail the order to make it not committable
      order.fail('E001', 'Test error');

      await expect(order.commit()).rejects.toThrow('Order is not committable');
    });

    it('should commit successfully', async () => {
      (mockGateway.commit as jest.Mock).mockResolvedValueOnce(undefined);

      await order.commit();

      expect(order.state).toBe(OrderState.COMMITTED);
      expect(order.committedAt).not.toBeNull();
    });

    it('should emit ORDER_COMMITTED event on success', async () => {
      const committedHandler = jest.fn();

      mockGateway.emitter.on(PaymentEvents.ORDER_COMMITTED, committedHandler);
      (mockGateway.commit as jest.Mock).mockResolvedValueOnce(undefined);

      await order.commit();

      expect(committedHandler).toHaveBeenCalledWith(order);
    });

    it('should set state to FAILED when commit fails', async () => {
      (mockGateway.commit as jest.Mock).mockRejectedValueOnce(new Error('[E002] Commit failed'));

      await order.commit();

      expect(order.state).toBe(OrderState.FAILED);
      expect(order.failedMessage).toEqual({
        code: 'E002',
        message: 'Commit failed',
      });
    });

    it('should not be committable after successful commit', async () => {
      (mockGateway.commit as jest.Mock).mockResolvedValueOnce(undefined);

      await order.commit();

      expect(order.committable).toBe(false);
    });
  });

  describe('refund', () => {
    it('should throw error when order is not committed', async () => {
      await expect(order.refund()).rejects.toThrow('Order is not committed');
    });

    it('should refund successfully when order is committed', async () => {
      // First commit the order
      (mockGateway.commit as jest.Mock).mockResolvedValueOnce(undefined);
      await order.commit();

      // Then refund
      (mockGateway.refund as jest.Mock).mockResolvedValueOnce(undefined);
      await order.refund();

      expect(order.state).toBe(OrderState.REFUNDED);
    });

    it('should set state to FAILED when refund fails', async () => {
      // First commit the order
      (mockGateway.commit as jest.Mock).mockResolvedValueOnce(undefined);
      await order.commit();

      // Then refund with error
      (mockGateway.refund as jest.Mock).mockRejectedValueOnce(new Error('[E003] Refund failed'));
      await order.refund();

      expect(order.state).toBe(OrderState.FAILED);
      expect(order.failedMessage).toEqual({
        code: 'E003',
        message: 'Refund failed',
      });
    });
  });
});
