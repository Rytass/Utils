import { FinalPriceOnlyRoundStrategy, EveryCalculationRoundStrategy, NoRoundRoundStrategy } from './round-strategy';
import { QuantityWeightedAverageDiscountMethod, PriceWeightedAverageDiscountMethod } from './discount-method';
import { ItemBasedPolicyPickStrategy, OrderBasedPolicyPickStrategy } from './policy-pick-strategy';
import {
  DiscountMethod,
  DiscountMethodType,
  PolicyPickStrategy,
  PolicyPickStrategyType,
  RoundPrecision,
  RoundStrategy,
  RoundStrategyType,
} from './typings';
import { OrderLogistics } from './../typings';

export type OrderConfigConstructor = OrderConfigOption | OrderConfig;

export interface OrderConfigOption {
  /**
   * Strategy to determinate how to pick the `best-solution` in each `policies` iteration.
   * @description
   * `order-based` Choose the **lowest-discount policy** and applied it on matched-items from a `policies` iteration.
   * @description
   * `item-based` Choose the **lowest-discount-combination** decided by different items respectively from all the permutations of a `policies` iteration. (Discount Optimal Solution)
   * @default "item-based"
   */
  policyPickStrategy: PolicyPickStrategyType;
  /**
   * Strategy to determinate how `policy-discount` will be splitted into matched-items.
   * @param discountMethod DiscountMethodType
   * @default "price-weighted-average"
   */
  discountMethod: DiscountMethodType;
  /**
   * Strategy to determinate whether and how to rounding the calculated number on order-builder.
   * @param roundStrategy RoundStrategyType | [RoundStrategyType, RoundPrecision]
   * @description `strategy` | `[strategy, precision]`
   * @default strategy "every-calculation"
   * @default precision 0
   */
  roundStrategy: RoundStrategyType | [RoundStrategyType, RoundPrecision];
  /**
   * Logistic
   */
  logistics: OrderLogistics;
}

/**
 * Configuration of OrderBuilder.
 */
export class OrderConfig {
  readonly discountMethod: DiscountMethod;
  readonly policyPickStrategy: PolicyPickStrategy;
  readonly roundStrategy: RoundStrategy;
  private _logistics: OrderLogistics | undefined;

  get logistics(): OrderLogistics | undefined {
    return this._logistics;
  }

  constructor(config?: OrderConfigConstructor) {
    // Discount method.
    this.discountMethod =
      config instanceof OrderConfig
        ? config.discountMethod
        : ((): DiscountMethod => {
            switch (config?.discountMethod) {
              case 'quantity-weighted-average':
                return new QuantityWeightedAverageDiscountMethod();
              case 'price-weighted-average':
              default:
                return new PriceWeightedAverageDiscountMethod();
            }
          })();

    // PolicyPick strategy.
    this.policyPickStrategy =
      config instanceof OrderConfig
        ? config.policyPickStrategy
        : ((): PolicyPickStrategy => {
            switch (config?.policyPickStrategy) {
              case 'order-based':
                return new OrderBasedPolicyPickStrategy();
              case 'item-based':
              default:
                return new ItemBasedPolicyPickStrategy();
            }
          })();

    // Round strategy.
    this.roundStrategy =
      config instanceof OrderConfig
        ? config.roundStrategy
        : ((): RoundStrategy => {
            const [roundStrategy, precision] =
              config?.roundStrategy && Array.isArray(config.roundStrategy)
                ? (config.roundStrategy as [RoundStrategyType, RoundPrecision])
                : ([config?.roundStrategy || 'every-calculation', 0] as [RoundStrategyType, RoundPrecision]);

            switch (roundStrategy) {
              case 'no-round':
                return new NoRoundRoundStrategy(precision);
              case 'final-price-only':
                return new FinalPriceOnlyRoundStrategy(precision);
              case 'every-calculation':
              default:
                return new EveryCalculationRoundStrategy(precision);
            }
          })();

    // Logistics
    this._logistics = config?.logistics;
  }

  public updateLogistics(logistics: OrderLogistics): void {
    this._logistics = logistics;
  }
}
