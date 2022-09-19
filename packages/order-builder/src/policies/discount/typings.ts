import { ObjRecord } from '../../typings';
import { Condition } from '../../conditions';
import { PolicyResult } from '../typings';
import { FlattenOrderItem, OrderItem } from '../../core';

export enum Discount {
  PERCENTAGE = 'PERCENTAGE',
  VALUE = 'VALUE',
  STEP_VALUE = 'STEP_VALUE',
  STEP_PERCENTAGE = 'STEP_PERCENTAGE',
  ITEM_GIVEAWAY = 'ITEM_GIVEAWAY',
}

export type PolicyDiscountDescription<
T extends ObjRecord = ObjRecord> = PolicyResult<{
  type: Discount;
  value: number;
  discount: number;
  conditions: Condition[];
  appliedItems: FlattenOrderItem<OrderItem>[];
}> & T;

export type DiscountOptions<T extends ObjRecord = ObjRecord> = {
  id?: string;
  onlyMatched?: boolean;
} & T;

/**
 * @param {"quantity"|"price"} unit "quantity"|"price"
 */
export type StepDiscountOptions = DiscountOptions<{
  stepUnit: 'quantity' | 'price';
  stepLimit?: number;
}>
