export type LogisticsBaseStatus = 'DELIVERED' | 'DELIVERING' | 'SHELVED'

export type LogisticsStatus<T extends Logistics<unknown>> = LogisticsBaseStatus extends T['reference'] ? T['reference'] : never

export interface Logistics<T = LogisticsBaseStatus> {
  reference? : T,
  url: string,
  statusMap: (reference: any) => LogisticsStatusHistory<T>[];
}

export interface LogisticsStatusHistory<T> {
  businessPremise: string;
  date: string;
  status: T;
}

export interface LogisticsTraceResponse<K extends Logistics<LogisticsStatus<K>>> {
  logisticsId: string;
  statusHistory: ReturnType<K['statusMap']>
}

export interface LogisticsService<LogisticsType extends Logistics<LogisticsStatus<LogisticsType>>> {
  trace(request: string): Promise<LogisticsTraceResponse<LogisticsType>[]>;
  trace(request: string[]): Promise<LogisticsTraceResponse<LogisticsType>[]>;
}

