import { Decimal } from 'decimal.js';

/**
 * a + b
 * @param a Number
 * @param b Number
 * @returns Number
 * @example
 * 1.1 + 0.1 // 1.2
 */
export function plus(a: number, b: number): number {
  const aD = new Decimal(a);
  const bD = new Decimal(b);

  return aD.plus(bD).toNumber();
}

/**
 * a - b
 * @param a Number
 * @param b Number
 * @returns Number
 * @example
 * 0.3 - 0.1 // 0.2
 */
export function minus(a: number, b: number): number {
  const aD = new Decimal(a);
  const bD = new Decimal(b);

  return aD.minus(bD).toNumber();
}

/**
 * a * b
 * @param a Number
 * @param b Number
 * @returns Number
 * @example
 * 200.30 * 3 // 600.9
 */
export function times(a: number, b: number): number {
  const aD = new Decimal(a);
  const bD = new Decimal(b);

  return aD.times(bD).toNumber();
}

/**
 * a / b
 * @param a Number
 * @param b Number
 * @returns Number
 * @example
 * 600.90 / 3 // 200.3
 */
export function divided(a: number, b: number): number {
  const aD = new Decimal(a);
  const bD = new Decimal(b);

  return aD.dividedBy(bD).toNumber();
}

/**
 * a / b
 * @param a Number
 * @param b Number
 * @returns Number
 * @example
 * pow(2, 3) // 2^3 = 8
 */
export function pow(a: number, b: number): number {
  const aD = new Decimal(a);
  const bD = new Decimal(b);

  return aD.pow(bD).toNumber();
}

/**
 * Round
 * @param num Number
 * @param digitAfterDecimalPoint Number - `Int`
 * @returns Number
 * @example
 * round(12.456, 2) -> 12.46
 * round(12.456, 0) -> 12
 * round(12.456, 1) -> 12.5
 */
export function round(num: number, digitAfterDecimalPoint: number): number {
  if (!Number.isInteger(digitAfterDecimalPoint)) {
    throw new Error(`${digitAfterDecimalPoint} is not an integer number.`);
  }

  if (digitAfterDecimalPoint === 0) return Math.round(num);

  const multiplier = pow(10, digitAfterDecimalPoint);

  return divided(Math.round(times(num, multiplier)), multiplier);
}
