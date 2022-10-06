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

export class ItemIncluded<Item extends OrderItem = OrderItem>
  implements Condition<RequirementDescription>
{
  readonly type = Requirement.INCLUDED;
  readonly items: string[];
  readonly threshold: number;
  readonly conditions: Condition[];
  private readonly scope: (keyof Item)[] | null;
  private readonly itemSet: Set<string> | null;
  private readonly isMatchedItem:
    | ItemSpecifiedResolvedFnInput<any>['isMatchedItem']
    | null;

  /**
   * Item included condition.
   * @description Filter the items scope, and activate policy in the filtered scope.
   * @param {Object} itemIncludedInput Object
   */
  constructor(itemIncludedInput: ItemSpecifiedInput<Item>);
  constructor(itemIncludedInput: ItemSpecifiedResolvedFnInput<Item>);
  constructor(itemIncludedInput: ItemSpecifiedScopeInput<Item>);
  constructor(itemIncludedInput: ItemSpecifiedInput<Item>) {
    this.threshold = itemIncludedInput.threshold || 1;
    this.conditions = itemIncludedInput.conditions || [];
    this.isMatchedItem = itemIsMatchedItemFn(itemIncludedInput);
    this.items = itemSpecifiedItems(itemIncludedInput);
    this.scope = itemSpecifiedScope(itemIncludedInput);
    this.itemSet = this.items?.length ? new Set(this.items) : null;
  }

  matchedItems<I extends OrderItem = Item>(
    order: Order<I>
  ): FlattenOrderItem<I>[] {
    if (!this.isMatchedItem && this.items.length < 1) return [];

    return order.itemManager.flattenItems.filter((item) => {
      if (item.unitPrice <= 0) return false; // is not out of stock.

      if (typeof this.isMatchedItem === 'function') {
        return this.isMatchedItem(item);
      }

      const includedItem = this.includedItem(item);

      return includedItem && this.itemSet?.has(includedItem);
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

  private includedItem(item: FlattenOrderItem) {
    const keyName = (this.scope as string[]).find(s => s in item);

    return keyName ? item[keyName] : undefined;
  }
}
