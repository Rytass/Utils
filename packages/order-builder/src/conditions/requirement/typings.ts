import { ObjRecord } from '../../typings';

export enum Requirement {
  ITEM = 'ITEM_REQUIRED',
  QUANTITY = 'QUANTITY',
  ITEMS_IN = 'ITEMS_IN',
}

export type RequirementDescription<
  T extends ObjRecord | string = ObjRecord | string
> = {
  type: Requirement;
  items: T[];
};
