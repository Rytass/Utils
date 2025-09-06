import { Order } from '../../core/order';
import { Condition } from '../../conditions';
import { Policy, PolicyPrefix } from '../typings';
import { Discount, DiscountOptions, PolicyDiscountDescription } from './typings';
import { FlattenOrderItem } from '../../core';

/**
 * Implement this abstract class to create a new Discount variant.
 */
export abstract class BaseDiscount implements Policy<PolicyDiscountDescription> {
  readonly type!: Discount;
  readonly prefix!: PolicyPrefix;
  readonly id!: string;
  readonly value!: number;
  readonly conditions!: Condition[];
  readonly options?: DiscountOptions;
  matchedItems!: (order: Order) => FlattenOrderItem[];
  valid!: (order: Order) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  discount!: (..._: any[]) => number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  description!: (..._: any[]) => PolicyDiscountDescription;
  resolve!: <PolicyDiscountDescription>(
    order: Order,
    descriptions: PolicyDiscountDescription[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ..._: any[]
  ) => PolicyDiscountDescription[];
}
