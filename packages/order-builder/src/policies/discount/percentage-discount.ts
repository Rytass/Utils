import { BaseDiscount } from './base-discount';
import { Condition } from '../../conditions';
import { Discount, DiscountOptions } from './typings';
import { Order } from '../../core/order';
import { generateNewPolicyId } from '../utils';
import { minus, times } from '../../utils/decimal';

/**
 * A policy on `discounting a percentage value` on itemValue.
 * @param {Number} value `percentage-discount rate` number
 * @description `value: 0.8` <-> `20% off`
 * @description 0 ≤ value ≤ 1
 */
export class PercentageDiscount implements BaseDiscount {
  readonly type = Discount.PERCENTAGE;
  readonly id: string;
  readonly value: number;
  readonly conditions: Condition[];

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
   constructor(
    value: number,
    condition: Condition,
    options?: DiscountOptions
  );
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
      throw new Error('Invalid percentage-discount value.')
    }

    this.id = (Array.isArray(arg1) ? arg2?.id : arg1?.id) || generateNewPolicyId();
    this.value = value;
    this.conditions = Array.isArray(arg1) ? arg1 : [];
  }

  valid(order: Order) {
    if (!this.conditions.length) return true;

    return this.conditions.every(condition => condition.satisfy?.(order));
  }

  description(itemValue: number) {
    return {
      id: this.id,
      value: this.value,
      type: this.type,
      discount: this.discount(itemValue),
      conditions: this.conditions,
    };
  }

  resolve<PolicyDiscountDescription>(
    order: Order,
    policies: PolicyDiscountDescription[]
  ) {
    if (this.valid(order)) {
      return [
        ...policies,
        this.description(order.itemValue),
      ] as PolicyDiscountDescription[];
    }

    return policies as PolicyDiscountDescription[];
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
  discount(price: number) {
    return times(price, minus(1, this.value));
  }
}
