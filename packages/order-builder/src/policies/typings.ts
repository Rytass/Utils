import { ObjRecord } from '../typings';
import { Order } from '../core/order';
import { FlattenOrderItem } from '../core';
import { Condition } from '../conditions';

export enum PolicyPrefix {
  DISCOUNT = 'DISCOUNT',
}

export type PolicyResult<T extends ObjRecord> = {
  id: string;
} & T;

export interface Policy<T extends ObjRecord = ObjRecord> {
  id: string;
  prefix: PolicyPrefix;
  condition?: Condition[];
  matchedItems(order: Order): FlattenOrderItem[];
  valid(order: Order): boolean;
  resolve<TT extends T>(order: Order, ..._: any[]): TT[];
  description(..._: any[]): PolicyResult<T>;
}

export type Policies<P extends Policy = Policy> = P | P[];
