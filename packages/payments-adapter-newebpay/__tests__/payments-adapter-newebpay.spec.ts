/**
 * @jest-environment node
 */

import { NewebPaymentChannel, NewebPayPayment } from '../src';

describe('NewebPay Payments', () => {
  describe('Prepare Order', () => {
    it('should prepare order get encrypted payload', async () => {
      const payment = new NewebPayPayment({
        serverHost: 'https://af7d-125-228-40-131.ngrok.io',
      });

      // const order = payment.prepare({
      //   // id: '7bd2170f7d46712bb246',
      //   // id: '83894ea614b72592c88b',
      //   id: 'ee08876536b8f919047e',
      //   channel: NewebPaymentChannel.VACC,
      //   items: [{
      //     name: '鉛筆',
      //     unitPrice: 10,
      //     quantity: 1,
      //   }],
      // });

      // console.log(order.formHTML);

      const order = await payment.query('7bd2170f7d46712bb246', 10);

      console.log(order);
    });
  });
});
