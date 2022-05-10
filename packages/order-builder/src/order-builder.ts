import { Policy, PolicyDiscountDescription } from './policies';
import { OrderItem } from './typings';
import { minus, plus, times } from './utils/decimal';

/**
 * Initial policies configuration in order-builder
 * @param {Array} policies Policy[]
 */
class OrderBuilderOptions {
  policies!: Policy[];
}

/**
 * OrderPolicyManager
 */
class OrderPolicyManager {
  private _policies: Policy[];

  get policies(): Policy[] {
    return this._policies;
  }

  constructor(policies: Policy[]) {
    this._policies = policies;
  }

  addPolicy(policy: Policy): void;
  addPolicy(policies: Policy[]): void;
  addPolicy(arg0: Policy | Policy[]): void;
  addPolicy(arg0: Policy | Policy[]): any {
    const policies = Array.isArray(arg0) ? arg0 : [arg0];

    policies.forEach((policy) => {
      this._policies = [...this._policies, policy];
    });
  }

  removePolicy<PT extends Policy | string = Policy | string>(policy: PT): void;
  removePolicy<PT extends Policy | string = Policy | string>(policies: PT[]): void;
  removePolicy<PT extends Policy | string = Policy | string>(
    arg0: PT | PT[]
  ): void;
  removePolicy<PT extends Policy | string = Policy | string>(
    arg0: PT | PT[]
  ): void {
    const policies = Array.isArray(arg0) ? arg0 : [arg0];

    policies.forEach((policy) => {
      const id = typeof policy === 'string' ? policy : policy?.id;

      if (id) {
        this._policies = this._policies.filter(policy => policy.id !== id);
      }
    })
  }
}

/**
 * OrderBuilderInputs
 */
class OrderBuilderInput<
  Item extends OrderItem = OrderItem,
  Coupon extends string = string
> {
  items!: Item[];
  coupons?: Coupon[];
}

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
    const itemValue = this.itemValue;
    const totalDiscount = this.discounts.reduce(
      (total, policy) => plus(total, policy.discount),
      0
    );

    return minus(itemValue, totalDiscount);
  }

  /**
   * Push couponId into `order`.`coupons`
   * @param {String} id couponId
   * @returns {Order} Order
   */
  addCoupon(id: Coupon) {
    this._coupons.add(id);

    return this;
  }

  /**
   * Remove item from `order`.`items`
   * @param {String} id itemId
   * @param {Number} quantity quantity of item to remove
   * @returns {Order} Order
   */
  removeItem(id: string, quantity: number) {
    this._items = this._items.reduce((items, item) => {
      if (item.id !== id) return [...items, item];

      const predictQuantity = minus(item.quantity, quantity);

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

/**
 * OrderBuilder
 */
export class OrderBuilder {
  private _hasBuiltOrders: boolean = false;
  private readonly _policyManager: OrderPolicyManager;

  /**
   * Check whether `builder`.`build` was called.
   * @returns {Boolean} Boolean
   */
  get hasBuiltOrders() {
    return this._hasBuiltOrders;
  }

  /**
   * All policies config.
   * @returns {Array} Policy[]
   */
  get policies() {
    return this._policyManager.policies;
  }

  constructor(options: OrderBuilderOptions);
  constructor(builder: OrderBuilder);
  constructor(arg0: OrderBuilder | OrderBuilderOptions) {
    this._policyManager = new OrderPolicyManager(arg0.policies);
  }

  /**
   * Create an Order instance and make policies `readonly`
   * @param {OrderBuilderInput} OrderBuilderInput
   * @description `builder`.`policies` will be immutable after this method be called.
   * @returns {Order} Order
   */
  build({ items, coupons = [] }: OrderBuilderInput): Order {
    this._hasBuiltOrders = true;

    return new Order(this._policyManager, {
      items,
      coupons,
    });
  }

  /**
   * Add Policy.
   * @description will be forbidden once `builder`.`order` instance be built.
   * @param policy Policy
   * @returns {Order} Order
   */
  addPolicy(policy: Policy): OrderBuilder;
  /**
   * Add Policy.
   * @description will be forbidden once `builder`.`order` instance be built.
   * @param policies Policy[]
   * @returns {Order} Order
   */
  addPolicy(policies: Policy[]): OrderBuilder;
  addPolicy(arg0: Policy | Policy[]): any {
    if (this.hasBuiltOrders) {
      throw new Error('Policy is immutable if builder.build was called.');
    }

    this._policyManager.addPolicy(arg0);

    return this;
  }

  /**
   * Remove Policy.
   * @description will be forbidden once `builder`.`order` instance be built.
   * @param {Policy} policy Policy
   * @returns {Order} Order
   */
  removePolicy<PT extends Policy | string = Policy | string>(
    policy: PT
  ): OrderBuilder;
  /**
   * Remove Policies.
   * @description will be forbidden once `builder`.`order` instance be built.
   * @param {Array<Policy>} policies Policy[]
   * @returns {Order} Order
   */
  removePolicy<PT extends Policy | string = Policy | string>(
    policies: PT[]
  ): OrderBuilder;
  removePolicy<PT extends Policy | string = Policy | string>(
    arg0: PT | PT[]
  ): any {
    if (this.hasBuiltOrders) {
      throw new Error('Policy is immutable if builder.build was called.');
    }

    this._policyManager.removePolicy(arg0);

    return this;
  }
}
