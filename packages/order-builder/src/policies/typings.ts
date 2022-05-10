export type PolicyResult<T extends Record<string, any>> = {
  id: string;
} & T;

export interface Policy<T extends Record<string, any> = Record<string, any>> {
  id?: string;
  resolve<TT extends T = T>(...a: any[]): TT[];
  description(...a: any[]): PolicyResult<T>;
}
