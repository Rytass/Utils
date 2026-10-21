import { ValueTransformer } from 'typeorm';

/** PostgreSQL numeric 讀回來是字串，轉回 number */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};
