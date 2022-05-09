import { Order } from '../order-builder';
import { Condition } from './typings';

export enum Validator {
  COUPON = 'COUPON',
}

export type ValidatorDescription = {
  type: Validator;
};

export class CouponValidator implements Condition<ValidatorDescription> {
  type = Validator.COUPON;
  couponId: string;

  constructor(couponId: string) {
    this.couponId = couponId;
  }

  resolve(order: Order) {
    return order.coupons.some(couponId => couponId === this.couponId);
  }
}