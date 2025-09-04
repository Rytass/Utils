export type LogisticsBaseStatus = 'DELIVERED' | 'DELIVERING' | 'SHELVED';

export type LogisticsStatus<T extends LogisticsInterface<unknown>> = LogisticsBaseStatus extends T['reference']
  ? T['reference']
  : never;

export interface LogisticsInterface<T = LogisticsBaseStatus> {
  reference?: T;
  url: string;
}

export interface LogisticsStatusHistory<T> {
  date: string;
  status: T;
}

export interface LogisticsTraceResponse<K extends LogisticsInterface<LogisticsStatus<K>>> {
  logisticsId: string;
  statusHistory: LogisticsStatusHistory<K['reference']>[];
}

export interface LogisticsService<LogisticsType extends LogisticsInterface<LogisticsStatus<LogisticsType>>> {
  trace(request: string): Promise<LogisticsTraceResponse<LogisticsType>[]>;
  trace(request: string[]): Promise<LogisticsTraceResponse<LogisticsType>[]>;
}

export interface LogisticsErrorInterface {
  readonly code: string;
  readonly message?: string;
}
