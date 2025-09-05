/**
 * Cartesian Product
 * @link https://en.wikipedia.org/wiki/Cartesian_product
 */
export class CartesianProduct<T> {
  /**
   * Common iterator
   */
  [Symbol.iterator](): Generator<NonNullable<T>[]> {
    return (function* (it, len): Generator<NonNullable<T>[]> {
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

  constructor(...args: Iterable<T>[]) {
    this.seed = args.map(v => [...v]);
    this.size = this.seed.length;
    this.length = this.seed.reduce((a, v) => a * v.length, 1);
    Object.freeze(this);
  }

  nth(n: number): NonNullable<T>[] {
    let bn = Number(n);
    const result: NonNullable<T>[] = [];

    for (let i = 0; i < this.size; i++) {
      const base = this.seed[i].length;
      const bb = base;
      const bd = bn % bb;
      const element = this.seed[i][bd];

      if (element !== undefined && element !== null) {
        result.push(element as NonNullable<T>);
      }

      bn -= bd;
      bn /= bb;
    }

    return result;
  }

  /**
   * returns `[...this]`.
   */
  toArray(): NonNullable<T>[][] {
    return [...this] as NonNullable<T>[][];
  }

  forEach(cb: (iter: NonNullable<T>[]) => void): void {
    let pointer;

    for (let i = 0; i < this.length; i++) {
      pointer = this.nth(i);

      if (pointer.length > 0) {
        cb(pointer);
      }
    }
  }
}
