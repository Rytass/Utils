/**
 * @jest-environment node
 */
import { HappyCardPayment } from '../src/happy-card-payment';
import { HappyCardBaseUrls, HappyCardProductType, HappyCardRecordType, HappyCardResultCode } from '../src/typings';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HappyCardPayment Extended Tests', () => {
  let gateway: HappyCardPayment;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should use DEVELOPMENT base URL by default', () => {
      gateway = new HappyCardPayment({
        cSource: 'test-source',
        key: 'test-key',
      });

      expect(gateway.baseUrl).toBe(HappyCardBaseUrls.DEVELOPMENT);
    });

    it('should use provided base URL', () => {
      gateway = new HappyCardPayment({
        cSource: 'test-source',
        key: 'test-key',
        baseUrl: HappyCardBaseUrls.PRODUCTION,
      });

      expect(gateway.baseUrl).toBe(HappyCardBaseUrls.PRODUCTION);
    });
  });

  describe('getBaseData', () => {
    beforeEach(() => {
      gateway = new HappyCardPayment({
        cSource: 'test-source',
        key: 'test-key',
      });
    });

    it('should return area 1 for mainland (isIsland = false)', () => {
      const baseData = gateway.getBaseData(false);

      expect(baseData.area).toBe(1);
      expect(baseData.source).toBe('test-source');
      expect(baseData.version).toBe('001');
      expect(baseData.store_id).toBe('999999');
      expect(baseData.pos_id).toBe('01');
      expect(baseData.check).toBeDefined();
      expect(baseData.createdate).toBeDefined();
    });

    it('should return area 2 for island (isIsland = true)', () => {
      const baseData = gateway.getBaseData(true);

      expect(baseData.area).toBe(2);
    });

    it('should generate correct MD5 checksum format', () => {
      const baseData = gateway.getBaseData();

      // Check should be uppercase hex MD5
      expect(baseData.check).toMatch(/^[A-F0-9]{32}$/);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      gateway = new HappyCardPayment({
        cSource: 'test-source',
        key: 'test-key',
      });
    });

    it('should throw not implemented error', () => {
      expect(() => gateway.query('ORDER123')).toThrow('Method not implemented.');
    });
  });

  describe('commit', () => {
    beforeEach(() => {
      gateway = new HappyCardPayment({
        cSource: 'test-source',
        key: 'test-key',
      });

      jest.spyOn(gateway, 'getBaseData').mockReturnValue({
        check: 'MOCKED_CHECKSUM',
        source: 'test-source',
        version: '001',
        store_id: '999999',
        pos_id: '01',
        createdate: '2025-01-10T00:00:00.000',
        area: 1,
      });
    });

    it('should commit successfully when API returns success', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          resultMsg: 'Success',
          data: {},
        },
      });

      await expect(
        gateway.commit({
          payload: {
            trade_date: '2025-01-10T00:00:00.000',
            request_no: 'ORDER123',
            is_own_cup: 0,
            cup_count: 0,
            card_list: [],
          },
        }),
      ).resolves.toBeUndefined();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/Pay'),
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should throw error when API returns failure', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.FAILED,
          resultMsg: 'Payment failed',
          data: {},
        },
      });

      await expect(
        gateway.commit({
          payload: {
            trade_date: '2025-01-10T00:00:00.000',
            request_no: 'ORDER123',
            is_own_cup: 0,
            cup_count: 0,
            card_list: [],
          },
        }),
      ).rejects.toThrow('[0] Payment failed');
    });

    it('should pass isIsland to getBaseData', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          resultMsg: 'Success',
          data: {},
        },
      });

      await gateway.commit({
        payload: {
          trade_date: '2025-01-10T00:00:00.000',
          request_no: 'ORDER123',
          is_own_cup: 0,
          cup_count: 0,
          card_list: [],
        },
        isIsland: true,
      });

      expect(gateway.getBaseData).toHaveBeenCalledWith(true);
    });
  });

  describe('refund', () => {
    beforeEach(() => {
      gateway = new HappyCardPayment({
        cSource: 'test-source',
        key: 'test-key',
      });

      jest.spyOn(gateway, 'getBaseData').mockReturnValue({
        check: 'MOCKED_CHECKSUM',
        source: 'test-source',
        version: '001',
        store_id: '999999',
        pos_id: '01',
        createdate: '2025-01-10T00:00:00.000',
        area: 1,
      });
    });

    it('should refund successfully when API returns success', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          resultMsg: 'Success',
          data: {},
        },
      });

      await expect(
        gateway.refund({
          id: 'ORDER123',
          cardSerial: 'CARD123',
        }),
      ).resolves.toBeUndefined();

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/CancelPay'),
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should throw error when API returns failure', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.FAILED,
          resultMsg: 'Refund failed',
          data: {},
        },
      });

      await expect(
        gateway.refund({
          id: 'ORDER123',
          cardSerial: 'CARD123',
        }),
      ).rejects.toThrow('[0] Refund failed');
    });

    it('should include posTradeNo when provided', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          resultMsg: 'Success',
          data: {},
        },
      });

      await gateway.refund({
        id: 'ORDER123',
        cardSerial: 'CARD123',
        posTradeNo: 'POS123',
      });

      const callArg = mockedAxios.post.mock.calls[0][1];
      const parsedPayload = JSON.parse(callArg as string);

      expect(parsedPayload.card_list[0].pos_trade_no).toBe('POS123');
    });

    it('should use empty string for posTradeNo when not provided', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          resultMsg: 'Success',
          data: {},
        },
      });

      await gateway.refund({
        id: 'ORDER123',
        cardSerial: 'CARD123',
      });

      const callArg = mockedAxios.post.mock.calls[0][1];
      const parsedPayload = JSON.parse(callArg as string);

      expect(parsedPayload.card_list[0].pos_trade_no).toBe('');
    });
  });

  describe('getCardBalance', () => {
    beforeEach(() => {
      gateway = new HappyCardPayment({
        cSource: 'test-source',
        key: 'test-key',
      });

      jest.spyOn(gateway, 'getBaseData').mockReturnValue({
        check: 'MOCKED_CHECKSUM',
        source: 'test-source',
        version: '001',
        store_id: '999999',
        pos_id: '01',
        createdate: '2025-01-10T00:00:00.000',
        area: 1,
      });
    });

    it('should throw error when API returns failure', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.FAILED,
          resultMsg: 'Card not found',
          data: {},
        },
      });

      await expect(gateway.getCardBalance('INVALID_CARD', false)).rejects.toThrow('Card not found');
    });

    it('should pass isIsland to getBaseData when provided', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          data: {
            card_list: [
              {
                card_sn: '123456',
                productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
                amt: 100,
                record_list: [],
              },
            ],
          },
        },
      });

      await gateway.getCardBalance('123456', false, true);

      expect(gateway.getBaseData).toHaveBeenCalledWith(true);
    });

    it('should return balance when called with only cardSerial (default params)', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          data: {
            card_list: [
              {
                card_sn: '123456',
                productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
                amt: 100,
                record_list: [],
              },
            ],
          },
        },
      });

      // Call with only cardSerial to use default returnRecords = false and isIsland = false
      const result = await gateway.getCardBalance('123456');

      expect(result[0]).toBe(100);
      expect(gateway.getBaseData).toHaveBeenCalledWith(false);
    });

    it('should filter out cards with invalid product types', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          data: {
            card_list: [
              {
                card_sn: '123456',
                productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
                amt: 100,
                record_list: [],
              },
              {
                card_sn: '789',
                productType: 'INVALID_TYPE' as HappyCardProductType,
                amt: 200,
                record_list: [],
              },
            ],
          },
        },
      });

      const result = await gateway.getCardBalance('123456', false);

      // Only the valid card should be counted
      expect(result[0]).toBe(100);
    });
  });

  describe('prepare', () => {
    beforeEach(() => {
      mockedAxios.post.mockReset();

      gateway = new HappyCardPayment({
        cSource: 'test-source',
        key: 'test-key',
      });

      jest.spyOn(gateway, 'getBaseData').mockReturnValue({
        check: 'MOCKED_CHECKSUM',
        source: 'test-source',
        version: '001',
        store_id: '999999',
        pos_id: '01',
        createdate: '2025-01-10T00:00:00.000',
        area: 1,
      });
    });

    it('should throw error when total item price does not match total use amount', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          data: {
            card_list: [
              {
                card_sn: '123456',
                productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
                amt: 100,
                record_list: [{ record_id: 1, type: HappyCardRecordType.AMOUNT, amt: 100 }],
              },
            ],
          },
        },
      });

      await expect(
        gateway.prepare({
          cardSerial: '123456',
          items: [{ name: 'Item 1', quantity: 1, unitPrice: 100 }],
          useRecords: [{ id: 1, type: HappyCardRecordType.AMOUNT, amount: 50 }], // Mismatch
        }),
      ).rejects.toThrow('Total item price does not match with total use amount');
    });

    it('should throw error when balance is not enough', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          data: {
            card_list: [
              {
                card_sn: '123456',
                productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
                amt: 50,
                record_list: [{ record_id: 1, type: HappyCardRecordType.AMOUNT, amt: 50 }],
              },
            ],
          },
        },
      });

      await expect(
        gateway.prepare({
          cardSerial: '123456',
          items: [{ name: 'Item 1', quantity: 1, unitPrice: 100 }],
          useRecords: [{ id: 1, type: HappyCardRecordType.AMOUNT, amount: 100 }], // item price = 100, use = 100
        }),
      ).rejects.toThrow('Balance is not enough'); // record only has amt: 50
    });

    it('should throw error when posTradeNo is too long', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          data: {
            card_list: [
              {
                card_sn: '123456',
                productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
                amt: 100,
                record_list: [{ record_id: 1, type: HappyCardRecordType.AMOUNT, amt: 200 }], // Enough balance
              },
            ],
          },
        },
      });

      await expect(
        gateway.prepare({
          cardSerial: '123456',
          items: [{ name: 'Item 1', quantity: 1, unitPrice: 100 }],
          useRecords: [{ id: 1, type: HappyCardRecordType.AMOUNT, amount: 100 }],
          posTradeNo: '1234567', // 7 characters, more than 6
        }),
      ).rejects.toThrow('POS Trade No length should be less than 6');
    });

    it('should throw error when record does not exist', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          data: {
            card_list: [
              {
                card_sn: '123456',
                productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
                amt: 100,
                record_list: [{ record_id: 1, type: HappyCardRecordType.AMOUNT, amt: 100 }],
              },
            ],
          },
        },
      });

      await expect(
        gateway.prepare({
          cardSerial: '123456',
          items: [{ name: 'Item 1', quantity: 1, unitPrice: 100 }],
          useRecords: [{ id: 999, type: HappyCardRecordType.AMOUNT, amount: 100 }], // Non-existent record
        }),
      ).rejects.toThrow('Balance is not enough');
    });

    it('should create order successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          data: {
            card_list: [
              {
                card_sn: '123456',
                productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
                amt: 100,
                record_list: [{ record_id: 1, type: HappyCardRecordType.AMOUNT, amt: 100 }],
              },
            ],
          },
        },
      });

      const order = await gateway.prepare({
        cardSerial: '123456',
        items: [{ name: 'Item 1', quantity: 1, unitPrice: 100 }],
        useRecords: [{ id: 1, type: HappyCardRecordType.AMOUNT, amount: 100 }],
      });

      expect(order).toBeDefined();
      expect(order.productType).toBe(HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF);
    });

    it('should use default AMOUNT type when type is not specified', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          data: {
            card_list: [
              {
                card_sn: '123456',
                productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
                amt: 100,
                record_list: [{ record_id: 1, type: HappyCardRecordType.AMOUNT, amt: 100 }],
              },
            ],
          },
        },
      });

      const order = await gateway.prepare({
        cardSerial: '123456',
        items: [{ name: 'Item 1', quantity: 1, unitPrice: 100 }],
        useRecords: [{ id: 1, amount: 100 }], // No type specified
      });

      expect(order).toBeDefined();
    });

    it('should use provided order id', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          data: {
            card_list: [
              {
                card_sn: '123456',
                productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
                amt: 100,
                record_list: [{ record_id: 1, type: HappyCardRecordType.AMOUNT, amt: 100 }],
              },
            ],
          },
        },
      });

      const order = await gateway.prepare({
        id: 'CUSTOM_ORDER_ID',
        cardSerial: '123456',
        items: [{ name: 'Item 1', quantity: 1, unitPrice: 100 }],
        useRecords: [{ id: 1, type: HappyCardRecordType.AMOUNT, amount: 100 }],
      });

      expect(order.id).toBe('CUSTOM_ORDER_ID');
    });

    it('should create order with isIsland option', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          resultCode: HappyCardResultCode.SUCCESS,
          data: {
            card_list: [
              {
                card_sn: '123456',
                productType: HappyCardProductType.INVOICE_FIRST_DIGITAL_GIFT_GF,
                amt: 100,
                record_list: [{ record_id: 1, type: HappyCardRecordType.AMOUNT, amt: 100 }],
              },
            ],
          },
        },
      });

      const order = await gateway.prepare({
        cardSerial: '123456',
        items: [{ name: 'Item 1', quantity: 1, unitPrice: 100 }],
        useRecords: [{ id: 1, type: HappyCardRecordType.AMOUNT, amount: 100 }],
        isIsland: true,
      });

      // Verify order was created successfully with isIsland option
      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
    });
  });
});
