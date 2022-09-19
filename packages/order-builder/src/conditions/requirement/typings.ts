import { OrderItem } from '../../core';
import { ObjRecord } from '../../typings';
import { Condition } from '../typings';

export enum Requirement {
  ITEM = 'ITEM_REQUIRED',
  QUANTITY = 'QUANTITY',
  ITEMS_IN = 'ITEMS_IN',
  EXCLUDED = 'EXCLUDED',
  INCLUDED = 'INCLUDED',
}

export type RequirementDescription<
  T extends ObjRecord | string = ObjRecord | string
> = {
  type: Requirement;
  items: T[];
};

export type ItemSpecifiedScope<T extends ObjRecord = ObjRecord> = keyof T;
export type OmitItemSpecifiedScope<O extends OrderItem> = Omit<
  O,
  'conditionRef' | 'unitPrice' | 'quantity'
>;

export type ItemSpecifiedInput<Item extends OrderItem> = {
  items: string | string[];
  threshold?: number;
  scope?: ItemSpecifiedScope<OmitItemSpecifiedScope<Item>>;
  conditions?: Condition[];
};
