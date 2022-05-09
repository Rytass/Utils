import { Policy, PolicyResult } from './typings';
import { Condition } from '../conditions';
import { minus, times } from '../utils/decimal';
import { Order } from '../order-builder';

export enum Discount {
  PERCENTAGE = 'PERCENTAGE',
  VALUE = 'VALUE',
}

type PP<C extends Condition<any> = Condition<any>> = {
  type: Discount;
  value: number;
  discount: number;
  conditions: C[];
};

export type PolicyDiscountDescription = PolicyResult<PP>;

export interface PolicyDiscountResult extends Policy<PolicyDiscountDescription> {
  discount(...p: any[]): number;
  description(p: number, o?: Order): PolicyDiscountDescription;
}

class DiscountOptions<ID extends string = string> {
  id!: ID;
}

export abstract class BaseDiscount implements PolicyDiscountResult {
  id?: string;
  type!: Discount;
  private _order: Order | undefined;
  private _value: number;
  private _conditions: Condition[];

  constructor(
    value: number,
    conditions: Condition[],
    options?: DiscountOptions,
  );
  constructor(value: number, options: DiscountOptions);
  constructor(value: number);
  constructor(
    value: number,
    arg1?: DiscountOptions | Condition[],
    arg2?: DiscountOptions,
  ) {
    this.id = !Array.isArray(arg1) ? arg1?.id : arg2?.id;
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
      id: this?.id || '',
      value: this.value,
      type: this.type,
      discount: this.discount(price),
      conditions: this.conditions,
    };
  }

  resolve(
    order: Order,
    policies: PolicyDiscountDescription[],
  ): PolicyDiscountDescription[] {
    const num = order.getItemsValue();

    if (this.valid(order)) {
      return [
        ...policies,
        this.description(num),
      ]
    }

    return policies;
  }
}

export class ValueDiscount extends BaseDiscount {
  type = Discount.VALUE;
}

export class PercentageDiscount extends BaseDiscount {
  type = Discount.PERCENTAGE;

  discount(price: number) {
    return times(price, minus(1, this.value))
  }
}
