import { Order } from './order';
import { OrderItem } from './typings';
import { OrderPolicyManager } from './order-policy-manager';
import { Policy } from '../policies';

/**
 * OrderBuilderInputs
 * @param {Array} items OrderItem[] - `required`
 * @param {Array} coupons string - `optional`
 */
interface OrderBuilderInput<
  Item extends OrderItem = OrderItem,
  Coupon extends string = string
> {
  items: Item[];
  coupons?: Coupon[];
}

/**
 * Initial policies configuration in order-builder
 * @param {Array} policies Policy[]
 */
interface OrderBuilderConstructorInput {
  policies: Policy[];
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

  /** @param {OrderBuilderOptions} options OrderBuilderOptions */
  constructor(options: OrderBuilderConstructorInput);
  /** @param {OrderBuilder} builder OrderBuilder */
  constructor(builder: OrderBuilder);
  constructor();
  constructor(arg0?: OrderBuilder | OrderBuilderConstructorInput) {
    this._policyManager = new OrderPolicyManager(arg0?.policies || []);
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
