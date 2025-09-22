/**
 * CTBC 訂單 Mock 測試（純單元、無對外呼叫）
 *
 * - 測試重點：
 *   1. CTBCPayment.query() 透過 POS API 回應重建訂單
 *   2. CTBCOrder.refund() 正確呼叫 POS Refund 並更新狀態
 *   3. CTBCOrder.cancelRefund() 正確呼叫 POS RefundRev 並更新狀態
 *
 * 透過 jest.mock 攔截 ../src/ctbc-pos-api-utils，避免實際打 API。
 */

import { OrderState } from '@rytass/payments';
import { CTBCPayment } from '../src/ctbc-payment';
import { CTBCOrder } from '../src/ctbc-order';
import {
  CTBC_ERROR_CODES,
  CTBCPosApiResponse,
  CTBCPosApiRefundParams,
  CTBCPosApiCancelRefundParams,
} from '../src/typings';

// 直接 mock 掉 POS API 工具方法，避免網路呼叫
jest.mock('../src/ctbc-pos-api-utils', () => ({
  posApiQuery: jest.fn(),
  posApiRefund: jest.fn(),
  posApiCancelRefund: jest.fn(),
  posApiSmartCancelOrRefund: jest.fn(),
}));

import * as posApiUtils from '../src/ctbc-pos-api-utils';

const posApiQueryMock = posApiUtils.posApiQuery as jest.MockedFunction<typeof posApiUtils.posApiQuery>;
const posApiCancelRefundMock = posApiUtils.posApiCancelRefund as jest.MockedFunction<
  typeof posApiUtils.posApiCancelRefund
>;

const posApiSmartFlowMock = posApiUtils.posApiSmartCancelOrRefund as jest.MockedFunction<
  typeof posApiUtils.posApiSmartCancelOrRefund
>;

describe('CTBC 訂單 Mock 測試', () => {
  const TEST_MERID = 'DUMMY_MERID';
  const TEST_MACKEY = '123456789012345678901234'; // 24 長度，僅作為型別測試
  const TEST_ORDER_ID = 'ORDER123456';
  const TEST_HOST = 'https://testepos.ctbcbank.com';
  const TEST_XID = 'XID1234567890';
  const TEST_AUTH_CODE = 'A1B2C3';

  let payment: CTBCPayment;

  beforeEach(() => {
    jest.resetAllMocks();

    payment = new CTBCPayment({
      merchantId: TEST_MERID,
      merId: TEST_MERID,
      txnKey: TEST_MACKEY,
      terminalId: 'dummy-terminal',
      baseUrl: TEST_HOST,
      isAmex: false,
    });
  });

  function mockSuccessfulQuery(): void {
    const resp: CTBCPosApiResponse = {
      ErrCode: '00',
      RespCode: '0',
      QueryCode: '1',
      AuthAmt: '901 1000 0',
      PAN: '400361******7729',
      ECI: '05',
      AuthCode: TEST_AUTH_CODE,
      XID: TEST_XID,
      Txn_date: '2024/08/28',
      Txn_time: '12:00:00',
      CurrentState: '0',
    };

    posApiQueryMock.mockResolvedValue(resp);
  }

  it('應可查詢並以 POS 回應重建訂單（COMMITTED）', async () => {
    mockSuccessfulQuery();

    const order = await payment.query<CTBCOrder>(TEST_ORDER_ID);

    // 斷言查詢流程與訂單內容
    expect(posApiQueryMock).toHaveBeenCalledTimes(1);
    expect(order).toBeInstanceOf(CTBCOrder);
    expect(order.id).toBe(TEST_ORDER_ID);
    expect(order.state).toBe(OrderState.COMMITTED);
    expect(order.items[0].unitPrice).toBe(1000);
    expect(order.additionalInfo).toBeTruthy();
  });

  it('查詢失敗：API 回傳錯誤碼', async () => {
    const resp: CTBCPosApiResponse = {
      ErrCode: '01',
      ERRDESC: 'Order not found',
      RespCode: '99',
      CurrentState: '0',
    };

    posApiQueryMock.mockResolvedValue(resp);

    await expect(payment.query<CTBCOrder>('NOT_FOUND_ID')).rejects.toThrow('Query failed: 01 - Order not found');
  });

  it('查詢失敗：工具回傳數字錯誤碼', async () => {
    posApiQueryMock.mockResolvedValue(CTBC_ERROR_CODES.ERR_INVALID_LIDM);

    await expect(payment.query<CTBCOrder>('BAD_ID')).rejects.toThrow(
      `Query failed with error code: ${CTBC_ERROR_CODES.ERR_INVALID_LIDM}`,
    );
  });

  it('應可成功部分退款（退款後狀態為 REFUNDED）', async () => {
    mockSuccessfulQuery();
    posApiSmartFlowMock.mockResolvedValue({
      action: 'Refund',
      inquiry: {
        RespCode: '0',
        ErrCode: '00',
        CurrentState: '',
      } as CTBCPosApiResponse,
      response: { RespCode: '0', RefAmt: '901 50 0', CurrentState: '' } as CTBCPosApiResponse,
    });

    const order = await payment.query<CTBCOrder>(TEST_ORDER_ID);

    await order.refund(50);

    // 應呼叫 POS Refund 並更新狀態
    expect(posApiSmartFlowMock).toHaveBeenCalledTimes(1);
    const refundParams = posApiSmartFlowMock.mock.calls[0]?.[1] as CTBCPosApiRefundParams;

    expect(refundParams.MERID).toBe(TEST_MERID);
    expect(refundParams['LID-M']).toBe(TEST_ORDER_ID);
    expect(refundParams.OrgAmt).toBe('1000');
    expect(refundParams.PurchAmt).toBe('50');
    expect(refundParams.XID).toBe(TEST_XID);
    expect(refundParams.AuthCode).toBe(TEST_AUTH_CODE);

    expect(order.state).toBe(OrderState.REFUNDED);
  });

  it('退款失敗：缺少 XID 或 AuthCode', async () => {
    // 查詢結果缺少 XID，造成退款前置資訊不足
    const resp: CTBCPosApiResponse = {
      ErrCode: '00',
      RespCode: '0',
      QueryCode: '1',
      AuthAmt: '901 1000 0',
      PAN: '400361******7729',
      ECI: '05',
      // XID 缺漏
      Txn_date: '2024/08/28',
      Txn_time: '12:00:00',
      CurrentState: '0',
    };

    posApiQueryMock.mockResolvedValue(resp);

    const order = await payment.query<CTBCOrder>(TEST_ORDER_ID);

    await expect(order.refund(50)).rejects.toThrow(/Missing XID or AuthCode/i);
    expect(posApiSmartFlowMock).not.toHaveBeenCalled();
    expect(order.state).toBe(OrderState.FAILED);
  });

  it('退款失敗：工具回傳數字錯誤碼', async () => {
    mockSuccessfulQuery();
    posApiSmartFlowMock.mockResolvedValue({
      action: 'Refund',
      inquiry: {
        RespCode: '0',
        ErrCode: '00',
        CurrentState: '',
      } as CTBCPosApiResponse,
      response: CTBC_ERROR_CODES.ERR_INVALID_LIDM,
    });

    const order = await payment.query<CTBCOrder>(TEST_ORDER_ID);

    await expect(order.refund(50)).rejects.toThrow(
      `Refund/Cancel failed with error code: ${CTBC_ERROR_CODES.ERR_INVALID_LIDM}`,
    );

    expect(order.state).toBe(OrderState.FAILED);
  });

  it('退款失敗：API 回傳錯誤（RespCode 非 0）', async () => {
    mockSuccessfulQuery();
    posApiSmartFlowMock.mockResolvedValue({
      action: 'Refund',
      inquiry: {
        RespCode: '0',
        ErrCode: '00',
        CurrentState: '',
      } as CTBCPosApiResponse,
      response: { RespCode: '70', ERRDESC: '前次退貨交易,尚未確認', CurrentState: '' } as CTBCPosApiResponse,
    });

    const order = await payment.query<CTBCOrder>(TEST_ORDER_ID);

    await expect(order.refund(50)).rejects.toThrow('前次退貨交易,尚未確認');
    expect(order.state).toBe(OrderState.FAILED);
  });

  it('應可成功取消部分退款（狀態回到 COMMITTED）', async () => {
    mockSuccessfulQuery();
    posApiSmartFlowMock.mockResolvedValue({
      action: 'Refund',
      inquiry: {
        RespCode: '0',
        ErrCode: '00',
        CurrentState: '',
      } as CTBCPosApiResponse,
      response: { RespCode: '0', ErrCode: '00', CurrentState: '' } as CTBCPosApiResponse,
    });

    posApiCancelRefundMock.mockResolvedValue({ RespCode: '0' } as CTBCPosApiResponse);

    const order = await payment.query<CTBCOrder>(TEST_ORDER_ID);

    // 先部分退款 -> 變為 REFUNDED
    await order.refund(50);
    expect(order.state).toBe(OrderState.REFUNDED);

    // 再取消該筆退款 -> 回到 COMMITTED
    await order.cancelRefund(50);

    // 應呼叫 POS RefundRev 並更新狀態
    expect(posApiCancelRefundMock).toHaveBeenCalledTimes(1);
    const cancelParams = posApiCancelRefundMock.mock.calls[0]?.[1] as CTBCPosApiCancelRefundParams;

    expect(cancelParams.MERID).toBe(TEST_MERID);
    expect(cancelParams['LID-M']).toBe(TEST_ORDER_ID);
    expect(cancelParams.CredRevAmt).toBe('50');
    expect(cancelParams.XID).toBe(TEST_XID);
    expect(cancelParams.AuthCode).toBe(TEST_AUTH_CODE);

    expect(order.state).toBe(OrderState.COMMITTED);
  });

  it('取消退款失敗：非允許狀態（非 COMMITTED/REFUNDED）', async () => {
    const nonCommittedOrder = new CTBCOrder({
      id: 'TMP_ORDER',
      items: [{ name: 'Item', unitPrice: 1000, quantity: 1 }],
      gateway: payment,
    }); // 預設為 PRE_COMMIT 狀態

    await expect(nonCommittedOrder.cancelRefund(50)).rejects.toThrow(
      'Only committed or refunded orders can have their refund cancelled',
    );
  });

  it('取消退款失敗：工具回傳數字錯誤碼', async () => {
    mockSuccessfulQuery();
    posApiSmartFlowMock.mockResolvedValue({
      action: 'Refund',
      inquiry: {
        RespCode: '0',
        ErrCode: '00',
        CurrentState: '',
      } as CTBCPosApiResponse,
      response: { RespCode: '0', ErrCode: '00', CurrentState: '' } as CTBCPosApiResponse,
    });

    posApiCancelRefundMock.mockResolvedValue(CTBC_ERROR_CODES.ERR_INVALID_MERID);

    const order = await payment.query<CTBCOrder>(TEST_ORDER_ID);

    await order.refund(50);

    await expect(order.cancelRefund(50)).rejects.toThrow(
      `Cancel refund failed with error code: ${CTBC_ERROR_CODES.ERR_INVALID_MERID}`,
    );

    expect(order.state).toBe(OrderState.FAILED);
  });

  it('取消退款失敗：API 回傳錯誤（RespCode 非 0）', async () => {
    mockSuccessfulQuery();
    posApiSmartFlowMock.mockResolvedValue({
      action: 'Refund',
      inquiry: {
        RespCode: '0',
        ErrCode: '00',
        CurrentState: '',
      } as CTBCPosApiResponse,
      response: { RespCode: '0', ErrCode: '00', CurrentState: '' } as CTBCPosApiResponse,
    });

    posApiCancelRefundMock.mockResolvedValue({ RespCode: '01', ERRDESC: 'Cancel refund failed' } as CTBCPosApiResponse);

    const order = await payment.query<CTBCOrder>(TEST_ORDER_ID);

    await order.refund(50);

    await expect(order.cancelRefund(50)).rejects.toThrow('Cancel refund failed');
    expect(order.state).toBe(OrderState.FAILED);
  });
});
