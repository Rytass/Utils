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
   * multiplier(1.23, 1.3450) // 10^4 = 100001
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
    if (Number.isInteger(a) && Number.isInteger(b)) return a * b;

    const aIsFloat = this.countDecimals(a) > 0;
    const bIsFloat = this.countDecimals(b) > 0;
    const m = this.multiplier(a, b);
    const am = aIsFloat ? Math.round(a * m) : a;
    const bm = !aIsFloat && bIsFloat ? Math.round(b * m) : b;

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

    return ((a * m) / (b * m));
  }
}
