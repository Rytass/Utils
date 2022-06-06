import {
  Logistics,
  LogisticsService,
  LogisticsStatusHistory,
  LogisticsTraceResponse,
} from '@rytass/logistics';
import axios from 'axios';
import cheerio from 'cheerio';

export class TCatLogisticsService<T extends Logistics>
  implements LogisticsService<T>
{
  private readonly traceUrl: string =
    'https://www.t-cat.com.tw/Inquire/TraceDetail.aspx';
  private readonly configuration: T

  constructor(configuration: T) {
    this.configuration = configuration
  }
  private getTraceUrl(logisticId: string) {
    return this.traceUrl + `?BillID=${logisticId}`;
  }

  private getLogisticsStatuses(
    id: string,
    html: string
  ): LogisticsTraceResponse<T> {
    const htmlDOM = cheerio.load(html);
    const statusElments = htmlDOM(this.configuration.referenceSelector);
    const statusHistory: LogisticsStatusHistory[] = [];

    statusElments.map((index, element) =>
      statusHistory.push(this.configuration.statusMap(htmlDOM(element).text()))
    );

    return {
      logisticsId: id,
      statusHistory: [],
    };
  }

  async trace(logisticsId: string): Promise<LogisticsTraceResponse<T>[]>;
  async trace(logisticsId: string[]): Promise<LogisticsTraceResponse<T>[]>;
  async trace(
    logisticsIds: string | string[]
  ): Promise<LogisticsTraceResponse<T>[]> {
    const logistics: LogisticsTraceResponse<T>[] = [];
    const ids: string[] =
      typeof logisticsIds === 'string' ? [logisticsIds] : logisticsIds;

    await Promise.all(
      ids.map(async (id) => {
        await axios
          .get(this.getTraceUrl(id))
          .then(({ data }) => logistics.push(data))
          .catch((error) => {
            throw error;
          });
      })
    );

    return logistics;
  }
}
