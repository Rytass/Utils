/**
 * @jest-environment node
 */

import {
  InvoiceState,
  InvoiceCarrierType,
  InvoiceAllowanceState,
} from '@rytass/invoice';
import { AmegoInvoiceGateway, AmegoBaseUrls } from '../src';

describe('AmegoInvoiceGateway', () => {
  let gateway: AmegoInvoiceGateway;

  beforeEach(() => {
    gateway = new AmegoInvoiceGateway();
  });

  describe('getInvoiceState', () => {
    it('should return ISSUED for B2B invoice types', () => {
      expect(gateway.getInvoiceState('A0401')).toBe(InvoiceState.ISSUED);
    });

    it('should return ISSUED for B2C invoice types', () => {
      expect(gateway.getInvoiceState('C0401')).toBe(InvoiceState.ISSUED);
    });

    it('should return ISSUED for general invoice types', () => {
      expect(gateway.getInvoiceState('F0401')).toBe(InvoiceState.ISSUED);
    });

    it('should return VOID for B2B void invoice types', () => {
      expect(gateway.getInvoiceState('A0501')).toBe(InvoiceState.VOID);
    });

    it('should return VOID for B2C void invoice types', () => {
      expect(gateway.getInvoiceState('C0501')).toBe(InvoiceState.VOID);
    });

    it('should return VOID for general void invoice types', () => {
      expect(gateway.getInvoiceState('F0501')).toBe(InvoiceState.VOID);
    });

    it('should return ALLOWANCED for B2B allowance issue types', () => {
      expect(gateway.getInvoiceState('B0401')).toBe(InvoiceState.ALLOWANCED);
    });

    it('should return ISSUED for B2B allowance void types', () => {
      expect(gateway.getInvoiceState('B0501')).toBe(InvoiceState.ISSUED);
    });

    it('should return ALLOWANCED for B2C allowance issue types', () => {
      expect(gateway.getInvoiceState('D0401')).toBe(InvoiceState.ALLOWANCED);
    });

    it('should return ALLOWANCED for B2C allowance void types', () => {
      expect(gateway.getInvoiceState('D0501')).toBe(InvoiceState.ISSUED);
    });

    it('should return ALLOWANCED for general allowance issue types', () => {
      expect(gateway.getInvoiceState('G0401')).toBe(InvoiceState.ALLOWANCED);
    });

    it('should return ISSUED for general allowance void types', () => {
      expect(gateway.getInvoiceState('G0501')).toBe(InvoiceState.ISSUED);
    });

    it('should return INITED for unknown invoice types', () => {
      expect(gateway.getInvoiceState('UNKNOWN')).toBe(InvoiceState.INITED);
      expect(gateway.getInvoiceState('')).toBe(InvoiceState.INITED);
      expect(gateway.getInvoiceState('X0000')).toBe(InvoiceState.INITED);
    });
  });

  describe('getInvoiceAllowanceState', () => {
    it('should return INVALID for B2B allowance void types', () => {
      expect(gateway.getInvoiceAllowanceState('B0501')).toBe(
        InvoiceAllowanceState.INVALID,
      );
    });

    it('should return INVALID for B2C allowance void types', () => {
      expect(gateway.getInvoiceAllowanceState('D0501')).toBe(
        InvoiceAllowanceState.INVALID,
      );
    });

    it('should return INVALID for general allowance void types', () => {
      expect(gateway.getInvoiceAllowanceState('G0501')).toBe(
        InvoiceAllowanceState.INVALID,
      );
    });

    it('should return ISSUED for B2B allowance issue types', () => {
      expect(gateway.getInvoiceAllowanceState('B0401')).toBe(
        InvoiceAllowanceState.ISSUED,
      );
    });

    it('should return ISSUED for B2C allowance issue types', () => {
      expect(gateway.getInvoiceAllowanceState('D0401')).toBe(
        InvoiceAllowanceState.ISSUED,
      );
    });

    it('should return ISSUED for general allowance issue types', () => {
      expect(gateway.getInvoiceAllowanceState('G0401')).toBe(
        InvoiceAllowanceState.ISSUED,
      );
    });

    it('should return INITED for unknown allowance types', () => {
      expect(gateway.getInvoiceAllowanceState('UNKNOWN')).toBe(
        InvoiceAllowanceState.INITED,
      );
      expect(gateway.getInvoiceAllowanceState('')).toBe(
        InvoiceAllowanceState.INITED,
      );
      expect(gateway.getInvoiceAllowanceState('A0401')).toBe(
        InvoiceAllowanceState.INITED,
      );
    });
  });

  describe('getCarrierInfo', () => {
    it('should return platform carrier info', () => {
      const result = gateway.getCarrierInfo({
        carrier: {
          type: InvoiceCarrierType.PLATFORM,
          code: 'test@example.com',
        },
        buyerEmail: 'test@example.com',
      });

      expect(result).toEqual({
        carrierId: 'test@example.com',
        carrierType: 'amego',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });
    });

    it('should return mobile carrier info', () => {
      const result = gateway.getCarrierInfo({
        carrier: { type: InvoiceCarrierType.MOBILE, code: '/DDPD7U2' },
        buyerEmail: 'test@example.com',
      });

      expect(result).toEqual({
        carrierId: '/DDPD7U2',
        carrierType: '3J0002',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });
    });

    it('should return moica carrier info', () => {
      const result = gateway.getCarrierInfo({
        carrier: { type: InvoiceCarrierType.MOICA, code: 'ABCD1234' },
        buyerEmail: 'test@example.com',
      });

      expect(result).toEqual({
        carrierId: 'ABCD1234',
        carrierType: 'CQ0001',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });
    });

    it('should return love code carrier info', () => {
      const result = gateway.getCarrierInfo({
        carrier: { type: InvoiceCarrierType.LOVE_CODE, code: '123456' },
        buyerEmail: 'test@example.com',
      });

      expect(result).toEqual({
        carrierId: '',
        carrierType: '',
        buyerEmail: 'test@example.com',
        loveCode: '123456',
      });
    });

    it('should return default carrier info when no carrier provided', () => {
      const result = gateway.getCarrierInfo({
        buyerEmail: 'test@example.com',
      });

      expect(result).toEqual({
        carrierId: '',
        carrierType: '',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });
    });

    it('should return default carrier info when carrier type is undefined', () => {
      const result = gateway.getCarrierInfo({
        carrier: { code: 'test' },
        buyerEmail: 'test@example.com',
      });

      expect(result).toEqual({
        carrierId: '',
        carrierType: '',
        buyerEmail: 'test@example.com',
        loveCode: '',
      });
    });

    it('should handle missing buyerEmail', () => {
      const result = gateway.getCarrierInfo({
        carrier: { type: InvoiceCarrierType.MOBILE, code: '/DDPD7U2' },
      });

      expect(result).toEqual({
        carrierId: '/DDPD7U2',
        carrierType: '3J0002',
        buyerEmail: '',
        loveCode: '',
      });
    });
  });

  describe('constructor', () => {
    it('should use default values when no options provided', () => {
      const gateway = new AmegoInvoiceGateway();

      // Access private properties via any to test default values
      expect((gateway as any).baseUrl).toBe(AmegoBaseUrls.DEVELOPMENT);
      expect((gateway as any).vatNumber).toBe('12345678');
      expect((gateway as any).appKey).toBe('sHeq7t8G1wiQvhAuIM27');
    });

    it('should use provided options', () => {
      const gateway = new AmegoInvoiceGateway({
        baseUrl: AmegoBaseUrls.PRODUCTION,
        vatNumber: '87654321',
        appKey: 'customAppKey',
      });

      // Access private properties via any to test custom values
      expect((gateway as any).baseUrl).toBe(AmegoBaseUrls.PRODUCTION);
      expect((gateway as any).vatNumber).toBe('87654321');
      expect((gateway as any).appKey).toBe('customAppKey');
    });

    it('should handle partial options', () => {
      const gateway = new AmegoInvoiceGateway({
        vatNumber: '87654321',
        appKey: 'customAppKey',
      });

      // Access private properties via any to test mixed values
      expect((gateway as any).baseUrl).toBe(AmegoBaseUrls.DEVELOPMENT); // default
      expect((gateway as any).vatNumber).toBe('87654321'); // provided
      expect((gateway as any).appKey).toBe('customAppKey'); // provided
    });
  });

  describe('parseCarrierFromResponse (private method test)', () => {
    it('should return undefined for empty carrier type', () => {
      const result = (gateway as any).parseCarrierFromResponse('', 'test', '');

      expect(result).toBeUndefined();
    });

    it('should return undefined for null carrier type', () => {
      const result = (gateway as any).parseCarrierFromResponse(
        null,
        'test',
        '',
      );

      expect(result).toBeUndefined();
    });

    it('should parse mobile carrier type', () => {
      const result = (gateway as any).parseCarrierFromResponse(
        '3J0002',
        '/DDPD7U2',
        '',
      );

      expect(result).toEqual({
        type: InvoiceCarrierType.MOBILE,
        code: '/DDPD7U2',
      });
    });

    it('should parse mobile carrier type with carrierId2', () => {
      const result = (gateway as any).parseCarrierFromResponse(
        '3J0002',
        '',
        '/DDPD7U2',
      );

      expect(result).toEqual({
        type: InvoiceCarrierType.MOBILE,
        code: '/DDPD7U2',
      });
    });

    it('should parse moica carrier type', () => {
      const result = (gateway as any).parseCarrierFromResponse(
        'CQ0001',
        'ABCD1234',
        '',
      );

      expect(result).toEqual({
        type: InvoiceCarrierType.MOICA,
        code: 'ABCD1234',
      });
    });

    it('should parse platform carrier type', () => {
      const result = (gateway as any).parseCarrierFromResponse(
        'amego',
        'test@example.com',
        '',
      );

      expect(result).toEqual({
        type: InvoiceCarrierType.PLATFORM,
        code: 'test@example.com',
      });
    });

    it('should parse love code from unknown carrier type', () => {
      const result = (gateway as any).parseCarrierFromResponse(
        'unknown',
        '123456',
        '',
      );

      expect(result).toEqual({
        type: InvoiceCarrierType.LOVE_CODE,
        code: '123456',
      });
    });

    it('should return undefined for invalid love code (too short)', () => {
      const result = (gateway as any).parseCarrierFromResponse(
        'unknown',
        '12',
        '',
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid love code (too long)', () => {
      const result = (gateway as any).parseCarrierFromResponse(
        'unknown',
        '123456789012345678',
        '',
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined for invalid love code (non-numeric)', () => {
      const result = (gateway as any).parseCarrierFromResponse(
        'unknown',
        '12abc6',
        '',
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined for unknown carrier type with empty code', () => {
      const result = (gateway as any).parseCarrierFromResponse(
        'unknown',
        '',
        '',
      );

      expect(result).toBeUndefined();
    });
  });

  describe('isLoveCodeValid', () => {
    it('should throw error for unsupported method', async () => {
      await expect(gateway.isLoveCodeValid('123456')).rejects.toThrow(
        'Method not supported in Amego API.',
      );
    });
  });
});
