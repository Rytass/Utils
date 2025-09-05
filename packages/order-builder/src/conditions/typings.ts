import { FlattenOrderItem } from './../core/typings';
import { Order } from '../core/order';
import { ObjRecord } from '../typings';

export type Condition<T extends ObjRecord = ObjRecord, Options extends ObjRecord = ObjRecord> = {
  satisfy(order: Order, ..._: any[]): boolean;
  matchedItems?: (order: Order) => FlattenOrderItem[];
  readonly options?: Options;
} & T;
