import { Condition } from '../conditions';
import { Order } from '../order-builder';
import { Policy, PolicyResult } from './typings';
import { minus, times } from '../utils/decimal';

export enum Discount {
  BASE = 'BASE',
  PERCENTAGE = 'PERCENTAGE',
  VALUE = 'VALUE',
}

export type PolicyDiscountDescription = PolicyResult<{
  type: Discount;
  value: number;
  discount: number;
  conditions: Condition[];
}>;
class DiscountOptions {
  id!: string;
}

export abstract class BaseDiscount implements Policy<PolicyDiscountDescription> {
  readonly type!: Discount;
  readonly id?: string;
  readonly value!: number;
  readonly conditions!: Condition[];
  valid!: (o: Order) => boolean;
  discount!: (..._:any[]) => number;
  description!: (..._:any[]) => PolicyDiscountDescription;
  resolve!: <PolicyDiscountDescription>(..._:any[]) => PolicyDiscountDescription[];
}

/** @param {Number} value `fixed-discount` */
export class ValueDiscount implements BaseDiscount {
  readonly type = Discount.VALUE;
  readonly id?: string;
  readonly value: number;
  readonly conditions: Condition[];

  /**
   * @param {Number} value discount-policy value
   * @param {Array} conditions Condition[]
   * @param {DiscountOptions} options DiscountOptions
   * @returns {PolicyDiscountResult} PolicyDiscountResult
   */
   constructor(
    value: number,
    conditions: Condition[],
    options?: DiscountOptions
  );
  /**
   * @param {Number} value discount-policy value
   * @param {DiscountOptions} options DiscountOptions
   * @returns {PolicyDiscountResult} PolicyDiscountResult
   */
  constructor(value: number, options: DiscountOptions);
  /**
   * @param {Number} value discount-policy value
   * @returns {PolicyDiscountResult} PolicyDiscountResult
   */
  constructor(value: number);
  constructor(
    value: number,
    arg1?: DiscountOptions | Condition[],
    arg2?: DiscountOptions
  ) {
    this.id = Array.isArray(arg1) ? arg2?.id : arg1?.id;
    this.value = value;
    this.conditions = Array.isArray(arg1) ? [...arg1] : [];
  }

  valid(order: Order) {
    if (!this.conditions.length) return true;

    return this.conditions.every(condition => condition.resolve?.(order));
  }

  discount() {
    return this.value;
  }

  description() {
    return {
      id: this.id || '',
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

/**
 * @param {Number} value `percentage-discount rate`
 * @description `value: 0.8` <-> `20% off`
 */
export class PercentageDiscount implements BaseDiscount {
  readonly type = Discount.PERCENTAGE;
  readonly id?: string;
  readonly value: number;
  readonly conditions: Condition[];

  /**
   * @param {Number} value discount-policy value
   * @param {Array} conditions Condition[]
   * @param {DiscountOptions} options DiscountOptions
   * @returns {PolicyDiscountResult} PolicyDiscountResult
   */
   constructor(
    value: number,
    conditions: Condition[],
    options?: DiscountOptions
  );
  /**
   * @param {Number} value discount-policy value
   * @param {DiscountOptions} options DiscountOptions
   * @returns {PolicyDiscountResult} PolicyDiscountResult
   */
  constructor(value: number, options: DiscountOptions);
  /**
   * @param {Number} value discount-policy value
   * @returns {PolicyDiscountResult} PolicyDiscountResult
   */
  constructor(value: number);
  constructor(
    value: number,
    arg1?: DiscountOptions | Condition[],
    arg2?: DiscountOptions
  ) {
    this.id = Array.isArray(arg1) ? arg2?.id : arg1?.id;
    this.value = value;
    this.conditions = Array.isArray(arg1) ? [...arg1] : [];
  }

  valid(order: Order) {
    if (!this.conditions.length) return true;

    return this.conditions.every(condition => condition.resolve?.(order));
  }

  description(itemValue: number) {
    return {
      id: this.id || '',
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

  discount(price: number) {
    return times(price, minus(1, this.value));
  }
}
