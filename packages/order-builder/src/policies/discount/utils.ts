import { Condition } from '../../conditions';
import { FlattenOrderItem } from '../../core';
import { Order } from '../../core/order';
import { Policy, PolicyPrefix } from '../typings';
import { BaseDiscount } from './base-discount';
import { DiscountOptions } from './typings';

export function isDiscountPolicy(policy: Policy) {
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
  return conditions.reduce((items, condition) => {
    if (typeof condition?.matchedItems === 'function') {
      return [...items, ...condition.matchedItems(order)];
    }

    return items;
  }, [] as FlattenOrderItem[]);
}
