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
}));

import { CTBCPayment } from '../src';
import { CTBC_ERROR_CODES } from '../src/typings';
import { OrderState } from '@rytass/payments';
import { posApiQuery, posApiRefund, posApiCancelRefund } from '../src/ctbc-pos-api-utils';

const mockPosApiQuery = posApiQuery as jest.MockedFunction<typeof posApiQuery>;
const mockPosApiRefund = posApiRefund as jest.MockedFunction<typeof posApiRefund>;
const mockPosApiCancelRefund = posApiCancelRefund as jest.MockedFunction<typeof posApiCancelRefund>;

// Mock fetch for testing
const mockFetch = jest.fn();

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
      });

      const result = await payment.query('NEW_ORDER_001');

      // 驗證重建的訂單
      expect(result).toBeDefined();
      expect(result.id).toBe('NEW_ORDER_001');
      expect(result.totalPrice).toBe(2000);
      expect(result.state).toBe(OrderState.COMMITTED);
      expect(result.xid).toBe('TEST_XID_456');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Unknown Item');
      expect(result.items[0].unitPrice).toBe(2000);

      // 驗證 additionalInfo
      expect(result.additionalInfo).toBeDefined();

      if (result.additionalInfo) {
        const creditCardInfo = result.additionalInfo as any;

        expect(creditCardInfo.authCode).toBe('AUTH456');
        expect(creditCardInfo.card6Number).toBe('400361');
        expect(creditCardInfo.card4Number).toBe('7729');
        expect(creditCardInfo.eci).toBe('5'); // API 回應 "05" 應該映射為 "5"
        expect(creditCardInfo.amount).toBe(2000);
      }
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
      await expect((order as any).refund()).rejects.toThrow('Only committed orders can be refunded');
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

      // 模擬設定為已提交狀態
      (order as any)._state = OrderState.COMMITTED;

      await expect((order as any).refund(2000)).rejects.toThrow('Refund amount cannot exceed original amount');
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

      // 模擬設定為已提交狀態並設置必要的資訊
      (order as any)._state = OrderState.COMMITTED;
      (order as any)._xid = 'TEST_XID_FOR_FULL_REFUND';
      (order as any)._additionalInfo = {
        authCode: 'AUTH123',
      };

      // Mock 成功退款回應
      mockPosApiRefund.mockResolvedValue({
        RespCode: '0',
        ErrCode: '00',
        ResAmt: '901 1000 0',
        RetrRef: '000123456',
      });

      await (order as any).refund(); // 全額退款

      expect((order as any).state).toBe(OrderState.REFUNDED);
      expect(mockPosApiRefund).toHaveBeenCalledWith(
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

      // 模擬設定為已提交狀態並設置必要的資訊
      (order as any)._state = OrderState.COMMITTED;
      (order as any)._xid = 'TEST_XID_FOR_PARTIAL_REFUND';
      (order as any)._additionalInfo = {
        authCode: 'AUTH456',
      };

      // Mock 成功退款回應
      mockPosApiRefund.mockResolvedValue({
        RespCode: '0',
        ErrCode: '00',
        ResAmt: '901 500 0',
        RetrRef: '000654321',
      });

      await (order as any).refund(500); // 部分退款

      expect((order as any).state).toBe(OrderState.REFUNDED);
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

      // 模擬設定為已提交狀態並設置必要的資訊
      (order as any)._state = OrderState.COMMITTED;
      (order as any)._xid = 'TEST_XID_FOR_FAILED_REFUND';
      (order as any)._additionalInfo = {
        authCode: 'AUTH789',
      };

      // Mock 失敗回應 (使用存在的錯誤代碼)
      mockPosApiRefund.mockResolvedValue(CTBC_ERROR_CODES.ERR_INVALID_LIDM);

      await expect((order as any).refund()).rejects.toThrow(
        `Refund failed with error code: ${CTBC_ERROR_CODES.ERR_INVALID_LIDM}`,
      );

      expect((order as any).state).toBe(OrderState.FAILED);
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

      // 模擬設定為已提交狀態並設置必要的資訊
      (order as any)._state = OrderState.COMMITTED;
      (order as any)._xid = 'TEST_XID_FOR_API_ERROR';
      (order as any)._additionalInfo = {
        authCode: 'AUTH000',
      };

      // Mock API 錯誤回應
      mockPosApiRefund.mockResolvedValue({
        RespCode: '99',
        ErrorDesc: 'Transaction failed',
      });

      await expect((order as any).refund()).rejects.toThrow('Transaction failed');

      expect((order as any).state).toBe(OrderState.FAILED);
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
      await expect((order as any).cancelRefund()).rejects.toThrow(
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
      (order as any)._state = OrderState.REFUNDED;

      await expect((order as any).cancelRefund(1000)).rejects.toThrow(
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

      // 手動設定為已退款狀態並設置必要的資訊
      (order as any)._state = OrderState.REFUNDED;
      (order as any)._xid = 'TEST_XID_123';
      (order as any)._additionalInfo = {
        authCode: '123456',
      };

      await (order as any).cancelRefund(1000); // 明確傳入取消退款金額

      // 驗證退款撤銷後狀態變回已提交
      expect((order as any).state).toBe(OrderState.COMMITTED);
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

      // 手動設定為已退款狀態並設置必要的資訊
      (order as any)._state = OrderState.REFUNDED;
      (order as any)._xid = 'TEST_XID_456';
      (order as any)._additionalInfo = {
        authCode: '789012',
      };

      // 執行部分退款撤銷
      await (order as any).cancelRefund(500);

      // 驗證退款撤銷後狀態變回已提交
      expect((order as any).state).toBe(OrderState.COMMITTED);
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

      // 手動設定為已退款狀態並設置必要的資訊
      (order as any)._state = OrderState.REFUNDED;
      (order as any)._xid = 'TEST_XID_789';
      (order as any)._additionalInfo = {
        authCode: '345678',
      };

      await expect((order as any).cancelRefund(1000)).rejects.toThrow('Cancel refund failed');

      // 驗證失敗後狀態變為失敗
      expect((order as any).state).toBe(OrderState.FAILED);
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

      // 手動設定為已退款狀態並設置必要的資訊
      (order as any)._state = OrderState.REFUNDED;
      (order as any)._xid = 'TEST_XID_ABC';
      (order as any)._additionalInfo = {
        authCode: '901234',
      };

      await expect((order as any).cancelRefund(1000)).rejects.toThrow(
        `Cancel refund failed with error code: ${CTBC_ERROR_CODES.ERR_INVALID_MERID}`,
      );

      // 驗證失敗後狀態變為失敗
      expect((order as any).state).toBe(OrderState.FAILED);
    });
  });
});
