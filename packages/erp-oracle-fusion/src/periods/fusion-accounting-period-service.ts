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
 * `q` 以 `;` 串接條件且沒有跳脫語法，值裡帶 `;` 或引號就能多塞一個條件或改寫比較式——
 * 例如把查詢從指定的子帳模組換成另一個。這些值常來自使用者輸入，因此只放行期間名與 id
 * 實際會用到的字元。
 */
const SAFE_QUERY_VALUE_PATTERN = /^[A-Za-z0-9 _./-]+$/;

function assertSafeQueryValue(name: string, value: string | number): void {
  if (!SAFE_QUERY_VALUE_PATTERN.test(String(value))) {
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
   * `ledgerId`／`periodName` 含查詢語法字元（`;`、引號、比較運算子等）時拋錯，不送出請求。
   */
  async getStatus(
    query: AccountingPeriodStatusQuery,
    options?: FusionRequestOptions,
  ): Promise<AccountingPeriodStatus | null> {
    assertSafeQueryValue('ledgerId', query.ledgerId);
    assertSafeQueryValue('periodName', query.periodName);

    if (!Number.isInteger(query.applicationId)) {
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
