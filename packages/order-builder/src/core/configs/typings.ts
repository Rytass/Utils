import { Policies, Policy, PolicyDiscountDescription } from '../../policies';
import { Order } from '../order';

/**
 * DiscountMethodType
 * @description
 * `price-weighted-average` Will split out the discount based on price-weighted rate.
 * @description
 * `quantity-weighted-average` Will split out the discount based on quantity-weighted rate.
 */
export type DiscountMethodType = 'price-weighted-average' | 'quantity-weighted-average';

/**
 * DiscountMethod
 */
export interface DiscountMethod {
  readonly type: DiscountMethodType;
  handleOneDescription(order: Order, description: PolicyDiscountDescription): void;
  calculateDiscounts(order: Order): PolicyDiscountDescription[];
}

/**
 * RoundStrategyType
 * @description
 * `every-calculation` Will round the order-value in every-calculation.
 * @description
 * `final-price-only` Will round the order-value in final-price only.
 * @description
 * `no-round` Will never round the order-value.
 */
export type RoundStrategyType = 'every-calculation' | 'final-price-only' | 'no-round';

/**
 * RoundPrecision
 */
export type RoundPrecision = number;

/**
 * RoundStrategy
 */
export interface RoundStrategy {
  readonly type: RoundStrategyType;
  readonly precision: RoundPrecision;
  round(num: number, canActive: RoundStrategyType | RoundStrategyType[]): number;
}

/**
 * PickStrategy
 * @description
 * `order-based` Choose one lowest-discount policy from a `policies` iteration and applied it on matched-items.
 * @description
 * `item-based` Choose the best combination from permutations of a `policies` iteration based on item respectively. (Optimal Solution)
 */
export type PolicyPickStrategyType = 'order-based' | 'item-based';

/**
 * PickStrategy
 */
export interface PolicyPickStrategy {
  readonly type: PolicyPickStrategyType;
  pick(order: Order, policies: Policies, ..._: any[]): PolicyDiscountDescription[];
  pickOne(order: Order, policy: Policy, ..._: any[]): PolicyDiscountDescription[];
  pickMulti(order: Order, policies: Policy[], ..._: any[]): PolicyDiscountDescription[];
}
