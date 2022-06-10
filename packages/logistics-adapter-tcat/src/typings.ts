import {
  LogisticsInterface,
  LogisticsStatusHistory,
} from 'logistics/src/typings';

export type TCatLogisticsStatus =
  | 'DELIVERED'
  | 'TRANSPORTING'
  | 'DELIVERING'
  | 'COLLECTING'
  | 'CONSOLIDATED'
  | 'PICKUP_CANCELED'
  | 'SHELVED'
  | 'INVESTIGATING'
  | 'DELIVERING_TODAY'
  | 'FAIL_PICKUP'
  | 'AWAY_HOME';

export interface TCatLogisticsInterface<T> extends LogisticsInterface<T> {
  ignoreNotFound: boolean
  statusMap: (html: string, id: string) => LogisticsStatusHistory<T>[];
}
