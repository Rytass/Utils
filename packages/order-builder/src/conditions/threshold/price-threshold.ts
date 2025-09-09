import { Order } from '../../core/order';
import { Condition } from '../typings';
import { Threshold, ThresholdDescription } from './typings';
import { ConditionOptionsBase } from '../../typings';

export class PriceThreshold<Options extends ConditionOptionsBase = ConditionOptionsBase>
  implements Condition<ThresholdDescription, Options>
{
  readonly type = Threshold.PRICE;
  readonly value: number;
  readonly options?: Options;

  /**
   * Price threshold condition
   * @description Check whether price of order has reach the give threshold value.
   */
  constructor(value: number, options?: Options) {
    this.value = value;
    this.options = options;
  }

  satisfy(order: Order): boolean {
    return order.itemValue >= this.value;
  }
}
