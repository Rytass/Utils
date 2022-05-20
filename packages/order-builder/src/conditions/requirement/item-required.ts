import { Order } from '../../core/order';
import { Condition } from '../typings';
import { Requirement, RequirementDescription } from './typings';

type ItemRequiredInput = {
  id: string;
  quantity: number;
};

export class ItemRequired implements Condition<RequirementDescription<ItemRequiredInput>> {
  readonly type = Requirement.ITEM;
  readonly items: ItemRequiredInput[];

  /**
   * Item requirement condition
   * @description To check whether an order has all given items.
   * @param {ItemRequiredInput|String} item ItemRequiredInput | String
   */
  constructor(item: ItemRequiredInput | string);
  /**
   * Item requirement condition
   * @description To check whether an order has all given items.
   * @param {Array} items (ItemRequiredInput | String)[]
   */
  constructor(items: (ItemRequiredInput | string)[]);
  constructor(arg0: (ItemRequiredInput | string) | (ItemRequiredInput | string)[]) {
    const items = Array.isArray(arg0) ? arg0 : [arg0];

    this.items = items.map(item =>
      typeof item === 'string' ? { id: item, quantity: 1 } : item
    );
  }

  satisfy(order: Order) {
    const orderItemMap = new Map<string, ItemRequiredInput>(
      order?.items.map(item => [item.id, item])
    );

    return this.items.every(
      item => (orderItemMap.get(item.id)?.quantity || -1) >= item.quantity
    );
  }
}
