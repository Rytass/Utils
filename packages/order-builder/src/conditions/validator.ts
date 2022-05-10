import { Order } from '../order-builder';
import { Condition } from './typings';

export enum Validator {
  COUPON = 'COUPON',
}

export type ValidatorDescription = {
  type: Validator;
};

/**
 * Check whether coupon is in order.
 * @param {String} couponId String
 */
export class CouponValidator implements Condition<ValidatorDescription> {
  readonly type = Validator.COUPON;
  readonly couponId: string;

  constructor(couponId: string) {
    this.couponId = couponId;
  }

  resolve(order: Order) {
    return order.coupons.some(couponId => couponId === this.couponId);
  }
}
