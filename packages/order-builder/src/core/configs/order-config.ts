import { FinalPriceOnlyRoundStrategy, EveryCalculationRoundStrategy, NoRoundRoundStrategy } from './round-strategy';
import { QuantityWeightedAverageDiscountMethod, PriceWeightedAverageDiscountMethod } from './discount-method';
import { ItemBasedPolicyPickStrategy, OrderBasedPolicyPickStrategy } from './policy-pick-strategy';
import { DiscountMethod, DiscountMethodType, PolicyPickStrategy, PolicyPickStrategyType, RoundPrecision, RoundStrategy, RoundStrategyType } from './typings';

export type OrderConfigConstructor = OrderConfigOption | OrderConfig;

export interface OrderConfigOption {
  /**
   * Strategy to determinate how to pick the `best-solution` in each `policies` iteration.
   * @description
   * `ORDER_BASED` Choose the **lowest-discount policy** and applied it on matched-items from a `policies` iteration.
   * @description
   * `ITEM_BASED` Choose the **lowest-discount-combination** decided by different items respectively from all the permutations of a `policies` iteration. (Discount Optimal Solution)
   * @default "ITEM_BASED"
   */
  policyPickStrategy: PolicyPickStrategyType;
  /**
   * Strategy to determinate how `policy-discount` will be splitted into matched-items.
   * @param discountMethod DiscountMethodType
   * @default "PRICE_WEIGHTED_AVERAGE"
   */
  discountMethod: DiscountMethodType;
  /**
   * Strategy to determinate whether and how to rounding the calculated number on order-builder.
   * @param roundStrategy RoundStrategyType | [RoundStrategyType, RoundPrecision]
   * @description `strategy` | `[strategy, precision]`
   * @default strategy "EVERY_CALCULATION"
   * @default precision 0
   */
  roundStrategy: RoundStrategyType | [RoundStrategyType, RoundPrecision];
}

/**
 * Configuration of OrderBuilder.
 */
export class OrderConfig {
  readonly discountMethod: DiscountMethod;
  readonly policyPickStrategy: PolicyPickStrategy;
  readonly roundStrategy: RoundStrategy;

  constructor(config?: OrderConfigConstructor) {
    // Discount method.
    this.discountMethod = config instanceof OrderConfig
      ? config.discountMethod
      : (() => {
      switch (config?.discountMethod) {
        case 'QUANTITY_WEIGHTED_AVERAGE':
          return new QuantityWeightedAverageDiscountMethod();
        case 'PRICE_WEIGHTED_AVERAGE':
        default:
          return new PriceWeightedAverageDiscountMethod();
      }
    })();

    // PolicyPick strategy.
    this.policyPickStrategy = config instanceof OrderConfig
      ? config.policyPickStrategy
      : (() => {
        switch (config?.policyPickStrategy) {
          case 'ORDER_BASED':
            return new OrderBasedPolicyPickStrategy();
          case 'ITEM_BASED':
          default:
            return new ItemBasedPolicyPickStrategy();
          }
      })();

    // Round strategy.
    this.roundStrategy = config instanceof OrderConfig
      ? config.roundStrategy
      : (() => {
        const [
          roundStrategy,
          precision,
        ] = config?.roundStrategy && Array.isArray(config.roundStrategy)
          ? config.roundStrategy as [RoundStrategyType, RoundPrecision]
          : [config?.roundStrategy || 'EVERY_CALCULATION', 0] as [RoundStrategyType, RoundPrecision];

        switch (roundStrategy) {
          case 'NO_ROUND':
            return new NoRoundRoundStrategy(precision);
          case 'FINAL_PRICE_ONLY':
            return new FinalPriceOnlyRoundStrategy(precision);
          case 'EVERY_CALCULATION':
          default:
            return new EveryCalculationRoundStrategy(precision);
        }
      })();
  }
}
