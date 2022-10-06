import { FlattenOrderItem, OrderItem } from '../../core';
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

type ItemSpecifiedBaseInput = {
  threshold?: number;
  conditions?: Condition[];
};

export type ItemSpecifiedScopeInput<Item extends OrderItem> =
  ItemSpecifiedBaseInput & {
    items: string | string[];
    scope?:
      | ItemSpecifiedScope<OmitItemSpecifiedScope<Item>>
      | ItemSpecifiedScope<OmitItemSpecifiedScope<Item>>[];
  };

export type ItemSpecifiedResolvedFnInput<Item extends OrderItem> =
  ItemSpecifiedBaseInput & {
    isMatchedItem: <II extends FlattenOrderItem<Item>>(item: II) => boolean;
  };

export type ItemSpecifiedInput<Item extends OrderItem> =
  | ItemSpecifiedScopeInput<Item>
  | ItemSpecifiedResolvedFnInput<Item>;
