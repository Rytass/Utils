import { Order } from '../order-builder';
import { Condition } from './typings';

export enum Requirement {
  ITEM = 'ITEM_REQUIRED',
}

export type RequirementDescription<
  T extends Record<string, any> | string = Record<string, any> | string
> = {
  type: Requirement;
  items: T[];
};

export type ItemRequiredInput = {
  id: string;
  quantity: number;
};

/**
 * Item requirement condition
 * @description To check whether an order has all given items.
 */
export class ItemRequired implements Condition {
  readonly type = Requirement.ITEM;
  readonly items: ItemRequiredInput[];

  constructor(items: (ItemRequiredInput | string)[]) {
    this.items = items.map(item =>
      typeof item === 'string' ? { id: item, quantity: 1 } : item
    );
  }

  resolve(order: Order) {
    const orderItemMap = new Map<string, ItemRequiredInput>(
      order?.items.map(item => [item.id, item])
    );

    return this.items.every(
      item => (orderItemMap.get(item.id)?.quantity || -1) >= item.quantity
    );
  }
}
