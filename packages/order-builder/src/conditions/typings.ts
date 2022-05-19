import { FlattenOrderItem } from './../core/typings';
import { OrderItem } from '../core/typings';
import { Order } from '../core/order';
import { ObjRecord } from '../typings';

export type Condition<T extends ObjRecord = ObjRecord> = {
  satisfy(order: Order, ..._: any[]): boolean;
  matchedItems?: <Item extends OrderItem>(order: Order<Item>) => FlattenOrderItem<Item>[];
} & T;
