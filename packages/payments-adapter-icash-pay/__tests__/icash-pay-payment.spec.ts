import { ICashPayBaseUrls, ICashPayPaymentInitOptions, ICashPayPrepareOptions, LogLevel } from '../src/typing';
import { ICashPayPayment } from '../src/icash-pay-payment';
import debug from 'debug';
import { iCashPayDebug, iCashPayDebugInfo } from '../src/debug';
import { ICashPayOrder } from '../src/icash-pay-order';

jest.mock('../src/debug', () => ({
  iCashPayDebug: jest.fn(),
  iCashPayDebugInfo: jest.fn(),
  iCashPayDebugError: jest.fn(),
}));

jest.mock('../src/icash-pay-order');

describe('ICashPay Payment', () => {
  let payment: ICashPayPayment;

  const mockAESKey = '12345678901234567890123456789012'; // 32 bytes
  const mockAESIv = '1234567890abcdef'; // 16 bytes

  const MockOrder = ICashPayOrder as jest.MockedClass<typeof ICashPayOrder>;

  const mockOptions: ICashPayPaymentInitOptions = {
    baseUrl: 'https://example.com' as ICashPayBaseUrls,
    merchantId: 'TEST_MERCHANT_1',
    clientPrivateKey: 'TEST_CLIENT_PRIVATE_KEY',
    serverPublicKey: 'TEST_SERVER_PUBLIC_KEY',
    aesKey: {
      id: 'TEST_AES_KEY_ID',
      key: mockAESKey,
      iv: mockAESIv,
    },
  };

  const mockItems = [
    {
      name: 'TEST_ITEM_NAME_1',
      unitPrice: 100,
      quantity: 10,
    },
    {
      name: 'TEST_ITEM_NAME_2',
      unitPrice: 200,
      quantity: 5,
    },
  ];

  const mockPayPrepareOptions: ICashPayPrepareOptions = {
    id: 'TEST_ORDER_ID',
    items: mockItems,
    storeId: 'TEST_STORE_ID',
    storeName: 'TEST_STORE_NAME',
    barcode: 'TEST_BARCODE',
    amount: 1000,
    collectedAmount: 800,
    consignmentAmount: 200,
    nonRedeemAmount: 100,
    collectedNonRedeemAmount: 80,
    consignmentNonRedeemAmount: 20,
    nonPointAmount: 50,
  };

  describe('constructor', () => {
    beforeEach(() => {
      jest.spyOn(debug, 'enable').mockImplementation(jest.fn());
      jest.clearAllMocks();
    });

    it('should call logger - Debug', () => {
      payment = new ICashPayPayment({ ...mockOptions, logLevel: LogLevel.DEBUG });
      expect(debug.enable).toHaveBeenCalledWith('Payment:iCashPay:Debug');
    });

    it('should call logger - Info', () => {
      payment = new ICashPayPayment({ ...mockOptions, logLevel: LogLevel.INFO });
      expect(debug.enable).toHaveBeenCalledWith('Payment:iCashPay:Info');
    });

    it('should call logger - Error', () => {
      payment = new ICashPayPayment({ ...mockOptions, logLevel: LogLevel.ERROR });
      expect(debug.enable).toHaveBeenCalledWith('Payment:iCashPay:Error');
    });

    it('should log out for message for debug and debugInfo', () => {
      payment = new ICashPayPayment(mockOptions);

      expect(iCashPayDebug).toHaveBeenCalledWith(
        'Warning! Debug mode is enabled, sensitive data may be logged, please use this mode only for debugging purposes',
      );

      expect(iCashPayDebugInfo).toHaveBeenCalledWith('Initialized iCashPay Payment Gateway');
    });
  });

  describe('Functions', () => {
    beforeEach(() => {
      payment = new ICashPayPayment(mockOptions);
    });

    describe('ICashPayPayment.prepare', () => {
      it('should throw error if amount does not match sum of item prices', async () => {
        await expect(
          payment.prepare({
            ...mockPayPrepareOptions,
            amount: 500,
          }),
        ).rejects.toThrow('Total amount does not match the sum of item prices');
      });

      it('should throw error if amount is zero', async () => {
        await expect(
          payment.prepare({
            ...mockPayPrepareOptions,
            items: [
              {
                name: 'TEST_ITEM_NAME_1',
                unitPrice: 100,
                quantity: 0,
              },
              {
                name: 'TEST_ITEM_NAME_2',
                unitPrice: 200,
                quantity: 0,
              },
            ],
            amount: 0,
            consignmentAmount: 0,
            collectedAmount: 0,
          }),
        ).rejects.toThrow('Total amount must be greater than 0');
      });

      describe('success', () => {
        beforeEach(() => {
          jest.clearAllMocks();
        });

        it('should return new order - with id', async () => {
          await payment.prepare(mockPayPrepareOptions);

          expect(MockOrder).toHaveBeenCalledTimes(1);

          expect(MockOrder).toHaveBeenCalledWith(
            expect.objectContaining({
              id: 'TEST_ORDER_ID',
              items: mockItems,
              gateway: payment,
              createdAt: expect.any(Date),
              deductEncData: expect.any(String),
              isTWQRCode: false,
              isRefunded: false,
              paidAmount: 2000,
              bonusAmount: 0,
            }),
          );
        });

        it('should return new order - with no id', async () => {
          await payment.prepare({ ...mockPayPrepareOptions, id: undefined });

          expect(MockOrder).toHaveBeenCalledTimes(1);

          expect(MockOrder).toHaveBeenCalledWith(
            expect.objectContaining({
              id: expect.any(String),
              items: mockItems,
              gateway: payment,
              createdAt: expect.any(Date),
              deductEncData: expect.any(String),
              isTWQRCode: false,
              isRefunded: false,
              paidAmount: 2000,
              bonusAmount: 0,
            }),
          );
        });

        it('should return new order - no collected amount and consigment amount', async () => {
          await payment.prepare({
            ...mockPayPrepareOptions,
            amount: 2000,
            collectedAmount: undefined,
            consignmentAmount: undefined,
            collectedNonRedeemAmount: undefined,
            consignmentNonRedeemAmount: undefined,
            nonRedeemAmount: undefined,
            nonPointAmount: undefined,
          });

          expect(MockOrder).toHaveBeenCalledTimes(1);

          expect(MockOrder).toHaveBeenCalledWith(
            expect.objectContaining({
              id: expect.any(String),
              items: mockItems,
              gateway: payment,
              createdAt: expect.any(Date),
              deductEncData: expect.any(String),
              isTWQRCode: false,
              isRefunded: false,
              paidAmount: 2000,
              bonusAmount: 0,
            }),
          );
        });
      });
    });
  });
});
