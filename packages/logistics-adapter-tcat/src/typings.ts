import { Logistics, LogisticsService } from 'logistics/src/typings';

export const TCatLogisticsStatusMap: { [key: string]: string } = {
  順利送達: 'DELIVERED',
  轉運中: 'TRANSPORTING',
  配送中: 'DELIVERING',
  取件中: 'COLLECTING',
  已集貨: 'CONSOLIDATED',
  取消取件: 'PICKUP_CANCELED',
  暫置營業所: 'SHELVED',
  調查處理中: 'INVESTIGATING',
  '配送中(當配下車) (當配上車)': 'DELIVERING_TODAY',
  '未順利取件，請洽客服中心': 'FAIL_PICKUP',
  '不在家.公司行號休息': 'AWAY_HOME',
} as const;

export type TCatLogisticsStatus =
  typeof TCatLogisticsStatusMap[keyof typeof TCatLogisticsStatusMap];

export interface TCatLogistics extends Logistics<TCatLogisticsStatus> {}

export interface TCatLogisticsService
  extends LogisticsService<TCatLogistics> {}

