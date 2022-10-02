import { Order } from '../../core/order';
import { FlattenOrderItem, OrderItem } from '../../core/typings';
import { plus } from '../../utils/decimal';
import { Condition } from '../typings';
import { ItemSpecifiedInput, Requirement, RequirementDescription } from './typings';

export class ItemIncluded
  <Item extends OrderItem = OrderItem>
  implements Condition<RequirementDescription>
{
  readonly type = Requirement.INCLUDED;
  readonly items: string[];
  readonly threshold: number;
  readonly conditions: Condition[];
  private readonly scope: keyof Item;
  private readonly itemSet: Set<string>;

  /**
   * Item included condition.
   * @description Filter the items scope, and activate policy in the filtered scope.
   * @param {Object} itemIncludedInput Object
   */
  constructor(itemIncludedInput: ItemSpecifiedInput<Item>) {
    this.items = Array.isArray(itemIncludedInput.items)
      ? itemIncludedInput.items
      : [itemIncludedInput.items];

    this.itemSet = new Set(this.items);
    this.threshold = itemIncludedInput.threshold || 1;
    this.scope = itemIncludedInput.scope || 'id' as keyof Item;
    this.conditions = itemIncludedInput.conditions || [];
  }

  matchedItems<I extends OrderItem = Item>(order: Order<I>): FlattenOrderItem<I>[] {
    if (this.items.length < 1) return [];

    const scope = this.scope as string;

    return order.itemManager.flattenItems.filter(item => (
      item?.[scope]
      && this.itemSet.has(item[scope])
      && item.unitPrice > 0 // is not out of stock.
    ));
  }

  satisfy(order: Order<Item>) {
    const matchedItems = this.matchedItems<Item>(order);

    if (matchedItems.length < 1) return false;

    if (this.conditions.length && !this.conditions.every(condition => (
      condition.satisfy(order.subOrder({ subItems: matchedItems }))
    ))) return false;

    return matchedItems.reduce((totalQuantity, item) => plus(
      totalQuantity,
      item.quantity,
    ), 0) >= this.threshold;
  }
}
