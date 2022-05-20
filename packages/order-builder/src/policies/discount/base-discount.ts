import { Order } from '../../core/order';
import { Condition } from '../../conditions';
import { Policy, PolicyPrefix } from '../typings';
import { Discount, DiscountOptions, PolicyDiscountDescription } from './typings';

/**
 * Implement this abstract class to create a new Discount variant.
 */
export abstract class BaseDiscount
  implements Policy<PolicyDiscountDescription>
{
  readonly type!: Discount;
  readonly prefix!: PolicyPrefix;
  readonly id!: string;
  readonly value!: number;
  readonly conditions!: Condition[];
  readonly options?: DiscountOptions;
  valid!: (order: Order) => boolean;
  discount!: (..._: any[]) => number;
  description!: (..._: any[]) => PolicyDiscountDescription;
  resolve!: <PolicyDiscountDescription>(
    order: Order,
    descriptions: PolicyDiscountDescription[],
    ..._: any[]
  ) => PolicyDiscountDescription[];
}
