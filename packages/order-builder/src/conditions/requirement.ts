import { Order } from '../order-builder';
import { OrderItem } from '../typings';
import { Condition } from './typings';

export enum Requirement {
  ITEM = 'ITEM_REQUIRED',
}

export type RequirementDescription<
  T extends Record<string, any> | string = Record<string, any> | string,
> = {
  type: Requirement;
  items: T[];
};

export type ItemRequiredInput = {
  id: string;
  quantity: number;
};

export class ItemRequired implements Condition {
  type = Requirement.ITEM;
  items: ItemRequiredInput[];

  constructor(items: (ItemRequiredInput | string)[]) {
    this.items = items.map(i => (
      typeof i === 'string'
        ? { id: i, quantity: 1 }
        : i
    ));
  }

  resolve(order: Order) {
    const itemMap = new Map(order?.items.map(i => ([i.id, i])));

    return this.items.every((item) => {
      const fromOrder = itemMap?.get(item.id);

      return !!fromOrder && fromOrder.quantity >= item.quantity;
    });
  }
}
