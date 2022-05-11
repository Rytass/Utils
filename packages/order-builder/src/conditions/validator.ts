import { Order } from '../core/order';
import { Condition } from './typings';

export enum Validator {
  COUPON = 'COUPON',
}

export type ValidatorDescription = {
  type: Validator;
};

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
