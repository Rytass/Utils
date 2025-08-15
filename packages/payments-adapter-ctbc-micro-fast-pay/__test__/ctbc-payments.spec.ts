/**
 * @jest-environment jsdom
 */

import http, { createServer } from 'http';
import { CTBCPayment } from '../src/ctbc-payment';
import { CTBCPaymentOptions } from 'payments-adapter-ctbc-micro-fast-pay/src/typings';
import { PaymentEvents } from '../../payments/src/typings';

describe('CTBCPayment', () => {
  let mockServer: ReturnType<typeof createServer>;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();

    mockServer = {
      listen: jest.fn((port: any, host: any, cb: () => void) => {
        cb();

        return mockServer;
      }),
      close: jest.fn((cb?: () => void) => {
        cb?.();

        return mockServer;
      }),
      on: jest.fn(),
    } as any;

    jest.spyOn(http, 'createServer').mockReturnValue(mockServer);
  });

  describe('constructor', () => {
    it('should initialize  and call createServer if withServer is true', () => {
      const options: CTBCPaymentOptions = {
        merchantId: '8220123456789',
        merId: '80123',
        txnKey: '8M2Jibamq35sg8Xj6cE6cFb1',
        terminalId: '90711223',
        withServer: true,
        serverHost: 'http://localhost:3000',
      };

      const instance = new CTBCPayment(options);

      expect(http.createServer).toHaveBeenCalledTimes(1);
      expect(mockServer.listen).toHaveBeenCalledWith(
        3000,
        '0.0.0.0',
        expect.any(Function),
      );
    });

    it('applies defaults when optional fields are omitted', () => {
      const p = new CTBCPayment({
        merchantId: '8220123456789',
        merId: '80123',
        txnKey: '8M2Jibamq35sg8Xj6cE6cFb1',
        terminalId: '90711223',
      } as any);

      expect((p as any).serverHost).toBe('http://localhost:3000');
      expect((p as any).baseUrl).toBe('https://testepos.ctbcbank.com');
      expect((p as any).callbackPath).toBe('/payments/ctbc/callback');
      expect((p as any).isGatewayReady).toBe(true);
    });

    it('applies provided overrides', () => {
      const p = new CTBCPayment({
        merchantId: 'M',
        merId: 'MID',
        txnKey: '123456789012345678901234',
        terminalId: 'T',
        serverHost: 'http://localhost:4000',
        baseUrl: 'https://real.ctbc',
        callbackPath: '/cb',
        checkoutPath: '/co',
        bindCardPath: '/bind',
        boundCardPath: '/bound',
        boundCardCheckoutResultPath: '/bound/result',
      } as any);

      expect((p as any).serverHost).toBe('http://localhost:4000');
      expect((p as any).baseUrl).toBe('https://real.ctbc');
      expect((p as any).callbackPath).toBe('/cb');
      expect((p as any).checkoutPath).toBe('/co');
    });

    it('toggles isGatewayReady after SERVER_LISTENED when withServer=true', async () => {
      const mockServer: any = {
        listen: jest.fn((port: any, host: any, cb: () => void) => {
          setTimeout(cb, 0); // defer so constructor can attach listeners

          return mockServer;
        }),
        close: jest.fn((cb?: () => void) => {
          cb?.();

          return mockServer;
        }),
      };

      jest.spyOn(http, 'createServer').mockReturnValueOnce(mockServer);

      const p = new CTBCPayment({
        merchantId: 'M',
        merId: 'MID',
        txnKey: '123456789012345678901234',
        terminalId: 'T',
        withServer: true,
        serverHost: 'http://localhost:3000',
      } as any);

      await new Promise<void>((resolve) =>
        p.emitter.once(PaymentEvents.SERVER_LISTENED, () => resolve()),
      );

      expect((p as any).isGatewayReady).toBe(true);
    });

    it('isGatewayReady is true immediately when withServer is falsy', () => {
      const p = new CTBCPayment({
        merchantId: 'M',
        merId: 'MID',
        txnKey: '123456789012345678901234',
        terminalId: 'T',
      } as any);

      expect((p as any).isGatewayReady).toBe(true);
    });

    it('serverListener calls defaultServerListener (instance spy)', async () => {
      const p = new CTBCPayment({
        merchantId: 'M',
        merId: 'MID',
        txnKey: '123456789012345678901234',
        terminalId: 'T',
      } as any);

      const spy = jest
        .spyOn(p as any, 'defaultServerListener')
        .mockResolvedValue(undefined); // it's async

      const req: any = { method: 'GET', url: '/' };
      const res: any = {};

      await (p as any).serverListener(req, res);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(req, res);
    });

    describe('constructor event handlers', () => {
      const base = {
        merchantId: 'M',
        merId: 'MID',
        txnKey: '123456789012345678901234',
        terminalId: 'T',
      } as any;

      it('registers onCommit when provided as function', () => {
        const onCommit = jest.fn();

        const p = new CTBCPayment({ ...base, onCommit });

        p.emitter.emit(PaymentEvents.ORDER_COMMITTED, { id: 'o1' });

        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit).toHaveBeenCalledWith({ id: 'o1' });
      });

      it('registers onServerListen when provided as function', () => {
        const onServerListen = jest.fn();

        const p = new CTBCPayment({ ...base, onServerListen });

        p.emitter.emit(PaymentEvents.SERVER_LISTENED);

        expect(onServerListen).toHaveBeenCalledTimes(1);
      });

      it('does NOT register when not a function', () => {
        const p = new CTBCPayment({
          ...base,
          onCommit: 123,
          onServerListen: null,
        } as any);

        expect(() =>
          p.emitter.emit(PaymentEvents.ORDER_COMMITTED),
        ).not.toThrow();

        expect(() =>
          p.emitter.emit(PaymentEvents.SERVER_LISTENED),
        ).not.toThrow();
      });

      it('both handlers can be registered simultaneously', () => {
        const onCommit = jest.fn();
        const onServerListen = jest.fn();

        const p = new CTBCPayment({ ...base, onCommit, onServerListen });

        p.emitter.emit(PaymentEvents.ORDER_COMMITTED, { ok: 1 });
        p.emitter.emit(PaymentEvents.SERVER_LISTENED);

        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(onCommit).toHaveBeenCalledWith({ ok: 1 });
        expect(onServerListen).toHaveBeenCalledTimes(1);
      });
    });
  });
});
