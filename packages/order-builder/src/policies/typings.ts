export type PolicyResult<T extends Record<string, any>> = {
  id: string;
} & T;

export interface Policy<T extends Record<string, any> = Record<string, any>> {
  id?: string;
  resolve<TT extends T = T>(..._: any[]): TT[];
  description(..._: any[]): PolicyResult<T>;
}
