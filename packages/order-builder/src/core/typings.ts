import { Policy } from '../policies';
import { ObjRecord } from '../typings';
import { ItemDiscountRecord } from './order-item-record-collection';
import { Condition } from '../conditions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OrderItemConditionCb = (..._: any[]) => boolean;

type OrderItemConditionRef<CB extends OrderItemConditionCb = OrderItemConditionCb> = CB | string | string[];

type OrderItemOption = Omit<ObjRecord, 'id' | 'quantity' | 'conditionRef' | 'uniPrice'>;

/**
 * BaseOrderItem
 */
export type BaseOrderItem<T extends OrderItemConditionRef = OrderItemConditionRef> = {
  id: string;
  quantity: number;
  conditionRef?: T;
};

/**
 * OrderItem
 */
export type OrderItem<
  Option extends OrderItemOption = OrderItemOption,
  ConditionRef extends OrderItemConditionRef = OrderItemConditionRef,
> = {
  name: string;
  unitPrice: number;
} & Option &
  BaseOrderItem<ConditionRef>;

/**
 * Flattened Item which quantity === 1.
 */
export type FlattenOrderItem<Item extends OrderItem = OrderItem> = Item & {
  uuid: string;
};

/**
 * Dto of the `order.itemRecords`
 */
export interface OrderItemRecord<Item extends OrderItem> {
  itemId: string;
  appliedPolicies: Policy[];
  originItem: Item;
  initialValue: number;
  discountValue: number;
  finalPrice: number;
  discountRecords: ItemDiscountRecord[];
}

/**
 * Logistics of the order.
 */
export interface OrderLogistics {
  price: number;
  name?: string;
  threshold?: number;
  freeConditions?: Condition | Condition[];
}
