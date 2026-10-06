import { FusionRestClient } from '../client/fusion-rest-client';
import type { FusionListResponse, FusionRequestOptions } from '../client/fusion-rest-client';
import { FUSION_RESOURCES } from '../constants/resources';
import { withFusionQuery } from '../query/fusion-query';

/**
 * `ClosingStatus` 的取值。
 *
 * 能否入帳不只看 `O`：子帳模組（如 Receivables）在 `F` 期間也能建立交易，但 GL 過帳需要 `O`。
 * 這個判斷依模組而異，因此這裡只給語意，不提供單一的「可入帳」函式。
 */
export const FUSION_PERIOD_CLOSING_STATUS = {
  OPEN: 'O',
  CLOSED: 'C',
  FUTURE_ENTERABLE: 'F',
  NEVER_OPENED: 'N',
  PERMANENTLY_CLOSED: 'P',
  CLOSE_PENDING: 'W',
} as const;

export interface AccountingPeriodStatusQuery {
  readonly ledgerId: string | number;
  /** Fusion 的期間名（`PeriodNameId`），格式依帳本的會計行事曆而定，如 `Sep-26`。 */
  readonly periodName: string;
  /**
   * 子帳模組的 `ApplicationId`（GL 101、AR 222…）。**必填**：同一帳本同一期間在各模組有各自的
   * 狀態，不指定時 Fusion 會回傳任一模組的資料。
   */
  readonly applicationId: number;
}

export interface AccountingPeriodStatus {
  readonly ledgerId: string;
  readonly periodName: string;
  readonly applicationId: number;
  /** 原始 `ClosingStatus`，見 `FUSION_PERIOD_CLOSING_STATUS`。 */
  readonly closingStatus: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
}

interface AccountingPeriodStatusItem {
  readonly ClosingStatus?: string;
  readonly StartDate?: string;
  readonly EndDate?: string;
}

/**
 * `q` 沒有跳脫語法，值會被當成查詢語法的一部分解讀：`;` 可以多塞一個條件，而 `or`、
 * `is not null` 這類運算子只由字母與空白組成——所以空白也不能放行，否則
 * `Sep-26 or ApplicationId is not null` 就能把查詢從指定的子帳模組擴大到全部。
 * 這些值常來自使用者輸入，因此採白名單：id 只收數字，期間名只收不含空白的單一 token。
 *
 * 期間名含空白的會計行事曆因此無法使用本服務；需要時請自行以 `FusionRestClient` 查詢，
 * 並確保值不是來自未經檢查的輸入。
 */
const LEDGER_ID_PATTERN = /^[0-9]+$/;
const PERIOD_NAME_PATTERN = /^[A-Za-z0-9_./-]+$/;

function assertMatches(name: string, value: string | number, pattern: RegExp): void {
  if (!pattern.test(String(value))) {
    throw new Error(`Invalid ${name} for an accounting period query: ${JSON.stringify(value)}`);
  }
}

/**
 * 會計期間狀態查詢（`accountingPeriodStatusLOV`）。
 *
 * 查詢欄位是 `PeriodNameId` 而非 `PeriodName`——後者不存在，用了會得到一個不指名欄位的 400。
 */
export class FusionAccountingPeriodService {
  constructor(private readonly client: FusionRestClient) {}

  /**
   * 查詢單一期間在指定模組的狀態；Fusion 查無此期間時回傳 `null`。
   *
   * `ledgerId` 必須全為數字、`periodName` 必須是不含空白的單一 token，否則拋錯且不送出請求。
   */
  async getStatus(
    query: AccountingPeriodStatusQuery,
    options?: FusionRequestOptions,
  ): Promise<AccountingPeriodStatus | null> {
    assertMatches('ledgerId', query.ledgerId, LEDGER_ID_PATTERN);
    assertMatches('periodName', query.periodName, PERIOD_NAME_PATTERN);

    if (!Number.isInteger(query.applicationId) || query.applicationId < 0) {
      throw new Error(`Invalid applicationId for an accounting period query: ${JSON.stringify(query.applicationId)}`);
    }

    const response = await this.client.get<FusionListResponse<AccountingPeriodStatusItem>>(
      withFusionQuery(FUSION_RESOURCES.ACCOUNTING_PERIOD_STATUS_LOV, {
        q: { LedgerId: query.ledgerId, PeriodNameId: query.periodName, ApplicationId: query.applicationId },
        onlyData: true,
        limit: 1,
      }),
      options,
    );

    const item = response.items?.[0];

    if (!item?.ClosingStatus) return null;

    return {
      ledgerId: String(query.ledgerId),
      periodName: query.periodName,
      applicationId: query.applicationId,
      closingStatus: item.ClosingStatus,
      startDate: item.StartDate ?? null,
      endDate: item.EndDate ?? null,
    };
  }
}
