import {
  Condition,
  ItemExcluded,
  ItemIncluded,
  PriceThreshold,
} from '../conditions';
import { ItemGiveawayDiscount, Policies } from '../policies';
import { uuid } from '../utils/uuid';
import { OrderBuilder } from './order-builder';
import { OrderItem, OrderLogistics } from './typings';

/** ------------------- Order ------------------- */
export function generateNewOrderId() {
  return `ORDER:${uuid()}`;
}

/** ------------------- Logistics ------------------- */

export const ORDER_LOGISTICS_ID = '__LOGISTICS__';
export const ORDER_LOGISTICS_NAME = 'logistics';

function getConditions(
  target: Condition | Condition[] | undefined
): Condition[] {
  if (Array.isArray(target)) return target;
  if (typeof target === 'undefined') return [];

  return [target];
}

export function applyOrderLogisticAndReturnLogisticsItem<
  Item extends OrderItem
>(orderBuilder: OrderBuilder, logistics: OrderLogistics): Item {
  const logisticsItem = {
    id: ORDER_LOGISTICS_ID,
    name: logistics?.name || ORDER_LOGISTICS_NAME,
    quantity: 1,
    unitPrice: logistics.price,
  } as Item;

  const freeConditions = getConditions(logistics.freeConditions);

  if (typeof logistics?.threshold === 'number') {
    freeConditions.push(new PriceThreshold(logistics.threshold));
  }

  if (freeConditions.length > 0) {
    orderBuilder.removePolicy(ORDER_LOGISTICS_ID);
    orderBuilder.addPolicy(
      new ItemGiveawayDiscount(
        1,
        [
          ...freeConditions,
          new ItemIncluded({
            items: ORDER_LOGISTICS_ID,
            scope: 'id',
          }),
        ],
        { id: ORDER_LOGISTICS_ID, onlyMatched: true }
      )
    );
  }

  return logisticsItem;
}
