import { Policy, PolicyDiscountDescription } from './policies';
import { OrderItem } from './typings';
import { minus, plus, times } from './utils/decimal';

/**
 * OrderBuilderOptions
 */
class OrderBuilderOptions {
  policies!: Policy<any>[];
}

/**
 * OrderPolicyManager
 */
class OrderPolicyManager<P extends Policy<any> = Policy<any>> {
  private _ps: P[];
  private _policyMap: Map<string, P>;

  constructor(policies: P[]) {
    this._ps = policies;

    this._policyMap = new Map(
      policies.map((p, index) => [p?.id || `${index + 1}`, p])
    );
  }

  get policies(): P[] {
    return this._ps;
  }

  addPolicy(p: P): void;
  addPolicy(ps: P[]): void;
  addPolicy(arg0: P | P[]): void;
  addPolicy(arg0: P | P[]): any {
    const addOne = (p: P) => {
      this._ps.push(p);
      this._policyMap.set(p?.id || `${this._policyMap.size + 1}`, p);
    };

    Array.isArray(arg0) ? arg0.forEach(addOne) : addOne(arg0);
  }

  removePolicy<PT extends P | string = P | string>(p: PT): void;
  removePolicy<PT extends P | string = P | string>(ps: PT[]): void;
  removePolicy<PT extends P | string = P | string>(arg0: PT | PT[]): void;
  removePolicy<PT extends P | string = P | string>(arg0: PT | PT[]): void {
    const removeOne = (pOrPId: P | string) => {
      const id = typeof pOrPId === 'string' ? pOrPId : pOrPId?.id;

      if (id) {
        this._ps = this._ps.filter(p => p.id !== id);
        this._policyMap.delete(id);
      }
    };

    Array.isArray(arg0) ? arg0.forEach(removeOne) : removeOne(arg0);
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
  private _coupons: Set<Coupon>;
  private _policyManager: OrderPolicyManager;

  get items() {
    return this._items;
  }

  get coupons() {
    return Array.from(this._coupons.values());
  }

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

  addCoupon(id: Coupon) {
    this._coupons.add(id);

    return this;
  }

  removeItem(id: string, quantity: number) {
    this._items = this._items.reduce((acc, cur) => {
      if (cur.id !== id) {
        acc.push(cur);
      } else {
        const predictQuantity = minus(cur.quantity, quantity);

        if (predictQuantity > 0) {
          acc.push({
            ...cur,
            quantity: predictQuantity,
          });
        }
      }

      return acc;
    }, [] as Item[]);

    return this;
  }

  getItemsValue() {
    return this.items.reduce(
      (total, item) => plus(total, times(item.quantity, item.unitPrice)),
      0
    );
  }

  getPrice() {
    const itemValue = this.getItemsValue();
    const totalDiscount = this.getDiscounts().reduce(
      (total, policy) => plus(total, policy.discount),
      0
    );

    return minus(itemValue, totalDiscount);
  }

  getDiscountValue() {
    return this.getDiscounts().reduce(
      (total, policy) => plus(total, policy.discount),
      0
    );
  }

  getDiscounts<
    T extends PolicyDiscountDescription = PolicyDiscountDescription
  >() {
    return this.policies.reduce(
      (total, p) => p.resolve(this, total),
      [] as T[]
    );
  }
}

/**
 * OrderBuilder
 */
export class OrderBuilder<P extends Policy<any> = Policy<any>> {
  private _hasBuilt: boolean = false;
  private _policyManager: OrderPolicyManager;

  get hasBuilt() {
    return this._hasBuilt;
  }

  get policies() {
    return this._policyManager.policies;
  }

  constructor(options: OrderBuilderOptions);
  constructor(builder: OrderBuilder<P>);
  constructor(arg0: OrderBuilder<P> | OrderBuilderOptions) {
    this._policyManager = new OrderPolicyManager(arg0.policies);
  }

  build({ items, coupons = [] }: OrderBuilderInput): Order {
    this._hasBuilt = true;

    return new Order(this._policyManager, {
      items,
      coupons,
    });
  }

  /** @param policy Policy */
  addPolicy(policy: P): OrderBuilder<P>;
  /** @param policies Policy[] */
  addPolicy(policies: P[]): OrderBuilder<P>;
  addPolicy(arg0: P | P[]): any {
    this._throwErrorIfHasBuilt(); // Policy is immutable if builder.build was called.
    this._policyManager.addPolicy(arg0);

    return this;
  }

  /** @param id String */
  removePolicy<T extends P['id'] = string>(id: T): OrderBuilder<P>;
  /** @param policy Policy */
  removePolicy<PT extends P | string = P | string>(policy: PT): OrderBuilder<P>;
  removePolicy<PT extends P | string = P | string>(policies: PT[]): OrderBuilder<P>;
  removePolicy<PT extends P | string = P | string>(arg0: PT | PT[]): any {
    this._throwErrorIfHasBuilt(); // Policy is immutable if builder.build was called.
    this._policyManager.removePolicy(arg0);

    return this;
  }

  private _throwErrorIfHasBuilt() {
    if (this.hasBuilt) {
      throw new Error('Policy is immutable if builder.build was called.');
    }
  }
}
