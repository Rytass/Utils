/**
 * 由來源單據的冪等鍵確定性衍生一個正整數批次代碼（GL_INTERFACE 的 `GROUP_ID`，
 * 或其他 FBDI 的等效批次欄位）。
 *
 * FBDI 批次以此值隔離，避免併發匯入互相污染。同一來源單據重送（例如 worker crash 後重跑）
 * 必須衍生出同一個值，使匯入參數與 CSV 內的欄位彼此一致、且與前次送單一致——這是重送時
 * 判斷「Fusion 端是否已匯入過」的依據。
 *
 * 以雙輪 FNV-1a 32-bit hash 組合成正整數（落在 `Number.isSafeInteger` 與 Oracle NUMBER(18)
 * 範圍內）。碰撞機率對一般量級可忽略——此值的作用是把匯入限定在「本次上傳的這批列」，
 * 並非全域唯一鍵。
 */
function fnv1a32(input: string, seed: number): number {
  let hash = seed >>> 0;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

/** @param sourceKey 來源單據的穩定唯一鍵（如傳票 id、invoice id）。 */
export function deriveGroupId(sourceKey: string): string {
  const h1 = fnv1a32(sourceKey, 0x811c9dc5);
  const h2 = fnv1a32(`${sourceKey}#2`, 0x811c9dc5);
  const combined = h1 * 100000 + (h2 % 100000);

  return String(combined);
}
