import { Order } from '../../core/order';
import { FlattenOrderItem, OrderItem } from '../../core/typings';
import { plus } from '../../utils/decimal';
import { Condition } from '../typings';
import {
  ItemSpecifiedInput,
  ItemSpecifiedResolvedFnInput,
  ItemSpecifiedScopeInput,
  Requirement,
  RequirementDescription,
} from './typings';
import {
  itemIsMatchedItemFn,
  itemSpecifiedItems,
  itemSpecifiedScope,
} from './utils';

export class ItemExcluded<Item extends OrderItem = OrderItem>
  implements Condition<RequirementDescription>
{
  readonly type = Requirement.EXCLUDED;
  readonly items: string[];
  readonly threshold: number;
  readonly conditions: Condition[];
  private readonly scope: (keyof Item)[] | null;
  private readonly itemSet: Set<string> | null;
  private readonly isMatchedItem:
    | ItemSpecifiedResolvedFnInput<any>['isMatchedItem']
    | null;

  /**
   * Item excluded condition.
   * @description Filter the items scope, and activate policy in the filtered scope.
   * @param {Object} itemExcludedInput Object
   */
  constructor(itemExcludedInput: ItemSpecifiedInput<Item>);
  constructor(itemExcludedInput: ItemSpecifiedResolvedFnInput<Item>);
  constructor(itemExcludedInput: ItemSpecifiedScopeInput<Item>);
  constructor(itemExcludedInput: ItemSpecifiedInput<Item>) {
    this.threshold = itemExcludedInput.threshold || 1;
    this.conditions = itemExcludedInput.conditions || [];
    this.isMatchedItem = itemIsMatchedItemFn(itemExcludedInput);
    this.items = itemSpecifiedItems(itemExcludedInput);
    this.scope = itemSpecifiedScope(itemExcludedInput);
    this.itemSet = this.items?.length ? new Set(this.items) : null;
  }

  matchedItems<I extends OrderItem = Item>(
    order: Order<I>
  ): FlattenOrderItem<I>[] {
    if (!this.isMatchedItem && this.items.length < 1) return [];

    return order.itemManager.flattenItems.filter((item) => {
      if (typeof this.isMatchedItem === 'function') {
        return item.unitPrice > 0 && !this.isMatchedItem(item);
      }

      const excludedItem = this.excludedItem(item);

      return item.unitPrice > 0 && excludedItem && !this.itemSet?.has(excludedItem);
    });
  }

  satisfy(order: Order<Item>) {
    const matchedItems = this.matchedItems<Item>(order);

    if (matchedItems.length < 1) return false;

    if (
      this.conditions.length &&
      !this.conditions.every(condition =>
        condition.satisfy(order.subOrder({ subItems: matchedItems }))
      )
    )
      return false;

    return (
      matchedItems.reduce(
        (totalQuantity, item) => plus(totalQuantity, item.quantity),
        0
      ) >= this.threshold
    );
  }

  private excludedItem(item: FlattenOrderItem) {
    const keyName = (this.scope as string[]).find(s => s in item);

    return keyName ? item[keyName] : undefined;
  }
}
