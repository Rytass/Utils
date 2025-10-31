/**
 * CTBC AMEX API 類別方法整合測試
 *
 * 模擬 AMEX SOAP 流程，驗證 CTBCOrder 在 AMEX 模式下的退款與退款撤銷邏輯（使用 mocked SOAP 工具）。
 */

jest.mock('../src/ctbc-amex-api-utils', () => ({
  amexSmartCancelOrRefund: jest.fn(),
  amexCancelRefund: jest.fn(),
}));

import {
  AdditionalInfo,
  CardType,
  Channel,
  CreditCardAuthInfo,
  CreditCardECI,
  OrderCreditCardCommitMessage,
  OrderState,
} from '@rytass/payments';
import { CTBCOrder, CTBCPayment } from '../src';
import { amexCancelRefund, amexSmartCancelOrRefund } from '../src/ctbc-amex-api-utils';

const mockAmexSmartCancelOrRefund = amexSmartCancelOrRefund as jest.MockedFunction<typeof amexSmartCancelOrRefund>;
const mockAmexCancelRefund = amexCancelRefund as jest.MockedFunction<typeof amexCancelRefund>;

type TestAmexAuthInfo = CreditCardAuthInfo & { capBatchId?: string; capBatchSeq?: string };

describe('CTBC AMEX API - 類別方法整合測試', () => {
  let payment: CTBCPayment;

  beforeAll(() => {
    global.fetch = jest.fn() as unknown as typeof global.fetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    payment = new CTBCPayment({
      merchantId: 'TEST_MERCHANT',
      merId: 'TEST_MERID',
      txnKey: 'TEST_TXN_KEY_12345678901',
      terminalId: 'TEST_TERMINAL',
      baseUrl: 'https://testepos.ctbcbank.com',
      isAmex: true,
    });
  });

  const commitOrderAsAmex = async (order: CTBCOrder<OrderCreditCardCommitMessage>): Promise<void> => {
    void order.form;

    order.commit(
      {
        id: order.id,
        committedAt: new Date(),
      } as OrderCreditCardCommitMessage,
      {
        channel: Channel.CREDIT_CARD,
        processDate: new Date(),
        amount: order.totalPrice,
        eci: CreditCardECI.VISA_AE_JCB_3D,
        authCode: 'AMEX_AUTH',
        card6Number: '371234',
        card4Number: '1234',
        xid: 'AMEX_XID_001',
      } as AdditionalInfo<OrderCreditCardCommitMessage>,
    );
  };

  describe('CTBCOrder.refund() - AMEX 模式', () => {
    it('應該拒絕非已提交狀態的訂單', async () => {
      const order = (await payment.prepare({
        id: 'AMEX_NOT_COMMIT',
        cardType: CardType.AE,
        items: [{ name: 'AMEX Item', unitPrice: 1000, quantity: 1 }],
      })) as CTBCOrder<OrderCreditCardCommitMessage>;

      await expect(order.refund()).rejects.toThrow('Only committed orders can be refunded');
    });

    it('應該拒絕超過原金額的退款', async () => {
      const order = (await payment.prepare({
        id: 'AMEX_REF_OVER',
        cardType: CardType.AE,
        items: [{ name: 'AMEX Item', unitPrice: 1000, quantity: 1 }],
      })) as CTBCOrder<OrderCreditCardCommitMessage>;

      await commitOrderAsAmex(order);

      await expect(order.refund(2000)).rejects.toThrow('Refund amount cannot exceed original amount');
    });

    it('應該成功處理退款並保存 capBatch 資訊', async () => {
      const order = (await payment.prepare({
        id: 'AMEX_REF_OK',
        cardType: CardType.AE,
        items: [{ name: 'AMEX Item', unitPrice: 1000, quantity: 1 }],
      })) as CTBCOrder<OrderCreditCardCommitMessage>;

      await commitOrderAsAmex(order);

      mockAmexSmartCancelOrRefund.mockResolvedValue({
        action: 'Refund',
        inquiry: { RespCode: '0', ErrCode: '00', CurrentState: '' },
        response: {
          RespCode: '0',
          ErrCode: '00',
          capBatchId: 'BATCH123',
          capBatchSeq: 'SEQ456',
          CurrentState: '',
        },
      });

      await order.refund(500);

      expect(order.state).toBe(OrderState.REFUNDED);
      expect(order.additionalInfo).toBeDefined();
      expect((order.additionalInfo as TestAmexAuthInfo).capBatchId).toBe('BATCH123');
      expect((order.additionalInfo as TestAmexAuthInfo).capBatchSeq).toBe('SEQ456');
    });

    it('應該處理退款失敗的回應', async () => {
      const order = (await payment.prepare({
        id: 'AMEX_REF_FAIL',
        cardType: CardType.AE,
        items: [{ name: 'AMEX Item', unitPrice: 1000, quantity: 1 }],
      })) as CTBCOrder<OrderCreditCardCommitMessage>;

      await commitOrderAsAmex(order);

      mockAmexSmartCancelOrRefund.mockResolvedValue({
        action: 'Refund',
        inquiry: { RespCode: '0', ErrCode: '00', CurrentState: '' },
        response: { RespCode: '1', ErrCode: 'A001', ERRDESC: 'AMEX refund failed', CurrentState: '' },
      });

      await expect(order.refund()).rejects.toThrow('AMEX refund failed');
      expect(order.state).toBe(OrderState.FAILED);
    });

    it('應該處理 refund 呼叫時的例外', async () => {
      const order = (await payment.prepare({
        id: 'AMEX_REF_ERR',
        cardType: CardType.AE,
        items: [{ name: 'AMEX Item', unitPrice: 1000, quantity: 1 }],
      })) as CTBCOrder<OrderCreditCardCommitMessage>;

      await commitOrderAsAmex(order);

      mockAmexSmartCancelOrRefund.mockRejectedValue(new Error('SOAP timeout'));

      await expect(order.refund()).rejects.toThrow('SOAP timeout');
      expect(order.state).toBe(OrderState.FAILED);
    });

    it('應該處理 AMEX Pending 狀態錯誤', async () => {
      const order = (await payment.prepare({
        id: 'AMEX_ORDER_PENDING',
        items: [{ name: 'AMEX Item', unitPrice: 1000, quantity: 1 }],
        cardType: CardType.AE,
      })) as CTBCOrder<OrderCreditCardCommitMessage>;

      await commitOrderAsAmex(order);

      // Mock AMEX smart flow 返回 Pending 錯誤
      mockAmexSmartCancelOrRefund.mockRejectedValue(new Error('Transaction is still pending'));

      await expect(order.refund()).rejects.toThrow('Transaction is still pending');
      expect(order.state).toBe(OrderState.FAILED);
    });

    it('應該處理 AMEX Forbidden 狀態錯誤', async () => {
      const order = (await payment.prepare({
        id: 'AMEX_FORBIDDEN',
        items: [{ name: 'AMEX Item', unitPrice: 1000, quantity: 1 }],
        cardType: CardType.AE,
      })) as CTBCOrder<OrderCreditCardCommitMessage>;

      await commitOrderAsAmex(order);

      // Mock AMEX smart flow 返回 Forbidden 錯誤
      mockAmexSmartCancelOrRefund.mockRejectedValue(new Error('Transaction is in a forbidden state'));

      await expect(order.refund()).rejects.toThrow('Transaction is in a forbidden state');
      expect(order.state).toBe(OrderState.FAILED);
    });

    it('應該處理 AMEX Failed 狀態錯誤', async () => {
      const order = (await payment.prepare({
        id: 'AMEX_FAILED',
        items: [{ name: 'AMEX Item', unitPrice: 1000, quantity: 1 }],
        cardType: CardType.AE,
      })) as CTBCOrder<OrderCreditCardCommitMessage>;

      await commitOrderAsAmex(order);

      // Mock AMEX smart flow 返回 Failed 狀態錯誤
      mockAmexSmartCancelOrRefund.mockRejectedValue(new Error('Transaction has failed'));

      await expect(order.refund()).rejects.toThrow('Transaction has failed');
      expect(order.state).toBe(OrderState.FAILED);
    });
  });

  describe('CTBCOrder.cancelRefund() - AMEX 模式', () => {
    const makeRefundedOrder = (id: string, info?: TestAmexAuthInfo): CTBCOrder<OrderCreditCardCommitMessage> => {
      const order = new CTBCOrder<OrderCreditCardCommitMessage>({
        id,
        items: [{ name: 'AMEX Item', unitPrice: 1000, quantity: 1 }],
        gateway: payment,
        cardType: CardType.AE,
      });

      Object.defineProperty(order, '_state', {
        value: OrderState.REFUNDED,
        writable: true,
        configurable: true,
      });

      if (info) {
        Object.defineProperty(order, '_additionalInfo', {
          value: info,
          writable: true,
          configurable: true,
        });
      } else {
        Object.defineProperty(order, '_additionalInfo', {
          value: undefined,
          writable: true,
          configurable: true,
        });
      }

      return order;
    };

    const buildBaseInfo = (): TestAmexAuthInfo => ({
      channel: Channel.CREDIT_CARD,
      processDate: new Date(),
      amount: 1000,
      eci: CreditCardECI.VISA_AE_JCB_3D,
      authCode: 'AMEX_AUTH',
      card6Number: '371234',
      card4Number: '1234',
      xid: 'AMEX_XID_001',
    });

    it('應該拒絕缺少退款資料的訂單', async () => {
      const order = makeRefundedOrder('AMEX_CANCEL_NO');

      await expect(order.cancelRefund(500, { capBatchId: '', capBatchSeq: '' })).rejects.toThrow(
        'Missing refund metadata for AMEX cancel refund',
      );
    });

    it('應該拒絕缺少 capBatch 資訊的訂單', async () => {
      const order = makeRefundedOrder('AMEX_NO_BATCH', buildBaseInfo());

      expect(order.additionalInfo).toBeDefined();
      await expect(order.cancelRefund(200, { capBatchId: '', capBatchSeq: '' })).rejects.toThrow(
        'Missing XID, capBatchId or capBatchSeq for AMEX cancel refund',
      );
    });

    it('應該成功執行 AMEX 退款撤銷', async () => {
      const order = makeRefundedOrder('AMEX_CANCEL_OK', {
        ...buildBaseInfo(),
        capBatchId: 'BATCH123',
        capBatchSeq: 'SEQ456',
      });

      expect(order.additionalInfo).toBeDefined();
      mockAmexCancelRefund.mockResolvedValue({
        RespCode: '0',
        ErrCode: '00',
        ERRDESC: '',
        CurrentState: '',
      });

      await order.cancelRefund(500, { capBatchId: 'BATCH123', capBatchSeq: 'SEQ456' });

      expect(order.state).toBe(OrderState.COMMITTED);
      expect((order.additionalInfo as TestAmexAuthInfo).capBatchId).toBeUndefined();
      expect((order.additionalInfo as TestAmexAuthInfo).capBatchSeq).toBeUndefined();
    });

    it('應該處理退款撤銷失敗的情況', async () => {
      const order = makeRefundedOrder('AMEX_CANCEL_FAIL', {
        ...buildBaseInfo(),
        capBatchId: 'BATCH_FAIL',
        capBatchSeq: 'SEQ_FAIL',
      });

      expect(order.additionalInfo).toBeDefined();
      mockAmexCancelRefund.mockResolvedValue({
        RespCode: '1',
        ErrCode: 'A002',
        ERRDESC: 'Cancel failed',
        CurrentState: '',
      });

      await expect(order.cancelRefund(300, { capBatchId: 'BATCH_FAIL', capBatchSeq: 'SEQ_FAIL' })).rejects.toThrow(
        'Cancel failed',
      );

      expect(order.state).toBe(OrderState.FAILED);
    });
  });
});
