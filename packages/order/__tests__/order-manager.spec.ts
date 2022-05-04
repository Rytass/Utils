
import { OrderManager } from '../src/order-manager';
import { OrderBuilder } from '../src/order-builder';

describe('OrderManager', () => {
  it('`createOrderBuilder` should create an defined instance of OrderBuilder', () => {
    const orderBuilder = OrderManager.createOrderBuilder();

    expect(orderBuilder).toBeDefined();
    expect(orderBuilder).toBeInstanceOf(OrderBuilder)
  })
});
