import { Order } from '../../core/order';
import { Condition } from '../typings';
import { Requirement, RequirementDescription } from './typings';

type QuantityRequiredInput = {
  id: string;
  leastQuantity?: number; // if quantity not given, default will fallback to 0;
};

export class QuantityRequired
  implements Condition<RequirementDescription<QuantityRequiredInput>>
{
  readonly type = Requirement.QUANTITY;
  readonly items: QuantityRequiredInput[];
  readonly leastQuantity: number;

  /**
   * Quantity requirement condition
   * @description To check whether an order has reached given quantity items.
   * @param {Number} leastQuantity Number - A least quantity of items to satisfy condition.
   * @param {Array} specifiedItems (QuantityRequiredInput | string)[] - specified items cluster to check least quantity.
   */
  constructor(
    leastQuantity: number,
    specifiedItems: (QuantityRequiredInput | string)[],
  );
  /**
   * Quantity requirement condition
   * @description To check whether an order has reached given quantity items.
   * @param {Number} leastQuantity Number - A least quantity of items to satisfy condition.
   */
  constructor(leastQuantity: number);
  constructor(
    leastQuantity: number,
    specifiedItems?: (QuantityRequiredInput | string)[],
  ) {
    this.leastQuantity = leastQuantity;
    const items = Array.isArray(specifiedItems) ? specifiedItems : [];

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

    const validItems = order.items.filter((item) => {
      const matchedItem = validItemClusterMap.get(item.id);

      return matchedItem && item.quantity >= matchedItem.leastQuantity;
    });

    return validItems.reduce((totalQuantity, item) => (
      totalQuantity + item.quantity
    ), 0) >= this.leastQuantity;
  }
}
