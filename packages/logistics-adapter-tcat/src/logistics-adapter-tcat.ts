import {
  LogisticsInterface,
  LogisticsService,
  LogisticsStatus,
  LogisticsTraceResponse,
} from '@rytass/logistics';
import axios from 'axios';

export class TCatLogisticsService<T extends LogisticsInterface<LogisticsStatus<T>>>
  implements LogisticsService<T>
{
  private readonly configuration: T

  constructor(configuration: T extends LogisticsInterface<LogisticsStatus<T>> ? T : never) {
    this.configuration = configuration
  }
  private getTraceUrl(logisticId: string) {
    return this.configuration.url + `?BillID=${logisticId}&ReturnUrl=Trace.aspx`;
  }

  private getLogisticsStatuses(
    id: string,
    html: string
  ): LogisticsTraceResponse<T> {

    return {
      logisticsId: id,
      statusHistory: this.configuration.statusMap(html, id) as ReturnType<T['statusMap']>,
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
          .then(({ data }) => logistics.push(this.getLogisticsStatuses(id, data)))
          .catch((error) => {
            throw error;
          });
      })
    );

    return logistics;
  }
}