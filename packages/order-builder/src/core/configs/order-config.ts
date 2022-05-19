import { DiscountMethod, DiscountMethodType, RoundPrecision, RoundStrategy, RoundStrategyType } from './typings';
import { EveryCalculationRoundStrategy } from './every-calculation-round-strategy.config';
import { PriceWeightedAverageDiscountMethod } from './price-weighted-average-discount-method.config';
import { QuantityWeightedAverageDiscountMethod } from './quantity-weighted-average-discount-method.config';
import { FinalPriceOnlyRoundStrategy } from './final-price-only-round-strategy.config';
import { NoRoundRoundStrategy } from './no-round-round-strategy.config';

export type OrderConfigConstructor = OrderConfigOption | OrderConfig;

export interface OrderConfigOption {
  /**
   * Strategy to determinate how `policy-discount` will be splitted into matched-items.
   * @param discountMethod DiscountMethodType
   */
  discountMethod: DiscountMethodType;
  /**
   * Strategy to determinate whether and how to rounding the calculated number on order-builder.
   * @param roundStrategy RoundStrategyType | [RoundStrategyType, RoundPrecision]
   * @description `strategy` | `[strategy, precision]`
   * @default precision 0
   */
  roundStrategy: RoundStrategyType | [RoundStrategyType, RoundPrecision];
}

/**
 * Configuration of OrderBuilder.
 */
export class OrderConfig {
  readonly discountMethod: DiscountMethod;
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
