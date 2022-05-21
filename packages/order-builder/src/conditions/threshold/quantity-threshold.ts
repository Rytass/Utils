import { divided, minus, plus, times } from '../../utils/decimal';
import { Order } from '../../core/order';
import { Condition } from '../typings';
import { Threshold, ThresholdDescription } from './typings';

export class QuantityThreshold implements Condition<ThresholdDescription> {
  readonly type = Threshold.QUANTITY;
  readonly value: number;

  /**
   * Price threshold condition
   * @description Check whether price of order has reach the give threshold value.
   */
  constructor(value: number) {
    this.value = value;
  }

  satisfy(order: Order) {
    return order.itemManager.flattenItems.reduce((total, item) => (
      plus(
        total,
        Math.ceil(divided(
          minus(
            times(item.quantity, item.unitPrice),
            order.itemManager.collectionMap.get(item.uuid)?.discountValue || 0,
          ),
          item.unitPrice,
        )),
      )
    ), 0) >= this.value;
  }
}
