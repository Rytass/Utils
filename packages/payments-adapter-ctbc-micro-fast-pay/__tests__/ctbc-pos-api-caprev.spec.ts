/**
 * @jest-environment node
 */

/**
 * Tests for posApiSmartCancelOrRefund action paths.
 * This test covers the branches when:
 * - CurrentState is '1' (Reversal)
 * - CurrentState is '10' (CapRev)
 * - CurrentState is '12' (Refund)
 * - CurrentState is '11' or '21' (Pending - throws error)
 * - CurrentState is '20' or '22' (Forbidden - throws error)
 * - CurrentState is '-1', '13', or '23' (Failed - throws error)
 */

import crypto from 'node:crypto';
import iconv from 'iconv-lite';
import { SSLAuthIV } from '../src/ctbc-crypto-core';
import { posApiSmartCancelOrRefund, CTBCPosApiConfig, CTBCPosApiRefundParams } from '../src';

// Mock fetch
const mockFetch = jest.fn();

global.fetch = mockFetch as jest.Mock;

// Helper to encrypt JSON data for mock response
function encryptForMockResponse(jsonData: object, macKey: string): string {
  const jsonStr = JSON.stringify(jsonData);
  const big5Data = iconv.encode(jsonStr, 'big5');

  // Apply PKCS#5 padding
  const blockSize = 8;
  const padLength = blockSize - (big5Data.length % blockSize);
  const padding = Buffer.alloc(padLength, padLength);
  const paddedData = Buffer.concat([big5Data, padding]);

  // Encrypt using DES-EDE3-CBC
  const cipher = crypto.createCipheriv('des-ede3-cbc', Buffer.from(macKey, 'utf8'), SSLAuthIV);

  cipher.setAutoPadding(false);

  const encrypted = Buffer.concat([cipher.update(paddedData), cipher.final()]);

  return encrypted.toString('hex').toUpperCase();
}

describe('CTBC POS API - Smart Cancel/Refund Action Paths', () => {
  const validConfig: CTBCPosApiConfig = {
    URL: 'https://test.ctbc.com',
    MacKey: 'abcdefghijklmnopqrstuvwx', // 24 character key for 3DES
  };

  const refundParams: CTBCPosApiRefundParams = {
    MERID: '123456789012345',
    'LID-M': 'TEST_ORDER_123',
    OrgAmt: '1000',
    XID: 'XID123',
    AuthCode: 'ABC123',
    currency: '901',
    PurchAmt: '500',
    exponent: '0',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('posApiSmartCancelOrRefund - CapRev action', () => {
    it('should execute CapRev then Reversal when CurrentState is 10', async () => {
      // Query response - CurrentState: '10' triggers CapRev action
      const queryResponse = { CurrentState: '10', RespCode: '0' };
      const queryEncrypted = encryptForMockResponse(queryResponse, validConfig.MacKey);

      // CapRev response - success
      const capRevResponse = { RespCode: '0', ErrCode: '00' };
      const capRevEncrypted = encryptForMockResponse(capRevResponse, validConfig.MacKey);

      // Reversal response - success
      const reversalResponse = { RespCode: '0', ErrCode: '00' };
      const reversalEncrypted = encryptForMockResponse(reversalResponse, validConfig.MacKey);

      // Setup mock fetch to return different responses for each call
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${queryEncrypted}`),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${capRevEncrypted}`),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${reversalEncrypted}`),
        });

      const result = await posApiSmartCancelOrRefund(validConfig, refundParams);

      // Verify the action is CapRev
      expect(result.action).toBe('CapRev');

      // Verify fetch was called 3 times: query, caprev, reversal
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify the final response (from reversal)
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('object');
    });

    it('should return inquiry result when CapRev path is executed', async () => {
      // Query response - CurrentState: '10' triggers CapRev action
      const queryResponse = { CurrentState: '10', RespCode: '0', TradeNo: 'T123456' };
      const queryEncrypted = encryptForMockResponse(queryResponse, validConfig.MacKey);

      // CapRev response - success
      const capRevResponse = { RespCode: '0', ErrCode: '00' };
      const capRevEncrypted = encryptForMockResponse(capRevResponse, validConfig.MacKey);

      // Reversal response - success
      const reversalResponse = { RespCode: '0', ErrCode: '00', RefundNo: 'R123456' };
      const reversalEncrypted = encryptForMockResponse(reversalResponse, validConfig.MacKey);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${queryEncrypted}`),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${capRevEncrypted}`),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${reversalEncrypted}`),
        });

      const result = await posApiSmartCancelOrRefund(validConfig, refundParams);

      // Verify the inquiry result is preserved
      expect(result.inquiry).toBeDefined();
      expect(typeof result.inquiry).toBe('object');

      if (typeof result.inquiry === 'object') {
        expect(result.inquiry.CurrentState).toBe('10');
      }
    });
  });

  describe('posApiSmartCancelOrRefund - Reversal action', () => {
    it('should execute Reversal when CurrentState is 1', async () => {
      // Query response - CurrentState: '1' triggers Reversal action
      const queryResponse = { CurrentState: '1', RespCode: '0' };
      const queryEncrypted = encryptForMockResponse(queryResponse, validConfig.MacKey);

      // Reversal response - success
      const reversalResponse = { RespCode: '0', ErrCode: '00' };
      const reversalEncrypted = encryptForMockResponse(reversalResponse, validConfig.MacKey);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${queryEncrypted}`),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${reversalEncrypted}`),
        });

      const result = await posApiSmartCancelOrRefund(validConfig, refundParams);

      // Verify the action is Reversal
      expect(result.action).toBe('Reversal');

      // Verify fetch was called 2 times: query, reversal
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify the response
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('object');
    });
  });

  describe('posApiSmartCancelOrRefund - Refund action', () => {
    it('should execute Refund when CurrentState is 12', async () => {
      // Query response - CurrentState: '12' triggers Refund action
      const queryResponse = { CurrentState: '12', RespCode: '0' };
      const queryEncrypted = encryptForMockResponse(queryResponse, validConfig.MacKey);

      // Refund response - success
      const refundResponse = { RespCode: '0', ErrCode: '00' };
      const refundEncrypted = encryptForMockResponse(refundResponse, validConfig.MacKey);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${queryEncrypted}`),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${refundEncrypted}`),
        });

      const result = await posApiSmartCancelOrRefund(validConfig, refundParams);

      // Verify the action is Refund
      expect(result.action).toBe('Refund');

      // Verify fetch was called 2 times: query, refund
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify the response
      expect(result.response).toBeDefined();
      expect(typeof result.response).toBe('object');
    });
  });

  describe('posApiSmartCancelOrRefund - Error states', () => {
    it('should throw error when CurrentState is 11 (Pending)', async () => {
      // Query response - CurrentState: '11' triggers Pending error
      const queryResponse = { CurrentState: '11', RespCode: '0' };
      const queryEncrypted = encryptForMockResponse(queryResponse, validConfig.MacKey);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${queryEncrypted}`),
      });

      await expect(posApiSmartCancelOrRefund(validConfig, refundParams)).rejects.toThrow(
        'Transaction is still pending, cannot proceed with cancellation or refund.',
      );
    });

    it('should throw error when CurrentState is 20 (Forbidden)', async () => {
      // Query response - CurrentState: '20' triggers Forbidden error
      const queryResponse = { CurrentState: '20', RespCode: '0' };
      const queryEncrypted = encryptForMockResponse(queryResponse, validConfig.MacKey);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${queryEncrypted}`),
      });

      await expect(posApiSmartCancelOrRefund(validConfig, refundParams)).rejects.toThrow(
        'Transaction is in a forbidden state for cancellation or refund.',
      );
    });

    it('should throw error when CurrentState is -1 (Failed)', async () => {
      // Query response - CurrentState: '-1' triggers Failed error
      const queryResponse = { CurrentState: '-1', RespCode: '0' };
      const queryEncrypted = encryptForMockResponse(queryResponse, validConfig.MacKey);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(`MERID=123&ApiEnc=${queryEncrypted}`),
      });

      await expect(posApiSmartCancelOrRefund(validConfig, refundParams)).rejects.toThrow(
        'Transaction has failed, cannot proceed with cancellation or refund.',
      );
    });
  });
});
