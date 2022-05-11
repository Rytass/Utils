
/**
 * BaseOrderItem
 */
 export interface BaseOrderItem<Id extends string = string> {
  id: Id;
  quantity: number;
}

/**
 * OrderItem
 */
export interface OrderItem<Id extends string = string> extends BaseOrderItem<Id> {
  name: string;
  unitPrice: number;
}
