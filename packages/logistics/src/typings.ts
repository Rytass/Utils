export type LogisticsStatus<T> = 'DELIVERED' | 'DELIVERING' | 'SHELVED' | keyof T

export interface Logistics<T> {
  url: string,
  statusMap: (reference: any) => LogisticsStatusHistory<T>[];
}

export interface LogisticsStatusHistory<T> {
  businessPremise: string;
  date: string;
  status: T;
}

export interface LogisticsTraceResponse<K extends Logistics<unknown>> {
  logisticsId: string;
  statusHistory: ReturnType<K['statusMap']>
}

export interface LogisticsService<LogisticsType extends Logistics<unknown>> {
  trace(request: string): Promise<LogisticsTraceResponse<LogisticsType>[]>;
  trace(request: string[]): Promise<LogisticsTraceResponse<LogisticsType>[]>;
}

