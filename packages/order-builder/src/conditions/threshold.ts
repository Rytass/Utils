import { Order } from '../order-builder';
import { Condition } from './typings';

export type ThresholdDescription = {
  type: 'THRESHOLD';
  value: number;
};

export class PriceThreshold implements Condition<ThresholdDescription> {
  value!: number;
  type = 'THRESHOLD' as const;

  constructor(value: number) {
    this.value = value;
  }

  resolve<O extends Order = Order>(order: O) {
    return order.getItemsValue() >= this.value;
  }
}