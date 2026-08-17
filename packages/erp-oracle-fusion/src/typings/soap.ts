/**
 * Fusion SOAP 讀寫的共用值型別。
 *
 * 讀寫刻意用不同形狀：Fusion 回應**一律是字串**（解析器不做數值轉換，`long` 型的 id 轉
 * JS number 有精度風險，帳號 `0012` 轉 number 也會掉前導零）；寫入則接受 JS 原生型別，
 * 由序列化器轉字串。
 */

/**
 * 寫入時的純量值。
 *
 * `undefined` 與 `null` 語意不同，這是 partial update 的關鍵：
 * - `undefined`：欄位不送出 → Fusion 維持原值
 * - `null`：送出 `xsi:nil="true"` → Fusion 清空該欄位
 */
export type FusionSoapScalarInput = string | number | boolean | null | undefined;

/** 讀取時的純量值：Fusion 回應的字串，或 `xsi:nil="true"` 對應的 null。 */
export type FusionSoapScalar = string | null;

/** 由欄位載體型別衍生「寫入用」形狀：全部選填。 */
export type FusionSoapInput<TFields> = {
  readonly [K in keyof TFields]?: FusionSoapScalarInput;
};

/** 由欄位載體型別衍生「讀取用」形狀：欄位必然存在，無值時為 null。 */
export type FusionSoapOutput<TFields> = {
  readonly [K in keyof TFields]: FusionSoapScalar;
};

/**
 * 尚未強型別化的巢狀結構（彈性欄位 DFF/GDF、聯絡人、關係等）。
 *
 * 這些結構每個 pod 的彈性欄位設定都不同，寫死型別反而礙事；需要時直接以物件字面量帶入，
 * 序列化器會照樣輸出。
 */
export interface FusionSoapRecord {
  readonly [key: string]: FusionSoapScalarInput | FusionSoapRecord | readonly FusionSoapRecord[];
}
