/**
 * @jest-environment jsdom
 */

import request from 'supertest';
import { OrderState } from '@rytass/payments';
import { addMac } from '../__utils__/add-mac';
import { Channel, ECPayCallbackPaymentType, ECPayPayment } from '@rytass/payments-adapter-ecpay';
import http, { createServer } from 'http';
import { ECPayChannelApplePay, ECPayChannelBarcode, ECPayChannelCVS } from 'payments-adapter-ecpay/src/typings';

describe('ECPayPayment (Apple Pay)', () => {
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

  describe('Apple Pay', () => {
    const payment = new ECPayPayment<ECPayChannelApplePay>();

    it('should represent apple pay config on form data', () => {
      const order = payment.prepare({
        channel: Channel.APPLE_PAY,
        items: [{
          name: 'Test',
          unitPrice: 1000,
          quantity: 1,
        }],
      });

      expect(order.form.ChoosePayment).toBe('ApplePay');
    });
  });
});
