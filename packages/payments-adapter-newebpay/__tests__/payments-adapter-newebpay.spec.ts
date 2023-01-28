/**
 * @jest-environment node
 */

import { NewebPaymentChannel, NewebPayPayment } from '../src';

describe('NewebPay Payments', () => {
  describe('Prepare Order', () => {
    it('should prepare order get encrypted payload', (done) => {
      const payment = new NewebPayPayment();

      const order = payment.prepare({
        channel: NewebPaymentChannel.CREDIT,
        items: [{
          name: '鉛筆',
          unitPrice: 10,
          quantity: 1,
        }],
      });

      done();
    });
  });
});
