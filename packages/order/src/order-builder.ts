import { OrderCalculator } from './order-calculator';
import { OrderOperation, OrderRecord, OrderRecordBase } from './typings';

export class OrderBuilder<
MessageType extends string = string,
ORT extends OrderRecord<MessageType> = OrderRecord<MessageType>> {
  private _isLocked: boolean = false;
  private _initValue: number;
  private _operations: OrderOperation<MessageType>[] = [];

  constructor(initialValue?: number) {
    this._initValue = initialValue || 0;
  }

  plus(v: number, message?: MessageType): OrderBuilder<MessageType> {
    if (this._isLocked) return this;

    this._operations.push((originalValue: number) =>
      ({
        message,
        originalValue,
        value: v,
        accumulatedValue: OrderCalculator.plus(originalValue, v),
      }) as ORT
    );

    return this;
  }

  minus(v: number, message?: MessageType): OrderBuilder<MessageType> {
    if (this._isLocked) return this;

    this._operations.push((originalValue: number) =>
      ({
        message,
        originalValue,
        value: v,
        accumulatedValue: OrderCalculator.minus(originalValue, v),
      }) as ORT
    );

    return this;
  }

  times(v: number, message?: MessageType): OrderBuilder<MessageType> {
    if (this._isLocked) return this;

    this._operations.push((originalValue: number) =>
      ({
        message,
        originalValue,
        value: v,
        accumulatedValue: OrderCalculator.times(originalValue, v),
      }) as ORT,
    );

    return this;
  }

  divided(v: number, message?: MessageType): OrderBuilder<MessageType> {
    if (this._isLocked) return this;

    this._operations.push((originalValue: number) =>
      ({
        message,
        originalValue,
        value: v,
        accumulatedValue: OrderCalculator.divided(originalValue, v),
      }) as ORT,
    );

    return this;
  }

  /**
   * discount n% in that moment total value.
   * @param rate in %
   * @param message MessageType
   * @returns OrderBuilder<MessageType>
   */
  discount(rate: number, message?: MessageType): OrderBuilder<MessageType> {
    if (this._isLocked) return this;

    this._operations.push((originalValue: number) =>
      ({
        message,
        originalValue,
        value: rate,
        accumulatedValue: OrderCalculator.discount(originalValue, rate),
      }) as ORT,
    );

    return this;
  }

  /**
   * Get Current Order Value
   * @returns Number
   */
  getValue(): number {
    return this._operations.reduce((curTotal, operate) => (
      operate(curTotal).accumulatedValue
    ), this._initValue);
  }

  getRecords(): OrderRecordBase<MessageType>[] {
    return this._operations.reduce((records, operate) => {
      const { message, value } = operate(0);

      records.push({ message, value });

      return records;
    }, [] as OrderRecordBase<MessageType>[]);
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

  /**
   * Un-Do the mutations by size times.
   * @return OrderBuilder
   */
  undo(size = 1): OrderBuilder {
    Array.from(Array(Math.round(size))).forEach(() => {
      this._operations.pop();
    });

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
