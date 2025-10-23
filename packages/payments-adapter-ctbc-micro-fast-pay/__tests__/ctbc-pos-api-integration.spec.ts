/**
 * CTBC POS API 類別方法整合測試
 *
 * 測試 CTBCPayment.query() 和 CTBCOrder.refund()、CTBCOrder.cancelRefund() 方法的功能
 * 使用統一的 txnKey 作為 MAC 金鑰
 */

// Mock the POS API utilities before importing other modules
jest.mock('../src/ctbc-pos-api-utils', () => ({
  posApiQuery: jest.fn(),
  posApiRefund: jest.fn(),
  posApiCancelRefund: jest.fn(),
  posApiSmartCancelOrRefund: jest.fn(),
}));

import {
  AdditionalInfo,
  Channel,
  CreditCardAuthInfo,
  CreditCardECI,
  OrderCreditCardCommitMessage,
  OrderState,
} from '@rytass/payments';
import { CTBCOrder, CTBCPayment } from '../src';
import { posApiCancelRefund, posApiQuery, posApiSmartCancelOrRefund } from '../src/ctbc-pos-api-utils';
import { CTBC_ERROR_CODES, CTBCPosApiResponse } from '../src/typings';

const mockPosApiQuery = posApiQuery as jest.MockedFunction<typeof posApiQuery>;
const mockPosApiCancelRefund = posApiCancelRefund as jest.MockedFunction<typeof posApiCancelRefund>;
const mockPosApiSmartFlow = posApiSmartCancelOrRefund as jest.MockedFunction<typeof posApiSmartCancelOrRefund>;

// Mock fetch for testing (keep typing minimal to avoid DOM dependency)
const mockFetch = jest.fn() as unknown as typeof globalThis.fetch;

global.fetch = mockFetch;

describe('CTBC POS API - 類別方法整合測試', () => {
  let payment: CTBCPayment;

  beforeEach(() => {
    jest.clearAllMocks();

    // 建立 payment 實例，使用統一的 txnKey
    payment = new CTBCPayment({
      merchantId: 'TEST_MERCHANT',
      merId: 'TEST_MERID',
      txnKey: 'TEST_TXN_KEY_12345678901', // 統一的 MAC 金鑰
      terminalId: 'TEST_TERMINAL',
      baseUrl: 'https://testepos.ctbcbank.com',
      isAmex: false, // 明確指定使用 POS API
    });
  });

  describe('CTBCPayment.query() 方法測試', () => {
    it('應該處理成功的查詢', async () => {
      // 先創建並準備一個訂單
      await payment.prepare({
        id: 'TEST_ORDER_001',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      // Mock posApiQuery 的實作
      mockPosApiQuery.mockResolvedValue({
        ErrCode: '00',
        RespCode: '0',
        QueryCode: '1',
        AuthCode: 'AUTH123',
        AuthAmt: '901 1000 0',
        XID: 'TEST_XID_123',
        Txn_date: '2024-01-01',
        Txn_time: '12:00:00',
        ECI: '05',
        PAN: '400361******7729',
        CurrentState: '',
      });

      const result = await payment.query('TEST_ORDER_001');

      expect(result).toBeDefined();
      expect(result.id).toBe('TEST_ORDER_001');
      expect(mockPosApiQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          URL: 'https://testepos.ctbcbank.com',
          MacKey: 'TEST_TXN_KEY_12345678901',
        }),
        expect.objectContaining({
          MERID: 'TEST_MERID',
          'LID-M': 'TEST_ORDER_001',
          Tx_ATTRIBUTE: 'TX_AUTH',
        }),
      );
    });

    it('應該拋出錯誤當訂單不存在', async () => {
      // Mock posApiQuery 返回錯誤代碼，表示訂單不存在
      mockPosApiQuery.mockResolvedValue({
        CurrentState: '',
        ErrCode: '01', // 非 '00' 表示錯誤
        ERRDESC: 'Order not found',
        RespCode: '99',
      });

      await expect(payment.query('NONEXISTENT_ORDER')).rejects.toThrow('Query failed: 01 - Order not found');
    });

    it('應該從 API 查詢結果重建訂單當快取中不存在時', async () => {
      // 不先創建訂單，直接查詢一個不在快取中的訂單

      // Mock posApiQuery 的實作 - 使用真實 API 的回應格式
      mockPosApiQuery.mockResolvedValue({
        ErrCode: '00',
        RespCode: '0', // 真實 API 是 "0"
        QueryCode: '1',
        AuthCode: 'AUTH456',
        AuthAmt: '901 2000 0', // 格式: 貨幣碼 金額 指數
        Txn_date: '2024-01-01',
        Txn_time: '12:00:00',
        ECI: '05',
        PAN: '400361******7729',
        XID: 'TEST_XID_456',
        CurrentState: '1', // '1' means 授權成功 = COMMITTED
      });

      const result = await payment.query('NEW_ORDER_001');

      // 驗證重建的訂單
      expect(result).toBeDefined();
      expect(result.id).toBe('NEW_ORDER_001');
      expect(result.totalPrice).toBe(2000);
      expect(result.state).toBe(OrderState.COMMITTED);
      expect(result.additionalInfo).toBeDefined();
      expect((result.additionalInfo as unknown as CreditCardAuthInfo).xid).toBe('TEST_XID_456');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Unknown Item');
      expect(result.items[0].unitPrice).toBe(2000);

      // 驗證 additionalInfo
      expect(result.additionalInfo).toBeDefined();
    });

    it('應該處理查詢失敗', async () => {
      // 先創建並準備一個訂單
      await payment.prepare({
        id: 'TEST_ORDER_002',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      // Mock 失敗回應
      mockPosApiQuery.mockResolvedValue(CTBC_ERROR_CODES.ERR_INVALID_LIDM);

      await expect(payment.query('TEST_ORDER_002')).rejects.toThrow(
        `Query failed with error code: ${CTBC_ERROR_CODES.ERR_INVALID_LIDM}`,
      );
    });
  });

  describe('CTBCOrder.refund() 方法測試', () => {
    it('應該拒絕非已提交狀態的訂單', async () => {
      const order = await payment.prepare({
        id: 'TEST_ORDER_003',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      // 訂單剛創建時應該不是已提交狀態
      await expect(order.refund()).rejects.toThrow('Only committed orders can be refunded');
    });

    it('應該拒絕超過原金額的退款', async () => {
      const order = await payment.prepare({
        id: 'TEST_ORDER_005',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      // 模擬設定為已提交狀態（透過公開 API）
      // 將訂單推進到 PRE_COMMIT 再 commit 成功
      // 這樣就不需要操作私有欄位
      const ccOrder = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder.form; // 將狀態切到 PRE_COMMIT
      ccOrder.commit({
        id: order.id,

        committedAt: new Date(),
      } as OrderCreditCardCommitMessage);

      await expect(order.refund(2000)).rejects.toThrow('Refund amount cannot exceed original amount');
    });

    it('應該處理全額退款', async () => {
      const order = await payment.prepare({
        id: 'TEST_ORDER_006',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      // 模擬設定為已提交狀態並設置必要的資訊（使用公開 API）
      const ccOrder = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder.form; // 進入 PRE_COMMIT
      ccOrder.commit(
        {
          id: order.id,
          committedAt: new Date(),
        } as OrderCreditCardCommitMessage,
        {
          channel: Channel.CREDIT_CARD,
          processDate: new Date(),
          eci: CreditCardECI.VISA_AE_JCB_3D,
          authCode: 'AUTH123',
          card6Number: '400361',
          card4Number: '7729',
          xid: 'TEST_XID_FOR_FULL_REFUND',
        } as AdditionalInfo<OrderCreditCardCommitMessage>,
      );

      // Mock 成功退款回應
      mockPosApiSmartFlow.mockResolvedValue({
        action: 'Refund',
        inquiry: {
          RespCode: '0',
          ErrCode: '00',
          CurrentState: '',
        } as CTBCPosApiResponse,
        response: {
          RespCode: '0',
          ErrCode: '00',
          ResAmt: '901 1000 0',
          RetrRef: '000123456',
          CurrentState: '',
        } as CTBCPosApiResponse,
      });

      await order.refund(); // 全額退款

      expect(order.state).toBe(OrderState.REFUNDED);
      expect(mockPosApiSmartFlow).toHaveBeenCalledWith(
        expect.objectContaining({
          URL: 'https://testepos.ctbcbank.com',
          MacKey: 'TEST_TXN_KEY_12345678901',
        }),
        expect.objectContaining({
          MERID: 'TEST_MERID',
          'LID-M': 'TEST_ORDER_006',
          AuthCode: 'AUTH123',
          XID: 'TEST_XID_FOR_FULL_REFUND',
          OrgAmt: '1000',
          PurchAmt: '1000',
          currency: '901',
          exponent: '0',
        }),
      );
    });

    it('應該處理部分退款', async () => {
      const order = await payment.prepare({
        id: 'TEST_ORDER_007',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      // 模擬設定為已提交狀態並設置必要的資訊（使用公開 API）
      const ccOrder = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder.form;
      ccOrder.commit(
        {
          id: order.id,
          committedAt: new Date(),
        } as OrderCreditCardCommitMessage,
        {
          channel: Channel.CREDIT_CARD,
          processDate: new Date(),
          eci: CreditCardECI.VISA_AE_JCB_3D,
          authCode: 'AUTH456',
          card6Number: '400361',
          card4Number: '7729',
          xid: 'TEST_XID_FOR_PARTIAL_REFUND',
        } as AdditionalInfo<OrderCreditCardCommitMessage>,
      );

      // Mock 成功退款回應
      mockPosApiSmartFlow.mockResolvedValue({
        action: 'Refund',
        inquiry: {
          RespCode: '0',
          ErrCode: '00',
          CurrentState: '',
        } as CTBCPosApiResponse,
        response: {
          RespCode: '0',
          ErrCode: '00',
          ResAmt: '901 500 0',
          RetrRef: '000654321',
          CurrentState: '',
        } as CTBCPosApiResponse,
      });

      await order.refund(500); // 部分退款

      expect(order.state).toBe(OrderState.REFUNDED);
    });

    it('應該處理退款失敗', async () => {
      const order = await payment.prepare({
        id: 'TEST_ORDER_008',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      // 模擬設定為已提交狀態並設置必要的資訊（使用公開 API）
      const ccOrder = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder.form;
      ccOrder.commit(
        {
          id: order.id,
          committedAt: new Date(),
        } as OrderCreditCardCommitMessage,
        {
          channel: Channel.CREDIT_CARD,
          processDate: new Date(),
          eci: CreditCardECI.VISA_AE_JCB_3D,
          authCode: 'AUTH789',
          card6Number: '400361',
          card4Number: '7729',
          xid: 'TEST_XID_FOR_FAILED_REFUND',
        } as AdditionalInfo<OrderCreditCardCommitMessage>,
      );

      // Mock 失敗回應 (使用存在的錯誤代碼)
      mockPosApiSmartFlow.mockResolvedValue({
        action: 'Refund',
        inquiry: {
          RespCode: '0',
          ErrCode: '00',
          CurrentState: '',
        } as CTBCPosApiResponse,
        response: CTBC_ERROR_CODES.ERR_INVALID_LIDM,
      });

      await expect(order.refund()).rejects.toThrow(
        `Refund/Cancel failed with error code: ${CTBC_ERROR_CODES.ERR_INVALID_LIDM}`,
      );

      expect(order.state).toBe(OrderState.FAILED);
    });

    it('應該處理 API 回應錯誤', async () => {
      const order = await payment.prepare({
        id: 'TEST_ORDER_009',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      // 模擬設定為已提交狀態並設置必要的資訊（使用公開 API）
      const ccOrder6 = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder6.form;
      ccOrder6.commit(
        {
          id: order.id,
          committedAt: new Date(),
        } as OrderCreditCardCommitMessage,
        {
          channel: Channel.CREDIT_CARD,
          processDate: new Date(),
          eci: CreditCardECI.VISA_AE_JCB_3D,
          authCode: 'AUTH000',
          card6Number: '400361',
          card4Number: '7729',
          xid: 'TEST_XID_FOR_API_ERROR',
        } as AdditionalInfo<OrderCreditCardCommitMessage>,
      );

      // Mock API 錯誤回應
      mockPosApiSmartFlow.mockResolvedValue({
        action: 'Refund',
        inquiry: {
          RespCode: '0',
          ErrCode: '00',
          CurrentState: '',
        } as CTBCPosApiResponse,
        response: {
          RespCode: '99',
          ErrorDesc: 'Transaction failed',
          CurrentState: '',
        } as CTBCPosApiResponse,
      });

      await expect(order.refund()).rejects.toThrow('Transaction failed');

      expect(order.state).toBe(OrderState.FAILED);
    });

    it('應該處理 Pending 狀態錯誤', async () => {
      const order = await payment.prepare({
        id: 'TEST_ORDER_PENDING',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      const ccOrder = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder.form;
      ccOrder.commit(
        {
          id: order.id,
          committedAt: new Date(),
        } as OrderCreditCardCommitMessage,
        {
          channel: Channel.CREDIT_CARD,
          processDate: new Date(),
          eci: CreditCardECI.VISA_AE_JCB_3D,
          authCode: '901234',
          card6Number: '400361',
          card4Number: '7729',
          xid: 'TEST_XID_PENDING',
        } as AdditionalInfo<OrderCreditCardCommitMessage>,
      );

      // Mock smart flow 返回 Pending 錯誤
      mockPosApiSmartFlow.mockRejectedValue(new Error('Transaction is still pending'));

      await expect(order.refund()).rejects.toThrow('Transaction is still pending');

      expect(order.state).toBe(OrderState.FAILED);
    });

    it('應該處理 Forbidden 狀態錯誤', async () => {
      const order = await payment.prepare({
        id: 'TEST_FORBIDDEN',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      const ccOrder = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder.form;
      ccOrder.commit(
        {
          id: order.id,
          committedAt: new Date(),
        } as OrderCreditCardCommitMessage,
        {
          channel: Channel.CREDIT_CARD,
          processDate: new Date(),
          eci: CreditCardECI.VISA_AE_JCB_3D,
          authCode: '901234',
          card6Number: '400361',
          card4Number: '7729',
          xid: 'TEST_XID_FORBIDDEN',
        } as AdditionalInfo<OrderCreditCardCommitMessage>,
      );

      // Mock smart flow 返回 Forbidden 錯誤
      mockPosApiSmartFlow.mockRejectedValue(new Error('Transaction is in a forbidden state'));

      await expect(order.refund()).rejects.toThrow('Transaction is in a forbidden state');

      expect(order.state).toBe(OrderState.FAILED);
    });

    it('應該處理 Failed 狀態錯誤', async () => {
      const order = await payment.prepare({
        id: 'TEST_FAILED',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      const ccOrder = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder.form;
      ccOrder.commit(
        {
          id: order.id,
          committedAt: new Date(),
        } as OrderCreditCardCommitMessage,
        {
          channel: Channel.CREDIT_CARD,
          processDate: new Date(),
          eci: CreditCardECI.VISA_AE_JCB_3D,
          authCode: '901234',
          card6Number: '400361',
          card4Number: '7729',
          xid: 'TEST_XID_FAILED_STATE',
        } as AdditionalInfo<OrderCreditCardCommitMessage>,
      );

      // Mock smart flow 返回 Failed 狀態錯誤
      mockPosApiSmartFlow.mockRejectedValue(new Error('Transaction has failed'));

      await expect(order.refund()).rejects.toThrow('Transaction has failed');

      expect(order.state).toBe(OrderState.FAILED);
    });
  });

  describe('常數驗證測試', () => {
    it('應該包含錯誤代碼', () => {
      expect(CTBC_ERROR_CODES).toHaveProperty('ERR_INVALID_LIDM');
      expect(typeof CTBC_ERROR_CODES.ERR_INVALID_LIDM).toBe('number');
    });
  });

  describe('CTBCOrder.cancelRefund() 方法測試', () => {
    it('應該拒絕非已退款狀態的訂單', async () => {
      const order = await payment.prepare({
        id: 'TEST_ORDER_007',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      // 訂單剛創建時應該不是已退款狀態
      const ctbcOrder = order as unknown as CTBCOrder;

      await expect(ctbcOrder.cancelRefund(undefined as unknown as number)).rejects.toThrow(
        'Only committed or refunded orders can have their refund cancelled',
      );
    });

    it('應該拒絕沒有 XID 的訂單退款撤銷', async () => {
      const order = await payment.prepare({
        id: 'TEST_ORDER_008',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      // 手動設定為已退款狀態但沒有 XID
      (order as unknown as { _state: OrderState })._state = OrderState.REFUNDED;

      const ctbcOrder2 = order as unknown as CTBCOrder;

      await expect(ctbcOrder2.cancelRefund(1000)).rejects.toThrow(
        'Missing XID or AuthCode for refund cancellation operation',
      );
    });

    it('應該成功執行退款撤銷', async () => {
      // Mock 成功的退款撤銷回應
      mockPosApiCancelRefund.mockResolvedValue({
        RespCode: '0',
        ErrCode: '00',
        ResAmt: '901 0 0',
        RetrRef: '000123456',
        CurrentState: '',
      });

      const order = await payment.prepare({
        id: 'TEST_ORDER_010',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      // 透過公開 API 完成 commit 並設置必要資訊
      const ccOrder3 = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder3.form;
      ccOrder3.commit(
        {
          id: order.id,
          committedAt: new Date(),
        } as OrderCreditCardCommitMessage,
        {
          channel: Channel.CREDIT_CARD,
          processDate: new Date(),
          eci: CreditCardECI.VISA_AE_JCB_3D,
          authCode: '123456',
          card6Number: '400361',
          card4Number: '7729',
          xid: 'TEST_XID_123',
        } as AdditionalInfo<OrderCreditCardCommitMessage>,
      );

      (order as unknown as { _state: OrderState })._state = OrderState.REFUNDED;

      await (order as unknown as CTBCOrder).cancelRefund(1000); // 明確傳入取消退款金額

      // 驗證退款撤銷後狀態變回已提交
      expect(order.state).toBe(OrderState.COMMITTED);
      expect(mockPosApiCancelRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          URL: 'https://testepos.ctbcbank.com',
          MacKey: 'TEST_TXN_KEY_12345678901',
        }),
        expect.objectContaining({
          MERID: 'TEST_MERID',
          'LID-M': 'TEST_ORDER_010',
          AuthCode: '123456',
          XID: 'TEST_XID_123',
          CredRevAmt: '1000',
          currency: '901',
          exponent: '0',
        }),
      );
    });

    it('應該處理部分退款撤銷', async () => {
      // Mock 成功的退款撤銷回應
      mockPosApiCancelRefund.mockResolvedValue({
        RespCode: '0',
        ErrCode: '00',
        ResAmt: '901 0 0',
        RetrRef: '000789012',
        CurrentState: '',
      });

      const order = await payment.prepare({
        id: 'TEST_ORDER_011',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      const ccOrder4 = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder4.form;
      ccOrder4.commit(
        {
          id: order.id,
          committedAt: new Date(),
        } as OrderCreditCardCommitMessage,
        {
          channel: Channel.CREDIT_CARD,
          processDate: new Date(),
          eci: CreditCardECI.VISA_AE_JCB_3D,
          authCode: '789012',
          card6Number: '400361',
          card4Number: '7729',
          xid: 'TEST_XID_456',
        } as AdditionalInfo<OrderCreditCardCommitMessage>,
      );

      (order as unknown as { _state: OrderState })._state = OrderState.REFUNDED;

      // 執行部分退款撤銷
      await (order as unknown as CTBCOrder).cancelRefund(500);

      // 驗證退款撤銷後狀態變回已提交
      expect(order.state).toBe(OrderState.COMMITTED);
      expect(mockPosApiCancelRefund).toHaveBeenCalledWith(
        expect.objectContaining({
          URL: 'https://testepos.ctbcbank.com',
          MacKey: 'TEST_TXN_KEY_12345678901',
        }),
        expect.objectContaining({
          MERID: 'TEST_MERID',
          'LID-M': 'TEST_ORDER_011',
          AuthCode: '789012',
          XID: 'TEST_XID_456',
          CredRevAmt: '500',
          currency: '901',
          exponent: '0',
        }),
      );
    });

    it('應該處理退款撤銷失敗的情況', async () => {
      // Mock 失敗的退款撤銷回應
      mockPosApiCancelRefund.mockResolvedValue({
        RespCode: '01',
        ERRDESC: 'Cancel refund failed',
        CurrentState: '',
      });

      const order = await payment.prepare({
        id: 'TEST_ORDER_012',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      const ccOrder5 = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder5.form;
      ccOrder5.commit(
        {
          id: order.id,
          committedAt: new Date(),
        } as OrderCreditCardCommitMessage,
        {
          channel: Channel.CREDIT_CARD,
          processDate: new Date(),
          eci: CreditCardECI.VISA_AE_JCB_3D,
          authCode: '345678',
          card6Number: '400361',
          card4Number: '7729',
          xid: 'TEST_XID_789',
        } as AdditionalInfo<OrderCreditCardCommitMessage>,
      );

      (order as unknown as { _state: OrderState })._state = OrderState.REFUNDED;

      await expect((order as unknown as CTBCOrder).cancelRefund(1000)).rejects.toThrow('Cancel refund failed');

      // 驗證失敗後狀態變為失敗
      expect(order.state).toBe(OrderState.FAILED);
    });

    it('應該處理 API 錯誤代碼回應', async () => {
      // Mock API 錯誤代碼回應
      mockPosApiCancelRefund.mockResolvedValue(CTBC_ERROR_CODES.ERR_INVALID_MERID);

      const order = await payment.prepare({
        id: 'TEST_ORDER_013',
        items: [
          {
            name: 'Test Item',
            unitPrice: 1000,
            quantity: 1,
          },
        ],
      });

      const ccOrder7 = order as unknown as CTBCOrder<OrderCreditCardCommitMessage>;

      void ccOrder7.form;
      ccOrder7.commit(
        {
          id: order.id,
          committedAt: new Date(),
        } as OrderCreditCardCommitMessage,
        {
          channel: Channel.CREDIT_CARD,
          processDate: new Date(),
          eci: CreditCardECI.VISA_AE_JCB_3D,
          authCode: '901234',
          card6Number: '400361',
          card4Number: '7729',
          xid: 'TEST_XID_ABC',
        } as AdditionalInfo<OrderCreditCardCommitMessage>,
      );

      (order as unknown as { _state: OrderState })._state = OrderState.REFUNDED;

      await expect((order as unknown as CTBCOrder).cancelRefund(1000)).rejects.toThrow(
        `Cancel refund failed with error code: ${CTBC_ERROR_CODES.ERR_INVALID_MERID}`,
      );

      // 驗證失敗後狀態變為失敗
      expect(order.state).toBe(OrderState.FAILED);
    });
  });
});

// TEMP live integration (will be removed later)
// Live 測試已移至 `ctbc-pos-live.spec.ts`，避免影響本檔案的單元測試
