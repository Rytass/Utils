import { Condition } from '../../conditions';
import { PolicyResult } from '../typings';

export enum Discount {
  PERCENTAGE = 'PERCENTAGE',
  VALUE = 'VALUE',
}

export type PolicyDiscountDescription = PolicyResult<{
  type: Discount;
  value: number;
  discount: number;
  conditions: Condition[];
}>;

export interface DiscountOptions {
  id: string;
}
