import { Order } from '../../core/order';
import { Condition } from '../typings';
import { Threshold, ThresholdDescription } from './typings';
import { ObjRecord } from '../../typings';

export class PriceThreshold<Options extends ObjRecord = ObjRecord>
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

  satisfy(order: Order) {
    return order.itemValue >= this.value;
  }
}
