export interface OrderRecordBase<T extends string = string> {
  value: number;
  message?: T;
}

export interface OrderRecord<T extends string = string> extends OrderRecordBase<T> {
  originalValue: number;
  accumulatedValue: number;
}

export type OrderOperation<T extends string = string> = (originalValue: number) => OrderRecord<T>;

export interface OrderItem<
T extends string = string,
N extends string = string> {
  id: T;
  name: N;
  unitPrice: number;
  quantity: number;
}