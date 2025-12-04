import { Order } from '../../core/order';
import { Condition } from '../typings';
import { Validator, ValidatorDescription } from './typings';
import { ConditionOptionsBase } from '../../typings';

export class CouponValidator<Options extends ConditionOptionsBase = ConditionOptionsBase> implements Condition<
  ValidatorDescription,
  Options
> {
  readonly type = Validator.COUPON;
  readonly couponId: string;
  readonly options?: Options;

  /**
   * Check whether coupon is in order.
   * @param {String} couponId String
   * @returns {Condition} Condition
   */
  constructor(couponId: string, options?: Options) {
    this.couponId = couponId;
    this.options = options;
  }

  satisfy(order: Order): boolean {
    return order.coupons.some(couponId => couponId === this.couponId);
  }
}
