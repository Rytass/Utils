import { OrderBuilder } from './order-builder';

export class OrderManager {
  static createOrderBuilder(initialValue?: number) {
    return new OrderBuilder(initialValue);
  }
}
