import { Order } from '../../core/order';
import { Condition } from '../typings';
import { Validator, ValidatorDescription } from './typings';

export class CouponValidator implements Condition<ValidatorDescription> {
  readonly type = Validator.COUPON;
  readonly couponId: string;

  /**
   * Check whether coupon is in order.
   * @param {String} couponId String
   * @returns {Condition} Condition
   */
  constructor(couponId: string) {
    this.couponId = couponId;
  }

  satisfy(order: Order) {
    return order.coupons.some(couponId => couponId === this.couponId);
  }
}
