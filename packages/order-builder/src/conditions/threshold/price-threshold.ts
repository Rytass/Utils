import { Order } from '../../core/order';
import { Condition } from '../typings';
import { Threshold, ThresholdDescription } from './typings';

export class PriceThreshold implements Condition<ThresholdDescription> {
  readonly type = Threshold.PRICE;
  readonly value: number;

  /**
   * Price threshold condition
   * @description Check whether price of order has reach the give threshold value.
   */
  constructor(value: number) {
    this.value = value;
  }

  satisfy(order: Order) {
    return order.itemValue >= this.value;
  }
}
