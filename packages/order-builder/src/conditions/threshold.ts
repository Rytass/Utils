import { Order } from '../order-builder';
import { Condition } from './typings';

export type ThresholdDescription = {
  type: 'THRESHOLD';
  value: number;
};

/**
 * Price threshold condition
 * @description Check whether price of order has reach the give threshold value.
 */
export class PriceThreshold implements Condition<ThresholdDescription> {
  readonly type = 'THRESHOLD' as const;
  readonly value: number;

  constructor(value: number) {
    this.value = value;
  }

  resolve(order: Order) {
    return order.itemValue >= this.value;
  }
}
