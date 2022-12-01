import cheerio from 'cheerio';

import { LogisticsInterface, LogisticsStatusHistory } from '@rytass/logistics';

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

/**
 * Create customized logistics interface for TCAT
 *
 * The type parameter need to satisfy at least `DELIVEERED` | `DELIVERING` | `SHELVED`,
 * and provide a statusMap function to generate array of *LogisticsStatusHistory* with corresponding status.
 *
 * ```
 * import { TCatLogisticsService, TCatLogisticsInterface } from '@rytass/logistics-adapter-tcat'
 *
 * type customStatus = 'DELIVERED' | 'DELIVERING' | 'SHELVED' | 'TEST'
 *
 * const customLogistics: TCatLogisticsInterface<customStatus> = {
 *     ignoreNotFound: false,
 *     url: 'https://www.t-cat.com.tw/Inquire/TraceDetail.aspx',
 *     statusMap(reference: string, id: string) => {
 *     ...
 *   }
 * }
 *
 * const logistics = new TCatLogisticsService(customLogistics)
 * ```
 */
export interface TCatLogisticsInterface<T> extends LogisticsInterface<T> {
  ignoreNotFound: boolean;
  /**
   * A logistic result html and its id will be passed into statusMap
   */
  statusMap: (html: string, id: string) => LogisticsStatusHistory<T>[];
}

const TCatLogisticsStatusMap: { [key: string]: TCatLogisticsStatus } = {
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
};

export const TCatLogistics: TCatLogisticsInterface<TCatLogisticsStatus> = {
  ignoreNotFound: false,
  url: 'https://www.t-cat.com.tw/Inquire/TraceDetail.aspx',
  statusMap: (
    reference: string,
    logisticId: string
  ): LogisticsStatusHistory<TCatLogisticsStatus>[] => {
    const statusHistory: LogisticsStatusHistory<TCatLogisticsStatus>[] = [];
    const $ = cheerio.load(reference);
    const traceDOM = $('#resultTable tr');

    let isMatch: boolean = false;

    traceDOM.map((_index, dom) => {
      const innerText: string = $(dom).text();

      const statusArray: string[] = innerText.split(' ').filter(e => e != '');

      const status: TCatLogisticsStatus =
        TCatLogisticsStatusMap[statusArray[statusArray.length - 4]];

      const foundId: string = statusArray[0];

      if (foundId === logisticId) isMatch = true;
      if (status)
        statusHistory.push({
          businessPremise: statusArray[statusArray.length - 1],
          date: `${statusArray[statusArray.length - 3]} ${
            statusArray[statusArray.length - 2]
          }`,
          status: status,
        });
    });

    return isMatch ? statusHistory : [];
  },
};
