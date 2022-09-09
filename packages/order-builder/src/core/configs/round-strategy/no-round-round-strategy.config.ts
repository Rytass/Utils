import { RoundPrecision, RoundStrategy, RoundStrategyType } from '../typings';

/**
 * NoRoundRoundStrategy.
 */
export class NoRoundRoundStrategy implements RoundStrategy {
  readonly type: RoundStrategyType = 'no-round';
  readonly precision: RoundPrecision;

  constructor(precision: RoundPrecision) {
    this.precision = precision;
  }

  round(num: number, canActive: RoundStrategyType): number;
  round(num: number, canActive: RoundStrategyType[]): number;
  round(num: number, _: RoundStrategyType | RoundStrategyType[]): number {
    return num;
  }
}
