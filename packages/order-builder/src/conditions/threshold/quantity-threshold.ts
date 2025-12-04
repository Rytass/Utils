import { getOrderItems } from '../../policies/discount/utils';
import { Order } from '../../core/order';
import { divided, plus, times } from '../../utils/decimal';
import { Condition } from '../typings';
import { Threshold, ThresholdDescription } from './typings';
import { ConditionOptionsBase } from '../../typings';

export class QuantityThreshold<Options extends ConditionOptionsBase = ConditionOptionsBase> implements Condition<
  ThresholdDescription,
  ConditionOptionsBase
> {
  readonly type = Threshold.QUANTITY;
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
    return (
      getOrderItems(order).reduce(
        (total, item) => plus(total, Math.ceil(divided(times(item.quantity, item.unitPrice), item.unitPrice))),
        0,
      ) >= this.value
    );
  }
}
