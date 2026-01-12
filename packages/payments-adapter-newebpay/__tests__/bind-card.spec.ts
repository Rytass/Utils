/**
 * @jest-environment node
 */

import http, { createServer, IncomingMessage, ServerResponse } from 'http';
import { createCipheriv, createHash } from 'crypto';
import { OrderState, PaymentEvents } from '@rytass/payments';
import { NewebPayPayment } from '../src';

const MERCHANT_ID = 'MS154366906';
const AES_KEY = 'X4vM1RymaxkyzZ9mZHNE67Kba2gpv40c';
const AES_IV = '6ma4zu0UFWk54oyX';

// Helper function to encrypt payload (same format as NewebPay API response)
function encryptPayload(data: Record<string, unknown>): { TradeInfo: string; TradeSha: string } {
  // NewebPay API returns encrypted JSON wrapped in APIResponseWrapper
  const responseWrapper = {
    Status: 'SUCCESS',
    Message: '',
    Result: data,
  };

  const cipher = createCipheriv('aes-256-cbc', AES_KEY, AES_IV);

  const encrypted = `${cipher.update(JSON.stringify(responseWrapper), 'utf8', 'hex')}${cipher.final('hex')}`;

  const hash = createHash('sha256')
    .update(`HashKey=${AES_KEY}&${encrypted}&HashIV=${AES_IV}`)
    .digest('hex')
    .toUpperCase();

  return {
    TradeInfo: encrypted,
    TradeSha: hash,
  };
}

describe('NewebPay Bind Card', () => {
  const originCreateServer = createServer;
  const mockedCreateServer = jest.spyOn(http, 'createServer');

  let _requestHandler: ((req: IncomingMessage, res: ServerResponse) => void) | undefined;

  mockedCreateServer.mockImplementation(handler => {
    _requestHandler = handler as (req: IncomingMessage, res: ServerResponse) => void;

    const mockServer = originCreateServer(handler as (req: IncomingMessage, res: ServerResponse) => void);

    const mockedListen = jest.spyOn(mockServer, 'listen');

    mockedListen.mockImplementationOnce((_port?: number, _hostname?: string, listeningListener?: () => void) => {
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

  describe('NewebPayBindCardRequest', () => {
    it('should create a bind card request with basic properties', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      const request = await payment.prepareBindCard('member-001');

      expect(request.id).toBeDefined();
      expect(request.memberId).toBe('member-001');
      expect(request.state).toBe(OrderState.INITED);
      expect(request.committable).toBe(false);
      expect(request.cardId).toBeUndefined();
      expect(request.cardNumberPrefix).toBeUndefined();
      expect(request.cardNumberSuffix).toBeUndefined();
      expect(request.bindingDate).toBeUndefined();
      expect(request.expireDate).toBeUndefined();
      expect(request.failedMessage).toBeNull();
    });

    it('should create a bind card request with custom orderId', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      const request = await payment.prepareBindCard('member-002', {
        orderId: 'custom-order-id',
      });

      expect(request.id).toBe('custom-order-id');
    });

    it('should create a bind card request with items', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      const request = await payment.prepareBindCard('member-003', {
        items: [
          { name: '商品A', unitPrice: 100, quantity: 2 },
          { name: '商品B', unitPrice: 50, quantity: 1 },
        ],
      });

      expect(request.id).toBeDefined();
    });

    it('should create a bind card request with finishRedirectURL', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      const request = await payment.prepareBindCard('member-004', {
        finishRedirectURL: 'https://example.com/success',
      });

      expect(request.finishRedirectURL).toBe('https://example.com/success');
    });

    it('should get form data and transition to PRE_COMMIT state', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      const request = await payment.prepareBindCard('member-005');

      expect(request.state).toBe(OrderState.INITED);

      const form = request.form;

      expect(form).toBeDefined();
      expect(form.MerchantID).toBe(MERCHANT_ID);
      expect(form.TradeInfo).toBeDefined();
      expect(form.TradeSha).toBeDefined();
      expect(request.state).toBe(OrderState.PRE_COMMIT);
      expect(request.committable).toBe(true);
    });

    it('should throw error when getting form from finished order', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      const request = await payment.prepareBindCard('member-006');

      // Simulate order failure
      request.fail('ERR001', 'Test error');

      expect(() => request.form).toThrow('Finished order cannot get submit form data');
    });

    it('should get formHTML and transition to PRE_COMMIT state', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      const request = await payment.prepareBindCard('member-007');

      expect(request.state).toBe(OrderState.INITED);

      const formHTML = request.formHTML;

      expect(formHTML).toContain('<!DOCTYPE html>');
      expect(formHTML).toContain('<form action=');
      expect(formHTML).toContain('document.forms[0].submit()');
      expect(request.state).toBe(OrderState.PRE_COMMIT);
    });

    it('should throw error when getting formHTML from finished order', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      const request = await payment.prepareBindCard('member-008');

      // Simulate order failure
      request.fail('ERR002', 'Test error 2');

      expect(() => request.formHTML).toThrow('Finished order cannot get submit form url');
    });

    it('should handle fail method correctly', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      const failedEventHandler = jest.fn();

      payment.emitter.on(PaymentEvents.ORDER_FAILED, failedEventHandler);

      const request = await payment.prepareBindCard('member-009');

      request.fail('ERR003', 'Card binding failed');

      expect(request.state).toBe(OrderState.FAILED);
      expect(request.failedMessage).toEqual({
        code: 'ERR003',
        message: 'Card binding failed',
      });

      expect(failedEventHandler).toHaveBeenCalledWith(request);
    });

    it('should handle bound method correctly', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      const boundEventHandler = jest.fn();

      payment.emitter.on(PaymentEvents.CARD_BOUND, boundEventHandler);

      const request = await payment.prepareBindCard('member-010');

      request.bound({
        TokenValue: 'token-12345',
        Card6No: '411111',
        Card4No: '1111',
        PayTime: '2025-01-10 14:30:00',
        Exp: '2812',
        MerchantOrderNo: request.id,
        TradeNo: 'TN12345678',
        MerchantID: MERCHANT_ID,
        Status: 'SUCCESS',
      });

      expect(request.state).toBe(OrderState.COMMITTED);
      expect(request.cardId).toBe('token-12345');
      expect(request.cardNumberPrefix).toBe('411111');
      expect(request.cardNumberSuffix).toBe('1111');
      expect(request.bindingDate).toBeDefined();
      expect(request.expireDate).toBeDefined();
      expect(boundEventHandler).toHaveBeenCalledWith(request);
    });

    it('should return correct getBindCardUrl', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
        bindCardPath: '/bind-card',
      });

      const request = await payment.prepareBindCard('member-011', {
        orderId: 'bind-order-123',
      });

      expect(payment.getBindCardUrl(request)).toBe('https://test.rytass.com/bind-card/bind-order-123');
    });
  });

  describe('Bind Card Server Handling', () => {
    it('should serve bind card page on GET request', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
        bindCardPath: '/bind-card',
      });

      const _request = await payment.prepareBindCard('member-012', {
        orderId: 'bind-request-001',
      });

      // Simulate GET request to bind card URL
      const mockReq = {
        method: 'GET',
        url: '/bind-card/bind-request-001',
      } as IncomingMessage;

      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      } as unknown as ServerResponse;

      await payment.defaultServerListener(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/html; charset=utf-8',
      });

      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should return 404 for non-existent bind card request', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
        bindCardPath: '/bind-card',
      });

      // Simulate GET request to non-existent bind card
      const mockReq = {
        method: 'GET',
        url: '/bind-card/non-existent-order',
      } as IncomingMessage;

      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      } as unknown as ServerResponse;

      await payment.defaultServerListener(mockReq, mockRes);

      // Should fall through to 404
      expect(mockRes.writeHead).toHaveBeenCalledWith(404);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should handle POST callback for bound card', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
        boundCardPath: '/bound-card-callback',
      });

      const request = await payment.prepareBindCard('member-013', {
        orderId: 'bind-callback-001',
      });

      const boundEventHandler = jest.fn();

      payment.emitter.on(PaymentEvents.CARD_BOUND, boundEventHandler);

      // Create encrypted payload
      const { TradeInfo, TradeSha } = encryptPayload({
        TokenValue: 'token-callback-123',
        Card6No: '411111',
        Card4No: '1111',
        PayTime: '2025-01-10 15:00:00',
        Exp: '2812',
        MerchantOrderNo: 'bind-callback-001',
        TradeNo: 'TN-CALLBACK-001',
        MerchantID: MERCHANT_ID,
        Status: 'SUCCESS',
      });

      const bodyData = `MerchantID=${MERCHANT_ID}&TradeInfo=${TradeInfo}&TradeSha=${TradeSha}`;

      // Mock IncomingMessage with POST data
      const { Readable } = require('stream');
      const mockReq = new Readable() as IncomingMessage;

      mockReq.push(bodyData);
      mockReq.push(null);
      mockReq.method = 'POST';
      mockReq.url = '/bound-card-callback';

      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      } as unknown as ServerResponse;

      // The defaultServerListener returns before async processing completes
      // We need to wait for the CARD_BOUND event
      await new Promise<void>(resolve => {
        payment.emitter.once(PaymentEvents.CARD_BOUND, () => {
          resolve();
        });

        payment.defaultServerListener(mockReq, mockRes);
      });

      expect(boundEventHandler).toHaveBeenCalled();
      expect(request.cardId).toBe('token-callback-123');
    });

    it('should return 404 for POST callback with non-existent request', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
        boundCardPath: '/bound-card-callback',
      });

      // Create encrypted payload for non-existent order
      const { TradeInfo, TradeSha } = encryptPayload({
        TokenValue: 'token-callback-123',
        Card6No: '411111',
        Card4No: '1111',
        PayTime: '2025-01-10 15:00:00',
        Exp: '2812',
        MerchantOrderNo: 'non-existent-bind-order',
        TradeNo: 'TN-CALLBACK-002',
        MerchantID: MERCHANT_ID,
        Status: 'SUCCESS',
      });

      const bodyData = `MerchantID=${MERCHANT_ID}&TradeInfo=${TradeInfo}&TradeSha=${TradeSha}`;

      // Mock IncomingMessage with POST data
      const { Readable } = require('stream');
      const mockReq = new Readable() as IncomingMessage;

      mockReq.push(bodyData);
      mockReq.push(null);
      mockReq.method = 'POST';
      mockReq.url = '/bound-card-callback';

      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn().mockImplementation(() => {
          // This is called when processing completes
        }),
      } as unknown as ServerResponse;

      // Wait for end to be called
      await new Promise<void>(resolve => {
        (mockRes.end as jest.Mock).mockImplementation(() => {
          resolve();
        });

        payment.defaultServerListener(mockReq, mockRes);
      });

      expect(mockRes.writeHead).toHaveBeenCalledWith(404);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('should redirect after bound card if finishRedirectURL is set', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
        boundCardPath: '/bound-card-callback',
      });

      const _request = await payment.prepareBindCard('member-014', {
        orderId: 'bind-redirect-001',
        finishRedirectURL: 'https://example.com/success',
      });

      // Create encrypted payload
      const { TradeInfo, TradeSha } = encryptPayload({
        TokenValue: 'token-redirect-123',
        Card6No: '411111',
        Card4No: '1111',
        PayTime: '2025-01-10 16:00:00',
        Exp: '2812',
        MerchantOrderNo: 'bind-redirect-001',
        TradeNo: 'TN-REDIRECT-001',
        MerchantID: MERCHANT_ID,
        Status: 'SUCCESS',
      });

      const bodyData = `MerchantID=${MERCHANT_ID}&TradeInfo=${TradeInfo}&TradeSha=${TradeSha}`;

      // Mock IncomingMessage with POST data
      const { Readable } = require('stream');
      const mockReq = new Readable() as IncomingMessage;

      mockReq.push(bodyData);
      mockReq.push(null);
      mockReq.method = 'POST';
      mockReq.url = '/bound-card-callback';

      const mockRes = {
        writeHead: jest.fn(),
        end: jest.fn(),
      } as unknown as ServerResponse;

      // Wait for end to be called
      await new Promise<void>(resolve => {
        (mockRes.end as jest.Mock).mockImplementation(() => {
          resolve();
        });

        payment.defaultServerListener(mockReq, mockRes);
      });

      expect(mockRes.writeHead).toHaveBeenCalledWith(302, {
        location: 'https://example.com/success',
      });

      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('checkoutWithBoundCard', () => {
    it('should checkout with bound card successfully', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      // Mock fetch
      const originalFetch = global.fetch;

      global.fetch = jest.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            Status: 'SUCCESS',
            Message: 'Success',
            Result: {
              TradeNo: 'TN987654321',
              MerchantOrderNo: 'order-001',
            },
          }),
      });

      const committedEventHandler = jest.fn();

      payment.emitter.on(PaymentEvents.ORDER_COMMITTED, committedEventHandler);

      const order = await payment.checkoutWithBoundCard({
        cardId: 'token-12345',
        memberId: 'member-001',
        items: [{ name: '商品A', unitPrice: 100, quantity: 1 }],
      });

      expect(order.id).toBeDefined();
      expect(order.state).toBe(OrderState.COMMITTED);
      expect(committedEventHandler).toHaveBeenCalled();

      global.fetch = originalFetch;
    });

    it('should handle checkout with bound card failure', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      // Mock fetch
      const originalFetch = global.fetch;

      global.fetch = jest.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            Status: 'FAIL001',
            Message: 'Card payment failed',
            Result: {
              TradeNo: 'TN987654322',
              MerchantOrderNo: 'order-002',
            },
          }),
      });

      const failedEventHandler = jest.fn();

      payment.emitter.on(PaymentEvents.ORDER_FAILED, failedEventHandler);

      const order = await payment.checkoutWithBoundCard({
        cardId: 'token-12345',
        memberId: 'member-001',
        items: [{ name: '商品A', unitPrice: 100, quantity: 1 }],
      });

      expect(order.state).toBe(OrderState.FAILED);
      expect(failedEventHandler).toHaveBeenCalled();

      global.fetch = originalFetch;
    });

    it('should use custom orderId for checkoutWithBoundCard', async () => {
      const payment = new NewebPayPayment({
        merchantId: MERCHANT_ID,
        aesKey: AES_KEY,
        aesIv: AES_IV,
        serverHost: 'https://test.rytass.com',
      });

      // Mock fetch
      const originalFetch = global.fetch;

      global.fetch = jest.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            Status: 'SUCCESS',
            Message: 'Success',
            Result: {
              TradeNo: 'TN987654323',
              MerchantOrderNo: 'custom-order-001',
            },
          }),
      });

      const order = await payment.checkoutWithBoundCard({
        cardId: 'token-12345',
        memberId: 'member-001',
        orderId: 'custom-order-001',
        items: [{ name: '商品A', unitPrice: 100, quantity: 1 }],
      });

      expect(order.id).toBe('custom-order-001');

      global.fetch = originalFetch;
    });
  });
});
