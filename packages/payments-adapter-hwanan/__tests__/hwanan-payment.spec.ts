/**
 * @jest-environment node
 */

// Set NGROK_AUTHTOKEN before any imports
process.env.NGROK_AUTHTOKEN = 'test-auth-token';

import ngrok from 'ngrok';
import request from 'supertest';
import http, { createServer } from 'http';
import { createHash, randomBytes } from 'crypto';
import { HwaNanCustomizePageType, HwaNanPayment } from '../src';
import { OrderState } from '@rytass/payments';
import { App } from 'supertest/types';

const MERCHANT_ID = '326650918560582';
const TERMINAL_ID = '87345985';
const MER_ID = '22343';
const IDENTIFIER = '8949bf87c8d710a0';

describe('HwaNan Payment', () => {
  describe('Initialize', () => {
    it('should represent MerchantID, TerminalID, merID, MerchantName', async () => {
      const payment = new HwaNanPayment({
        merchantId: MERCHANT_ID,
        terminalId: TERMINAL_ID,
        merID: MER_ID,
        merchantName: 'Rytass Shop',
        identifier: IDENTIFIER,
      });

      const order = await payment.prepare({
        items: [
          {
            name: 'Pencil',
            unitPrice: 10,
            quantity: 2,
          },
        ],
      });

      expect(order.form.MerchantID).toBe(MERCHANT_ID);
      expect(order.form.TerminalID).toBe(TERMINAL_ID);
      expect(order.form.merID).toBe(MER_ID);
      expect(order.form.MerchantName).toBe('Rytass Shop');
    });

    it('should represent customize template', async () => {
      const payment = new HwaNanPayment({
        merchantId: MERCHANT_ID,
        terminalId: TERMINAL_ID,
        merID: MER_ID,
        merchantName: 'Rytass Shop',
        identifier: IDENTIFIER,
        customizePageType: HwaNanCustomizePageType.OTHER,
        customizePageVersion: 'TestTemplate',
      });

      const order = await payment.prepare({
        items: [
          {
            name: 'Pencil',
            unitPrice: 10,
            quantity: 2,
          },
        ],
      });

      expect(order.form.customize).toBe(HwaNanCustomizePageType.OTHER);
      expect(order.form.PageVer).toBe('TestTemplate');
    });

    it('should represent base path and checkout url', () => {
      const payment = new HwaNanPayment({
        baseUrl: 'https://hwanan.rytass.com',
        merchantId: MERCHANT_ID,
        terminalId: TERMINAL_ID,
        merID: MER_ID,
        merchantName: 'Rytass Shop',
        identifier: IDENTIFIER,
      });

      expect(payment.checkoutActionUrl).toBe('https://hwanan.rytass.com/transaction/api-auth/');
    });
  });

  describe('Prepare', () => {
    const payment = new HwaNanPayment({
      merchantId: MERCHANT_ID,
      terminalId: TERMINAL_ID,
      merID: MER_ID,
      merchantName: 'Rytass Shop',
      identifier: IDENTIFIER,
    });

    it('should prepare order form payload', async () => {
      const order = await payment.prepare({
        id: '202303210001',
        items: [
          {
            name: 'Pencil',
            unitPrice: 10,
            quantity: 2,
          },
        ],
      });

      expect(order.id).toBe('202303210001');
      expect(order.totalPrice).toBe(20);
      expect(order.form.lidm).toBe('202303210001');
      expect(order.form.purchAmt).toBe(20);
    });

    it('should prepare order form html', async () => {
      const order = await payment.prepare({
        id: '202303210001',
        items: [
          {
            name: 'Pencil',
            unitPrice: 10,
            quantity: 2,
          },
        ],
      });

      const formHTML = order.formHTML;

      expect(formHTML).toMatch(/^<!DOCTYPE html>/);
    });

    it('should auto generate order id', async () => {
      const order = await payment.prepare({
        items: [
          {
            name: 'Pencil',
            unitPrice: 10,
            quantity: 2,
          },
        ],
      });

      expect(order.id).not.toBeNull();
    });

    it('should throw error when prepare order with no items', () => {
      expect(() =>
        payment.prepare({
          items: [],
        }),
      ).rejects.toThrow();
    });
  });

  describe('Query', () => {
    const payment = new HwaNanPayment({
      merchantId: MERCHANT_ID,
      terminalId: TERMINAL_ID,
      merID: MER_ID,
      merchantName: 'Rytass Shop',
      identifier: IDENTIFIER,
    });

    it('should throw error on query', () => {
      expect(() => payment.query('ID')).rejects.toThrow();
    });
  });

  describe('Build-in Server', () => {
    it('should get checkout form from checkout url', done => {
      const payment = new HwaNanPayment({
        merchantId: MERCHANT_ID,
        terminalId: TERMINAL_ID,
        merID: MER_ID,
        merchantName: 'Rytass Shop',
        identifier: IDENTIFIER,
        withServer: true,
        checkoutPath: '/checkout',
        onServerListen: async () => {
          const order = await payment.prepare({
            items: [
              {
                name: 'Pencil',
                unitPrice: 10,
                quantity: 2,
              },
            ],
          });

          const data = await request(payment._server as App)
            .get(`/checkout/${order.id}`)
            .expect(200);

          expect(data.text).toBe(order.formHTML);

          await payment._server?.close();

          done();
        },
      });
    });

    it('should throw error if server not ready', done => {
      const payment = new HwaNanPayment({
        merchantId: MERCHANT_ID,
        terminalId: TERMINAL_ID,
        merID: MER_ID,
        merchantName: 'Rytass Shop',
        identifier: IDENTIFIER,
        withServer: true,
        checkoutPath: '/checkout',
        onServerListen: async () => {
          await payment._server?.close();

          done();
        },
      });

      expect(() =>
        payment.prepare({
          items: [
            {
              name: 'Pencil',
              unitPrice: 10,
              quantity: 2,
            },
          ],
        }),
      ).rejects.toThrow();
    });

    it('should set port for build-in server', done => {
      const originCreateServer = createServer;
      const mockedCreateServer = jest.spyOn(http, 'createServer');

      mockedCreateServer.mockImplementationOnce(requestHandler => {
        const mockServer = originCreateServer(requestHandler);

        const mockedListen = jest.spyOn(mockServer, 'listen');

        mockedListen.mockImplementationOnce((port?: any, hostname?: any, listeningListener?: () => void) => {
          expect(port).toBe(9876);

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

      const payment = new HwaNanPayment({
        merchantId: MERCHANT_ID,
        terminalId: TERMINAL_ID,
        merID: MER_ID,
        merchantName: 'Rytass Shop',
        identifier: IDENTIFIER,
        withServer: true,
        serverHost: 'http://localhost:9876',
        checkoutPath: '/checkout',
        onServerListen: async () => {
          await payment._server?.close();

          mockedCreateServer.mockClear();

          done();
        },
      });
    });

    it('should handle order commit request', done => {
      const payment = new HwaNanPayment({
        merchantId: MERCHANT_ID,
        terminalId: TERMINAL_ID,
        merID: MER_ID,
        merchantName: 'Rytass Shop',
        identifier: IDENTIFIER,
        withServer: true,
        checkoutPath: '/checkout',
        callbackPath: '/callback',
        onCommit: order => {
          expect(order.id).toBe('123456789');
        },
        onServerListen: async () => {
          const order = await payment.prepare({
            id: '123456789',
            items: [
              {
                name: 'Pencil',
                unitPrice: 10,
                quantity: 2,
              },
            ],
          });

          expect(order.state).toBe(OrderState.INITED);

          await request(payment._server as App)
            .get(`/checkout/${order.id}`)
            .expect(200);

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const xid = randomBytes(10).toString('hex');

          await request(payment._server as App)
            .post('/callback')
            .send(
              new URLSearchParams({
                status: '0',
                errcode: '00',
                authCode: '123456',
                authAmt: order.totalPrice.toString(),
                xid,
                lidm: order.id,
                merID: MER_ID,
                Last4digitPAN: '0000',
                errDesc: '',
                encOut: '',
                checkValue: createHash('md5')
                  .update(
                    `${createHash('md5')
                      .update(`${IDENTIFIER}|${order.id}`)
                      .digest('hex')}|0|00|123456|${order.totalPrice}|${xid}`,
                  )
                  .digest('hex')
                  .substring(16),
                Einvoice: '',
              }).toString(),
            )
            .expect(200);

          expect(order.committedAt).not.toBeNull();
          expect(order.state).toBe(OrderState.COMMITTED);
          expect(order.additionalInfo?.card4Number).toBe('0000');
          expect(order.platformTradeNumber).toBe(xid);

          await payment._server?.close();

          done();
        },
      });
    });

    it('should handle order failed request', done => {
      const payment = new HwaNanPayment({
        merchantId: MERCHANT_ID,
        terminalId: TERMINAL_ID,
        merID: MER_ID,
        merchantName: 'Rytass Shop',
        identifier: IDENTIFIER,
        withServer: true,
        checkoutPath: '/checkout',
        callbackPath: '/callback',
        onCommit: order => {
          expect(order.id).toBe('123456789');
        },
        onServerListen: async () => {
          const order = await payment.prepare({
            id: '123456789',
            items: [
              {
                name: 'Pencil',
                unitPrice: 10,
                quantity: 2,
              },
            ],
          });

          expect(order.state).toBe(OrderState.INITED);

          await request(payment._server as App)
            .get(`/checkout/${order.id}`)
            .expect(200);

          expect(order.state).toBe(OrderState.PRE_COMMIT);

          const xid = randomBytes(10).toString('hex');

          await request(payment._server as App)
            .post('/callback')
            .send(
              new URLSearchParams({
                status: '-1',
                errcode: '99',
                authCode: '123456',
                authAmt: order.totalPrice.toString(),
                xid,
                lidm: order.id,
                merID: MER_ID,
                Last4digitPAN: '0000',
                errDesc: 'ERROR',
                encOut: '',
                checkValue: createHash('md5')
                  .update(
                    `${createHash('md5')
                      .update(`${IDENTIFIER}|${order.id}`)
                      .digest('hex')}|-1|99|123456|${order.totalPrice}|${xid}`,
                  )
                  .digest('hex')
                  .substring(16),
                Einvoice: '',
              }).toString(),
            )
            .expect(200);

          expect(order.state).toBe(OrderState.FAILED);
          expect(order.failedMessage?.code).toBe('99');
          expect(order.failedMessage?.message).toBe('ERROR');

          await payment._server?.close();

          done();
        },
      });
    });

    it('should build-in server throw error on invalid request', done => {
      const payment = new HwaNanPayment({
        merchantId: MERCHANT_ID,
        terminalId: TERMINAL_ID,
        merID: MER_ID,
        merchantName: 'Rytass Shop',
        identifier: IDENTIFIER,
        withServer: true,
        checkoutPath: '/checkout',
        callbackPath: '/callback',
        onServerListen: async () => {
          await request(payment._server as App)
            .post('/not_found')
            .expect(404);

          await request(payment._server as App)
            .post('/callback')
            .send(
              new URLSearchParams({
                status: '0',
                errcode: '00',
                authCode: '123456',
                authAmt: '200',
                xid: '1',
                lidm: '11111',
                merID: MER_ID,
                Last4digitPAN: '0000',
                errDesc: '',
                encOut: '',
                checkValue: createHash('md5')
                  .update(
                    `${createHash('md5').update(`${IDENTIFIER}|11111`).digest('hex')}|0|00|123456|200|1|INVALID_STRING`,
                  )
                  .digest('hex')
                  .substring(16),
                Einvoice: '',
              }).toString(),
            )
            .expect(400, 'Checksum Invalid');

          await request(payment._server as App)
            .post('/callback')
            .send(
              new URLSearchParams({
                status: '0',
                errcode: '00',
                authCode: '123456',
                authAmt: '200',
                xid: '1',
                lidm: '11111',
                merID: MER_ID,
                Last4digitPAN: '0000',
                errDesc: '',
                encOut: '',
                checkValue: createHash('md5')
                  .update(`${createHash('md5').update(`${IDENTIFIER}|11111`).digest('hex')}|0|00|123456|200|1`)
                  .digest('hex')
                  .substring(16),
                Einvoice: '',
              }).toString(),
            )
            .expect(400, 'Order Not Found');

          await payment._server?.close();

          done();
        },
      });
    });
  });

  describe('Build-in Ngrok Server', () => {
    const mockForwarder = {
      url: jest.fn().mockReturnValue('https://test-ngrok-url.ngrok.io'),
    };

    const mockNgrok = {
      authtoken: jest.fn().mockResolvedValue(undefined),
      forward: jest.fn().mockResolvedValue(mockForwarder),
    };

    const mockServerForNgrok = new (require('events').EventEmitter)();

    mockServerForNgrok.listen = jest.fn((port, host, callback) => {
      setImmediate(() => callback && callback());

      return mockServerForNgrok;
    });

    mockServerForNgrok.close = jest.fn(callback => {
      setImmediate(() => callback && callback());

      return mockServerForNgrok;
    });

    beforeEach(() => {
      jest.clearAllMocks();
      jest.resetModules();

      // Mock HTTP server creation for ngrok tests
      jest.doMock('http', () => ({
        createServer: jest.fn(() => mockServerForNgrok),
      }));

      // Mock dynamic import of @ngrok/ngrok
      jest.doMock('@ngrok/ngrok', () => ({
        __esModule: true,
        default: mockNgrok,
      }));

      // Override global import function to handle dynamic imports
      const originalImport = global.import || jest.fn();

      global.import = jest.fn().mockImplementation(moduleName => {
        if (moduleName === '@ngrok/ngrok') {
          return Promise.resolve({ default: mockNgrok });
        }

        return originalImport.call(global, moduleName);
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
      delete global.import;
    });

    it('should connect to ngrok when withServer is ngrok', async () => {
      const { HwaNanPayment } = await import('../src');

      return new Promise<void>(resolve => {
        const payment = new HwaNanPayment({
          merchantId: MERCHANT_ID,
          terminalId: TERMINAL_ID,
          merID: MER_ID,
          merchantName: 'Rytass Shop',
          identifier: IDENTIFIER,
          withServer: 'ngrok',
          callbackPath: '/callback',
          onServerListen: () => {
            // Verify ngrok integration was properly called
            expect(mockNgrok.authtoken).toHaveBeenCalledWith('test-auth-token');
            expect(mockNgrok.forward).toHaveBeenCalledWith(3000);
            expect(mockForwarder.url).toHaveBeenCalled();
            resolve();
          },
        });
      });
    });

    it('should connect to ngrok with custom port from serverHost', async () => {
      const { HwaNanPayment } = await import('../src');

      const customPort = 9999;

      return new Promise<void>(resolve => {
        const payment = new HwaNanPayment({
          merchantId: MERCHANT_ID,
          terminalId: TERMINAL_ID,
          merID: MER_ID,
          merchantName: 'Rytass Shop',
          identifier: IDENTIFIER,
          withServer: 'ngrok',
          serverHost: `http://localhost:${customPort}`,
          callbackPath: '/callback',
          onServerListen: () => {
            // Verify ngrok was called with correct port
            expect(mockNgrok.forward).toHaveBeenCalledWith(customPort);
            resolve();
          },
        });
      });
    });

    it('should call ngrok methods correctly', async () => {
      const { HwaNanPayment } = await import('../src');

      return new Promise<void>(resolve => {
        const payment = new HwaNanPayment({
          merchantId: MERCHANT_ID,
          terminalId: TERMINAL_ID,
          merID: MER_ID,
          merchantName: 'Rytass Shop',
          identifier: IDENTIFIER,
          withServer: 'ngrok',
          callbackPath: '/callback',
          onServerListen: () => {
            // Verify that ngrok methods are being called
            expect(mockNgrok.authtoken).toHaveBeenCalledWith('test-auth-token');
            expect(mockNgrok.forward).toHaveBeenCalledWith(3000);
            resolve();
          },
        });
      });
    });
  });
});
