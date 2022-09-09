import { RoundPrecision, RoundStrategy, RoundStrategyType } from '../typings';
import { round } from '../../../utils/decimal';

/**
 * EveryCalculationRoundStrategy.
 */
export class EveryCalculationRoundStrategy implements RoundStrategy {
  readonly type: RoundStrategyType = 'every-calculation';
  readonly precision: RoundPrecision;

  constructor(precision: RoundPrecision) {
    this.precision = precision;
  }

  round(num: number, canActive: RoundStrategyType): number;
  round(num: number, canActive: RoundStrategyType[]): number;
  round(num: number, canActive: RoundStrategyType | RoundStrategyType[]): number {
    const canActives = Array.isArray(canActive) ? canActive : [canActive];

    return canActives.includes(this.type)
      ? round(num, this.precision)
      : num;
  }
}
