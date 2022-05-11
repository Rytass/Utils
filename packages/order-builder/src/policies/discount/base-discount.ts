import { Order } from '../../core/order';
import { Condition } from '../../conditions';
import { Policy } from '../typings';
import { Discount, PolicyDiscountDescription } from './typings';

/**
 * Implement this abstract class to create a new Discount variant.
 */
export abstract class BaseDiscount
  implements Policy<PolicyDiscountDescription>
{
  readonly type!: Discount;
  readonly id?: string;
  readonly value!: number;
  readonly conditions!: Condition[];
  valid!: (order: Order) => boolean;
  discount!: (..._: any[]) => number;
  description!: (..._: any[]) => PolicyDiscountDescription;
  resolve!: <PolicyDiscountDescription>(
    ..._: any[]
  ) => PolicyDiscountDescription[];
}
