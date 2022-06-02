import { Logistics, LogisticsService } from '@rytass/logistics';

export enum TCatLogisticsStatus {
  DELIVERED = 'DELIVERED',
  TRANSPORTING = 'TRANSPORTING',
  DELIVERING = 'DELIVERING',
  DELIVERING_TODAY = 'DELIVERING_TODAY',
  COLLECTING = 'COLLECTING',
  CONSOLIDATED = 'CONSOLIDATED',
  PICKUP_CANCELED = 'PICKUP_CANCELED',
  FAIL_PICKUP = 'FAIL_PICKUP',
  SHELVED = 'SHELVED',
  INVESTIGATING = 'INVESTIGATING',
  AWAY_HOME = 'AWAY_HOME',
}

export interface TCatLogistics extends Logistics<TCatLogisticsStatus> {}