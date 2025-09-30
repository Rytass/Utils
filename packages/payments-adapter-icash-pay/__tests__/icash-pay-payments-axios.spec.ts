import {
  I_CASH_PAY_SUCCESS_CODE,
  ICashPayBaseUrls,
  ICashPayPaymentInitOptions,
  ICashPayResponse,
  ICashPayTradeStatus,
} from '../src/typing';
import { ICashPayPayment } from '../src/icash-pay-payment';
import axios from 'axios';
import * as crypto from 'node:crypto';
import { ICashPayOrder } from '../src/icash-pay-order';

jest.mock('node:crypto');

const fakePayload = {
  TradeStatus: ICashPayTradeStatus.COMMITTED,
  TotalAmount: '2000',
  ICPAmount: '1500',
  BonusAmt: '500',
  PaymentDate: '2025/09/30 12:34:56',
  TransactionID: 'TXN123456',
  ICPAccount: 'ICP-ACC-001',
  PaymentType: 'CREDIT_CARD',
  MMemberID: 'MEMBER-999',
  MobileInvoiceCarry: 'MOBILE-CARRIER',
  MaskedPan: '123456******7890',
  GID: 'UNIGID-001',
};

jest.mock('node:crypto', () => {
  const actual = jest.requireActual('node:crypto');
  const fakeDecipher = {
    update: jest.fn(() => Buffer.from(JSON.stringify(fakePayload))),
    final: jest.fn(() => Buffer.alloc(0)),
  };

  return {
    ...actual,
    createDecipheriv: jest.fn(() => fakeDecipher),
    sign: jest.fn(() => Buffer.from('MOCK_SIGNATURE')),
    verify: jest.fn(() => true),
  };
});

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../src/icash-pay-order');

describe('with mocked axios, crypto', () => {
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

  const mockEncData = 'TEST_ENCDATA';
  const mockAxiosSuccessResponse = {
    data: { EncData: mockEncData, RtnCode: I_CASH_PAY_SUCCESS_CODE, RtnMsg: 'Success' } as ICashPayResponse,
    status: 200,
    statusText: 'OK',
    headers: { 'x-req-id': 'abc' },
    config: {},
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    payment = new ICashPayPayment(mockOptions);

    (crypto.sign as jest.Mock).mockReturnValueOnce(Buffer.from('MOCK_SIGNATURE'));
    (crypto.verify as jest.Mock).mockReturnValue(true);
    mockedAxios.post.mockResolvedValue(mockAxiosSuccessResponse);
  });

  describe('ICashPayPayment.commit', () => {
    it('should throw error if RtnCode is not a success code', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        ...mockAxiosSuccessResponse,
        data: { ...mockAxiosSuccessResponse.data, RtnCode: '9999', RtnMsg: 'Payment failed' },
      });

      await expect(payment.commit(mockEncData)).rejects.toThrow('[9999] Payment failed');
    });

    it('should throw error if is not verification failed', async () => {
      (crypto.verify as jest.Mock).mockReturnValue(false);

      await expect(payment.commit(mockEncData)).rejects.toThrow('[-999] Signature verification failed');
    });

    it('should return responsePayload - success', async () => {
      const res = await payment.commit(mockEncData);

      expect(res).toMatchObject(fakePayload);
    });
  });

  describe('ICashPayPayment.query', () => {
    it('should return new failed order if RtnCode is not a success code', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        ...mockAxiosSuccessResponse,
        data: { ...mockAxiosSuccessResponse.data, RtnCode: '9999', RtnMsg: 'Payment failed' },
      });

      await expect(payment.query('TEST_ORDER_ID'));

      expect(MockOrder).toHaveBeenCalledTimes(1);

      expect(MockOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'TEST_ORDER_ID',
          items: [],
          gateway: payment,
          createdAt: expect.any(Date),
          failedCode: '9999',
          failedMessage: 'Payment failed',
          isTWQRCode: false,
          isRefunded: false,
          paidAmount: 0,
          bonusAmount: 0,
        }),
      );
    });

    it('should return new failed order if verification failed', async () => {
      (crypto.verify as jest.Mock).mockReturnValue(false);

      await expect(payment.query('TEST_ORDER_ID'));

      expect(MockOrder).toHaveBeenCalledTimes(1);

      expect(MockOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'TEST_ORDER_ID',
          items: [],
          gateway: payment,
          createdAt: expect.any(Date),
          failedCode: '-999',
          failedMessage: 'Signature verification failed',
          isTWQRCode: false,
          isRefunded: false,
          paidAmount: 0,
          bonusAmount: 0,
        }),
      );
    });

    describe('Failing Trade Status', () => {
      it('should return new failed order if TradeStatus is FAILED', async () => {
        fakePayload.TradeStatus = ICashPayTradeStatus.FAILED;

        await expect(payment.query('TEST_ORDER_ID'));

        expect(MockOrder).toHaveBeenCalledTimes(1);

        expect(MockOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'TEST_ORDER_ID',
            items: [],
            gateway: payment,
            createdAt: expect.any(Date),
            failedCode: '1',
            failedMessage: 'Success',
            isTWQRCode: false,
            isRefunded: false,
            paidAmount: 0,
            bonusAmount: 0,
          }),
        );
      });

      it('should return new failed order if TradeStatus is CANCELLED', async () => {
        fakePayload.TradeStatus = ICashPayTradeStatus.CANCELLED;

        await expect(payment.query('TEST_ORDER_ID'));

        expect(MockOrder).toHaveBeenCalledTimes(1);

        expect(MockOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'TEST_ORDER_ID',
            items: [],
            gateway: payment,
            createdAt: expect.any(Date),
            failedCode: '1',
            failedMessage: 'Success',
            isTWQRCode: false,
            isRefunded: false,
            paidAmount: 0,
            bonusAmount: 0,
          }),
        );
      });

      it('should return new failed order if TradeStatus is SETTLEMENT_FAILED', async () => {
        fakePayload.TradeStatus = ICashPayTradeStatus.SETTLEMENT_FAILED;

        await expect(payment.query('TEST_ORDER_ID'));

        expect(MockOrder).toHaveBeenCalledTimes(1);

        expect(MockOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'TEST_ORDER_ID',
            items: [],
            gateway: payment,
            createdAt: expect.any(Date),
            failedCode: '1',
            failedMessage: 'Success',
            isTWQRCode: false,
            isRefunded: false,
            paidAmount: 0,
            bonusAmount: 0,
          }),
        );
      });

      it('should return new failed order if TradeStatus is INITED', async () => {
        fakePayload.TradeStatus = ICashPayTradeStatus.INITED;

        await expect(payment.query('TEST_ORDER_ID'));

        expect(MockOrder).toHaveBeenCalledTimes(1);

        expect(MockOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'TEST_ORDER_ID',
            items: [],
            gateway: payment,
            createdAt: expect.any(Date),
            failedCode: '1',
            failedMessage: 'Success',
            isTWQRCode: false,
            isRefunded: false,
            paidAmount: 0,
            bonusAmount: 0,
          }),
        );
      });
    });

    it('should return new order if success', async () => {
      fakePayload.TradeStatus = ICashPayTradeStatus.COMMITTED;
      await expect(payment.query('TEST_ORDER_ID'));

      expect(MockOrder).toHaveBeenCalledTimes(1);

      expect(MockOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'TEST_ORDER_ID',
          items: [
            {
              name: '服務費',
              quantity: 1,
              unitPrice: 20,
            },
          ],
          paidAmount: 15,
          bonusAmount: 5,
          gateway: payment,
          createdAt: expect.any(Date),
          committedAt: expect.any(Date),
          transactionId: fakePayload.TransactionID,
          icpAccount: fakePayload.ICPAccount,
          paymentType: fakePayload.PaymentType,
          boundMemberId: fakePayload.MMemberID,
          invoiceMobileCarrier: fakePayload.MobileInvoiceCarry,
          creditCardFirstSix: '123456',
          creditCardLastFour: '7890',
          isTWQRCode: false,
          twqrIssueCode: undefined,
          uniGID: fakePayload.GID,
          isRefunded: false,
        }),
      );
    });
  });
});
