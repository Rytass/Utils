import {
  BaseOrderItem,
  OrderItem,
  OrderItemRecord,
  FlattenOrderItem,
} from './typings';
import { OrderConfig } from './configs/order-config';
import { OrderItemManager } from './order-item-manager';
import { OrderPolicyManager } from './order-policy-manager';
import { PolicyDiscountDescription } from '../policies';
import { minus, plus, times } from '../utils/decimal';
import { OrderBuilder } from './order-builder';

/**
 * OrderConstructor
 * @param {Array} items OrderItem[]
 * @param {Array} coupons string
 */
export interface OrderConstructor<
  Item extends OrderItem = OrderItem,
  Coupon extends string = string
> {
  items: Item[];
  coupons: Coupon[];
}

export type SubOrderResolveFn<
  Item extends OrderItem = OrderItem,
  Coupon extends string = string
> = (
  construct: OrderConstructor<Item, Coupon>
) => OrderConstructor<Item, Coupon>;

/**
 * SubOrderConditions
 * @description Conditions inputs to create a sub-order instance.
 */
export interface SubOrderCondition {
  subItems?: (string | FlattenOrderItem)[];
  subCoupons?: string[];
}

/**
 * Order
 */
export class Order<
  Item extends OrderItem = OrderItem,
  Coupon extends string = string
> {
  private readonly _builder: OrderBuilder;
  private readonly _policyManager: OrderPolicyManager;
  private readonly _itemManager: OrderItemManager<Item>;
  private readonly _coupons: Set<Coupon>;

  /**
   * OrderBuilder configuration.
   */
  get config(): OrderConfig {
    return this._builder.config;
  }

  /**
   * Item Manager
   */
  get itemManager() {
    return this._itemManager;
  }

  /**
   * All items in order.
   * @returns {Array} OrderItem[]
   */
  get items(): Item[] {
    return this._itemManager.items;
  }

  /**
   * All coupons in order.
   * @returns {Array} String[]
   */
  get coupons() {
    return Array.from(this._coupons.values());
  }

  /**
   * All policies config based on its builder.
   * @returns {Array} Policy[]
   */
  get policies() {
    return this._policyManager.policies;
  }

  constructor(
    builder: OrderBuilder,
    policyManager: OrderPolicyManager,
    { items, coupons }: OrderConstructor<Item, Coupon>
  ) {
    this._builder = builder;
    this._policyManager = policyManager;
    this._itemManager = new OrderItemManager<Item>(items);
    this._coupons = new Set(coupons);
  }

  /**
   * Get the after-balanced item detail records.
   * @returns {Array<OrderItemRecord>} OrderItemRecord[]
   */
  get itemRecords(): OrderItemRecord<Item>[] {
    this.config.discountMethod.calculateDiscounts(this); // calculate discounts first.

    return this.itemManager.getCurrentItemRecords(
      this._policyManager.policyMap
    );
  }

  /**
   * Activated discount-policies in this order.
   * @returns {Array} PolicyDiscountDescription[]
   */
  get discounts(): PolicyDiscountDescription[] {
    return this.config.discountMethod.calculateDiscounts(this);
  }

  /**
   * Total value of `activated` discount-policies.
   * @description Policies `will not be included` if own conditions were not satisfied.
   * @returns {Number} Number
   */
  get discountValue() {
    return this.discounts.reduce(
      (totalDiscountValue, discountDescription) =>
        plus(totalDiscountValue, discountDescription.discount),
      0
    );
  }

  /**
   * Total value of items in order.
   * @description sum of all `quantity` * `unitPrice`.
   * @returns {Number} Number
   */
  get itemValue() {
    return this.items.reduce(
      (total, item) => plus(total, times(item.quantity, item.unitPrice)),
      0
    );
  }

  /**
   * Total quantity of all items in order.
   * @description sum of all `quantity`.
   * @returns {Number} Number
   */
  get itemQuantity() {
    return this.items.reduce((total, item) => plus(total, item.quantity), 0);
  }

  /**
   * Price after all activated policies applied in `order`.`items`.
   * @description To equal `this.itemValue` - `this.discountValue`.
   * @returns {Number} Number
   */
  get price() {
    return minus(this.itemValue, this.discountValue);
  }

  /**
   * To get a sub-order instance.
   * @param {Array} subItems (String | FlattenOrderItem)[]
   * @param {Array} subCoupons String[]
   * @returns {Order} Order
   */
  subOrder({
    subItems = [],
    subCoupons = [],
  }: SubOrderCondition): Order<Item, Coupon> {
    const couponFilterSet = new Set(subCoupons);
    const itemFilterSet = new Set(
      subItems.map(subItem =>
        typeof subItem === 'string' ? subItem : subItem.id
      )
    );

    return new Order<Item, Coupon>(this._builder, this._policyManager, {
      items: this.items.filter(item => itemFilterSet.has(item.id)),
      coupons: this.coupons.filter(coupon => couponFilterSet.has(coupon)),
    });
  }

  /**
   * Push couponId into `order`.`coupons`
   * @param {String} coupon String
   * @returns {Order} Order
   */
  addCoupon(coupon: Coupon): Order<Item, Coupon>;
  /**
   * Push couponId into `order`.`coupons`
   * @param {Array} coupons String[]
   * @returns {Order} Order
   */
  addCoupon(coupons: Coupon[]): Order<Item, Coupon>;
  addCoupon(arg0: Coupon | Coupon[]): Order<Item, Coupon> {
    const coupons = Array.isArray(arg0) ? arg0 : [arg0];

    coupons.forEach(coupon => this._coupons.add(coupon));

    return this;
  }

  /**
   * Remove couponId from `order`.`coupons` if exists.
   * @param {String} coupon String
   * @returns {Order} Order
   */
  removeCoupon(coupon: Coupon): Order<Item, Coupon>;
  /**
   * Remove couponId from `order`.`coupons` if exists.
   * @param {Array} coupons String[]
   * @returns {Order} Order
   */
  removeCoupon(coupons: Coupon[]): Order<Item, Coupon>;
  removeCoupon(arg0: Coupon | Coupon[]): Order<Item, Coupon> {
    const coupons = Array.isArray(arg0) ? arg0 : [arg0];

    coupons.forEach(coupon => this._coupons.delete(coupon));

    return this;
  }

  /**
   * Add item from `order`.`items`.
   * @param {OrderItem} item OrderItem
   * @returns {Order} Order
   */
  addItem(item: Item): Order<Item, Coupon>;
  /**
   * Add item from `order`.`items`.
   * @param {Array} items OrderItem[]
   * @returns {Order} Order
   */
  addItem(items: Item[]): Order<Item, Coupon>;
  addItem(arg0: Item | Item[]): Order<Item, Coupon> {
    this._itemManager.addItem(arg0);

    return this;
  }

  /**
   * Remove item from `order`.`items`.
   * @param {String} id itemId
   * @param {Number} quantity quantity of item to remove
   * @returns {Order} Order
   */
  removeItem(id: string, quantity: number): Order<Item, Coupon>;
  /**
   * Remove item from `order`.`items`.
   * @param {OrderItem} item OrderItem
   * @returns {Order} Order
   */
  removeItem<RemoveItem extends BaseOrderItem = BaseOrderItem>(
    item: RemoveItem
  ): Order<Item, Coupon>;
  /**
   * Remove item from `order`.`items`.
   * @param {Array} items OrderItem[]
   * @returns {Order} Order
   */
  removeItem<RemoveItem extends BaseOrderItem = BaseOrderItem>(
    items: RemoveItem[]
  ): Order<Item, Coupon>;
  removeItem<RemoveItem extends BaseOrderItem = BaseOrderItem>(
    arg0: string | RemoveItem | RemoveItem[],
    arg1?: number
  ): Order<Item, Coupon> {
    this._itemManager.removeItem(arg0, arg1);

    return this;
  }
}
