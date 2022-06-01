import { Condition } from '../../conditions';
import { FlattenOrderItem } from '../../core';
import { Order } from '../../core/order';
import { divided, minus, plus, pow, times } from '../../utils/decimal';
import { PolicyPrefix } from '../typings';
import { generateNewPolicyId } from '../utils';
import { BaseDiscount } from './base-discount';
import { Discount, PolicyDiscountDescription, StepDiscountOptions } from './typings';
import { getConditionsByDiscountConstructor, getOnlyMatchedItems, getOptionsByDiscountConstructor, getOrderItems } from './utils';

/**
 * A policy on `discounting value based on stepped discount-rate` on itemValue
 * @param {Number} step step to accumulate discount-value
 * @param {Number} value discount-policy value
 * @returns {Policy} Policy
 */
export class StepPercentageDiscount implements BaseDiscount {
  readonly prefix = PolicyPrefix.DISCOUNT;
  readonly type = Discount.STEP_PERCENTAGE;
  readonly id: string;
  readonly step: number;
  readonly value: number;
  readonly conditions: Condition[];
  readonly options?: StepDiscountOptions;

  /**
   * @param {Step} step `Step` to accumulate discount-value
   * @param {Number} value discount-policy value
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
   * @param {Number} step step to accumulate discount-value
   * @param {Number} value discount-policy value
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
   * @param {Number} step step to accumulate discount-value
   * @param {Number} value discount-policy value
   * @param {StepDiscountOptions} options StepDiscountOptions
   * @returns {Policy} Policy
   */
  constructor(step: number, value: number, options: StepDiscountOptions);
  /**
   * @param {Number} step step to accumulate discount-value
   * @param {Number} value discount-policy value
   * @returns {Policy} Policy
   */
  constructor(step: number, value: number);
  constructor(
    step: number,
    value: number,
    arg1?: Condition | Condition[] | StepDiscountOptions,
    arg2?: StepDiscountOptions
  ) {
    // To check value boundary. 0 ≤ value ≤ 1
    if (value < 0 || value > 1) {
      throw new Error('Invalid percentage value.');
    }

    this.options = getOptionsByDiscountConstructor(arg1, arg2);
    this.id = this.options?.id || generateNewPolicyId();
    this.step = step;
    this.value = value;
    this.conditions = getConditionsByDiscountConstructor(arg1);
  }

  get stepLimit() {
    return this.options?.stepLimit || Number.MAX_SAFE_INTEGER;
  }

  matchedItems(order: Order): FlattenOrderItem[] {
    return this.options?.onlyMatched
      ? getOnlyMatchedItems(order, this.conditions)
      : getOrderItems(order);
  }

  valid(order: Order): boolean {
    return this.conditions.length
      ? this.conditions.every(condition => condition.satisfy?.(order))
      : true;
  }

  discount(itemValue: number, multiplier: number): number {
    const discountRate = pow(
      this.value,
      Math.min(
        this.stepLimit,
        Math.floor(divided(multiplier, this.step)),
      ),
    );

    return times(itemValue, minus(1, discountRate))
  }

  description(
    order: Order,
    itemValue: number,
    multiplier: number,
    appliedItems: FlattenOrderItem[],
  ): PolicyDiscountDescription {
    return {
      id: this.id,
      step: this.step,
      value: this.value,
      type: this.type,
      discount: order.config.roundStrategy.round(
        this.discount(itemValue, multiplier),
        ['FINAL_PRICE_ONLY', 'EVERY_CALCULATION'],
      ),
      conditions: this.conditions,
      appliedItems,
    };
  }

  getMultiplier(itemValue: number, items: FlattenOrderItem[]) {
    return this.options?.stepUnit === 'quantity'
    ? items.reduce((total, item) => (
        plus(total, item.quantity)
      ), 0)
    : itemValue;
  }

  resolve<PolicyDiscountDescription>(
    order: Order,
    policies: PolicyDiscountDescription[],
  ): PolicyDiscountDescription[] {
    if (this.valid(order)) {
      const matchedItems: FlattenOrderItem[] = this.matchedItems(order);

      const itemValue = order.config.roundStrategy.round(
        matchedItems.reduce((total, item) => plus(
          total,
          item.unitPrice,
        ), 0),
        'EVERY_CALCULATION',
      );

      const multiplier = this.getMultiplier(itemValue, matchedItems);

      return [
        ...policies,
        this.description(
          order,
          itemValue,
          multiplier,
          matchedItems,
        ),
      ] as PolicyDiscountDescription[];
    }

    return policies;
  }
}
