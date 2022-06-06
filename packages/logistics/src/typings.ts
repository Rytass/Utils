export type LogisticsStatus<T = any> = 'DELIVERED' | 'DELIVERING' | 'SHELVED' | keyof T

export interface Logistics<Status = LogisticsStatus> {
  referenceSelector: string;
  statusMap: (reference: string) => LogisticsStatusHistory<Status>;
}

export interface LogisticsStatusHistory<Status = unknown> {
  businessPremise: string;
  date: Date;
  status: Status;
}

export interface LogisticsTraceResponse<LogisticsType extends Logistics> {
  logisticsId: string;
  statusHistory: LogisticsStatusHistory<ReturnType<LogisticsType['statusMap']>>[];
}

export interface LogisticsService<LogisticsType extends Logistics> {
  trace(request: string): Promise<LogisticsTraceResponse<LogisticsType>[]>;
  trace(request: string[]): Promise<LogisticsTraceResponse<LogisticsType>[]>;
}
