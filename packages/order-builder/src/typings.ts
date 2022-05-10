export interface OrderItem<
  T extends string = string,
  N extends string = string
> {
  id: T;
  name: N;
  unitPrice: number;
  quantity: number;
}
