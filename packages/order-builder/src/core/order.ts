import { BaseOrderItem, OrderItem } from './typings';
import { OrderPolicyManager } from './order-policy-manager';
import { PolicyDiscountDescription } from '../policies';
import { minus, plus, times } from '../utils/decimal';

/**
 * Order
 */
export class Order<
  Item extends OrderItem = OrderItem,
  Coupon extends string = string
> {
  private _items: Item[];
  private readonly _coupons: Set<Coupon>;
  private readonly _policyManager: OrderPolicyManager;

  /**
   * All items in order.
   * @returns {Array} OrderItem[]
   */
  get items() {
    return this._items;
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
    policyManager: OrderPolicyManager,
    {
      items,
      coupons,
    }: {
      items: Item[];
      coupons: Coupon[];
    }
  ) {
    this._policyManager = policyManager;
    this._items = items;
    this._coupons = new Set(coupons);
  }

  /**
   * Activated discount-policies in this order.
   * @returns {Array<PolicyDiscountDescription>} PolicyDiscountDescription[]
   */
  get discounts() {
    return this.policies.reduce(
      (discounts, discountPolicy) => discountPolicy.resolve(this, discounts),
      [] as PolicyDiscountDescription[]
    );
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
   * Price after all activated policies applied in `order`.`items`.
   * @description To equal `this.itemValue` - `this.discountValue`.
   * @returns {Number} Number
   */
  get price() {
    return minus(this.itemValue, this.discountValue);
  }

  /**
   * Push couponId into `order`.`coupons`
   * @param {String} id String
   * @returns {Order} Order
   */
  addCoupon(id: Coupon): Order;
  /**
   * Push couponId into `order`.`coupons`
   * @param {Array} ids String[]
   * @returns {Order} Order
   */
  addCoupon(ids: Coupon[]): Order;
  addCoupon(arg0: Coupon | Coupon[]): Order {
    const ids = Array.isArray(arg0) ? arg0 : [arg0];

    ids.forEach(id => this._coupons.add(id));

    return this;
  }

  /**
   * Remove couponId from `order`.`coupons` if exists.
   * @param {String} id String
   * @returns {Order} Order
   */
  removeCoupon(id: Coupon): Order;
  /**
   * Remove couponId from `order`.`coupons` if exists.
   * @param {Array} ids String[]
   * @returns {Order} Order
   */
  removeCoupon(ids: Coupon[]): Order;
  removeCoupon(arg0: Coupon | Coupon[]): Order {
    const ids = Array.isArray(arg0) ? arg0 : [arg0];

    ids.forEach(id => this._coupons.delete(id));

    return this;
  }

  /**
   * Add item from `order`.`items`.
   * @param {OrderItem} item OrderItem
   * @returns {Order} Order
   */
  addItem(item: Item): Order;
  /**
   * Add item from `order`.`items`.
   * @param {Array} items OrderItem[]
   * @returns {Order} Order
   */
  addItem(items: Item[]): Order;
  addItem(arg0: Item | Item[]): any {
    const items = Array.isArray(arg0) ? arg0 : [arg0];

    this._items = [...this._items, ...items];

    return this;
  }

  /**
   * Remove item from `order`.`items`.
   * @param {String} id itemId
   * @param {Number} quantity quantity of item to remove
   * @returns {Order} Order
   */
  removeItem(id: string, quantity: number): Order;
  /**
   * Remove item from `order`.`items`.
   * @param {OrderItem} item OrderItem
   * @returns {Order} Order
   */
  removeItem<RemoveItem extends BaseOrderItem = BaseOrderItem>(
    item: RemoveItem
  ): Order;
  /**
   * Remove item from `order`.`items`.
   * @param {Array} items OrderItem[]
   * @returns {Order} Order
   */
  removeItem<RemoveItem extends BaseOrderItem = BaseOrderItem>(
    items: RemoveItem[]
  ): Order;
  removeItem<RemoveItem extends BaseOrderItem = BaseOrderItem>(
    arg0: string | RemoveItem | RemoveItem[],
    arg1?: number
  ): Order {
    const items: RemoveItem[] = Array.isArray(arg0)
      ? arg0
      : [
          {
            id: typeof arg0 === 'string'
              ? arg0
              : arg0.id,
            quantity: typeof arg0 !== 'string'
              ? arg0.quantity
              : typeof arg1 === 'number' ? Math.max(arg1, 0) : 0,
          } as RemoveItem,
        ];

    const toRemoveItemMap = new Map<string, RemoveItem>(
      items.map(item => [item.id, item])
    );

    this._items = this._items.reduce((items, item) => {
      const matchedToRemoveItem = toRemoveItemMap.get(item.id);

      if (!matchedToRemoveItem) return [...items, item];

      const predictQuantity = minus(
        item.quantity,
        matchedToRemoveItem.quantity
      );

      return predictQuantity > 0
        ? [
            ...items,
            {
              ...item,
              quantity: predictQuantity,
            },
          ]
        : items;
    }, [] as Item[]);

    return this;
  }
}
