import { Logistics, LogisticsStatusHistory } from '@rytass/logistics';
import { TCatLogisticsStatus, TCatLogisticsStatusMap } from '..';
import cheerio from 'cheerio';

export const TCatLogistics: Logistics<TCatLogisticsStatus> = {
  url: 'https://www.t-cat.com.tw/Inquire/TraceDetail.aspx',
  statusMap: (reference: string) => {
    const statusHistory: LogisticsStatusHistory<TCatLogisticsStatus>[] = [];
    const $ = cheerio.load(reference);
    const traceDOM = $(
      '#main > div.contentsArea > div > div > div > div > table > tbody > tr'
    );

    traceDOM.map((_index, dom) => {
      const innerText = $(dom).text();
      const statusArray = innerText.split(' ').filter(e => e != '');
      const status =
        TCatLogisticsStatusMap[statusArray[statusArray.length - 3]];

        if (status)
            statusHistory.push({
                businessPremise: statusArray[statusArray.length - 1],
                date: statusArray[statusArray.length - 2],
                status: status,
            })
    });

    return statusHistory;
  },
};
