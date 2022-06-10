import { LogisticsStatusHistory } from '@rytass/logistics';
import { TCatLogisticsInterface, TCatLogisticsStatus } from '..';
import cheerio from 'cheerio';

export const TCatLogisticsStatusMap: { [key: string]: TCatLogisticsStatus } = {
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

export const TCatLogistics: TCatLogisticsInterface<TCatLogisticsStatus> = {
  url: 'https://www.t-cat.com.tw/Inquire/TraceDetail.aspx',
  statusMap: (reference: string, logisticId: string) => {
    const statusHistory: LogisticsStatusHistory<TCatLogisticsStatus>[] = [];
    const $ = cheerio.load(reference);
    const traceDOM = $(
      '#main > div.contentsArea > div > div > div > div > table > tbody > tr'
    );

    let isMatch = false;

    traceDOM.map((_index, dom) => {
      const innerText = $(dom).text();
      const statusArray = innerText.split(' ').filter(e => e != '');

      const status =
        TCatLogisticsStatusMap[statusArray[statusArray.length - 4]];

      const foundId = statusArray[0];

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
