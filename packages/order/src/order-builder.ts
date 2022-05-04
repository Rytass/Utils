import { OrderCalculator } from './order-calculator';
import { OrderManager } from './order-manager';
import { OrderOperation } from './typings';

export class OrderBuilder {
  private _isLocked: boolean = false;
  private _initValue: number;
  private _operations: OrderOperation[] = [];

  constructor(initialValue?: number) {
    this._initValue = initialValue || 0;
  }

  plus(v: number): OrderBuilder {
    if (this._isLocked) return this;

    this._operations.push((originalValue: number) =>
      OrderCalculator.plus(originalValue, v)
    );

    return this;
  }

  minus(v: number): OrderBuilder {
    if (this._isLocked) return this;

    this._operations.push((originalValue: number) =>
      OrderCalculator.minus(originalValue, v)
    );

    return this;
  }

  times(v: number): OrderBuilder {
    if (this._isLocked) return this;

    this._operations.push((originalValue: number) =>
      OrderCalculator.times(originalValue, v)
    );

    return this;
  }

  divided(v: number): OrderBuilder {
    if (this._isLocked) return this;

    this._operations.push((originalValue: number) =>
      OrderCalculator.divided(originalValue, v)
    );

    return this;
  }

  /**
   * Get Current Order Value
   * @returns Number
   */
  getValue(): number {
    return this._operations.reduce((total, cur) => cur(total), this._initValue);
  }

  /**
   * check whether mutate operation queue is locked present.
   */
  get locked() {
    return this._isLocked;
  }

  /**
   * Lock the operations queue;
   * @returns OrderBuilder
   */
  lock(): OrderBuilder {
    this._isLocked = true;

    return this;
  }

  /**
   * UnLock the operations queue;
   * @returns OrderBuilder
   */
  unLock(): OrderBuilder {
    this._isLocked = false;

    return this;
  }

  isGreaterThan(v: number): boolean {
    return this.getValue() > v;
  }

  isGreaterEqualThan(v: number): boolean {
    return this.getValue() >= v;
  }

  isLessThan(v: number): boolean {
    return this.getValue() < v
  }

  isLessEqualThan(v: number): boolean {
    return this.getValue() <= v
  }

  isEqual(v: number): boolean {
    return this.getValue() === v;
  }
}
