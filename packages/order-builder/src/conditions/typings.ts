export type Condition<T extends Record<string, any> = Record<string, any>> = {
  resolve(...a: any[]): boolean;
} & T;
