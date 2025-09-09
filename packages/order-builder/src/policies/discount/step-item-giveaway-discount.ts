import { Condition } from '../../conditions';
import { FlattenOrderItem } from '../../core';
import { Order } from '../../core/order';
import { OptionsBase } from '../../typings';
import { divided, plus, times } from '../../utils/decimal';
import { PolicyPrefix } from '../typings';
import { generateNewPolicyId } from '../utils';
import { BaseDiscount } from './base-discount';
import { Discount, ItemGiveawayStrategy, PolicyDiscountDescription, DiscountOptions } from './typings';
import {
  getConditionsByDiscountConstructor,
  getOnlyMatchedItems,
  getOptionsByDiscountConstructor,
  getOrderItems,
} from './utils';

type StepItemGiveawayDiscountOptions<T extends OptionsBase = OptionsBase> = DiscountOptions<
  {
    stepLimit?: number;
    strategy?: ItemGiveawayStrategy;
  } & T
>;

/**
 * A policy on `giveaway items` based on item-give-away-strategy.
 * @param {Number} value `Number` Quantity of giveaway items.
 * @returns {Policy} Policy
 */
export class StepItemGiveawayDiscount implements BaseDiscount {
  readonly prefix = PolicyPrefix.DISCOUNT;
  readonly type = Discount.STEP_ITEM_GIVEAWAY;
  readonly id: string;
  readonly step: number;
  readonly value: number;
  readonly strategy: ItemGiveawayStrategy;
  readonly conditions: Condition[];
  readonly options?: StepItemGiveawayDiscountOptions;

  /**
   * @param {Number} step step to accumulate discount-value
   * @param {Number} value `Number` Quantity of giveaway items.
   * @param {StepItemGiveawayDiscountOptions} options StepItemGiveawayDiscountOptions
   * @returns {Policy} Policy
   */
  constructor(step: number, value: number, options: StepItemGiveawayDiscountOptions);
  /**
   * @param {Number} value `Number` Quantity of giveaway items.
   * @param {Array} conditions Condition[]
   * @param {StepItemGiveawayDiscountOptions} options StepItemGiveawayDiscountOptions
   * @returns {Policy} Policy
   */
  constructor(step: number, value: number, conditions: Condition[], options?: StepItemGiveawayDiscountOptions);
  /**
   * @param {Number} step step to accumulate discount-value
   * @param {Number} value `Number` Quantity of giveaway items.
   * @param {Condition} condition Condition
   * @param {StepItemGiveawayDiscountOptions} options StepItemGiveawayDiscountOptions
   * @returns {Policy} Policy
   */
  constructor(step: number, value: number, condition: Condition, options?: StepItemGiveawayDiscountOptions);
  /**
   * @param {Number} step step to accumulate discount-value
   * @param {Number} value `Number` Quantity of giveaway items.
   * @returns {Policy} Policy
   */
  constructor(step: number, value: number);
  constructor(
    step: number,
    value: number,
    arg1?: StepItemGiveawayDiscountOptions | Condition | Condition[],
    arg2?: StepItemGiveawayDiscountOptions,
  ) {
    this.options = getOptionsByDiscountConstructor(arg1, arg2);
    this.strategy = this.options?.strategy ?? 'LOW_PRICE_FIRST';
    this.id = this.options?.id || generateNewPolicyId();
    this.value = Math.floor(value);
    this.step = Math.floor(step);
    this.conditions = getConditionsByDiscountConstructor(arg1);
  }

  matchedItems(order: Order): FlattenOrderItem[] {
    return (this.options?.onlyMatched ? getOnlyMatchedItems(order, this.conditions) : getOrderItems(order)).filter(
      item => times(item.unitPrice, item.quantity),
    );
  }

  valid(order: Order): boolean {
    return this.conditions.length ? this.conditions.every(condition => condition.satisfy?.(order)) : true;
  }

  discount(giveawayItemValue: number): number {
    return this.options?.excludedInCalculation ? 0 : giveawayItemValue;
  }

  description(giveawayItemValue: number, appliedItems: FlattenOrderItem[]): PolicyDiscountDescription {
    return {
      id: this.id,
      value: this.value,
      strategy: this.strategy,
      type: this.type,
      discount: this.discount(giveawayItemValue),
      conditions: this.conditions,
      appliedItems,
      matchedTimes: appliedItems.length,
      policy: this,
    };
  }

  resolve<PolicyDiscountDescription>(order: Order, policies: PolicyDiscountDescription[]): PolicyDiscountDescription[] {
    if (this.valid(order)) {
      const matchedItems: FlattenOrderItem[] = this.matchedItems(order);

      const stepLimit = Math.min(
        this.options?.stepLimit || Number.MAX_SAFE_INTEGER,
        Math.floor(divided(matchedItems.length, this.step + this.value)),
      );

      const effectTimes = times(this.value, stepLimit);

      const giveawayItems = matchedItems
        // sort by giveaway strategy
        .sort((a, b) => {
          switch (this.strategy) {
            case 'HIGH_PRICE_FIRST':
              return b.unitPrice - a.unitPrice;
            case 'LOW_PRICE_FIRST':
            default:
              return a.unitPrice - b.unitPrice;
          }
        })
        // pick matched-giveaway-items quantity by given quantity (this.value)
        .slice(0, effectTimes);

      const giveawayItemValue = order.config.roundStrategy.round(
        // original giveawayItem
        giveawayItems.reduce((total, item) => plus(total, item.unitPrice), 0),
        'final-price-only',
      );

      policies.push(this.description(giveawayItemValue, giveawayItems) as PolicyDiscountDescription);
    }

    return policies;
  }
}
