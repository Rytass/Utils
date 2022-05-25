import { Optional } from './typings';

/**
 * Cartesian Product
 * @link https://en.wikipedia.org/wiki/Cartesian_product
 */
export class CartesianProduct<T> {
  /**
   * Common iterator
   */
  [Symbol.iterator]() {
    return (function* (it, len) {
      for (let i = 0; i < len; i++) yield it.nth(i);
    })(this, this.length);
  }
  /**
   * the seed iterable
   */
  readonly seed: T[][];
  /**
   * the size (# of elements) of each element.
   */
  readonly size: number;
  /**
   * the number of elements
   */
  readonly length: number;

  /**
   * returns `[...this]`.
   */
  toArray(): T[][] {
    return [...this].filter(it => it) as T[][];
  }

  constructor(...args: Iterable<T>[]) {
    this.seed = args.map(v => [...v]);
    this.size = this.seed.length;
    this.length = Number(this.seed.reduce((a, v) => a * Number(v.length), Number(1)));
    Object.freeze(this);
  }

  nth(n: number): Optional<T[]> {
    let bn = Number(n);
    let result = [];

    for (let i = 0; i < this.size; i++) {
      const base = this.seed[i].length;
      const bb = Number(base);
      const bd = bn % bb;

      result.push(this.seed[i][Number(bd)]);
      bn -= bd;
      bn /= bb;
    }

    return result;
  }
}
