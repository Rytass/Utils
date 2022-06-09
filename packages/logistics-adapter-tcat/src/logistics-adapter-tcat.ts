import {
  Logistics,
  LogisticsService,
  LogisticsStatus,
  LogisticsTraceResponse,
} from '@rytass/logistics';
import axios from 'axios';
import { TCatLogistics } from '.';

export class TCatLogisticsService<T extends Logistics<LogisticsStatus<T>>>
  implements LogisticsService<T>
{
  private readonly configuration: T

  constructor(configuration: T extends Logistics<LogisticsStatus<T>> ? T : never) {
    this.configuration = configuration
  }
  private getTraceUrl(logisticId: string) {
    return this.configuration.url + `?BillID=${logisticId}`;
  }

  private getLogisticsStatuses(
    id: string,
    html: string
  ): LogisticsTraceResponse<T> {

    return {
      logisticsId: id,
      statusHistory: this.configuration.statusMap(html) as ReturnType<T['statusMap']>,
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