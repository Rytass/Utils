/**
 * @jest-environment node
 */

import { ECPayPayment, OrderState } from '../src';

describe('ECPayPayment Refund', () => {
  it('should refund successfully', async () => {
    const payment = new ECPayPayment({
      creditCheckCode: 123456,
      emulateRefund: true,
    });

    const order = await payment.query('e93b51dea2f5a8d88b5a');

    expect(order.state).toBe(OrderState.COMMITTED);

    await order.refund();

    expect(order.state).toBe(OrderState.REFUNDED);
  });
});
