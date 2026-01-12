/**
 * @jest-environment node
 */

/**
 * Tests for ngrok error handling in CTBCPayment.
 * These tests cover the error branches when:
 * 1. NGROK_AUTHTOKEN is not set
 * 2. @ngrok/ngrok module fails to import
 */

import { EventEmitter } from 'events';

describe('CTBC Payment Ngrok Error Handling', () => {
  const originalToken = process.env.NGROK_AUTHTOKEN;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    // Always restore the token after each test
    if (originalToken) {
      process.env.NGROK_AUTHTOKEN = originalToken;
    } else {
      process.env.NGROK_AUTHTOKEN = 'test-auth-token';
    }

    jest.restoreAllMocks();
  });

  describe('NGROK_AUTHTOKEN not set', () => {
    it('should throw error when NGROK_AUTHTOKEN is not set', async () => {
      // Remove the token before mocking
      delete process.env.NGROK_AUTHTOKEN;

      // Create a mock server that captures the listen callback
      const mockServer = new EventEmitter() as EventEmitter & {
        listen: jest.Mock;
        close: jest.Mock;
      };

      let listenCallback: (() => Promise<void>) | undefined;

      mockServer.listen = jest.fn((_port: number, _host: string, callback: () => Promise<void>) => {
        listenCallback = callback;

        return mockServer;
      });

      mockServer.close = jest.fn((callback?: () => void) => {
        if (callback) callback();

        return mockServer;
      });

      // Mock http module
      jest.doMock('http', () => ({
        ...jest.requireActual('http'),
        createServer: jest.fn(() => mockServer),
      }));

      // Import the module after mocking
      const { CTBCPayment } = await import('../src');

      // Create payment instance
      new CTBCPayment({
        merchantId: 'TEST_MERCHANT',
        txnKey: 'abcdefghijklmnop',
        txnVersion: '1.0.0',
        withServer: 'ngrok',
        serverHost: 'http://localhost:3000',
        callbackPath: '/callback',
      });

      // Verify callback was captured
      expect(listenCallback).toBeDefined();

      // Execute the callback and expect it to throw
      await expect(listenCallback!()).rejects.toThrow('[CTBCPayment] NGROK_AUTHTOKEN is not set');
    });
  });

  describe('ngrok import failure', () => {
    it('should throw error when @ngrok/ngrok module fails to import', async () => {
      // Ensure token is set so we pass the first check
      process.env.NGROK_AUTHTOKEN = 'test-auth-token';

      // Create a mock server that captures the listen callback
      const mockServer = new EventEmitter() as EventEmitter & {
        listen: jest.Mock;
        close: jest.Mock;
      };

      let listenCallback: (() => Promise<void>) | undefined;

      mockServer.listen = jest.fn((_port: number, _host: string, callback: () => Promise<void>) => {
        listenCallback = callback;

        return mockServer;
      });

      mockServer.close = jest.fn((callback?: () => void) => {
        if (callback) callback();

        return mockServer;
      });

      // Mock http module
      jest.doMock('http', () => ({
        ...jest.requireActual('http'),
        createServer: jest.fn(() => mockServer),
      }));

      // Mock @ngrok/ngrok to throw on import
      jest.doMock('@ngrok/ngrok', () => {
        throw new Error('Cannot find module @ngrok/ngrok');
      });

      // Import the module after mocking
      const { CTBCPayment } = await import('../src');

      // Create payment instance
      new CTBCPayment({
        merchantId: 'TEST_MERCHANT',
        txnKey: 'abcdefghijklmnop',
        txnVersion: '1.0.0',
        withServer: 'ngrok',
        serverHost: 'http://localhost:3000',
        callbackPath: '/callback',
      });

      // Verify callback was captured
      expect(listenCallback).toBeDefined();

      // Execute the callback and expect it to throw
      await expect(listenCallback!()).rejects.toThrow('Cannot find module @ngrok/ngrok');
    });
  });

  describe('ngrok success path', () => {
    it('should successfully connect to ngrok when everything is configured', async () => {
      // Ensure token is set
      process.env.NGROK_AUTHTOKEN = 'test-auth-token';

      // Create a mock server that captures the listen callback
      const mockServer = new EventEmitter() as EventEmitter & {
        listen: jest.Mock;
        close: jest.Mock;
      };

      let listenCallback: (() => Promise<void>) | undefined;

      mockServer.listen = jest.fn((_port: number, _host: string, callback: () => Promise<void>) => {
        listenCallback = callback;

        return mockServer;
      });

      mockServer.close = jest.fn((callback?: () => void) => {
        if (callback) callback();

        return mockServer;
      });

      // Mock http module
      jest.doMock('http', () => ({
        ...jest.requireActual('http'),
        createServer: jest.fn(() => mockServer),
      }));

      // Mock @ngrok/ngrok to succeed
      // The module is imported twice: once for check, once for default
      const mockNgrok = {
        authtoken: jest.fn().mockResolvedValue(undefined),
        forward: jest.fn().mockResolvedValue({
          url: jest.fn(() => 'https://abc123.ngrok.io'),
        }),
      };

      jest.doMock('@ngrok/ngrok', () => ({
        __esModule: true,
        default: mockNgrok,
      }));

      // Import the module after mocking
      const { CTBCPayment, PaymentEvents } = await import('../src');

      // Create payment instance
      const payment = new CTBCPayment({
        merchantId: 'TEST_MERCHANT',
        txnKey: 'abcdefghijklmnop',
        txnVersion: '1.0.0',
        withServer: 'ngrok',
        serverHost: 'http://localhost:3000',
        callbackPath: '/callback',
      });

      // Track SERVER_LISTENED event
      const serverListenedPromise = new Promise<void>(resolve => {
        payment.emitter.on(PaymentEvents.SERVER_LISTENED, resolve);
      });

      // Verify callback was captured
      expect(listenCallback).toBeDefined();

      // Execute the callback - should succeed
      await listenCallback!();

      // Wait for SERVER_LISTENED event
      await serverListenedPromise;

      // Verify serverHost was updated to ngrok URL
      expect(payment.serverHost).toBe('https://abc123.ngrok.io');

      // Verify ngrok was called correctly
      expect(mockNgrok.authtoken).toHaveBeenCalledWith('test-auth-token');
      expect(mockNgrok.forward).toHaveBeenCalled();
    });
  });
});
