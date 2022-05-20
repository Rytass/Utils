import { Condition } from '../../conditions';
import { FlattenOrderItem } from '../../core';
import { Order } from '../../core/order';
import { divided, minus, plus, times } from '../../utils/decimal';
import { PolicyPrefix } from '../typings';
import { generateNewPolicyId } from '../utils';
import { BaseDiscount } from './base-discount';
import { Discount, PolicyDiscountDescription, StepDiscountOptions } from './typings';
import { getConditionsByDiscountConstructor, getOnlyMatchedItems, getOptionsByDiscountConstructor } from './utils';

/**
 * A policy on `discounting value based on stepped price` on itemValue
 * @param {Number} step step to accumulate discount-value
 * @param {Number} value `Fixed` number
 * @returns {Policy} Policy
*/
export class StepValueDiscount
  implements BaseDiscount {
  readonly prefix = PolicyPrefix.DISCOUNT;
  readonly type = Discount.STEP_VALUE;
  readonly id: string;
  readonly step: number;
  readonly value: number;
  readonly conditions: Condition[];
  readonly options?: StepDiscountOptions;

  /**
   * @param {Number} step `Step` to accumulate discount-value
   * @param {Number} value fixed-value number
   * @param {Array} conditions Condition[]
   * @param {StepDiscountOptions} options StepDiscountOptions
   * @returns {Policy} Policy
   */
  constructor(
    step: number,
    value: number,
    conditions: Condition[],
    options?: StepDiscountOptions
  );
  /**
   * @param {Number} step `Step` to accumulate discount-value
   * @param {Number} value fixed-value number
   * @param {Condition} condition Condition
   * @param {StepDiscountOptions} options StepDiscountOptions
   * @returns {Policy} Policy
   */
   constructor(
    step: number,
    value: number,
    condition: Condition,
    options?: StepDiscountOptions
  );
  /**
   * @param {Number} step `Step` to accumulate discount-value
   * @param {Number} value fixed-value number
   * @param {StepDiscountOptions} options StepDiscountOptions
   * @returns {Policy} Policy
   */
  constructor(
    step: number,
    value: number,
    options: StepDiscountOptions,
  );
  /**
   * @param {Number} step `Step` to accumulate discount-value
   * @param {Number} value fixed-value number
   * @returns {Policy} Policy
   */
  constructor(step: number, value: number);
  constructor(
    step: number,
    value: number,
    arg1?: Condition | Condition[] | StepDiscountOptions,
    arg2?: StepDiscountOptions
  ) {
    this.options = getOptionsByDiscountConstructor(arg1, arg2);
    this.id = this.options?.id || generateNewPolicyId();
    this.step = step;
    this.value = value;
    this.conditions = getConditionsByDiscountConstructor(arg1);
  }

  valid(order: Order): boolean {
    return this.conditions.length
      ? this.conditions.every(condition => condition.satisfy?.(order))
      : true;
  }

  discount(itemValue: number): number {
    return times(this.value, Math.floor(divided(
      itemValue,
      this.step,
    )));
  }

  description(
    order: Order,
    itemValue: number,
    appliedItems: FlattenOrderItem[],
  ): PolicyDiscountDescription {
    return {
      id: this.id,
      step: this.step,
      value: this.value,
      type: this.type,
      discount: order.config.roundStrategy.round(
        this.discount(itemValue),
        ['FINAL_PRICE_ONLY', 'EVERY_CALCULATION'],
      ),
      conditions: this.conditions,
      appliedItems,
    };
  }

  resolve<PolicyDiscountDescription>(
    order: Order,
    policies: PolicyDiscountDescription[]
  ): PolicyDiscountDescription[] {
    if (this.valid(order)) {
      const itemManager = order.itemManager;
      const matchedItems: FlattenOrderItem[] = this.options?.onlyMatched
        ? getOnlyMatchedItems(order, this.conditions)
        : itemManager.withStockItems;

      const itemValue = this.options?.stepUnit === 'quantity'
        ? matchedItems.reduce((total, item) => (
            plus(total, item.quantity)
          ), 0)
        : order.config.roundStrategy.round(
          matchedItems.reduce((total, item) => plus(
            total,
            minus(
              item.unitPrice,
              itemManager.collectionMap.get(item.uuid)?.discountValue || 0,
            ),
          ), 0),
          'EVERY_CALCULATION',
        );

      return [
        ...policies,
        this.description(
          order,
          itemValue,
          matchedItems,
        ),
      ] as PolicyDiscountDescription[];
    }

    return policies;
  }
}
