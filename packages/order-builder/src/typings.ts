/**
 * Base record type for extensible objects
 * Improved type-safe alternatives for specific use cases
 */

// Specific interfaces for type-safe usage
export interface OptionsBase {
  id?: string;
  onlyMatched?: boolean;
  excludedInCalculation?: boolean;
  stepLimit?: number;
  stepUnit?: 'quantity' | 'price';
  strategy?: 'LOW_PRICE_FIRST' | 'HIGH_PRICE_FIRST';
  threshold?: number;
  leastQuantity?: number;
  [key: string]: unknown;
}

export interface PolicyResultBase {
  id?: string;
  [key: string]: unknown;
}

export interface ConditionOptionsBase {
  threshold?: number;
  [key: string]: unknown;
}

export interface OrderItemExtension {
  [key: string]: string | number | boolean | undefined | null | unknown[];
}

// Gradual migration approach - keep ObjRecord but with better defaults where possible
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ObjRecord = Record<string, any>;

export type OptionalKeys<Obj extends ObjRecord> = {
  [Key in keyof Obj]?: Obj[Key];
};
