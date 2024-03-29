import {
  BaseOrderItem,
  OrderItem,
  OrderItemRecord,
  FlattenOrderItem,
  OrderLogistics,
} from './typings';
import { OrderConfig } from './configs/order-config';
import { OrderItemManager, OrderItemManagerImpl } from './order-item-manager';
import { OrderPolicyManager } from './order-policy-manager';
import { Policies, PolicyDiscountDescription } from '../policies';
import { minus, plus, times } from '../utils/decimal';
import { OrderBuilder } from './order-builder';
import { generateNewOrderId, ORDER_LOGISTICS_ID } from './utils';
import { OrderCalculateSubject } from './order-calculate-subject';

/**
 * OrderConstructor
 * @param {Array} items OrderItem[]
 * @param {Array} coupons string
 */
export interface OrderConstructor<
  Item extends OrderItem = OrderItem,
  Coupon extends string = string
> {
  id?: string;
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
  subPolicies?: Policies;
  itemScope?: 'id' | 'uuid';
}

/**
 * Order
 */
export class Order<
  Item extends OrderItem = OrderItem,
  Coupon extends string = string
> {
  readonly id: string;
  readonly parent: Order | null;
  readonly builder: OrderBuilder;
  private readonly _policyManager: OrderPolicyManager;
  private readonly _itemManager: OrderItemManagerImpl<Item>;
  private readonly _coupons: Set<Coupon>;

  /**
   * OrderBuilder configuration.
   * @returns {OrderConfig} OrderConfig
   */
  get config(): OrderConfig {
    return this.builder.config;
  }

  /**
   * Item Manager
   * @returns {OrderItemManager} OrderItemManager
   */
  get itemManager(): OrderItemManager<Item> {
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
  get coupons(): Coupon[] {
    return Array.from(this._coupons.values());
  }

  /**
   * All policies config based on its builder.
   * @returns {Array} Policy[]
   */
  get policies(): Policies[] {
    return this._policyManager.policies;
  }

  /**
   * Get logistics config.
   * @returns {OrderLogistics} OrderLogistics
   */
  get logistics(): OrderLogistics | undefined {
    return this.builder.config.logistics;
  }

  constructor(
    builder: OrderBuilder,
    policyManager: OrderPolicyManager,
    { id, items, coupons }: OrderConstructor<Item, Coupon>,
    parent?: Order
  ) {
    this.id = id || generateNewOrderId();
    this.parent = parent || null;
    this.builder = builder;
    this._policyManager = policyManager;
    this._itemManager = new OrderItemManagerImpl<Item>(items);
    this._coupons = new Set(coupons);
  }

  private readonly _itemRecordSubject = new OrderCalculateSubject<OrderItemRecord<Item>[]>();
  /**
   * Get the after-balanced item detail records.
   * @returns {Array<OrderItemRecord>} OrderItemRecord[]
   */
  get itemRecords(): OrderItemRecord<Item>[] {
    return this._itemRecordSubject.subscribe(() => {
      this.config.discountMethod.calculateDiscounts(this); // calculate discounts first.

      return this.itemManager.getCurrentItemRecords(
        this._policyManager.policyMap
      );
    });
  }

  private readonly _discountsSubject = new OrderCalculateSubject<PolicyDiscountDescription[]>();
  /**
   * Activated discount-policies in this order.
   * @returns {Array} PolicyDiscountDescription[]
   */
  get discounts(): PolicyDiscountDescription[] {
    return this._discountsSubject.subscribe(
      () => this.config.discountMethod.calculateDiscounts(this),
    );
  }

  private readonly _discountValueSubject = new OrderCalculateSubject<number>();
  /**
   * Total value of `activated` discount-policies.
   * @description Policies `will not be included` if own conditions were not satisfied.
   * @returns {Number} Number
   */
  get discountValue(): number {
    return this._discountValueSubject.subscribe(() => this.discounts.reduce(
      (totalDiscountValue: number, discountDescription) =>
        plus(totalDiscountValue, discountDescription.discount),
      0
    ));
  }

  private readonly _itemValueSubject = new OrderCalculateSubject<number>();
  /**
   * Total value of items in order.
   * @description sum of all `quantity` * `unitPrice`.
   * @returns {Number} Number
   */
  get itemValue(): number {
    return this._itemValueSubject.subscribe(() => this.items.reduce(
      (total: number, item) => plus(total, times(item.quantity, item.unitPrice)),
      0
    ));
  }

  private readonly _itemQuantitySubject = new OrderCalculateSubject<number>();
  /**
   * Total quantity of all items in order.
   * @description sum of all `quantity`.
   * @returns {Number} Number
   */
  get itemQuantity(): number {
    return this._itemQuantitySubject.subscribe(() =>  this.items.reduce(
      (total: number, item) => plus(total, item.quantity), 0
    ));
  }

  /**
   * Price after all activated policies applied in `order`.`items`.
   * @description To equal `this.itemValue` - `this.discountValue`.
   * @returns {Number} Number
   */
  get price(): number {
    return minus(this.itemValue, this.discountValue);
  }

  /**
   * Get logistics record.
   * @returns {OrderItemRecord} OrderItemRecord
   */
   get logisticsRecord(): OrderItemRecord<Item> | null {
    return this.itemRecords.find(record => record.originItem.id === ORDER_LOGISTICS_ID) || null;
  }

  /**
   * Mutate hook.
   */
  private useEffect(next: Function) {
    this._discountsSubject.next();
    this._itemRecordSubject.next();
    this._discountValueSubject.next();
    this._itemValueSubject.next();
    this._itemQuantitySubject.next();
    next();

    return this;
  }

  /**
   * To get a sub-order instance.
   * @param {Array} subItems (String | FlattenOrderItem)[]
   * @param {Array} subCoupons String[]
   * @returns {Order} Order
   */
  public subOrder({
    subItems = [],
    subCoupons = [],
    subPolicies,
    itemScope = 'id',
  }: SubOrderCondition): Order<Item, Coupon> {
    const couponFilterSet = new Set(subCoupons);
    const itemFilterSet = new Set(
      subItems.map(subItem =>
        typeof subItem === 'string' ? subItem : subItem[itemScope]
      )
    );

    const policyManager = subPolicies
      ? new OrderPolicyManager([subPolicies])
      : this._policyManager;

    const items =
      itemScope === 'id'
        ? this.items.filter(item => itemFilterSet.has(item.id))
        : Array.from<Item>(
            this._itemManager.flattenItems
              .filter(item => itemFilterSet.has(item.uuid))
              .reduce((total, { uuid, ...item }) => {
                const record: Item = total.get(item.id) || {
                  ...item,
                  quantity: 0,
                };

                total.set(item.id, {
                  ...record,
                  quantity: record.quantity + item.quantity,
                });

                return total;
              }, new Map())
              .values()
          );

    return new Order<Item, Coupon>(
      this.builder,
      policyManager,
      {
        items,
        coupons: this.coupons.filter(coupon => couponFilterSet.has(coupon)),
      },
      this
    );
  }

  /**
   * Push couponId into `order`.`coupons`
   * @param {String} coupon String
   * @returns {Order} Order
   */
  public addCoupon(coupon: Coupon): Order<Item, Coupon>;
  /**
   * Push couponId into `order`.`coupons`
   * @param {Array} coupons String[]
   * @returns {Order} Order
   */
  public addCoupon(coupons: Coupon[]): Order<Item, Coupon>;
  public addCoupon(arg0: Coupon | Coupon[]): Order<Item, Coupon> {
    return this.useEffect(() => {
      const coupons = Array.isArray(arg0) ? arg0 : [arg0];

      coupons.forEach(coupon => this._coupons.add(coupon));
    });
  }

  /**
   * Remove couponId from `order`.`coupons` if exists.
   * @param {String} coupon String
   * @returns {Order} Order
   */
  public removeCoupon(coupon: Coupon): Order<Item, Coupon>;
  /**
   * Remove couponId from `order`.`coupons` if exists.
   * @param {Array} coupons String[]
   * @returns {Order} Order
   */
  public removeCoupon(coupons: Coupon[]): Order<Item, Coupon>;
  public removeCoupon(arg0: Coupon | Coupon[]): Order<Item, Coupon> {
    return this.useEffect(() => {
      const coupons = Array.isArray(arg0) ? arg0 : [arg0];

      coupons.forEach(coupon => this._coupons.delete(coupon));
    });
  }

  /**
   * Add item from `order`.`items`.
   * @param {OrderItem} item OrderItem
   * @returns {Order} Order
   */
  public addItem(item: Item): Order<Item, Coupon>;
  /**
   * Add item from `order`.`items`.
   * @param {Array} items OrderItem[]
   * @returns {Order} Order
   */
  public addItem(items: Item[]): Order<Item, Coupon>;
  public addItem(arg0: Item | Item[]): Order<Item, Coupon> {
    return this.useEffect(() => {
      this._itemManager.addItem(arg0);
    });
  }

  /**
   * Remove item from `order`.`items`.
   * @param {String} id itemId
   * @param {Number} quantity quantity of item to remove
   * @returns {Order} Order
   */
   public removeItem(id: string, quantity: number): Order<Item, Coupon>;
  /**
   * Remove item from `order`.`items`.
   * @param {OrderItem} item OrderItem
   * @returns {Order} Order
   */
   public removeItem<RemoveItem extends BaseOrderItem>(
    item: RemoveItem
  ): Order<Item, Coupon>;
  /**
   * Remove item from `order`.`items`.
   * @param {Array} items OrderItem[]
   * @returns {Order} Order
   */
  public removeItem<RemoveItem extends BaseOrderItem>(
    items: RemoveItem[]
  ): Order<Item, Coupon>;
  public removeItem<RemoveItem extends BaseOrderItem>(
    arg0: string | RemoveItem | RemoveItem[],
    arg1?: number
  ): Order<Item, Coupon> {
    return this.useEffect(() => {
      this._itemManager.removeItem(arg0, arg1);
    });
  }
}
