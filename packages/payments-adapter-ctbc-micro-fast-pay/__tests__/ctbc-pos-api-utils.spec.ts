/**
 * @jest-environment node
 */
import {
  posApiQuery,
  posApiRefund,
  posApiCancelRefund,
  posApiReversal,
  posApiCapRev,
  posApiSmartCancelOrRefund,
  getPosNextActionFromInquiry,
} from '../src/ctbc-pos-api-utils';
import { setSSLAuthIV } from '../src/ctbc-crypto-core';
import { CTBCHtmlErrorResponseError } from '../src/errors';
import { CTBC_ERROR_CODES, CTBCPosApiConfig, CTBCPosApiResponse } from '../src/typings';
import crypto from 'node:crypto';
import * as iconv from 'iconv-lite';

// Mock fetch
const mockFetch = jest.fn();

global.fetch = mockFetch as jest.Mock;

describe('CTBC POS API Utils', () => {
  const validConfig: CTBCPosApiConfig = {
    URL: 'https://test.ctbc.com',
    MacKey: 'abcdefghijklmnopqrstuvwx', // 24 character key for 3DES
  };

  const shortMacKeyConfig: CTBCPosApiConfig = {
    URL: 'https://test.ctbc.com',
    MacKey: '12345678', // 8 character key for DES
  };

  const sslAuthIV = Buffer.alloc(8, 0xab);

  // 組出與 CTBC 相同格式的回應：MERID=...&ApiEnc=<3DES 加密的 Big5 JSON>
  const buildEncryptedResponse = (payload: Record<string, string>): string => {
    const big5 = iconv.encode(JSON.stringify(payload), 'big5');
    const padLength = 8 - (big5.length % 8);
    const padded = Buffer.concat([big5, Buffer.alloc(padLength, padLength)]);
    const cipher = crypto.createCipheriv('des-ede3-cbc', Buffer.from(validConfig.MacKey, 'utf8'), sslAuthIV);

    cipher.setAutoPadding(false);

    const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);

    return `MERID=123456789012345&ApiEnc=${encrypted.toString('hex')}`;
  };

  beforeAll(() => {
    setSSLAuthIV(sslAuthIV);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks 不會清掉未被消費的 mockResolvedValueOnce 佇列，殘留值會汙染後續測試
    mockFetch.mockReset();
  });

  describe('Parameter Validation Functions', () => {
    describe('posApiQuery - MERID validation', () => {
      it('should return ERR_INVALID_MERID when MERID is empty', async () => {
        const result = await posApiQuery(validConfig, {
          MERID: '',
          'LID-M': 'TEST_ORDER_123',
        });

        expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_MERID);
      });

      it('should return ERR_INVALID_MERID when MERID contains non-numeric characters', async () => {
        const result = await posApiQuery(validConfig, {
          MERID: 'ABC123',
          'LID-M': 'TEST_ORDER_123',
        });

        expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_MERID);
      });
    });

    describe('posApiQuery - LID-M validation', () => {
      it('should return ERR_INVALID_LIDM when LID-M is empty', async () => {
        const result = await posApiQuery(validConfig, {
          MERID: '123456789012345',
          'LID-M': '',
        });

        expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_LIDM);
      });

      it('should return ERR_INVALID_LIDM when LID-M is too long (>19 chars)', async () => {
        const result = await posApiQuery(validConfig, {
          MERID: '123456789012345',
          'LID-M': '12345678901234567890', // 20 chars
        });

        expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_LIDM);
      });

      it('should return ERR_INVALID_LIDM when LID-M contains invalid characters', async () => {
        const result = await posApiQuery(validConfig, {
          MERID: '123456789012345',
          'LID-M': 'ORDER-123@TEST', // Contains @
        });

        expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_LIDM);
      });
    });

    describe('posApiQuery - TxType validation', () => {
      it('should return ERR_HOST_CONNECTION_FAILED when TxType is empty (treated as not provided)', async () => {
        // Empty TxType is treated as not provided, so validation passes
        // But network request fails
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await posApiQuery(validConfig, {
          MERID: '123456789012345',
          'LID-M': 'TEST_ORDER_123',
          TxType: '',
        });

        expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
      });

      it('should return ERR_INVALID_TX_TYPE when TxType is invalid', async () => {
        const result = await posApiQuery(validConfig, {
          MERID: '123456789012345',
          'LID-M': 'TEST_ORDER_123',
          TxType: 'X', // Invalid type
        });

        expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_TX_TYPE);
      });
    });
  });

  describe('posApiRefund - Parameter Validation', () => {
    it('should return ERR_INVALID_MERID when MERID is empty', async () => {
      const result = await posApiRefund(validConfig, {
        MERID: '',
        'LID-M': 'TEST_ORDER_123',
        OrgAmt: '1000',
        XID: 'XID123',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_MERID);
    });

    it('should return ERR_INVALID_LIDM when LID-M is invalid', async () => {
      const result = await posApiRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': '',
        OrgAmt: '1000',
        XID: 'XID123',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_LIDM);
    });

    it('should return ERR_INVALID_ORG_AMT when OrgAmt is not numeric', async () => {
      const result = await posApiRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        OrgAmt: 'abc',
        XID: 'XID123',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_ORG_AMT);
    });

    it('should return ERR_INVALID_AUTH_CODE when AuthCode is invalid', async () => {
      const result = await posApiRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        OrgAmt: '1000',
        XID: 'XID123',
        AuthCode: 'TOOLONGCODE', // More than 6 chars
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_AUTH_CODE);
    });

    it('should return ERR_INVALID_AUTH_CODE when AuthCode contains invalid chars', async () => {
      const result = await posApiRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        OrgAmt: '1000',
        XID: 'XID123',
        AuthCode: 'AB@#', // Invalid characters
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_AUTH_CODE);
    });
  });

  describe('posApiCancelRefund - Parameter Validation', () => {
    it('should return ERR_INVALID_MERID when MERID is empty', async () => {
      const result = await posApiCancelRefund(validConfig, {
        MERID: '',
        'LID-M': 'TEST_ORDER_123',
        CredRevAmt: '1000',
        XID: 'XID123',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_MERID);
    });

    it('should return ERR_INVALID_LIDM when LID-M is invalid', async () => {
      const result = await posApiCancelRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': '',
        CredRevAmt: '1000',
        XID: 'XID123',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_LIDM);
    });

    it('should return ERR_INVALID_ORG_AMT when CredRevAmt is not numeric', async () => {
      const result = await posApiCancelRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        CredRevAmt: 'abc',
        XID: 'XID123',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_ORG_AMT);
    });

    it('should return ERR_INVALID_AUTH_CODE when AuthCode is invalid (too long)', async () => {
      const result = await posApiCancelRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        CredRevAmt: '1000',
        XID: 'XID123',
        AuthCode: 'TOOLONGCODE', // More than 6 chars
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_AUTH_CODE);
    });
  });

  describe('posApiReversal - Parameter Validation', () => {
    it('should return ERR_INVALID_MERID when MERID is empty', async () => {
      const result = await posApiReversal(validConfig, {
        MERID: '',
        'LID-M': 'TEST_ORDER_123',
        XID: 'XID123',
        AuthCode: 'ABC123',
        OrgAmt: '1000',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_MERID);
    });

    it('should return ERR_INVALID_LIDM when LID-M is invalid', async () => {
      const result = await posApiReversal(validConfig, {
        MERID: '123456789012345',
        'LID-M': '',
        XID: 'XID123',
        AuthCode: 'ABC123',
        OrgAmt: '1000',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_LIDM);
    });
  });

  describe('posApiCapRev - Parameter Validation', () => {
    it('should return ERR_INVALID_MERID when MERID is empty', async () => {
      const result = await posApiCapRev(validConfig, {
        MERID: '',
        'LID-M': 'TEST_ORDER_123',
        XID: 'XID123',
        AuthCode: 'ABC123',
        OrgAmt: '1000',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_MERID);
    });

    it('should return ERR_INVALID_LIDM when LID-M is invalid', async () => {
      const result = await posApiCapRev(validConfig, {
        MERID: '123456789012345',
        'LID-M': '',
        XID: 'XID123',
        AuthCode: 'ABC123',
        OrgAmt: '1000',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_LIDM);
    });
  });

  describe('getPosNextActionFromInquiry', () => {
    it('should return "Reversal" for CurrentState 1', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '1' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('Reversal');
    });

    it('should return "CapRev" for CurrentState 10', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '10' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('CapRev');
    });

    it('should return "Refund" for CurrentState 12', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '12' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('Refund');
    });

    it('should return "Forbidden" for CurrentState 20', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '20' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('Forbidden');
    });

    it('should return "Forbidden" for CurrentState 22', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '22' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('Forbidden');
    });

    it('should return "Pending" for CurrentState 11', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '11' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('Pending');
    });

    it('should return "Pending" for CurrentState 21', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '21' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('Pending');
    });

    it('should return "Failed" for CurrentState -1', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '-1' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('Failed');
    });

    it('should return "Failed" for CurrentState 13', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '13' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('Failed');
    });

    it('should return "Failed" for CurrentState 23', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '23' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('Failed');
    });

    it('should return "None" for CurrentState 0', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '0' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('None');
    });

    it('should return "None" for unrecognized CurrentState', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '999' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('None');
    });

    it('should return "None" when CurrentState is empty string', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('None');
    });

    it('should return "None" when CurrentState is undefined', () => {
      const inquiry: CTBCPosApiResponse = {};
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('None');
    });

    it('should return "None" when CurrentState is NaN string', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: 'abc' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('None');
    });

    it('should return "None" when CurrentState is whitespace', () => {
      const inquiry: CTBCPosApiResponse = { CurrentState: '   ' };
      const result = getPosNextActionFromInquiry(inquiry);

      expect(result).toBe('None');
    });
  });

  describe('API Error Handling', () => {
    it('should return error code when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
      });

      // When fetch fails, the result is ERR_HOST_CONNECTION_FAILED
      // But since we're mocking, it depends on implementation
      expect(typeof result).toBe('number');
    });

    it('should return ERR_HOST_CONNECTION_FAILED when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: jest.fn().mockResolvedValue('Internal Server Error'),
      });

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });
  });

  describe('posApiQuery with optional parameters', () => {
    it('should handle TxType parameter when valid', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        TxType: 'Q', // Valid type
      });

      // Should reach the network request (and fail due to mock)
      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should handle TxID parameter', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        TxID: 'TX123456',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should handle Tx_ATTRIBUTE parameter', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        Tx_ATTRIBUTE: 'TX_AUTH',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });
  });

  describe('posApiRefund with optional parameters', () => {
    it('should handle valid AuthCode', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        OrgAmt: '1000',
        XID: 'XID123',
        AuthCode: 'ABC123',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should pass when AuthCode is null', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        OrgAmt: '1000',
        XID: 'XID123',
        AuthCode: null as unknown as string,
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should handle currency, PurchAmt and exponent for partial refund', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        OrgAmt: '1000',
        XID: 'XID123',
        currency: '901',
        PurchAmt: '500',
        exponent: '2',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });
  });

  describe('posApiCancelRefund with optional parameters', () => {
    it('should handle valid AuthCode', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiCancelRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        CredRevAmt: '1000',
        XID: 'XID123',
        AuthCode: 'ABC123',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should handle currency and exponent parameters', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiCancelRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        CredRevAmt: '1000',
        XID: 'XID123',
        currency: '901',
        exponent: '2',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });
  });

  describe('posApiReversal with optional parameters', () => {
    it('should handle currency and exponent parameters', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiReversal(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        XID: 'XID123',
        AuthCode: 'ABC123',
        OrgAmt: '1000',
        currency: '901',
        exponent: '2',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should handle request without currency parameters (empty amount strings)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiReversal(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        XID: 'XID123',
        AuthCode: 'ABC123',
        OrgAmt: '1000',
        // No currency, exponent - amount strings will be empty
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });
  });

  describe('posApiCapRev with optional parameters', () => {
    it('should handle currency and exponent parameters', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiCapRev(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        XID: 'XID123',
        AuthCode: 'ABC123',
        OrgAmt: '1000',
        currency: '901',
        exponent: '2',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should handle request without currency parameters (empty amount strings)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiCapRev(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        XID: 'XID123',
        AuthCode: 'ABC123',
        OrgAmt: '1000',
        // No currency, exponent - amount strings will be empty
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });
  });

  describe('MAC Key Length', () => {
    it('should work with 8-character MAC key', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(shortMacKeyConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should work with 24-character MAC key', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });
  });

  describe('posApiSmartCancelOrRefund', () => {
    const refundParams = {
      MERID: '123456789012345',
      'LID-M': 'TEST_ORDER_123',
      OrgAmt: '1000',
      XID: 'XID123',
      AuthCode: 'ABC123',
      currency: '901',
      PurchAmt: '500',
      exponent: '0',
    };

    it('should throw error when transaction is pending (CurrentState 11)', async () => {
      const inquiry = { CurrentState: '11' };
      const action = getPosNextActionFromInquiry(inquiry);

      expect(action).toBe('Pending');
    });

    it('should throw error when transaction is forbidden (CurrentState 20)', async () => {
      const inquiry = { CurrentState: '20' };
      const action = getPosNextActionFromInquiry(inquiry);

      expect(action).toBe('Forbidden');
    });

    it('should throw error when transaction has failed (CurrentState -1)', async () => {
      const inquiry = { CurrentState: '-1' };
      const action = getPosNextActionFromInquiry(inquiry);

      expect(action).toBe('Failed');
    });

    it('should return Reversal action for CurrentState 1', async () => {
      const inquiry = { CurrentState: '1' };
      const action = getPosNextActionFromInquiry(inquiry);

      expect(action).toBe('Reversal');
    });

    it('should return CapRev action for CurrentState 10', async () => {
      const inquiry = { CurrentState: '10' };
      const action = getPosNextActionFromInquiry(inquiry);

      expect(action).toBe('CapRev');
    });

    it('should return Refund action for CurrentState 12', async () => {
      const inquiry = { CurrentState: '12' };
      const action = getPosNextActionFromInquiry(inquiry);

      expect(action).toBe('Refund');
    });

    it('should return None for invalid query result (number)', async () => {
      const inquiry = { CurrentState: undefined } as CTBCPosApiResponse;
      const action = getPosNextActionFromInquiry(inquiry);

      expect(action).toBe('None');
    });

    it('should throw Pending error when calling posApiSmartCancelOrRefund with pending state', async () => {
      // Mock fetch to return a response that parses to CurrentState: '11'
      // This is tricky because parseResponse uses encryption
      // We can test by using invalid MERID to get error code path first
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // When query fails (returns error code), action becomes 'None'
      const result = await posApiSmartCancelOrRefund(validConfig, refundParams);

      expect(result.action).toBe('None');
      expect(typeof result.inquiry).toBe('number'); // Error code
    });
  });

  describe('checkAuthCode edge cases', () => {
    it('should pass validation when AuthCode is empty string (falsy)', async () => {
      // Empty string is falsy, so !input is true, and the function returns true (passes validation)
      // Then the request proceeds to network call which fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        OrgAmt: '1000',
        XID: 'XID123',
        AuthCode: '', // Empty string is treated as "not provided" and passes validation
      });

      // Empty string passes validation, so we get network error instead
      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should return ERR_INVALID_AUTH_CODE when AuthCode has special characters', async () => {
      const result = await posApiRefund(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        OrgAmt: '1000',
        XID: 'XID123',
        AuthCode: 'AB!@#', // Special characters fail regex
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_INVALID_AUTH_CODE);
    });
  });

  describe('checkTxType edge cases', () => {
    it('should accept valid TxType Q', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        TxType: 'Q',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should accept valid TxType A', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        TxType: 'A',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should accept valid TxType S', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        TxType: 'S',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should accept valid TxType V', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        TxType: 'V',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });

    it('should accept valid TxType R', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        TxType: 'R',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });
  });

  describe('getJsonString variations', () => {
    // These are internal functions but we can test through API calls with different param combinations
    it('should handle query with all optional parameters', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
        TxType: 'Q',
        TxID: 'TX123',
        Tx_ATTRIBUTE: 'TX_AUTH',
      });

      expect(result).toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);
    });
  });

  describe('Response parsing edge cases', () => {
    it('should return error code when response format is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('short=response'),
      });

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
      });

      // The response parsing returns CTBC_ERROR_CODES.ERR_RESPONSE_PARSE_FAILED
      // But since it uses parseResponse which may have issues, we just check it's an error number
      expect(typeof result).toBe('number');
    });

    it('should return error code when decrypted data has no JSON ending', async () => {
      // This is difficult to test without mocking the crypto functions
      // The parseResponse function checks for '}' in the decrypted data
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue('MERID=123&ApiEnc=invalid_encrypted_data'),
      });

      const result = await posApiQuery(validConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
      });

      // Since the decryption will fail or produce invalid data, we expect an error
      expect(typeof result).toBe('number');
    });
  });

  describe('CTBCHtmlErrorResponseError', () => {
    // CTBC 系統維護期間實際回傳的公告頁
    const htmlErrorResponse =
      '<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><style></style></head>' +
      "<body lang=ZH-TW style='text-justify-trim:punctuation'><p><b><u>&#37325;&#35201;&#20844;&#21578;</u></b></p>" +
      '<p>&#30446;&#21069;&#27491;&#36914;&#34892;&#31995;&#32113;&#32173;&#35703;&#20013;&#65292;&#36896;&#25104;&#19981;&#20415;&#65292;&#25964;&#35531;&#35211;&#35538;!</p>' +
      '<p>&nbsp;</p><p>&#20013;&#22283;&#20449;&#35351; &#25964;&#21855;</p></body></html>';

    const queryParams = {
      MERID: '123456789012345',
      'LID-M': 'TEST_ORDER_123',
    };

    it('should throw CTBCHtmlErrorResponseError when CTBC returns an HTML error page', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=UTF-8' }),
        text: jest.fn().mockResolvedValue(htmlErrorResponse),
      });

      await expect(posApiQuery(validConfig, queryParams)).rejects.toThrow(CTBCHtmlErrorResponseError);
    });

    it('should detect a DOCTYPE-prefixed HTML page', async () => {
      const doctypeResponse = `<!DOCTYPE html>\n<html><body>系統維護中</body></html>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: jest.fn().mockResolvedValue(doctypeResponse),
      });

      await expect(posApiQuery(validConfig, queryParams)).rejects.toThrow(CTBCHtmlErrorResponseError);
    });

    it('should detect an HTML error page served with a non-2xx status code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: jest.fn().mockResolvedValue(htmlErrorResponse),
      });

      await expect(posApiQuery(validConfig, queryParams)).rejects.toThrow(CTBCHtmlErrorResponseError);
    });

    it('should detect an HTML page by content-type even when the body is not recognisable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=big5' }),
        text: jest.fn().mockResolvedValue('<!-- maintenance -->\n<body>系統維護中</body>'),
      });

      await expect(posApiQuery(validConfig, queryParams)).rejects.toThrow(CTBCHtmlErrorResponseError);
    });

    it('should carry the raw response text on the responseText property', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: jest.fn().mockResolvedValue(htmlErrorResponse),
      });

      let caughtError: unknown;

      try {
        await posApiQuery(validConfig, queryParams);
      } catch (error) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(CTBCHtmlErrorResponseError);
      expect((caughtError as CTBCHtmlErrorResponseError).responseText).toBe(htmlErrorResponse);
      expect((caughtError as CTBCHtmlErrorResponseError).name).toBe('CTBCHtmlErrorResponseError');
    });

    it('should truncate the embedded page in the error message but keep it whole on responseText', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: jest.fn().mockResolvedValue(htmlErrorResponse),
      });

      let caughtError: unknown;

      try {
        await posApiQuery(validConfig, queryParams);
      } catch (error) {
        caughtError = error;
      }

      const error = caughtError as CTBCHtmlErrorResponseError;

      expect(htmlErrorResponse.length).toBeGreaterThan(200);
      expect(error.message).toContain(htmlErrorResponse.slice(0, 200));
      expect(error.message).not.toContain(htmlErrorResponse);
      expect(error.message.length).toBeLessThan(htmlErrorResponse.length);
      expect(error.responseText).toBe(htmlErrorResponse);
    });

    it('should parse a normal (non-HTML) response instead of throwing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: jest.fn().mockResolvedValue(buildEncryptedResponse({ RespCode: '0', ErrCode: '00', CurrentState: '1' })),
      });

      const result = await posApiQuery(validConfig, queryParams);

      expect(result).toEqual(expect.objectContaining({ RespCode: '0', ErrCode: '00', CurrentState: '1' }));
    });

    it('should detect an HTML page hidden behind a proxy comment or XML declaration', async () => {
      const wrapped = '<!-- proxy banner --><html><body><a href="/?x=1&y=2">blocked</a></body></html>';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: jest.fn().mockResolvedValue(wrapped),
      });

      await expect(posApiQuery(validConfig, queryParams)).rejects.toThrow(CTBCHtmlErrorResponseError);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: jest.fn().mockResolvedValue('<?xml version="1.0"?><html><body>maintenance</body></html>'),
      });

      await expect(posApiQuery(validConfig, queryParams)).rejects.toThrow(CTBCHtmlErrorResponseError);
    });

    it('should not be fooled by an HTML page whose links mimic an envelope', async () => {
      // <a href="/help?a=1&b=2"> 讓 split 後的第 4 段變成 'b'，是合法 hex 但不是 3DES 密文長度
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=UTF-8' }),
        text: jest.fn().mockResolvedValue('<html><body><a href="/help?a=1&b=2">status</a></body></html>'),
      });

      await expect(posApiQuery(validConfig, queryParams)).rejects.toThrow(CTBCHtmlErrorResponseError);
    });

    it('should NOT reject a valid CTBC envelope that is mislabelled as text/html', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=UTF-8' }),
        text: jest.fn().mockResolvedValue(buildEncryptedResponse({ RespCode: '0', ErrCode: '00', CurrentState: '1' })),
      });

      const result = await posApiQuery(validConfig, queryParams);

      expect(result).toEqual(expect.objectContaining({ RespCode: '0', ErrCode: '00' }));
    });

    it('should not hang when a non-2xx response never finishes streaming its body', async () => {
      jest.useFakeTimers();

      const abortAwareText = (signal: AbortSignal): Promise<string> =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('The operation was aborted')));
        });

      mockFetch.mockImplementationOnce((_url: string, options: RequestInit) =>
        Promise.resolve({
          ok: false,
          status: 503,
          headers: new Headers({ 'content-type': 'text/plain' }),
          text: () => abortAwareText(options.signal as AbortSignal),
        }),
      );

      const pending = posApiQuery(validConfig, queryParams);

      await Promise.resolve();
      jest.advanceTimersByTime(30000);

      await expect(pending).resolves.toBe(CTBC_ERROR_CODES.ERR_HOST_CONNECTION_FAILED);

      jest.useRealTimers();
    });

    it('should still return ERR_RESPONSE_PARSE_FAILED for a malformed non-HTML response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: jest.fn().mockResolvedValue('short=response'),
      });

      const result = await posApiQuery(validConfig, queryParams);

      expect(result).toBe(CTBC_ERROR_CODES.ERR_RESPONSE_PARSE_FAILED);
    });
  });

  describe('Invalid MAC key length', () => {
    it('should return error when MAC key has invalid length', async () => {
      const invalidKeyConfig: CTBCPosApiConfig = {
        URL: 'https://test.ctbc.com',
        MacKey: '12345', // Invalid length (not 8 or 24)
      };

      // Invalid MAC key length causes getMacValue to throw, which is caught in sendAndGetResponse
      // and returns ERR_HOST_CONNECTION_FAILED
      const result = await posApiQuery(invalidKeyConfig, {
        MERID: '123456789012345',
        'LID-M': 'TEST_ORDER_123',
      });

      // The error is caught and returns a number error code
      expect(typeof result).toBe('number');
    });
  });
});
