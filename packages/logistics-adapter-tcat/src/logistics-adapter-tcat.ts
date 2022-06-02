import { LogisticsService, LogisticsTraceResponse } from '@rytass/logistics';
import { TCatLogistics, TCatLogisticsStatus } from '.';
import axios from 'axios'

export class LogisticsTCat implements LogisticsService<TCatLogistics> {
    private readonly traceUrl: string = 'https://www.t-cat.com.tw/Inquire/TraceDetail.aspx'

    async trace(logisticsId: string): Promise<LogisticsTraceResponse<TCatLogisticsStatus>[]>;
    async trace(logisticsId: string[]): Promise<LogisticsTraceResponse<TCatLogisticsStatus>[]>;
    async trace(logisticsIds: string | string[]): Promise<LogisticsTraceResponse<TCatLogisticsStatus>[]> {
        return []
    }
}