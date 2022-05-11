export type Condition<T extends Record<string, any> = Record<string, any>> = {
  satisfy(...a: any[]): boolean;
} & T;
