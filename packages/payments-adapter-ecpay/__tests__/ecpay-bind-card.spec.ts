/**
 * @jest-environment node
 */

import request from 'supertest';
import http, { createServer } from 'http';
import { LRUCache } from 'lru-cache';
import { ECPayPayment } from '../src/ecpay-payment';
import { ECPayBindCardRequest } from '../src/ecpay-bind-card-request';
import { ECPayBindCardRequestState } from '../src/typings';

const BASE_URL = 'https://payment-stage.ecpay.com.tw';
const MERCHANT_ID = '2000214';
const HASH_KEY = '5294y06JbISpM5x9';
const HASH_IV = 'v77hoKGq4kWxNNIS';
const MEMBER_ID = 'rytass';

describe('ECPayPayment Card Binding', () => {
  const originCreateServer = createServer;
  const mockedCreateServer = jest.spyOn(http, 'createServer');

  mockedCreateServer.mockImplementation((requestHandler) => {
    const mockServer = originCreateServer(requestHandler);

    const mockedListen = jest.spyOn(mockServer, 'listen');

    mockedListen.mockImplementationOnce((port?: any, hostname?: any, listeningListener?: () => void) => {
      mockServer.listen(0, listeningListener);

      return mockServer;
    });

    const mockedClose = jest.spyOn(mockServer, 'close');

    mockedClose.mockImplementationOnce((onClosed) => {
      mockServer.close(onClosed);

      return mockServer;
    });

    return mockServer;
  });

  it('should card binding fail', (done) => {
    const payment = new ECPayPayment({
      withServer: true,
      serverHost: 'http://localhost:3333',
      merchantId: MERCHANT_ID,
      hashKey: HASH_KEY,
      hashIv: HASH_IV,
      baseUrl: BASE_URL,
      onServerListen: () => {
        const bindCardRequest = payment.prepareBindCard('rytass');

        bindCardRequest.formHTML;

        const successfulResponse = {
          RtnCode: '-1',
          RtnMsg: 'Failed',
          MerchantID: MERCHANT_ID,
          MerchantMemberID: `${MERCHANT_ID}${MEMBER_ID}`,
          CardID: '187794',
          Card6No: '431195',
          Card4No: '2222',
          BindingDate: '2023/11/25 19:42:31',
          CheckMacValue: 'A44745C8EF1FCE3741F17CEA9FE6C7D33F502FFF633291DFC6F3B885D0309796',
        };

        request(payment._server)
          .post('/payments/ecpay/bound-card-finished')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');

            expect(bindCardRequest.state).toEqual(ECPayBindCardRequestState.FAILED);
            expect(bindCardRequest.failedMessage).not.toBeNull();

            payment._server?.close(done);
          });
      },
    });
  });

  it('should card binding finish', (done) => {
    const payment = new ECPayPayment({
      withServer: true,
      serverHost: 'http://localhost:3333',
      merchantId: MERCHANT_ID,
      hashKey: HASH_KEY,
      hashIv: HASH_IV,
      baseUrl: BASE_URL,
      boundCardFinishPath: '/payments/ecpay/bound-card-finished',
      onServerListen: () => {
        const bindCardRequest = payment.prepareBindCard('rytass');

        bindCardRequest.formHTML;

        expect(() => bindCardRequest.formHTML).toThrow();

        const successfulResponse = {
          RtnCode: '1',
          RtnMsg: 'Succeeded',
          MerchantID: MERCHANT_ID,
          MerchantMemberID: `${MERCHANT_ID}${MEMBER_ID}`,
          CardID: '187794',
          Card6No: '431195',
          Card4No: '2222',
          BindingDate: '2023/11/25 19:42:31',
          CheckMacValue: '2C35D59EB0BF5EBA4A5FCA37D6AA697D66B708C98244A061AD4EA9896E30B8C2',
        };

        request(payment._server)
          .post('/payments/ecpay/bound-card-finished')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');

            expect(bindCardRequest.memberId).toEqual(MEMBER_ID);
            expect(bindCardRequest.cardId).toEqual('187794');
            expect(bindCardRequest.cardNumberPrefix).toEqual('431195');
            expect(bindCardRequest.cardNumberSuffix).toEqual('2222');
            expect(bindCardRequest.bindingDate?.getTime()).toEqual(new Date('2023/11/25 19:42:31').getTime());
            expect(bindCardRequest.state).toEqual(ECPayBindCardRequestState.BOUND);
            expect(bindCardRequest.failedMessage).toBeNull();

            payment._server?.close(done);
          });
      },
    });
  });

  it('should card binding with bound card background path', (done) => {
    const payment = new ECPayPayment({
      withServer: true,
      serverHost: 'http://localhost:3333',
      merchantId: MERCHANT_ID,
      hashKey: HASH_KEY,
      hashIv: HASH_IV,
      baseUrl: BASE_URL,
      boundCardPath: '/payments/ecpay/bound-card',
      onServerListen: () => {
        const bindCardRequest = payment.prepareBindCard('rytass');

        bindCardRequest.formHTML;

        const successfulResponse = {
          RtnCode: '1',
          RtnMsg: 'Succeeded',
          MerchantID: MERCHANT_ID,
          MerchantMemberID: `${MERCHANT_ID}${MEMBER_ID}`,
          CardID: '187794',
          Card6No: '431195',
          Card4No: '2222',
          BindingDate: '2023/11/25 19:42:31',
          CheckMacValue: '2C35D59EB0BF5EBA4A5FCA37D6AA697D66B708C98244A061AD4EA9896E30B8C2',
        };

        request(payment._server)
          .post('/payments/ecpay/bound-card')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(200)
          .then((res) => {
            expect(res.text).toEqual('1|OK');

            expect(bindCardRequest.memberId).toEqual(MEMBER_ID);
            expect(bindCardRequest.cardId).toEqual('187794');

            payment._server?.close(done);
          });
      },
    });
  });

  it('should fail on bind card form not inited', (done) => {
    const payment = new ECPayPayment({
      withServer: true,
      serverHost: 'http://localhost:3333',
      merchantId: MERCHANT_ID,
      hashKey: HASH_KEY,
      hashIv: HASH_IV,
      baseUrl: BASE_URL,
      boundCardPath: '/payments/ecpay/bound-card',
      onServerListen: () => {
        payment.prepareBindCard('rytass');

        const successfulResponse = {
          RtnCode: '1',
          RtnMsg: 'Succeeded',
          MerchantID: MERCHANT_ID,
          MerchantMemberID: `${MERCHANT_ID}${MEMBER_ID}`,
          CardID: '187794',
          Card6No: '431195',
          Card4No: '2222',
          BindingDate: '2023/11/25 19:42:31',
          CheckMacValue: '2C35D59EB0BF5EBA4A5FCA37D6AA697D66B708C98244A061AD4EA9896E30B8C2',
        };

        request(payment._server)
          .post('/payments/ecpay/bound-card')
          .send(new URLSearchParams(successfulResponse).toString())
          .expect('Content-Type', 'text/plain')
          .expect(400)
          .then((res) => {
            expect(res.text).toEqual('0|RequestNotFound');

            payment._server?.close(done);
          });
      },
    });
  });

  it('should pass custom cache store', () => {
    const cache = new LRUCache<string, ECPayBindCardRequest>({
      ttlAutopurge: true,
      max: 100,
    });

    const payment = new ECPayPayment({
      merchantId: MERCHANT_ID,
      hashKey: HASH_KEY,
      hashIv: HASH_IV,
      baseUrl: BASE_URL,
      bindCardRequestsCache: {
        get: async (key: string) => cache.get(key),
        set: async (key: string, value: ECPayBindCardRequest) => {
          cache.set(key, value);
        },
      },
    });

    const bindCardRequest = payment.prepareBindCard('rytass');

    bindCardRequest.formHTML;

    expect(bindCardRequest).toEqual(cache.get(MEMBER_ID));
  });
});
