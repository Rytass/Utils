import { ObjRecord } from '../typings';

export enum PolicyPrefix {
  DISCOUNT = 'DISCOUNT',
}

export type PolicyResult<T extends ObjRecord> = {
  id: string;
} & T;

export interface Policy<T extends ObjRecord = ObjRecord> {
  id?: string;
  prefix: PolicyPrefix;
  resolve<TT extends T = T>(..._: any[]): TT[];
  description(..._: any[]): PolicyResult<T>;
}

export type Policies<P extends Policy = Policy> = P | P[]
