/**
 * @jest-environment node
 */

// Set NGROK_AUTHTOKEN before any imports
process.env.NGROK_AUTHTOKEN = 'test-auth-token';

import { EventEmitter } from 'events';

describe('ECPayPayment Ngrok binding', () => {
  const mockForwarder = {
    url: jest.fn().mockReturnValue('https://test-ngrok-url.ngrok.io'),
  };

  const mockNgrok = {
    authtoken: jest.fn().mockResolvedValue(undefined),
    forward: jest.fn().mockResolvedValue(mockForwarder),
  };

  const mockServer = new EventEmitter();

  mockServer.listen = jest.fn((_port, _host, callback) => {
    setImmediate(() => callback && callback());

    return mockServer;
  });

  mockServer.close = jest.fn(callback => {
    setImmediate(() => callback && callback());

    return mockServer;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Mock HTTP server creation
    jest.doMock('http', () => ({
      createServer: jest.fn(() => mockServer),
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
    const { ECPayPayment } = await import('../src');

    return new Promise<void>(resolve => {
      const _payment = new ECPayPayment({
        merchantId: '2000132',
        hashKey: '5294y06JbISpM5x9',
        hashIv: 'v77hoKGq4kWxNNIS',
        withServer: 'ngrok',
        serverHost: 'http://localhost:3000',
        callbackPath: '/payments/ecpay/callback',
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

  it('should connect to ngrok with custom port', async () => {
    const { ECPayPayment } = await import('../src');

    const customPort = 8080;

    return new Promise<void>(resolve => {
      const _payment = new ECPayPayment({
        merchantId: '2000132',
        hashKey: '5294y06JbISpM5x9',
        hashIv: 'v77hoKGq4kWxNNIS',
        withServer: 'ngrok',
        serverHost: `http://localhost:${customPort}`,
        callbackPath: '/payments/ecpay/callback',
        onServerListen: () => {
          // Verify ngrok was called with correct port
          expect(mockNgrok.forward).toHaveBeenCalledWith(customPort);
          resolve();
        },
      });
    });
  });

  it('should call ngrok methods correctly', async () => {
    const { ECPayPayment } = await import('../src');

    return new Promise<void>(resolve => {
      const _payment = new ECPayPayment({
        merchantId: '2000132',
        hashKey: '5294y06JbISpM5x9',
        hashIv: 'v77hoKGq4kWxNNIS',
        withServer: 'ngrok',
        serverHost: 'http://localhost:3000',
        callbackPath: '/payments/ecpay/callback',
        onServerListen: () => {
          // Verify that ngrok methods are being called (demonstrates ngrok integration is working)
          expect(mockNgrok.authtoken).toHaveBeenCalledWith('test-auth-token');
          expect(mockNgrok.forward).toHaveBeenCalledWith(3000);
          resolve();
        },
      });
    });
  });
});
