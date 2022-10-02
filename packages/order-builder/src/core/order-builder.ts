import { OptionalKeys } from '../typings';
import { Order } from './order';
import { OrderConfig, OrderConfigOption } from './configs/order-config';
import { OrderItem, OrderLogistics } from './typings';
import { OrderPolicyManager, RemovePolicy } from './order-policy-manager';
import { Policies, Policy } from '../policies';
import { applyOrderLogisticAndReturnLogisticsItem, generateNewOrderId, ORDER_LOGISTICS_ID } from './utils';

/**
 * OrderConstructor
 * @param {Array} items OrderItem[]
 * @param {Array} coupons string[]
 */
interface OrderBuilderBuildInputs<
  Item extends OrderItem = OrderItem,
  Coupon extends string = string
> {
  id?: string;
  items: Item[];
  coupons?: Coupon[];
  logistics?: OrderLogistics;
}

/**
 * Initial policies configuration in order-builder
 * @param {Array} policies Policy[]
 * @param {OrderConfigOption} config OrderConfigOption
 */
interface OrderBuilderConstructor extends OptionalKeys<OrderConfigOption> {
  policies?: Policies[];
}

/**
 * OrderBuilder
 */
export class OrderBuilder<
  Item extends OrderItem = OrderItem,
  Coupon extends string = string
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
  get hasBuiltOrders(): boolean {
    return this._hasBuiltOrders;
  }

  /**
   * Get all policies.
   * @returns {Array} Policies[]
   */
  get policies(): Policies[] {
    return this._policyManager.policies;
  }

  /** @param {OrderBuilderConstructor} options OrderBuilderConstructor */
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
        : (config as OrderConfigOption | undefined)
    );
  }

  /**
   * Create an Order instance and make policies `readonly`
   * @param {OrderBuilderInput} OrderBuilderInput
   * @description `builder`.`policies` will be immutable after this method be called.
   * @returns {Order} Order
   */
  public build<I extends Item, C extends Coupon>({
    id: orderId,
    items: itemsProp,
    coupons = [],
    logistics: logisticsProp,
  }: OrderBuilderBuildInputs<I, C>): Order<I, C> {
    const id = orderId || generateNewOrderId();

    // Items logic
    const items = itemsProp.filter(item => item.id !== ORDER_LOGISTICS_ID);

    // Logistic logic
    const logistics = logisticsProp || this.config.logistics;

    if (typeof logistics !== 'undefined') {
      items.push(applyOrderLogisticAndReturnLogisticsItem(this, logistics));
    }

    this._hasBuiltOrders = true;

    return new Order<I, C>(this, this._policyManager, {
      id,
      items,
      coupons,
    });
  }

  /**
   * Clone current policy instance. (Will get different instance.)
   */
  public clone(): OrderBuilder<Item, Coupon> {
    return new OrderBuilder<Item, Coupon>(this);
  }

  /**
   * Add Policy.
   * @description will be forbidden once `builder`.`order` instance be built.
   * @param policy Policy
   * @returns {OrderBuilder} OrderBuilder
   */
  public addPolicy(policy: Policies): OrderBuilder<Item, Coupon>;
  /**
   * Add Policy.
   * @description will be forbidden once `builder`.`order` instance be built.
   * @param policies Policy[]
   * @returns {OrderBuilder} OrderBuilder
   */
  public addPolicy(policies: Policies[]): OrderBuilder<Item, Coupon>;
  public addPolicy(arg0: Policies | Policies[]): OrderBuilder<Item, Coupon> {
    if (this.hasBuiltOrders) {
      throw new Error('Policy is immutable if builder.build was called. You should call builder.clone first.');
    }

    this._policyManager.addPolicy(arg0);

    return this;
  }

  /**
   * Remove Policy.
   * @description will be forbidden once `builder`.`order` instance be built.
   * @param {Policy} policy RemovePolicy
   * @returns {OrderBuilder} OrderBuilder
   */
  public removePolicy<PT extends RemovePolicy>(policy: PT): OrderBuilder<Item, Coupon>;
  /**
   * Remove Policies.
   * @description will be forbidden once `builder`.`order` instance be built.
   * @param {Array<Policy>} policies Policy[]
   * @returns {OrderBuilder} OrderBuilder
   */
  public removePolicy<PT extends RemovePolicy>(
    policies: PT[]
  ): OrderBuilder<Item, Coupon>;
  public removePolicy<PT extends RemovePolicy>(
    arg0: PT | PT[]
  ): OrderBuilder<Item, Coupon> {
    if (this.hasBuiltOrders) {
      throw new Error('Policy is immutable if builder.build was called. You should call builder.clone first.');
    }

    this._policyManager.removePolicy(arg0);

    return this;
  }

  /**
   * Get Policy instance.
   * @param policyId String
   * @returns Policy | undefined
   */
  public getPolicy(policyId: string): Policy | undefined {
    return this._policyManager.policyMap.get(policyId);
  }

  /**
   * Set logistics.
   * @param logistics OrderLogistic
   * @return {OrderBuilder} OrderBuilder
   */
  public setLogistics(logistics: OrderLogistics): OrderBuilder {
    this.config.updateLogistics(logistics);

    return this;
  }
}
