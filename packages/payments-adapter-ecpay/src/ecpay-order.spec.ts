import { ECPayPayment } from '.';
import { ECPayOrder } from './ecpay-order';

describe('ECPayOrder', () => {
  const payment = new ECPayPayment();

  const order = payment.prepare({
    items: [{
      name: 'Test',
      unitPrice: 10,
      quantity: 1
    }, {
      name: '中文',
      unitPrice: 15,
      quantity: 4
    }],
  });

  it('should calculate total price', () => {
    expect(order.totalPrice).toBe(70);
  });

  it('should get checkout url throw error when no server', () => {
    expect(() => order.checkoutURL).toThrowError();
  });

  it('should get valid checkout url', (done) => {
    let finishable = false;

    const paymentWithServer = new ECPayPayment({
      withServer: true,
      serverHost: 'http://localhost:3001',
      onServerListen: () => {
        if (finishable) {
          paymentWithServer._server?.close(() => {
            done();
          });
        } else {
          finishable = true;
        }
      },
    });

    const withServerOrder = paymentWithServer.prepare({
      items: [{
        name: 'Test',
        unitPrice: 10,
        quantity: 1
      }, {
        name: '中文',
        unitPrice: 15,
        quantity: 4
      }],
    });

    const re = new RegExp(`${withServerOrder.id}$`);

    expect(withServerOrder.checkoutURL).toMatch(re);

    if (finishable) {
      paymentWithServer._server?.close(() => {
        done();
      });
    }

    finishable = true;
  });
});
