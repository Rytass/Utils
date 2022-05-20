import { Condition } from '../typings';
import { ObjRecord } from './../../typings';
import { Order } from '../../core/order';
import { FlattenOrderItem, OrderItem } from '../../core/typings';
import { Requirement, RequirementDescription } from './typings';
import { minus, plus } from '../../utils/decimal';

type ItemIncludedScope<T extends ObjRecord = ObjRecord> = keyof T;
type OmitItemIncludeScope<O extends OrderItem> = Omit<O, 'conditionRef' | 'unitPrice' | 'quantity'>;

export class ItemIncluded
  <Item extends OrderItem = OrderItem>
  implements Condition<RequirementDescription>
{
  readonly type = Requirement.QUANTITY;
  readonly items: string[];
  readonly threshold: number;
  readonly conditions: Condition[];
  private readonly scope: keyof Item;

  /**
   * Item included condition.
   * @description Filter the items scope, and activate policy in the filtered scope.
   * @param {Object} itemIncludedInput Object
   */
  constructor(itemIncludedInput: {
    items: string[],
    threshold?: number,
    scope?: ItemIncludedScope<OmitItemIncludeScope<Item>>,
    conditions?: Condition[]
  }) {
    this.items = itemIncludedInput.items;
    this.threshold = itemIncludedInput.threshold || 1;
    this.scope = itemIncludedInput.scope || 'id' as keyof Item;
    this.conditions = itemIncludedInput.conditions || [];
  }

  matchedItems<I extends OrderItem = Item>(order: Order<I>): FlattenOrderItem<I>[] {
    if (this.items.length  < 1) return [];

    const scope = this.scope as string;

    const validItemClusterMap = new Set(this.items);

    return order.itemManager.flattenItems.reduce((matchedItems: FlattenOrderItem<I>[], item) => (
      item?.[scope]
      && validItemClusterMap.has(item[scope])
      && minus( // is not out of stock.
        item.unitPrice,
        order.itemManager.collectionMap.get(item.uuid)?.discountValue || 0) > 0
        ? [
          ...matchedItems,
          item,
        ]
        : matchedItems
    ), [] as FlattenOrderItem<I>[]);
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
