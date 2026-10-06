/**
 * MTOM 回應的解包。
 *
 * Fusion 有一批 SOAP 服務（Receivables 的 `CreditMemoService`、`StandardReceiptService` 等）
 * 即使沒有附件也以 MTOM 回應：`multipart/related`，SOAP envelope 包在其中一個
 * `application/xop+xml` part 裡。XML 解析器看到的是 MIME 邊界而非 XML，結果是成功回應被解析成
 * 空物件、fault 被判成沒有 fault——後者會讓業務驗證失敗被誤分類為可重試的暫時性錯誤。
 *
 * 這裡只取出 envelope，不處理 `xop:Include` 參照的二進位附件。
 */

const BOUNDARY_PATTERN = /boundary="?([^";]+)"?/i;
const ENVELOPE_START_PATTERN = /<(?:\w+:)?Envelope[\s>]/;

/**
 * 取出 multipart 中第一個含 SOAP Envelope 的 part。
 *
 * 邊界優先取自 `Content-Type` 標頭，取不到時由 body 開頭的 `--boundary` 推得（錯誤路徑上常常
 * 只剩 body 文字）。非 multipart 或找不到 envelope 時回傳 `null`。
 */
export function extractMtomEnvelope(body: string, contentType: string | null): string | null {
  const boundaryFromHeader = contentType ? BOUNDARY_PATTERN.exec(contentType)?.[1] : undefined;
  const boundaryFromBody = /^\s*--([^\r\n]+)/.exec(body)?.[1];
  const boundary = boundaryFromHeader ?? boundaryFromBody;

  if (!boundary) return null;

  const part = body
    .split(`--${boundary}`)
    .map(chunk => chunk.trim())
    .find(chunk => ENVELOPE_START_PATTERN.test(chunk));

  if (!part) return null;

  const headerEnd = part.search(/\r?\n\r?\n/);
  const content = headerEnd >= 0 ? part.slice(headerEnd).trim() : part;
  const envelopeStart = content.search(ENVELOPE_START_PATTERN);

  return envelopeStart >= 0 ? content.slice(envelopeStart) : null;
}

/** MTOM 回應回傳其中的 envelope，其餘內容原樣回傳。 */
export function unwrapMtomSoapBody(body: string, contentType: string | null): string {
  return extractMtomEnvelope(body, contentType) ?? body;
}
