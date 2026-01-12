/**
 * CTBCOrder 單元測試
 * 覆蓋 ctbc-order.ts 中未測試的 getters 和方法
 */

import { CardType, OrderState, PaymentEvents } from '@rytass/payments';
import { CTBCOrder } from '../src/ctbc-order';
import { CTBCPayment } from '../src/ctbc-payment';
import { CTBCOrderCommitMessage } from '../src/typings';

// Mock POS API utils
jest.mock('../src/ctbc-pos-api-utils', () => ({
  posApiQuery: jest.fn(),
  posApiRefund: jest.fn(),
  posApiCancelRefund: jest.fn(),
  posApiSmartCancelOrRefund: jest.fn(),
}));

// Mock AMEX API utils
jest.mock('../src/ctbc-amex-api-utils', () => ({
  amexCancelRefund: jest.fn(),
  amexSmartCancelOrRefund: jest.fn(),
}));

import * as posApiUtils from '../src/ctbc-pos-api-utils';
import * as amexApiUtils from '../src/ctbc-amex-api-utils';

const posApiSmartFlowMock = posApiUtils.posApiSmartCancelOrRefund as jest.MockedFunction<
  typeof posApiUtils.posApiSmartCancelOrRefund
>;

const amexSmartFlowMock = amexApiUtils.amexSmartCancelOrRefund as jest.MockedFunction<
  typeof amexApiUtils.amexSmartCancelOrRefund
>;

const amexCancelRefundMock = amexApiUtils.amexCancelRefund as jest.MockedFunction<typeof amexApiUtils.amexCancelRefund>;

describe('CTBCOrder unit tests', () => {
  const TEST_MERID = 'TEST_MERID';
  const TEST_MACKEY = '123456789012345678901234';
  const TEST_HOST = 'https://testepos.ctbcbank.com';

  let payment: CTBCPayment;

  beforeEach(() => {
    jest.resetAllMocks();

    payment = new CTBCPayment({
      merchantId: TEST_MERID,
      merId: TEST_MERID,
      txnKey: TEST_MACKEY,
      terminalId: 'test-terminal',
      baseUrl: TEST_HOST,
      isAmex: false,
    });
  });

  describe('constructor states', () => {
    it('should create order with INITED state when form is provided', () => {
      const order = new CTBCOrder({
        id: 'ORDER001',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        form: { MERID: TEST_MERID } as CTBCOrder['_form'],
        clientBackUrl: 'https://client-back',
      });

      expect(order.state).toBe(OrderState.INITED);
      expect(order.clientBackUrl).toBe('https://client-back');
    });

    it('should create order with REFUNDED state when refundedAt is provided', () => {
      const refundedAt = new Date('2025-01-01');
      const order = new CTBCOrder({
        id: 'ORDER002',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        refundedAt,
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123' },
      });

      expect(order.state).toBe(OrderState.REFUNDED);
      expect(order.refundedAt).toBe(refundedAt);
    });

    it('should create order with COMMITTED state when committedAt is provided', () => {
      const committedAt = new Date('2025-01-01');
      const order = new CTBCOrder({
        id: 'ORDER003',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        committedAt,
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123' },
      });

      expect(order.state).toBe(OrderState.COMMITTED);
      expect(order.committedAt).toBe(committedAt);
    });

    it('should create order with PRE_COMMIT state for bound card checkout', () => {
      const order = new CTBCOrder({
        id: 'ORDER004',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        checkoutCardId: 'CARD123',
        checkoutMemberId: 'MEMBER123',
      });

      expect(order.state).toBe(OrderState.PRE_COMMIT);
      expect(order.checkoutCardId).toBe('CARD123');
      expect(order.checkoutMemberId).toBe('MEMBER123');
    });
  });

  describe('getters', () => {
    it('should return correct totalPrice', () => {
      const order = new CTBCOrder({
        id: 'ORDER005',
        items: [
          { name: 'Item1', unitPrice: 100, quantity: 2 },
          { name: 'Item2', unitPrice: 50, quantity: 3 },
        ],
        gateway: payment,
      });

      expect(order.totalPrice).toBe(350); // 100*2 + 50*3
    });

    it('should throw when getting form for committed order', () => {
      const order = new CTBCOrder({
        id: 'ORDER006',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        committedAt: new Date(),
        additionalInfo: { xid: 'XID123' },
      });

      expect(() => order.form).toThrow('Finished order cannot get submit form data');
    });

    it('should throw when getting formHTML for failed order', () => {
      const order = new CTBCOrder({
        id: 'ORDER007',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        form: { MERID: TEST_MERID } as CTBCOrder['_form'],
      });

      order.fail('ERR01', 'Test error');

      expect(() => order.formHTML).toThrow('Finished order cannot get submit form url');
    });

    it('should return correct formHTML', () => {
      const order = new CTBCOrder({
        id: 'ORDER008',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        form: { MERID: TEST_MERID, Amount: '100' } as unknown as CTBCOrder['_form'],
      });

      const html = order.formHTML;

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('SSLAuthUI.jsp');
      expect(html).toContain(`name="MERID" value="${TEST_MERID}"`);
    });

    it('should return null failedMessage when not failed', () => {
      const order = new CTBCOrder({
        id: 'ORDER009',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
      });

      expect(order.failedMessage).toBeNull();
    });

    it('should return correct failedMessage after fail', () => {
      const order = new CTBCOrder({
        id: 'ORDER010',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        form: { MERID: TEST_MERID } as CTBCOrder['_form'],
      });

      order.fail('ERR01', 'Test error message');

      expect(order.failedMessage).toEqual({
        code: 'ERR01',
        message: 'Test error message',
      });
    });

    it('should return createdAt from constructor', () => {
      const createdAt = new Date('2025-01-15T10:00:00Z');
      const order = new CTBCOrder({
        id: 'ORDER010b',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        createdAt,
        committedAt: new Date(),
        additionalInfo: { xid: 'XID123' },
      });

      expect(order.createdAt).toBe(createdAt);
    });

    it('should return correct asyncInfo after infoRetrieved', () => {
      const order = new CTBCOrder({
        id: 'ORDER011',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        form: { MERID: TEST_MERID } as CTBCOrder['_form'],
      });

      const asyncInfo = { cardNumber: '1234****5678' };

      order.infoRetrieved(asyncInfo as unknown as CTBCOrder['_asyncInfo']);

      expect(order.asyncInfo).toBe(asyncInfo);
      expect(order.state).toBe(OrderState.ASYNC_INFO_RETRIEVED);
    });

    it('should return default cardType as VMJ', () => {
      const order = new CTBCOrder({
        id: 'ORDER012',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
      });

      expect(order.cardType).toBe(CardType.VMJ);
    });

    it('should return AE cardType when specified', () => {
      const order = new CTBCOrder({
        id: 'ORDER013',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        cardType: CardType.AE,
      });

      expect(order.cardType).toBe(CardType.AE);
    });
  });

  describe('boundCardCheckoutPayload', () => {
    it('should throw when checkoutCardId or checkoutMemberId is missing', () => {
      const order = new CTBCOrder({
        id: 'ORDER014',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
      });

      expect(() => order.boundCardCheckoutPayload).toThrow(
        'Bound card checkout payload requires checkoutCardId and checkoutMemberId',
      );
    });

    it('should return correct payload for bound card checkout', () => {
      const order = new CTBCOrder({
        id: 'ORDER015',
        items: [
          { name: 'Very Long Item Name That Exceeds 18 Characters', unitPrice: 100, quantity: 1 },
          { name: 'Item2', unitPrice: 50, quantity: 1 },
        ],
        gateway: payment,
        checkoutCardId: 'TOKEN123',
        checkoutMemberId: 'MEMBER456',
      });

      const payload = order.boundCardCheckoutPayload;

      expect(payload.MerID).toBe(TEST_MERID);
      expect(payload.MemberID).toBe('MEMBER456');
      expect(payload.Token).toBe('TOKEN123');
      expect(payload.PurchAmt).toBe(150);
      expect(payload.Lidm).toBe('ORDER015');
      // OrderDesc should be truncated to 18 characters
      expect(payload.OrderDesc?.length).toBeLessThanOrEqual(18);
    });
  });

  describe('commit', () => {
    it('should throw when order is not committable', () => {
      const order = new CTBCOrder({
        id: 'ORDER016',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        committedAt: new Date(),
        additionalInfo: { xid: 'XID123' },
      });

      expect(() =>
        order.commit({ id: 'ORDER016', totalPrice: 100, committedAt: new Date() } as CTBCOrderCommitMessage),
      ).toThrow('Only pre-commit order can commit');
    });

    it('should emit ORDER_COMMITTED event', () => {
      const order = new CTBCOrder({
        id: 'ORDER017',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        checkoutCardId: 'CARD123',
        checkoutMemberId: 'MEMBER123',
      });

      const emitSpy = jest.spyOn(payment.emitter, 'emit');
      const commitMessage = { id: 'ORDER017', totalPrice: 100, committedAt: new Date() } as CTBCOrderCommitMessage;

      order.commit(commitMessage, { xid: 'XID123' });

      expect(order.state).toBe(OrderState.COMMITTED);
      expect(emitSpy).toHaveBeenCalledWith(PaymentEvents.ORDER_COMMITTED, order);
    });
  });

  describe('refund with AMEX', () => {
    let amexPayment: CTBCPayment;

    beforeEach(() => {
      amexPayment = new CTBCPayment({
        merchantId: TEST_MERID,
        merId: TEST_MERID,
        txnKey: TEST_MACKEY,
        terminalId: 'test-terminal',
        baseUrl: TEST_HOST,
        isAmex: true,
      });
    });

    it('should handle AMEX refund success', async () => {
      const order = new CTBCOrder({
        id: 'ORDER018',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: amexPayment,
        committedAt: new Date(),
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123' },
        cardType: CardType.AE,
      });

      amexSmartFlowMock.mockResolvedValue({
        action: 'Refund',
        response: { RespCode: '0', capBatchId: 'BATCH1', capBatchSeq: 'SEQ1' },
      });

      await order.refund(50);

      expect(order.state).toBe(OrderState.REFUNDED);
      expect(amexSmartFlowMock).toHaveBeenCalled();
    });

    it('should handle AMEX refund failure', async () => {
      const order = new CTBCOrder({
        id: 'ORDER019',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: amexPayment,
        committedAt: new Date(),
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123' },
        cardType: CardType.AE,
      });

      amexSmartFlowMock.mockResolvedValue({
        action: 'Refund',
        response: { RespCode: '99', ErrCode: 'E01', ERRDESC: 'AMEX error' },
      });

      await expect(order.refund(50)).rejects.toThrow('AMEX error');
      expect(order.state).toBe(OrderState.FAILED);
    });

    it('should handle AMEX refund exception', async () => {
      const order = new CTBCOrder({
        id: 'ORDER020',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: amexPayment,
        committedAt: new Date(),
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123' },
        cardType: CardType.AE,
      });

      amexSmartFlowMock.mockRejectedValue(new Error('Network error'));

      await expect(order.refund(50)).rejects.toThrow('Network error');
      expect(order.state).toBe(OrderState.FAILED);
    });
  });

  describe('refund validation', () => {
    it('should throw when order is not committed', async () => {
      const order = new CTBCOrder({
        id: 'ORDER021',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
      });

      await expect(order.refund()).rejects.toThrow('Only committed orders can be refunded');
    });

    it('should throw when refund amount exceeds total', async () => {
      const order = new CTBCOrder({
        id: 'ORDER022',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        committedAt: new Date(),
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123' },
      });

      await expect(order.refund(200)).rejects.toThrow('Refund amount cannot exceed original amount');
    });

    it('should handle unknown refund error', async () => {
      const order = new CTBCOrder({
        id: 'ORDER023',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        committedAt: new Date(),
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123' },
      });

      posApiSmartFlowMock.mockRejectedValue('Unknown error type');

      await expect(order.refund(50)).rejects.toBe('Unknown error type');
      expect(order.state).toBe(OrderState.FAILED);
    });
  });

  describe('cancelRefund with AMEX', () => {
    let amexPayment: CTBCPayment;

    beforeEach(() => {
      amexPayment = new CTBCPayment({
        merchantId: TEST_MERID,
        merId: TEST_MERID,
        txnKey: TEST_MACKEY,
        terminalId: 'test-terminal',
        baseUrl: TEST_HOST,
        isAmex: true,
      });
    });

    it('should throw when missing AMEX metadata', async () => {
      const order = new CTBCOrder({
        id: 'ORDER024',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: amexPayment,
        committedAt: new Date(),
        cardType: CardType.AE,
      });

      await expect(order.cancelRefund(50)).rejects.toThrow('Missing refund metadata for AMEX cancel refund');
    });

    it('should throw when missing XID or capBatchId for AMEX cancel refund', async () => {
      const order = new CTBCOrder({
        id: 'ORDER025',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: amexPayment,
        committedAt: new Date(),
        additionalInfo: { authCode: 'AUTH123' }, // Missing xid
        cardType: CardType.AE,
      });

      await expect(order.cancelRefund(50, { capBatchId: 'BATCH1', capBatchSeq: 'SEQ1' })).rejects.toThrow(
        'Missing XID, capBatchId or capBatchSeq',
      );
    });

    it('should handle AMEX cancel refund success', async () => {
      const order = new CTBCOrder({
        id: 'ORDER026',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: amexPayment,
        refundedAt: new Date(),
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123', capBatchId: 'BATCH1', capBatchSeq: 'SEQ1' },
        cardType: CardType.AE,
      });

      amexCancelRefundMock.mockResolvedValue({ RespCode: '0' });

      await order.cancelRefund(50, { capBatchId: 'BATCH1', capBatchSeq: 'SEQ1' });

      expect(order.state).toBe(OrderState.COMMITTED);
    });

    it('should handle AMEX cancel refund failure', async () => {
      const order = new CTBCOrder({
        id: 'ORDER027',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: amexPayment,
        refundedAt: new Date(),
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123', capBatchId: 'BATCH1', capBatchSeq: 'SEQ1' },
        cardType: CardType.AE,
      });

      amexCancelRefundMock.mockResolvedValue({ RespCode: '99', ErrCode: 'E01', ERRDESC: 'Cancel failed' });

      await expect(order.cancelRefund(50, { capBatchId: 'BATCH1', capBatchSeq: 'SEQ1' })).rejects.toThrow(
        'Cancel failed',
      );

      expect(order.state).toBe(OrderState.FAILED);
    });

    it('should handle AMEX cancel refund exception', async () => {
      const order = new CTBCOrder({
        id: 'ORDER028',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: amexPayment,
        refundedAt: new Date(),
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123', capBatchId: 'BATCH1', capBatchSeq: 'SEQ1' },
        cardType: CardType.AE,
      });

      amexCancelRefundMock.mockRejectedValue(new Error('Network error'));

      await expect(order.cancelRefund(50, { capBatchId: 'BATCH1', capBatchSeq: 'SEQ1' })).rejects.toThrow(
        'Network error',
      );

      expect(order.state).toBe(OrderState.FAILED);
    });
  });

  describe('cancelRefund validation', () => {
    it('should throw when cancel refund amount exceeds total', async () => {
      const order = new CTBCOrder({
        id: 'ORDER029',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        committedAt: new Date(),
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123' },
      });

      await expect(order.cancelRefund(200)).rejects.toThrow('Cancel refund amount cannot exceed original amount');
    });

    it('should throw when missing additionalInfo for POS cancel refund', async () => {
      const order = new CTBCOrder({
        id: 'ORDER030',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        committedAt: new Date(),
      });

      await expect(order.cancelRefund(50)).rejects.toThrow('Missing XID or AuthCode');
    });

    it('should handle unknown cancel refund error', async () => {
      const order = new CTBCOrder({
        id: 'ORDER031',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        committedAt: new Date(),
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123' },
      });

      const posApiCancelRefundMock = posApiUtils.posApiCancelRefund as jest.MockedFunction<
        typeof posApiUtils.posApiCancelRefund
      >;

      posApiCancelRefundMock.mockRejectedValue('Unknown error type');

      await expect(order.cancelRefund(50)).rejects.toBe('Unknown error type');
      expect(order.state).toBe(OrderState.FAILED);
    });

    it('should set failedMessage from Error instance in POS cancel refund', async () => {
      const order = new CTBCOrder({
        id: 'ORDER032',
        items: [{ name: 'Item', unitPrice: 100, quantity: 1 }],
        gateway: payment,
        committedAt: new Date(),
        additionalInfo: { xid: 'XID123', authCode: 'AUTH123' },
      });

      const posApiCancelRefundMock = posApiUtils.posApiCancelRefund as jest.MockedFunction<
        typeof posApiUtils.posApiCancelRefund
      >;

      posApiCancelRefundMock.mockRejectedValue(new Error('POS Network error'));

      await expect(order.cancelRefund(50)).rejects.toThrow('POS Network error');
      expect(order.state).toBe(OrderState.FAILED);
      expect(order.failedMessage?.message).toBe('POS Network error');
    });
  });
});
