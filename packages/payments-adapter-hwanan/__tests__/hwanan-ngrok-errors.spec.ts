/**
 * @jest-environment node
 */

/**
 * Tests for ngrok error handling in HwaNanPayment.
 * These tests cover the error branches when:
 * 1. NGROK_AUTHTOKEN is not set
 * 2. @ngrok/ngrok module fails to import
 */

import { EventEmitter } from 'events';

const MERCHANT_ID = '326650918560582';
const TERMINAL_ID = '87345985';
const MER_ID = '22343';
const IDENTIFIER = '8949bf87c8d710a0';

describe('HwaNan Payment Ngrok Error Handling', () => {
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
      const { HwaNanPayment } = await import('../src');

      // Create payment instance
      new HwaNanPayment({
        merchantId: MERCHANT_ID,
        terminalId: TERMINAL_ID,
        merID: MER_ID,
        merchantName: 'Rytass Shop',
        identifier: IDENTIFIER,
        withServer: 'ngrok',
        callbackPath: '/callback',
      });

      // Verify callback was captured
      expect(listenCallback).toBeDefined();

      // Execute the callback and expect it to throw
      await expect(listenCallback!()).rejects.toThrow('[HwananPayment] NGROK_AUTHTOKEN is not set');
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
      const { HwaNanPayment } = await import('../src');

      // Create payment instance
      new HwaNanPayment({
        merchantId: MERCHANT_ID,
        terminalId: TERMINAL_ID,
        merID: MER_ID,
        merchantName: 'Rytass Shop',
        identifier: IDENTIFIER,
        withServer: 'ngrok',
        callbackPath: '/callback',
      });

      // Verify callback was captured
      expect(listenCallback).toBeDefined();

      // Execute the callback and expect it to throw
      await expect(listenCallback!()).rejects.toThrow('Cannot find module @ngrok/ngrok');
    });
  });
});
