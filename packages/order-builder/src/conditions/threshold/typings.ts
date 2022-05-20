export enum Threshold {
  PRICE = 'PRICE_THRESHOLD',
  QUANTITY = 'QUANTITY_THRESHOLD',
}

export type ThresholdDescription = {
  type: Threshold;
  value: number;
};
