import { Order } from '../../core/order';
import { Condition } from '../typings';
import { QuantityRequiredInput, Requirement, RequirementDescription } from './typings';
import { ObjRecord } from '../../typings';
import { quantityRequiredOptions } from './utils';

export class QuantityRequired<Options extends ObjRecord = ObjRecord>
  implements Condition<RequirementDescription<QuantityRequiredInput>, Options>
{
  readonly type = Requirement.QUANTITY;
  readonly items: QuantityRequiredInput[];
  readonly leastQuantity: number;
  readonly options?: Options;

  /**
   * Quantity requirement condition
   * @description To check whether an order has reached given quantity items.
   * @param {Number} leastQuantity Number - A least quantity of items to satisfy condition.
   * @param {Array} specifiedItems (QuantityRequiredInput | string)[] - specified items cluster to check least quantity.
   */
  constructor(
    leastQuantity: number,
    specifiedItems: (QuantityRequiredInput | string)[],
    options?: Options
  );
  /**
   * Quantity requirement condition
   * @description To check whether an order has reached given quantity items.
   * @param {Number} leastQuantity Number - A least quantity of items to satisfy condition.
   */
  constructor(leastQuantity: number, options?: Options);
  constructor(
    leastQuantity: number,
    arg1?: (QuantityRequiredInput | string)[] | Options,
    arg2?: Options,
  ) {
    this.options = quantityRequiredOptions<Options>(arg1, arg2);
    this.leastQuantity = leastQuantity;
    const items = Array.isArray(arg1) ? arg1 : [];

    this.items = items.map(item => ({
      id: typeof item === 'string' ? item : item.id,
      leastQuantity: typeof item === 'string' ? 0 : item?.leastQuantity || 0,
    }));
  }

  satisfy(order: Order) {
    const validItemClusterMap = new Map<string, { id: string, leastQuantity: number }>(
      this.items.length
        ? this.items.map(item => [item.id, { id: item.id, leastQuantity: item?.leastQuantity || 0 }])
        : order.items.map(item => [item.id, { id: item.id, leastQuantity: 0 }]) // if not cluster limit then choose all.
    );

    const toCheckItems = order.items.filter((item) => {
      const matchedItem = validItemClusterMap.get(item.id);

      return matchedItem && item.quantity >= matchedItem.leastQuantity;
    });

    return toCheckItems.reduce((totalQuantity, item) => (
      totalQuantity + item.quantity
    ), 0) >= this.leastQuantity;
  }
}
