export class OrderCalculator {
  static countDecimals(v: number) {
    return Number((() => {
        if (
            Math.floor(v.valueOf()) === v.valueOf() ||
            v % 1 == 0
          ) return 0;

          const str = Math.abs(v).toString();

          if (str.indexOf('.') !== -1 && str.indexOf('-') !== -1) {
              return str.split('-')[1];
          } else if (str.indexOf('.') !== -1) {
              return str.split('.')[1]?.length;
          }

          return str.split('-')[1];
    })() || 0)
  }

  /**
   * get the bigger decimal length factor and create a 10 based power multiplier.
   * @param a Number
   * @param b Number
   * @returns Number
   * @example
   * multiplier(1.23, 1.3450) // 10^4 = 10000
   */
  static multiplier(a: number, b: number) {
    return Math.pow(
      10,
      Math.max(this.countDecimals(a), this.countDecimals(b)),
    );
  }

  /**
   * a + b
   * @param a Number
   * @param b Number
   * @returns Number
   * @example
   * 1.1 + 0.1 // 1.2
   */
  static plus(a: number, b: number) {
    const m = this.multiplier(a, b);

    return ((a * m) + (b * m)) / m;
  }

  /**
   * a - b
   * @param a Number
   * @param b Number
   * @returns Number
   * @example
   * 0.3 - 0.1 // 0.2
   */
  static minus(a: number, b: number) {
    const m = this.multiplier(a, b);

    return ((a * m) - (b * m)) / m;
  }

  /**
   * a * b
   * @param a Number
   * @param b Number
   * @returns Number
   * @example
   * 200.30 * 3 // 600.9
   */
  static times(a: number, b: number): number {
    const aIsInt = Number.isInteger(a);
    const bIsInt = Number.isInteger(b);

    if (aIsInt && bIsInt) return a * b;

    const m = this.multiplier(a, b);
    const am = aIsInt ? a : Math.round(a * m);
    const bm = aIsInt && !bIsInt ? Math.round(b * m) : b;

    return (am * bm) / m;
  }

  /**
   * a / b
   * @param a Number
   * @param b Number
   * @returns Number
   * @example
   * 600.90 / 3 // 200.3
   */
   static divided(a: number, b: number) {
    const m = this.multiplier(a, b);

    return (a * m) / (b * m);
  }

  /**
   * @param a Number
   * @param rate Number unit: %
   * @returns Number
   * @example
   * 600.90 / 3 // 200.3
   */
   static discount(a: number, rate: number) {
    const r = this.divided(rate, 100);

    return this.times(a, this.minus(1, r));
  }
}
