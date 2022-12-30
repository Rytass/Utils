import { plus, times } from '../../utils/decimal';
import { Condition } from '../../conditions';
import { FlattenOrderItem } from '../../core';
import { Order } from '../../core/order';
import { PolicyPrefix } from '../typings';
import { generateNewPolicyId } from '../utils';
import { BaseDiscount } from './base-discount';
import { Discount, DiscountOptions, PolicyDiscountDescription } from './typings';
import { getConditionsByDiscountConstructor, getOnlyMatchedItems, getOptionsByDiscountConstructor, getOrderItems } from './utils';

/**
 * A policy on `discounting a fixed value` on itemValue
 * @param {Number} value `Fixed` number
 * @returns {Policy} Policy
*/
export class ValueDiscount implements BaseDiscount {
  readonly prefix = PolicyPrefix.DISCOUNT;
  readonly type = Discount.VALUE;
  readonly id: string;
  readonly value: number;
  readonly conditions: Condition[];
  readonly options?: DiscountOptions;

  /**
   * @param {Number} value fixed-value number
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
   * @param {Number} value fixed-value number
   * @param {Condition} condition Condition
   * @param {DiscountOptions} options DiscountOptions
   * @returns {Policy} Policy
   */
   constructor(
    value: number,
    condition: Condition,
    options?: DiscountOptions
  );
  /**
   * @param {Number} value fixed-value number
   * @param {DiscountOptions} options DiscountOptions
   * @returns {Policy} Policy
   */
  constructor(value: number, options: DiscountOptions);
  /**
   * @param {Number} value fixed-value number
   * @returns {Policy} Policy
   */
  constructor(value: number);
  constructor(
    value: number,
    arg1?: Condition | Condition[] | DiscountOptions,
    arg2?: DiscountOptions
  ) {
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

  discount(): number {
    return this.options?.excludedInCalculation
      ? 0
      : this.value;
  }

  description(order: Order, appliedItems: FlattenOrderItem[]): PolicyDiscountDescription {
    const maximumDiscountValue = appliedItems.reduce(
      (total, item) => plus(total, times(item.quantity, item.unitPrice)),
      0
    );

    return {
      id: this.id,
      value: this.value,
      type: this.type,
      discount: Math.min(
        maximumDiscountValue,
        order.config.roundStrategy.round(
          this.discount(),
          ['every-calculation', 'final-price-only'],
        ),
      ),
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

      policies.push(this.description(order, matchedItems) as PolicyDiscountDescription);
    }

    return policies;
  }
}
