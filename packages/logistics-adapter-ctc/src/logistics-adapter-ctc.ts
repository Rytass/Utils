import {
  ErrorCode,
  LogisticsError,
  LogisticsService,
  LogisticsStatus,
  LogisticsTraceResponse
} from '@rytass/logistics';
import axios from 'axios';
import { CtcLogisticsInterface, CtcLogisticsStatusEnum, CtcLogisticsStatusHistory, CtcLogisticsStatusMap } from './typings';

export class CtcLogisticsService<
  T extends CtcLogisticsInterface<LogisticsStatus<T>>,
> implements LogisticsService<T> {
  private readonly configuration: T;

  constructor(
    configuration: T extends CtcLogisticsInterface<LogisticsStatus<T>>
      ? T
      : never,
  ) {
    this.configuration = configuration;
  }

  async getLogisticsStatuses(
    id: string,
  ): Promise<LogisticsTraceResponse<T>> {

    try {
      const result = await axios.get<{
        error: string | null;
        success: boolean;
        shipment_history: {
          status: string;
          code: string;
          created_at: string;
        }[];
        images: string[];
      }>(`${this.configuration.url}/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          'api-token': this.configuration.apiToken,
        },
      })

      const { status, data } = result;

      if (status !== 200) {
        if (!this.configuration.ignoreNotFound) {
          throw new LogisticsError(ErrorCode.INVALID_PARAMETER, `Failed to fetch logistics status for ID: ${id}`);
        } else {
          console.warn(`Ignoring not found for ID: ${id}`);

          return {
            logisticsId: id,
            statusHistory: [],
          }
        }
      } else {
        if (!data.success && !this.configuration.ignoreNotFound) {
          throw new LogisticsError(ErrorCode.INVALID_PARAMETER, `ID:${id} is not found.`);
        } else if (!data.success) {
          console.warn(`Ignoring not found for ID: ${id}`);

          return {
            logisticsId: id,
            statusHistory: [],
          }
        }
      }

      const statusHistory = data.shipment_history.map((history) => {
        return {
          date: history.created_at,
          status: CtcLogisticsStatusMap[history.status] as T['reference'],
          statusCode: history.code as unknown as CtcLogisticsStatusEnum,
        }
      });

      return {
        logisticsId: id,
        statusHistory: statusHistory as CtcLogisticsStatusHistory<T['reference']>[],
      }

    } catch (err) {
      if (err instanceof LogisticsError) {
        throw err;
      }

      if (axios.isAxiosError(err)) {
        if (!this.configuration.ignoreNotFound) {
          if (err.response?.status === 403) {
            throw new LogisticsError(
              ErrorCode.PERMISSION_DENIED,
              `No Permission to view ID:${id}`,
            );
          }

          throw new LogisticsError(
            ErrorCode.INVALID_PARAMETER,
            `Failed to fetch logistics status for ID: ${id}, ${JSON.stringify(err.response?.data)}`,
          );

        } else {

          return {
            logisticsId: id,
            statusHistory: [],
          }
        }
      }

      throw err
    }
  }

  async trace(logisticsId: string): Promise<LogisticsTraceResponse<T>[]>;
  async trace(logisticsIds: string[]): Promise<LogisticsTraceResponse<T>[]>;
  async trace(
    logisticsIds: string | string[],
  ): Promise<LogisticsTraceResponse<T>[]> {
    const ids = Array.isArray(logisticsIds) ? logisticsIds : [logisticsIds];

    return Promise.all(ids.map(id => this.getLogisticsStatuses(id)))
  }
}
