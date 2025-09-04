/**
 * @jest-environment node
 */

import http, { createServer } from 'http';
import { ECPayPayment } from '../src/ecpay-payment';
import axios from 'axios';
import { DateTime } from 'luxon';
import { ECPayBindCardRequest } from '../src';
import { ECPayBindCardCallbackPayload, ECPayBindCardRequestPayload } from '../src/typings';
import { getAddMac } from '../__utils__/add-mac';

const BASE_URL = 'https://payment-stage.ecpay.com.tw';
const MERCHANT_ID = '2000214';
const HASH_KEY = '5294y06JbISpM5x9';
const HASH_IV = 'v77hoKGq4kWxNNIS';

const addMac = getAddMac(HASH_KEY, HASH_IV);

function checkMac(payload: Record<string, string>): boolean {
  const { CheckMacValue: mac, ...res } = payload;
  const { CheckMacValue: computedMac } = addMac(
    Object.entries(res).reduce(
      (vars, [key, value]) => ({
        ...vars,
        [key]: (value as unknown as string | number).toString(),
      }),
      {},
    ),
  );

  if (computedMac !== mac) return false;

  return true;
}

describe('ECPayPayment Query Card Bound Info', () => {
  const originCreateServer = createServer;
  const mockedCreateServer = jest.spyOn(http, 'createServer');

  mockedCreateServer.mockImplementation(requestHandler => {
    const mockServer = originCreateServer(requestHandler);

    const mockedListen = jest.spyOn(mockServer, 'listen');

    mockedListen.mockImplementationOnce((port?: any, hostname?: any, listeningListener?: () => void) => {
      mockServer.listen(0, listeningListener);

      return mockServer;
    });

    const mockedClose = jest.spyOn(mockServer, 'close');

    mockedClose.mockImplementationOnce(onClosed => {
      mockServer.close(onClosed);

      return mockServer;
    });

    return mockServer;
  });

  const post = jest.spyOn(axios, 'post');

  const payment = new ECPayPayment({
    serverHost: 'http://localhost:3333',
    withServer: false,
    merchantId: MERCHANT_ID,
    hashKey: HASH_KEY,
    hashIv: HASH_IV,
    baseUrl: BASE_URL,
  });

  const DEFAULT_BINDING_DATE = DateTime.now().minus({ days: 20 }).toFormat('yyyy/MM/dd HH:mm:ss');

  it('should queryBoundCard return card info', async () => {
    post.mockImplementationOnce(async (url: string, data: unknown) => {
      expect(url).toEqual('https://payment-stage.ecpay.com.tw/MerchantMember/QueryMemberBinding');

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        MerchantID: string;
        MerchantMemberID: string;
        CheckMacValue: string;
      };

      expect(checkMac(params)).toBeTruthy();

      const payload = addMac({
        MerchantID: params.MerchantID,
        MerchantMemberID: params.MerchantMemberID,
        Count: '1',
        JSonData: JSON.stringify({
          CardID: params.MerchantMemberID.replace(new RegExp(`^${params.MerchantID}`), ''),
          Card6No: '123456',
          Card4No: '9876',
          CardExpireDate: '2904',
          BindingDate: DEFAULT_BINDING_DATE,
        }),
      });

      return { data: payload };
    });

    const response = await payment.queryBoundCard('192536');

    expect(DateTime.fromJSDate(response.bindingDate as Date).toFormat('yyyy/MM/dd HH:mm:ss')).toEqual(
      DEFAULT_BINDING_DATE,
    );
    expect(response.cardId).toEqual('192536');
    expect(response.cardNumberPrefix).toEqual('123456');
    expect(response.cardNumberSuffix).toEqual('9876');
    expect(DateTime.fromJSDate(response.expireDate).toFormat('yyMM')).toEqual('2904');
  });

  it('should throw on checksum invalid', async () => {
    post.mockImplementationOnce(async (url: string, data: unknown) => {
      expect(url).toEqual('https://payment-stage.ecpay.com.tw/MerchantMember/QueryMemberBinding');

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        MerchantID: string;
        MerchantMemberID: string;
        CheckMacValue: string;
      };

      expect(checkMac(params)).toBeTruthy();

      const payload = addMac({
        MerchantID: params.MerchantID,
        MerchantMemberID: params.MerchantMemberID,
        Count: '1',
        JSonData: JSON.stringify({
          CardID: params.MerchantMemberID.replace(new RegExp(`^${params.MerchantID}`), ''),
          Card6No: '123456',
          Card4No: '9876',
          CardExpireDate: '2904',
          BindingDate: DEFAULT_BINDING_DATE,
        }),
      });

      payload.CheckMacValue = 'INVALID';

      return { data: payload };
    });

    expect(() => payment.queryBoundCard('192536')).rejects.toThrow('Invalid CheckSum');
  });

  it('should throw on not found', async () => {
    post.mockImplementationOnce(async (url: string, data: unknown) => {
      expect(url).toEqual('https://payment-stage.ecpay.com.tw/MerchantMember/QueryMemberBinding');

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        MerchantID: string;
        MerchantMemberID: string;
        CheckMacValue: string;
      };

      expect(checkMac(params)).toBeTruthy();

      const payload = addMac({
        MerchantID: params.MerchantID,
        MerchantMemberID: params.MerchantMemberID,
        Count: '0',
        JSonData: JSON.stringify({
          CardID: '',
          Card6No: '',
          Card4No: '',
          CardExpireDate: '',
          BindingDate: '',
        }),
      });

      return { data: payload };
    });

    expect(() => payment.queryBoundCard('556888')).rejects.toThrow('No card found');
  });

  it('should bind card request can get expire date from remote', async () => {
    post.mockImplementationOnce(async (url: string, data: unknown) => {
      expect(url).toEqual('https://payment-stage.ecpay.com.tw/MerchantMember/QueryMemberBinding');

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        MerchantID: string;
        MerchantMemberID: string;
        CheckMacValue: string;
      };

      expect(checkMac(params)).toBeTruthy();

      const payload = addMac({
        MerchantID: params.MerchantID,
        MerchantMemberID: params.MerchantMemberID,
        Count: '1',
        JSonData: JSON.stringify({
          CardID: params.MerchantMemberID.replace(new RegExp(`^${params.MerchantID}`), ''),
          Card6No: '123456',
          Card4No: '9876',
          CardExpireDate: '3201',
          BindingDate: DEFAULT_BINDING_DATE,
        }),
      });

      return { data: payload };
    });

    const payload = addMac({
      MerchantID: MERCHANT_ID,
      MerchantMemberID: `${MERCHANT_ID}201434`,
      ServerReplyURL: 'http://localhost:3333/payments/ecpay/bound-card',
      ClientRedirectURL: 'http://localhost:3333/payments/ecpay/bound-card-finished',
    }) as ECPayBindCardRequestPayload;

    const request = new ECPayBindCardRequest(payload, payment);

    const boundPayload = addMac({
      MerchantID: MERCHANT_ID,
      RtnCode: '1',
      RtnMsg: '',
      MerchantMemberID: `${MERCHANT_ID}201434`,
      CardID: '185035',
      Card6No: '127349',
      Card4No: '1233',
      BindingDate: DEFAULT_BINDING_DATE,
    });

    request.bound(boundPayload as unknown as ECPayBindCardCallbackPayload);

    const expireDate = await request.expireDate;

    post.mockClear();

    expect(DateTime.fromJSDate(expireDate).toFormat('yyMM')).toEqual('3201');

    const secondaryRead = await request.expireDate;

    expect(DateTime.fromJSDate(secondaryRead).toFormat('yyMM')).toEqual('3201');
    expect(post.mock.calls.length).toEqual(0);
  });

  it('should bind card request get expire date throw on fetch failed', async () => {
    post.mockImplementationOnce(async (url: string, data: unknown) => {
      expect(url).toEqual('https://payment-stage.ecpay.com.tw/MerchantMember/QueryMemberBinding');

      const params = Array.from(new URLSearchParams(data as string).entries()).reduce(
        (vars, [key, value]) => ({
          ...vars,
          [key]: value,
        }),
        {},
      ) as {
        MerchantID: string;
        MerchantMemberID: string;
        CheckMacValue: string;
      };

      expect(checkMac(params)).toBeTruthy();

      const payload = addMac({
        MerchantID: params.MerchantID,
        MerchantMemberID: params.MerchantMemberID,
        Count: '0',
        JSonData: JSON.stringify({
          CardID: '',
          Card6No: '',
          Card4No: '',
          CardExpireDate: '',
          BindingDate: '',
        }),
      });

      return { data: payload };
    });

    const payload = addMac({
      MerchantID: MERCHANT_ID,
      MerchantMemberID: `${MERCHANT_ID}201434`,
      ServerReplyURL: 'http://localhost:3333/payments/ecpay/bound-card',
      ClientRedirectURL: 'http://localhost:3333/payments/ecpay/bound-card-finished',
    }) as ECPayBindCardRequestPayload;

    const request = new ECPayBindCardRequest(payload, payment);

    const boundPayload = addMac({
      MerchantID: MERCHANT_ID,
      RtnCode: '1',
      RtnMsg: '',
      MerchantMemberID: `${MERCHANT_ID}201434`,
      CardID: '185035',
      Card6No: '127349',
      Card4No: '1233',
      BindingDate: DEFAULT_BINDING_DATE,
    });

    request.bound(boundPayload as unknown as ECPayBindCardCallbackPayload);

    expect(() => request.expireDate).rejects.toThrow('No card found');
  });
});
