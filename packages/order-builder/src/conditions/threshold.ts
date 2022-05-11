import { Order } from '../core/order';
import { Condition } from './typings';

export type ThresholdDescription = {
  type: 'THRESHOLD';
  value: number;
};

export class PriceThreshold implements Condition<ThresholdDescription> {
  readonly type = 'THRESHOLD' as const;
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
