import { Condition } from '../../conditions';
import { FlattenOrderItem } from '../../core';
import { Order } from '../../core/order';
import { minus, times } from '../../utils/decimal';
import { Policy, PolicyPrefix } from '../typings';
import { BaseDiscount } from './base-discount';
import { DiscountOptions } from './typings';

export function isDiscountPolicy(policy: Policy): policy is BaseDiscount {
  return policy.prefix === PolicyPrefix.DISCOUNT;
}

export function getConditionsByDiscountConstructor<
Options extends DiscountOptions = DiscountOptions>(
  arg1?: Options | Condition | Condition[]
): BaseDiscount['conditions'] {
  if (Array.isArray(arg1)) return arg1;

  return typeof (arg1 as Condition)?.satisfy === 'function'
    ? [arg1 as Condition]
    : [];
}

export function getOptionsByDiscountConstructor<
Options extends DiscountOptions = DiscountOptions>(
  arg1?: Options | Condition | Condition[],
  arg2?: Options
): Options | undefined {
  if (typeof arg1 === 'undefined' && typeof arg2 === 'undefined') return undefined;
  if (Array.isArray(arg1)) return arg2;

  return typeof (arg1 as Condition)?.satisfy === 'function'
    ? arg2
    : arg1 as Options
}

/** Get only-matched items */
export function getOnlyMatchedItems(
  order: Order,
  conditions: Condition[],
) {
  let hasSubConstrain = false;

  const filteredItems = conditions.reduce((items, condition) => {
    if (typeof condition?.matchedItems === 'function') {
      hasSubConstrain = true;
      condition.matchedItems(order).forEach(item => items.add(item));

      return items;
    }

    return items;
  }, new Set<FlattenOrderItem>());

  return hasSubConstrain && filteredItems.size ? Array.from(filteredItems.values()) : getOrderItems(order);
}

export function getOrderItems(order: Order) {
  return order.itemManager.flattenItems.filter(item => times(
    item.quantity,
    minus(
      item.unitPrice,
      order.parent?.itemManager.collectionMap.get(item.uuid)?.discountValue || 0,
    ),
  ) > 0)
}
