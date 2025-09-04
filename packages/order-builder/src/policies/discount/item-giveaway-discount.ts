import { Condition } from '../../conditions';
import { FlattenOrderItem } from '../../core';
import { Order } from '../../core/order';
import { plus, times } from '../../utils/decimal';
import { PolicyPrefix } from '../typings';
import { generateNewPolicyId } from '../utils';
import { BaseDiscount } from './base-discount';
import { Discount, DiscountOptions, ItemGiveawayStrategy, PolicyDiscountDescription } from './typings';
import {
  getConditionsByDiscountConstructor,
  getOnlyMatchedItems,
  getOptionsByDiscountConstructor,
  getOrderItems,
} from './utils';

interface ItemGiveawayDiscountOptions extends DiscountOptions {
  strategy?: ItemGiveawayStrategy;
}

/**
 * A policy on `giveaway items` based on item-give-away-strategy.
 * @param {Number} value `Number` Quantity of giveaway items.
 * @returns {Policy} Policy
 */
export class ItemGiveawayDiscount implements BaseDiscount {
  readonly prefix = PolicyPrefix.DISCOUNT;
  readonly type = Discount.ITEM_GIVEAWAY;
  readonly id: string;
  readonly value: number;
  readonly strategy: ItemGiveawayStrategy;
  readonly conditions: Condition[];
  readonly options?: ItemGiveawayDiscountOptions;

  /**
   * @param {Number} value `Number` Quantity of giveaway items.
   * @param {Array} conditions Condition[]
   * @param {ItemGiveawayDiscountOptions} options ItemGiveawayDiscountOptions
   * @returns {Policy} Policy
   */
  constructor(value: number, conditions: Condition[], options?: ItemGiveawayDiscountOptions);
  /**
   * @param {Number} value `Number` Quantity of giveaway items.
   * @param {Condition} condition Condition
   * @param {ItemGiveawayDiscountOptions} options ItemGiveawayDiscountOptions
   * @returns {Policy} Policy
   */
  constructor(value: number, condition: Condition, options?: ItemGiveawayDiscountOptions);
  /**
   * @param {Number} value `Number` Quantity of giveaway items.
   * @param {ItemGiveawayDiscountOptions} options ItemGiveawayDiscountOptions
   * @returns {Policy} Policy
   */
  constructor(value: number, options: ItemGiveawayDiscountOptions);
  /**
   * @param {Number} value `Number` Quantity of giveaway items.
   * @returns {Policy} Policy
   */
  constructor(value: number);
  constructor(
    value: number,
    arg1?: Condition | Condition[] | ItemGiveawayDiscountOptions,
    arg2?: ItemGiveawayDiscountOptions,
  ) {
    this.options = getOptionsByDiscountConstructor(arg1, arg2);
    this.strategy = this.options?.strategy ?? 'LOW_PRICE_FIRST';
    this.id = this.options?.id || generateNewPolicyId();
    this.value = value;
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
        .slice(0, this.value);

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
