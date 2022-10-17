import { Condition } from '../../conditions';
import { FlattenOrderItem } from '../../core';
import { Order } from '../../core/order';
import { minus, plus, times } from '../../utils/decimal';
import { PolicyPrefix } from '../typings';
import { generateNewPolicyId } from '../utils';
import { BaseDiscount } from './base-discount';
import {
  Discount,
  DiscountOptions,
  PolicyDiscountDescription,
} from './typings';
import {
  getConditionsByDiscountConstructor,
  getOnlyMatchedItems,
  getOptionsByDiscountConstructor,
  getOrderItems,
} from './utils';

/**
 * A policy on `discounting a percentage value` on itemValue.
 * @param {Number} value `percentage-discount rate` number
 * @description `value: 0.8` <-> `20% off`
 * @description 0 ≤ value ≤ 1
 */
export class PercentageDiscount implements BaseDiscount {
  readonly prefix = PolicyPrefix.DISCOUNT;
  readonly type = Discount.PERCENTAGE;
  readonly id: string;
  readonly value: number;
  readonly conditions: Condition[];
  readonly options?: DiscountOptions;

  /**
   * @param {Number} value discount-policy value
   * @param {Array} conditions Condition[]
   * @param {DiscountOptions} options DiscountOptions
   * @returns {Policy} Policy
   */
  constructor(
    value: number,
    conditions: Condition[],
    options?: DiscountOptions
  );
  /**
   * @param {Number} value discount-policy value
   * @param {Condition} condition Condition
   * @param {DiscountOptions} options DiscountOptions
   * @returns {Policy} Policy
   */
  constructor(value: number, condition: Condition, options?: DiscountOptions);
  /**
   * @param {Number} value discount-policy value
   * @param {DiscountOptions} options DiscountOptions
   * @returns {Policy} Policy
   */
  constructor(value: number, options: DiscountOptions);
  /**
   * @param {Number} value discount-policy value
   * @returns {Policy} Policy
   */
  constructor(value: number);
  constructor(
    value: number,
    arg1?: DiscountOptions | Condition | Condition[],
    arg2?: DiscountOptions
  ) {
    // To check value boundary. 0 ≤ value ≤ 1
    if (value < 0 || value > 1) {
      throw new Error('Invalid percentage value.');
    }

    this.options = getOptionsByDiscountConstructor(arg1, arg2);
    this.id = this.options?.id || generateNewPolicyId();
    this.value = value;
    this.conditions = getConditionsByDiscountConstructor(arg1);
  }

  matchedItems(order: Order): FlattenOrderItem[] {
    return this.options?.onlyMatched
      ? getOnlyMatchedItems(order, this.conditions)
      : getOrderItems(order);
  }

  valid(order: Order): boolean {
    return this.conditions.length
      ? this.conditions.every(condition => condition.satisfy?.(order))
      : true;
  }

  /**
   * Calculate discount price.
   * @param {Number} price number
   * @example
   * ```
   * new PercentageDiscount(0.8).discount(100); // 100 * (1 - 0.8) = 20;
   * ```
   * @returns {Number} number
   */
  discount(price: number): number {
    return this.options?.excludedInCalculation
    ? 0
    : times(price, minus(1, this.value));
  }

  description(
    order: Order,
    itemValue: number,
    appliedItems: FlattenOrderItem[]
  ): PolicyDiscountDescription {
    return {
      id: this.id,
      value: this.value,
      type: this.type,
      discount: order.config.roundStrategy.round(this.discount(itemValue), [
        'final-price-only',
        'every-calculation',
      ]),
      conditions: this.conditions,
      appliedItems,
      matchedTimes: 1,
      policy: this,
    };
  }

  resolve<PolicyDiscountDescription>(
    order: Order,
    policies: PolicyDiscountDescription[]
  ): PolicyDiscountDescription[] {
    if (this.valid(order)) {
      const matchedItems: FlattenOrderItem[] = this.matchedItems(order);

      const itemValue = order.config.roundStrategy.round(
        matchedItems.reduce((total, item) => plus(total, item.unitPrice), 0),
        'every-calculation'
      );

      policies.push(
        this.description(
          order,
          itemValue,
          matchedItems
        ) as PolicyDiscountDescription
      );
    }

    return policies;
  }
}
