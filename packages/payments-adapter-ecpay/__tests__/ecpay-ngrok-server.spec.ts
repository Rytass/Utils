/**
 * @jest-environment node
 */

// Mock ngrok module using doMock before importing
const mockNgrok = {
  authtoken: jest.fn(),
  forward: jest.fn(),
};

jest.doMock('@ngrok/ngrok', () => ({
  default: mockNgrok,
}));

// Need to reset modules to ensure fresh imports
jest.resetModules();

import { ECPayPayment } from '../src';
import { EventEmitter } from 'events';

// Mock the HTTP server
jest.mock('http', () => {
  const actualHttp = jest.requireActual('http');

  return {
    ...actualHttp,
    createServer: jest.fn(() => {
      const mockServer = new EventEmitter();
      mockServer.listen = jest.fn((port, host, callback) => {
        // Immediately call the callback to simulate server start
        setImmediate(() => callback && callback());
        return mockServer;
      });
      mockServer.close = jest.fn((callback) => {
        setImmediate(() => callback && callback());
        return mockServer;
      });
      return mockServer;
    }),
  };
});

describe('ECPayPayment Ngrok binding', () => {
  beforeAll(() => {
    // Mock forward to return an object with url() method
    mockNgrok.forward.mockResolvedValue({
      url: () => 'https://test-ngrok-url.ngrok.io',
    });
  });

  beforeEach(() => {
    mockNgrok.authtoken.mockClear();
    mockNgrok.forward.mockClear();
  });

  afterAll(() => {
    delete process.env.NGROK_AUTHTOKEN;
  });

  it('should connect to ngrok when withServer is ngrok', (done) => {
    const payment = new ECPayPayment({
      withServer: 'ngrok',
      onServerListen: () => {
        expect(mockNgrok.authtoken).toHaveBeenCalledWith('test-token');
        expect(mockNgrok.forward).toHaveBeenCalled();

        payment._server?.close(done);
      },
    });
  });

  it('should connect to ngrok with custom port', (done) => {
    const payment = new ECPayPayment({
      withServer: 'ngrok',
      serverHost: 'http://0.0.0.0:3005',
      onServerListen: () => {
        expect(mockNgrok.authtoken).toHaveBeenCalledWith('test-token');
        expect(mockNgrok.forward).toHaveBeenCalledWith(3005);

        payment._server?.close(done);
      },
    });
  });

  it('should handle ngrok connection failure gracefully', (done) => {
    // Mock ngrok to throw an error
    mockNgrok.forward.mockRejectedValueOnce(
      new Error('Ngrok connection failed'),
    );

    const payment = new ECPayPayment({
      withServer: 'ngrok',
      onServerListen: () => {
        // Should still call authtoken even if forward fails
        expect(mockNgrok.authtoken).toHaveBeenCalledWith('test-token');
        expect(mockNgrok.forward).toHaveBeenCalled();

        payment._server?.close(done);
      },
    });
  });
});
