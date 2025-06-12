import {
  LogisticsService,
  LogisticsStatus,
  LogisticsTraceResponse,
  LogisticsError,
  ErrorCode,
} from '@rytass/logistics';
import axios from 'axios';
import { TCatLogisticsInterface, TCatLogisticsStatusHistory, TCatLogisticsTraceResponse } from './typings';

export class TCatLogisticsService<
  T extends TCatLogisticsInterface<LogisticsStatus<T>>,
> implements LogisticsService<T> {
  private readonly configuration: T;

  constructor(
    configuration: T extends TCatLogisticsInterface<LogisticsStatus<T>>
      ? T
      : never,
  ) {
    this.configuration = configuration;
  }
  private getTraceUrl(logisticId: string) {
    return (
      this.configuration.url + `?BillID=${logisticId}&ReturnUrl=Trace.aspx`
    );
  }

  private getLogisticsStatuses(
    id: string,
    html: string,
  ): TCatLogisticsTraceResponse<T> {
    const statusHistory = this.configuration.statusMap(html, id) as ReturnType<
      T['statusMap']
    >;

    if (!statusHistory.length && !this.configuration.ignoreNotFound)
      throw new LogisticsError(
        ErrorCode.NOT_FOUND_ERROR,
        `ID:${id} is not found.`,
      );

    return {
      logisticsId: id,
      statusHistory: this.configuration.statusMap(html, id) as TCatLogisticsStatusHistory<T['reference']>[],
    };
  }

  async trace(logisticsId: string): Promise<LogisticsTraceResponse<T>[]>;
  async trace(logisticsId: string[]): Promise<LogisticsTraceResponse<T>[]>;
  async trace(
    logisticsIds: string | string[],
  ): Promise<LogisticsTraceResponse<T>[]> {
    const logistics: TCatLogisticsTraceResponse<T>[] = [];
    const ids: string[] =
      typeof logisticsIds === 'string' ? [logisticsIds] : logisticsIds;

    await Promise.all(
      ids.map(async (id) => {
        await axios
          .get(this.getTraceUrl(id))
          .then(({ data }) =>
            logistics.push(this.getLogisticsStatuses(id, data)),
          )
          .catch((error) => {
            throw error;
          });
      }),
    );

    return logistics;
  }
}
