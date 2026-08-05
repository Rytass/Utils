/** 已套上預設值的 client 設定（由 `FusionClientModule` 內部提供）。 */
export const FUSION_CLIENT_OPTIONS = Symbol('FUSION_CLIENT_OPTIONS');

/**
 * 觀測埋點落地目的地（`FusionCallLogSink`）。未於 module 選項提供時綁定 no-op，
 * 因此 client 在無觀測基礎設施的專案也能直接使用。
 */
export const FUSION_CALL_LOG_SINK = Symbol('FUSION_CALL_LOG_SINK');
