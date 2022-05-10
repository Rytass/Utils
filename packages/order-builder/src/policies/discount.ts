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

export interface PolicyDiscountResult
  extends Policy<PolicyDiscountDescription> {
  discount(...p: any[]): number;
  description(p: number, o?: Order): PolicyDiscountDescription;
}

class DiscountOptions<ID extends string = string> {
  id!: ID;
}

export abstract class BaseDiscount implements PolicyDiscountResult {
  type: Discount = Discount.BASE;
  readonly id?: string;
  private readonly _value: number;
  private readonly _conditions: Condition[];

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
    this._value = value;
    this._conditions = Array.isArray(arg1) ? [...arg1] : [];
  }

  get value() {
    return this._value;
  }

  get conditions() {
    return this._conditions;
  }

  valid(o: Order) {
    if (!this.conditions.length) return true;

    return this.conditions.every(condition => condition.resolve?.(o));
  }

  discount(_: number): number {
    return this.value;
  }

  description(price: number) {
    return {
      id: this.id || '',
      value: this.value,
      type: this.type,
      discount: this.discount(price),
      conditions: this.conditions,
    };
  }

  resolve<PolicyDiscountDescription>(
    order: Order,
    policies: PolicyDiscountDescription[]
  ): PolicyDiscountDescription[] {
    const num = order.itemValue;

    if (this.valid(order)) {
      return [
        ...policies,
        this.description(num),
      ] as PolicyDiscountDescription[];
    }

    return policies as PolicyDiscountDescription[];
  }
}

/** @param {Number} value `fixed-discount` */
export class ValueDiscount extends BaseDiscount {
  readonly type = Discount.VALUE;
}

/**
 * @param {Number} value `percentage-discount rate`
 * @description `value: 0.8` <-> `20% off`
 */
export class PercentageDiscount extends BaseDiscount {
  readonly type = Discount.PERCENTAGE;

  discount(price: number) {
    return times(price, minus(1, this.value));
  }
}
