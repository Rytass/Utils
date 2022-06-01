import { Policies, Policy, PolicyDiscountDescription } from '../../policies';
import { Order } from '../order';

/**
 * DiscountMethodType
 * @description
 * `PRICE_WEIGHTED_AVERAGE` Will split out the discount based on price-weighted rate.
 * @description
 * `QUANTITY_WEIGHTED_AVERAGE` Will split out the discount based on quantity-weighted rate.
 */
export type DiscountMethodType = 'PRICE_WEIGHTED_AVERAGE' | 'QUANTITY_WEIGHTED_AVERAGE';

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
 * `EVERY_CALCULATION` Will round the order-value in every-calculation.
 * @description
 * `FINAL_PRICE_ONLY` Will round the order-value in final-price only.
 * @description
 * `NO_ROUND` Will never round the order-value.
 */
export type RoundStrategyType = 'EVERY_CALCULATION' | 'FINAL_PRICE_ONLY' | 'NO_ROUND';

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
 * `ORDER_BASED` Choose one lowest-discount policy from a `policies` iteration and applied it on matched-items.
 * @description
 * `ITEM_BASED` Choose the best combination from permutations of a `policies` iteration based on item respectively. (Optimal Solution)
 */
export type PolicyPickStrategyType = 'ORDER_BASED' | 'ITEM_BASED' | 'KNAPSACK';

/**
 * PickStrategy
 */
export interface PolicyPickStrategy {
  readonly type: PolicyPickStrategyType;
  pick(
    order: Order,
    policies: Policies,
    ..._:any[]
  ): PolicyDiscountDescription[];
  pickOne(
    order: Order,
    policy: Policy,
    ..._:any[]
  ): PolicyDiscountDescription[];
  pickMulti(
    order: Order,
    policies: Policy[],
    ..._:any[]
  ): PolicyDiscountDescription[];
}
