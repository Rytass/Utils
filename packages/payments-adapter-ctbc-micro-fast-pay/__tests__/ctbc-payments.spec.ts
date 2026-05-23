import { CardType, CTBCBindCardRequest, CTBCOrder, CTBCPayment } from '../src';
import * as iconv from 'iconv-lite';
import * as ctbcCrypto from '../src/ctbc-crypto-core';

jest.mock('iconv-lite', () => ({
  __esModule: true,
  decode: jest.fn(),
}));

const rspjsonpwdToBody = (response: {}): string => {
  const rspjsonpwd = encodeURIComponent(JSON.stringify(response));

  return `rspjsonpwd=${rspjsonpwd}`;
};

const jsonToBody = (response: {}): string => {
  return encodeURIComponent(JSON.stringify(response));
};

describe('CTBCPayments Mock Tests', () => {
  let payment: CTBCPayment;
  let order: CTBCOrder;
  let bindCardRequest: CTBCBindCardRequest;

  const mockFailedResponse = {
    Response: {
      ReturnCode: 'I0001',
      ReturnMsg: 'FAILED',
      Data: {
        TXN: 'aZ7xQpL9vRt3HsMnK2wJf4Dy',
      },
    },
  };

  const mockSuccessResponse = {
    Response: {
      ReturnCode: 'I0000',
      ReturnMsg: 'SUCCESS',
      Data: {
        TXN: 'aZ7xQpL9vRt3HsMnK2wJf4Dy',
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // setup order
    order = new CTBCOrder({
      id: '123',
      items: [
        {
          name: 'Test Item',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
      gateway: payment,
      createdAt: new Date(),
    });

    // setup payment instance with same txnKey
    payment = new CTBCPayment({
      merchantId: 'TEST_MERCHANT',
      merId: 'TEST_MERID',
      txnKey: 'h3Qx7uZLmYpWv8CtEr2KdBfj',
      terminalId: 'TEST_TERMINAL',
      baseUrl: 'https://testepos.ctbcbank.com',
      isAmex: false,
    });

    Reflect.set(order, '_gateway', payment);

    // setup bind card request
    bindCardRequest = new CTBCBindCardRequest(
      {
        MerID: 'TEST_MERID',
        MemberID: 'TEST_MEMBERID',
        RequestNo: 'xyz987',
        TokenURL: 'https://tokenurl.ctbcbank.com',
      },
      payment,
    );
  });

  describe('CTBCPayments.handleCallbackTextBodyByURLPath', () => {
    describe('callbackPath', () => {
      const url = '/payments/ctbc/callback';

      it('should throw error if URLResEnc is not provided', async () => {
        await expect(payment.handleCallbackTextBodyByURLPath(url, '')).rejects.toThrow(
          'Missing URLResEnc parameter in callback',
        );
      });

      it('should throw error if requestId is not in parameter', async () => {
        jest.spyOn(iconv, 'decode').mockReturnValue('status=SUCCESS');

        await expect(
          payment.handleCallbackTextBodyByURLPath(url, 'URLResEnc=h3Qx7uZLmYpWv8CtEr2KdBfj'),
        ).rejects.toThrow('Missing lidm parameter in callback');
      });

      describe('Checkout Failed', () => {
        it('VMJ', async () => {
          jest.spyOn(iconv, 'decode').mockReturnValue('status=SUCCESS&lidm=123&errcode=01&errDesc=Transaction Failed');

          const orderCache = Reflect.get(payment, 'orderCache');

          orderCache.set('123', order);

          await expect(
            payment.handleCallbackTextBodyByURLPath(url, 'URLResEnc=h3Qx7uZLmYpWv8CtEr2KdBfj&lidm=123'),
          ).rejects.toThrow('CTBC Card Checkout Failed: 01 - Transaction Failed');
        });

        it('AE', async () => {
          Reflect.set(order, '_cardType', CardType.AE);
          Reflect.set(payment, 'isAmex', true);
          jest
            .spyOn(iconv, 'decode')
            .mockReturnValue('status=SUCCESS&lidm=123&errcode=A001&errDesc=Transaction Failed');

          const orderCache = Reflect.get(payment, 'orderCache');

          orderCache.set('123', order);

          await expect(
            payment.handleCallbackTextBodyByURLPath(url, 'URLResEnc=h3Qx7uZLmYpWv8CtEr2KdBfj&lidm=123'),
          ).rejects.toThrow('CTBC Amex Checkout Failed: A001 - Transaction Failed');
        });

        it('Unknown', async () => {
          Reflect.set(order, '_cardType', null);
          jest.spyOn(iconv, 'decode').mockReturnValue('status=SUCCESS&lidm=123&');

          const orderCache = Reflect.get(payment, 'orderCache');

          orderCache.set('123', order);

          await expect(
            payment.handleCallbackTextBodyByURLPath(url, 'URLResEnc=h3Qx7uZLmYpWv8CtEr2KdBfj&lidm=123'),
          ).rejects.toThrow('CTBC Unknown Checkout Failed: null - null');
        });
      });

      describe('Checkout Success', () => {
        it('should return 302 if clientBackUrl is provided', async () => {
          Reflect.set(order, '_clientBackUrl', 'https://example.com');
          jest.spyOn(iconv, 'decode').mockReturnValue('status=SUCCESS&lidm=123&errcode=00&xid=xid_123');

          const orderCache = Reflect.get(payment, 'orderCache');

          orderCache.set('123', order);

          const result = await payment.handleCallbackTextBodyByURLPath(
            url,
            'URLResEnc=h3Qx7uZLmYpWv8CtEr2KdBfj&lidm=123',
          );

          expect(result).toEqual({
            status: 302,
            headers: {
              Location: 'https://example.com',
            },
          });
        });

        it('should return 200 if clientBackUrl is not provided', async () => {
          jest.spyOn(iconv, 'decode').mockReturnValue('status=SUCCESS&lidm=123&errcode=00&xid=xid_123');

          const orderCache = Reflect.get(payment, 'orderCache');

          orderCache.set('123', order);

          const result = await payment.handleCallbackTextBodyByURLPath(
            url,
            'URLResEnc=h3Qx7uZLmYpWv8CtEr2KdBfj&lidm=123',
          );

          expect(result).toEqual({
            status: 200,
            headers: {
              'Content-Type': 'text/plain',
            },
            body: '1|OK',
          });
        });
      });
    });

    describe('boundCardPath', () => {
      const url = '/payments/ctbc/bound-card';

      describe('status code not I0000', () => {
        it('should throw Bind Card Failed if there is request', async () => {
          jest.spyOn(ctbcCrypto, 'decrypt3DES').mockReturnValue('StatusCode=I0001&StatusDesc=FAILED&RequestNo=abc123');

          const body = rspjsonpwdToBody(mockFailedResponse);

          await expect(payment.handleCallbackTextBodyByURLPath(url, body)).rejects.toThrow(
            'CTBC Bind Card Failed: I0001 - FAILED',
          );
        });
      });

      describe('status code I0000', () => {
        it('should throw error if request is undefined', async () => {
          jest.spyOn(ctbcCrypto, 'decrypt3DES').mockReturnValue('StatusCode=I0000&StatusDesc=SUCCESS&RequestNo=abc123');

          const body = rspjsonpwdToBody(mockSuccessResponse);

          await expect(payment.handleCallbackTextBodyByURLPath(url, body)).rejects.toThrow(
            'Unknown bind card request: abc123',
          );
        });

        it('should return status 200 - OK', async () => {
          jest
            .spyOn(ctbcCrypto, 'decrypt3DES')
            .mockReturnValue(
              'StatusCode=I0000&StatusDesc=SUCCESS&RequestNo=abc123&CardToken=token_987&CardNoMask=CardMask=1234-5678-9876-5432',
            );

          const body = rspjsonpwdToBody(mockSuccessResponse);

          const bindCardRequestsCache = Reflect.get(payment, 'bindCardRequestsCache');

          bindCardRequestsCache.set('abc123', bindCardRequest);

          const result = await payment.handleCallbackTextBodyByURLPath(url, body);

          expect(result).toEqual({
            status: 200,
            headers: {
              'Content-Type': 'text/plain',
            },
            body: '1|OK',
          });
        });
      });
    });

    describe('boundCardCheckoutResultPath', () => {
      const url = '/payments/ctbc/bound-card/checkout-result';

      describe('status code not I0000', () => {
        it('should throw Bound Card Checkout Failed if code is not I0000', async () => {
          jest.spyOn(ctbcCrypto, 'decrypt3DES').mockReturnValue('StatusCode=I0001&StatusDesc=FAILED&RequestNo=abc123');

          const body = jsonToBody(mockFailedResponse);

          await expect(payment.handleCallbackTextBodyByURLPath(url, body)).rejects.toThrow(
            'CTBC Bound Card Checkout Failed: I0001 - FAILED',
          );
        });
      });

      describe('status code I0000', () => {
        it('should throw error if order is undefined', async () => {
          jest.spyOn(ctbcCrypto, 'decrypt3DES').mockReturnValue('StatusCode=I0000&StatusDesc=SUCCESS&RequestNo=abc123');

          const body = jsonToBody(mockSuccessResponse);

          await expect(payment.handleCallbackTextBodyByURLPath(url, body)).rejects.toThrow(
            'Unknown bound card checkout order: abc123',
          );
        });

        describe('Checkout Success', () => {
          it('should return 302 if clientBackUrl is provided', async () => {
            Reflect.set(order, '_clientBackUrl', 'https://example.com');
            jest
              .spyOn(ctbcCrypto, 'decrypt3DES')
              .mockReturnValue('StatusCode=I0000&StatusDesc=SUCCESS&RequestNo=abc123');

            const body = jsonToBody(mockSuccessResponse);

            const orderCache = Reflect.get(payment, 'orderCache');

            orderCache.set('abc123', order);

            const result = await payment.handleCallbackTextBodyByURLPath(url, body);

            expect(result).toEqual({
              status: 302,
              headers: {
                Location: 'https://example.com',
              },
            });
          });

          it('should return 200 - OK if clientBackUrl is not provided', async () => {
            jest
              .spyOn(ctbcCrypto, 'decrypt3DES')
              .mockReturnValue('StatusCode=I0000&StatusDesc=SUCCESS&RequestNo=abc123');

            const body = jsonToBody(mockSuccessResponse);

            const orderCache = Reflect.get(payment, 'orderCache');

            orderCache.set('abc123', order);

            const result = await payment.handleCallbackTextBodyByURLPath(url, body);

            expect(result).toEqual({
              status: 200,
              headers: {
                'Content-Type': 'text/plain',
              },
              body: '1|OK',
            });
          });
        });
      });
    });

    it('not found path', async () => {
      const result = await payment.handleCallbackTextBodyByURLPath('', '');

      expect(result).toEqual({
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
        },
        body: '0|Not Found',
      });
    });
  });
});
