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
  const aD = new Decimal(a)
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
  const aD = new Decimal(a)
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
  const aD = new Decimal(a)
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
  const aD = new Decimal(a)
  const bD = new Decimal(b);

  return aD.dividedBy(bD).toNumber();
}
