import { Optional } from '../typings';
import { Order } from './order';
import { OrderConfig, OrderConfigOption } from './configs/order-config';
import { OrderItem } from './typings';
import { OrderPolicyManager, RemovePolicy } from './order-policy-manager';
import { Policies, Policy } from '../policies';

/**
 * OrderConstructor
 * @param {Array} items OrderItem[]
 * @param {Array} coupons string[]
 */
interface OrderBuilderBuildInputs<
Item extends OrderItem = OrderItem,
Coupon extends string = string,
> {
  items: Item[];
  coupons?: Coupon[];
}

/**
 * Initial policies configuration in order-builder
 * @param {Array} policies Policy[]
 * @param {OrderConfigOption} config OrderConfigOption
 */
interface OrderBuilderConstructor extends Optional<OrderConfigOption> {
  policies: Policies[];
}

/**
 * OrderBuilder
 */
export class OrderBuilder<
Item extends OrderItem = OrderItem,
Coupon extends string = string,
> {
  private _hasBuiltOrders: boolean = false;
  private readonly _policyManager: OrderPolicyManager;
  /**
   * Get builder config.
   * @returns {OrderConfig} OrderConfig
   */
  readonly config: OrderConfig;

  /**
   * Check whether `builder`.`build` was called.
   * @returns {Boolean} Boolean
   */
  get hasBuiltOrders() {
    return this._hasBuiltOrders;
  }

  /**
   * Get all policies.
   * @returns {Array} Policies[]
   */
  get policies() {
    return this._policyManager.policies;
  }

  /** @param {OrderBuilderConstructorInput} options OrderBuilderConstructorInput */
  constructor(options: OrderBuilderConstructor);
  /** @param {OrderBuilder} builder OrderBuilder */
  constructor(builder: OrderBuilder<Item, Coupon>);
  /** OrderBuilder */
  constructor();
  constructor(arg0?: OrderBuilder<Item, Coupon> | OrderBuilderConstructor) {
    const { policies = [], ...config } = arg0 || {};

    this._policyManager = new OrderPolicyManager(arg0?.policies || []);
    this.config = new OrderConfig(
      arg0 instanceof OrderBuilder
        ? arg0.config
        : config as OrderConfigOption | undefined
    );
  }

  /**
   * Create an Order instance and make policies `readonly`
   * @param {OrderBuilderInput} OrderBuilderInput
   * @description `builder`.`policies` will be immutable after this method be called.
   * @returns {Order} Order
   */
  build<I extends Item, C extends Coupon>({
    items,
    coupons = [],
  }: OrderBuilderBuildInputs<I, C>): Order<I, C> {
    this._hasBuiltOrders = true;

    return new Order<I, C>(this, this._policyManager, {
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
  addPolicy(policy: Policies): OrderBuilder<Item, Coupon>;
  /**
   * Add Policy.
   * @description will be forbidden once `builder`.`order` instance be built.
   * @param policies Policy[]
   * @returns {Order} Order
   */
  addPolicy(policies: Policies[]): OrderBuilder<Item, Coupon>;
  addPolicy(arg0: Policies | Policies[]): OrderBuilder<Item, Coupon> {
    if (this.hasBuiltOrders) {
      throw new Error('Policy is immutable if builder.build was called.');
    }

    this._policyManager.addPolicy(arg0);

    return this;
  }

  /**
   * Remove Policy.
   * @description will be forbidden once `builder`.`order` instance be built.
   * @param {Policy} policy RemovePolicy
   * @returns {Order} Order
   */
  removePolicy<PT extends RemovePolicy>(policy: PT): OrderBuilder<Item, Coupon>;
  /**
   * Remove Policies.
   * @description will be forbidden once `builder`.`order` instance be built.
   * @param {Array<Policy>} policies Policy[]
   * @returns {Order} Order
   */
  removePolicy<PT extends RemovePolicy>(policies: PT[]): OrderBuilder<Item, Coupon>;
  removePolicy<PT extends RemovePolicy>(arg0: PT | PT[]): OrderBuilder<Item, Coupon> {
    if (this.hasBuiltOrders) {
      throw new Error('Policy is immutable if builder.build was called.');
    }

    this._policyManager.removePolicy(arg0);

    return this;
  }

  /**
   * Get Policy instance.
   * @param policyId String
   * @returns Policy | undefined
   */
  getPolicy(policyId: string): Policy | undefined {
    return this._policyManager.policyMap.get(policyId);
  }
}
