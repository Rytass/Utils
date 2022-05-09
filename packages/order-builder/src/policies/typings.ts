export type PolicyResult<T extends Record<string, any>, > = {
  id: string;
} & T;

export interface Policy<
  T extends Record<string, any>> {
  id?: string;
  resolve(...a: any[]): T[];
  description(...a: any[]): PolicyResult<T>;
}
