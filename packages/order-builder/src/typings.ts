export interface OrderItem<Id extends string = string> {
  id: Id;
  name: string;
  unitPrice: number;
  quantity: number;
}
