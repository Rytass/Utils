import { Injectable } from '@nestjs/common';
import type { FusionCallLogSink } from '@rytass/erp-oracle-fusion';

/**
 * 預設的觀測 sink：完全不落地。
 *
 * 讓 `FusionClientModule` 在未提供 sink 的專案也能直接運作——觀測性是可選加值，
 * 不是使用 client 的前置條件。
 */
@Injectable()
export class NoopFusionCallLogSink implements FusionCallLogSink {
  async record(): Promise<void> {
    // 刻意留空：無觀測基礎設施時不做任何事。
  }
}
