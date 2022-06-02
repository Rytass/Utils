export interface Logistics<T = unknown> {
  statusMap: {
    identifier: (reference: string) => Boolean;
    isStatus: T;
  }[];
}

export interface LogisticsStatusHistory<T = unknown> {
  date: Date;
  status: T;
}

export interface LogisticsTraceResponse<T = unknown> {
  logisticsId: string;
  currentStatus: T;
  statusHistory: LogisticsStatusHistory<T>[];
}

export interface LogisticsService<T extends Logistics> {
  trace(
    request: string
  ): Promise<LogisticsTraceResponse<T['statusMap'][number]['isStatus']>[]>;
  trace(
    request: string[]
  ): Promise<LogisticsTraceResponse<T['statusMap'][number]['isStatus']>[]>;
}
