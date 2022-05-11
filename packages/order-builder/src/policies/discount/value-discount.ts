import { BaseDiscount } from './base-discount';
import { Condition } from '../../conditions';
import { Discount, DiscountOptions } from './typings';
import { Order } from '../../core/order';
import { generateNewPolicyId } from '../utils';

/**
 * A policy on `discounting a fixed value` on itemValue
 * @param {Number} value `Fixed` number
 * @returns {Policy} Policy
*/
export class ValueDiscount implements BaseDiscount {
  readonly type = Discount.VALUE;
  readonly id: string;
  readonly value: number;
  readonly conditions: Condition[];

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
    this.id = (Array.isArray(arg1)? arg2?.id : arg1?.id) || generateNewPolicyId();
    this.value = value;
    this.conditions = Array.isArray(arg1)
      ? arg1
      : typeof (arg1 as Condition)?.satisfy === 'function' ? [arg1 as Condition] : [];
  }

  valid(order: Order) {
    if (!this.conditions.length) return true;

    return this.conditions.every(condition => condition.satisfy?.(order));
  }

  discount() {
    return this.value;
  }

  description() {
    return {
      id: this.id,
      value: this.value,
      type: this.type,
      discount: this.discount(),
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
        this.description(),
      ] as PolicyDiscountDescription[];
    }

    return policies as PolicyDiscountDescription[];
  }
}
