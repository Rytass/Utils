import {
  ErrorCode,
  LogisticsError,
  LogisticsService,
  LogisticsStatus,
  LogisticsTraceResponse,
} from '@rytass/logistics';
import axios from 'axios';
import {
  CreateOrUpdateCtcLogisticsOptions,
  CreateOrUpdateCtcLogisticsRequest,
  CreateOrUpdateCtcLogisticsResponse,
  CtcLogisticsDto,
  CtcLogisticsInterface,
  CtcLogisticsStatusEnum,
  CtcLogisticsStatusHistory,
  CtcLogisticsStatusMap,
} from './typings';

export class CtcLogisticsService<T extends CtcLogisticsInterface<LogisticsStatus<T>>> implements LogisticsService<T> {
  private readonly configuration: T;

  constructor(configuration: T extends CtcLogisticsInterface<LogisticsStatus<T>> ? T : never) {
    this.configuration = configuration;
  }

  private async getLogisticsStatuses(trackingNumber: string): Promise<LogisticsTraceResponse<T>> {
    try {
      const result = await axios.get<{
        success: boolean;
        shipment_history: {
          status: string;
          code: string;
          created_at: string;
        }[];
        images: string[];
      }>(`${this.configuration.url}/${trackingNumber}`, {
        headers: {
          'Content-Type': 'application/json',
          'api-token': this.configuration.apiToken,
        },
      });

      const { status, data } = result;

      if (status !== 200) {
        if (!this.configuration.ignoreNotFound) {
          throw new LogisticsError(
            ErrorCode.INVALID_PARAMETER,
            `Failed to fetch logistics status for ID: ${trackingNumber}`,
          );
        } else {
          return {
            logisticsId: trackingNumber,
            statusHistory: [],
          };
        }
      } else {
        if (!data.success && !this.configuration.ignoreNotFound) {
          throw new LogisticsError(ErrorCode.INVALID_PARAMETER, `ID:${trackingNumber} is not found.`);
        } else if (!data.success) {
          return {
            logisticsId: trackingNumber,
            statusHistory: [],
          };
        }
      }

      const statusHistory = data.shipment_history.map(history => {
        return {
          date: history.created_at,
          status: CtcLogisticsStatusMap[history.status] as T['reference'],
          statusCode: history.code as unknown as CtcLogisticsStatusEnum,
        };
      });

      return {
        logisticsId: trackingNumber,
        statusHistory: statusHistory as CtcLogisticsStatusHistory<T['reference']>[],
      };
    } catch (err) {
      if (err instanceof LogisticsError) {
        throw err;
      }

      if (axios.isAxiosError(err)) {
        if (!this.configuration.ignoreNotFound) {
          if (err.response?.status === 403) {
            throw new LogisticsError(ErrorCode.PERMISSION_DENIED, `No Permission to view ID:${trackingNumber}`);
          }

          throw new LogisticsError(
            ErrorCode.INVALID_PARAMETER,
            `Failed to fetch logistics status for ID: ${trackingNumber}, ${JSON.stringify(err.response?.data)}`,
          );
        } else {
          return {
            logisticsId: trackingNumber,
            statusHistory: [],
          };
        }
      }

      throw err;
    }
  }

  async trace(logisticsId: string): Promise<LogisticsTraceResponse<T>[]>;
  async trace(logisticsIds: string[]): Promise<LogisticsTraceResponse<T>[]>;
  async trace(logisticsIds: string | string[]): Promise<LogisticsTraceResponse<T>[]> {
    const ids = Array.isArray(logisticsIds) ? logisticsIds : [logisticsIds];

    return Promise.all(ids.map(id => this.getLogisticsStatuses(id)));
  }

  async create(options: CreateOrUpdateCtcLogisticsOptions): Promise<CtcLogisticsDto> {
    const { senderTel, senderMobile, receiverMobile, receiverTel } = options;

    if (!senderTel && !senderMobile) {
      throw new LogisticsError(ErrorCode.INVALID_PARAMETER, 'Either senderTel or senderMobile must be provided.');
    }

    if (!receiverTel && !receiverMobile) {
      throw new LogisticsError(ErrorCode.INVALID_PARAMETER, 'Either receiverTel or receiverMobile must be provided.');
    }

    const requestBody: CreateOrUpdateCtcLogisticsRequest = {
      order: {
        tracking_number: options.trackingNumber, // 建立可指定查件單號, 更新時可帶入托運單號做更新
        customer_department_id: options.customerDepartmentId,
        customer_department_unit_id: options.customerDepartmentUnitId,

        sender_company: options.senderCompany,
        sender_contact_name: options.senderContactName ?? options.senderCompany,
        sender_tel: senderTel ?? '',
        sender_mobile: senderMobile ?? '',
        sender_address: options.senderAddress,
        sender_remark: options.senderRemark ?? '',

        receiver_company: options.receiverCompany,
        receiver_contact_name: options.receiverContactName,
        receiver_tel: receiverTel ?? '',
        receiver_mobile: receiverMobile ?? '',
        receiver_address: options.receiverAddress,
        receiver_remark: options.receiverRemark ?? '',
        pay_code: options.payCode,

        shipment_content: options.shipmentContent ?? '貨件', // 固定為 '貨件'
        transportation: options.transportation ?? 'truck', // 固定為 'truck'
        shipping_method: options.shippingMethod ?? 'land', // 固定為 'land'
        payer: options.payer ?? 'receiver', // 固定為 'receiver'
        shipping_time: options.shippingTime ?? 'regular', // 固定為 'regular'
        payment_method: options.paymentMethod ?? 'monthly', // 固定為 'monthly'
        quantity: options.quantity ?? 1, // 固定為 1
        weight: options.weight ?? 1, // 固定為 1
        volume: options.volume ?? 1, // 固定為 1
      },
    };

    try {
      const { data } = await axios.post<CreateOrUpdateCtcLogisticsResponse>(`${this.configuration.url}`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'api-token': this.configuration.apiToken,
        },
      });

      if (!data.success) {
        if (options.trackingNumber) {
          throw new LogisticsError(
            ErrorCode.INVALID_PARAMETER,
            `Failed to create logistics with tracking number: ${options.trackingNumber}, ${JSON.stringify(data)}`,
          );
        }

        throw new LogisticsError(
          ErrorCode.INVALID_PARAMETER,
          `Failed to create logistics, error: ${JSON.stringify(data)}`,
        );
      }

      return {
        trackingNumber: data.tracking_number,
        shippingNumber: data.shipping_number,
      };
    } catch (err) {
      if (err instanceof LogisticsError) {
        throw err;
      }

      if (axios.isAxiosError(err)) {
        const response = err.response;

        const errorMessage = options.trackingNumber
          ? `Failed to create logistics with tracking number: ${options.trackingNumber}, ${response?.data.error}`
          : `Failed to create logistics, ${response?.data.error}`;

        throw new LogisticsError(ErrorCode.INVALID_PARAMETER, errorMessage);
      }

      throw err;
    }
  }

  async update(options: CreateOrUpdateCtcLogisticsOptions): Promise<CtcLogisticsDto> {
    const { trackingNumber } = options;

    if (!trackingNumber) {
      throw new LogisticsError(ErrorCode.INVALID_PARAMETER, 'trackingNumber is required for update.');
    }

    try {
      const data: LogisticsTraceResponse<T> = await this.getLogisticsStatuses(trackingNumber);

      if (data.statusHistory.length === 0) {
        throw new LogisticsError(
          ErrorCode.NOT_FOUND_ERROR,
          `Logistics with tracking number: ${trackingNumber} not found.`,
        );
      }

      return this.create(options);
    } catch (err) {
      if (err instanceof LogisticsError) {
        throw err;
      }

      if (axios.isAxiosError(err)) {
        throw new LogisticsError(
          ErrorCode.INVALID_PARAMETER,
          `Failed to update logistics with tracking number: ${trackingNumber}, ${JSON.stringify(err.response?.data)}`,
        );
      }

      throw err;
    }
  }
}
