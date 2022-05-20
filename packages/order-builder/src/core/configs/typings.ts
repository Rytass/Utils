import { PolicyDiscountDescription } from '../../policies';
import { Order } from '../order';

/**
 * DiscountMethodType
 */
export type DiscountMethodType = 'PRICE_WEIGHTED_AVERAGE' | 'QUANTITY_WEIGHTED_AVERAGE';

/**
 * DiscountMethod
 */
export interface DiscountMethod {
  readonly type: DiscountMethodType;
  calculateDiscounts(order: Order): PolicyDiscountDescription[];
}

/**
 * RoundStrategyType
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
