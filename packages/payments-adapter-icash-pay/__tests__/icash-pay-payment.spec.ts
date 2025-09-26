import { ICashPayBaseUrls, ICashPayPaymentInitOptions, LogLevel } from '../src/typing';
import { ICashPayPayment } from '../src/icash-pay-payment';
import debug from 'debug';
import { iCashPayDebug, iCashPayDebugInfo } from '../src/debug';

jest.mock('../src/debug', () => ({
  iCashPayDebug: jest.fn(),
  iCashPayDebugInfo: jest.fn(),
  iCashPayDebugError: jest.fn(),
}));

jest.mock('../src/icash-pay-order');

describe('iCash Pay Payment', () => {
  let payment: ICashPayPayment;

  const mockKey = '12345678901234567890123456789012'; // 32 bytes
  const mockIv = '1234567890abcdef'; // 16 bytes

  const mockOptions: ICashPayPaymentInitOptions = {
    baseUrl: 'https://example.com' as ICashPayBaseUrls,
    merchantId: 'TEST_MERCHANT_1',
    clientPrivateKey: 'TEST_PRIVATEKEY',
    serverPublicKey: 'TEST_PUBLICKEY',
    aesKey: {
      id: 'TEST_AES_KEY_ID',
      key: mockKey,
      iv: mockIv,
    },
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
});
