import { FusionAuthProvider } from '../auth/fusion-auth-provider';
import { resolveFusionClientOptions } from '../client/resolve-options';
import { FusionHttpTransport } from '../transport/fusion-http-transport';
import type { FusionRequestError } from '../errors/fusion-errors';
import type { FusionCallContext, FusionOperation } from '../typings/call-log';
import type { FusionClientOptions, ResolvedFusionClientOptions } from '../typings/client-options';
import { buildSoapEnvelope } from './envelope';
import type { SoapParameter } from './envelope';
import { buildSoapFaultError, classifySoapHttpError, parseSoapXml } from './soap-fault';

/**
 * 一個 Fusion SOAP 服務的座標。
 *
 * 三個 namespace 全部顯式指定，不做推導——Fusion 各服務的 namespace 規則並不一致：
 * `CustomerProfileService` 的 types namespace 是 `{service}types/`，但
 * `CustomerAccountService` 卻是 `{service}applicationModule/types/`。推導必然出錯。
 */
export interface FusionSoapService {
  /** pod 相對路徑，如 `/crmService/CustomerAccountService`。 */
  readonly path: string;
  /** SDO 欄位所在的 namespace（`{service}/`）。 */
  readonly serviceNamespace: string;
  /** operation 與參數 element 所在的 namespace。 */
  readonly typesNamespace: string;
  /** `SOAPAction` 標頭的前綴；與 operation 名稱串接後送出。 */
  readonly soapActionNamespace: string;
}

export interface FusionSoapCallOptions {
  /** 關聯業務物件，落地到觀測紀錄。 */
  readonly context?: FusionCallContext;
  /**
   * 最大重試次數，**預設 0**。
   *
   * 與 REST client 相反：SOAP 沒有 method 語意可判斷冪等性，`createCustomerAccount` 與
   * `findCustomerAccount` 都是 POST。預設不重試是安全的一側；唯讀 operation 由服務層
   * 顯式開啟。
   */
  readonly maxRetries?: number;
  /** 附加／覆寫 HTTP 標頭。 */
  readonly headers?: Readonly<Record<string, string>>;
  /** 觀測紀錄的操作分類，預設為 SOAP operation 名稱。 */
  readonly operation?: FusionOperation;
  /** 要擷取到觀測紀錄 `refs` 的欄位名（於回應中深度搜尋）。 */
  readonly refKeys?: readonly string[];
  /** 觀測摘要的白名單欄位（於回應中深度搜尋）。 */
  readonly summaryKeys?: readonly string[];
}

/**
 * 於巢狀回應中深度搜尋指定欄位的第一個值。
 *
 * SOAP 回應的層數依 operation 而異（`{op}Response/result/Value/...`），寫死路徑很脆弱；
 * 但只取白名單欄位，因此深度搜尋不會意外撈到大型或機密內容。
 */
function findFirstValues(node: unknown, keys: readonly string[]): Record<string, string> {
  const found: Record<string, string> = {};

  if (keys.length === 0) return found;

  const visit = (current: unknown): void => {
    if (current === null || typeof current !== 'object') return;

    if (Array.isArray(current)) {
      current.forEach(visit);

      return;
    }

    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (keys.includes(key) && !(key in found) && value !== null && typeof value !== 'object') {
        found[key] = String(value);
      }

      visit(value);
    }
  };

  visit(node);

  return found;
}

/**
 * Oracle Fusion SOAP client。
 *
 * 存在的理由：Fusion 有一批業務物件**沒有對應的 REST 資源**，只能走 SOAP——客戶帳戶
 * （`CustomerAccountService`）與 AR 信用檔（`ReceivablesCustomerProfileService`）即為此類。
 *
 * 與 `FusionRestClient` 共用 `FusionHttpTransport`，因此認證、逾時、重試退避、觀測埋點的
 * 行為完全一致；差異只在序列化格式與錯誤分類。
 *
 * 認證沿用 `FusionClientOptions.auth`。Fusion 的 SOAP 端點掛的是
 * `wss11_saml_or_username_token_with_message_protection_service_policy`，名稱看起來要求
 * WS-Security 訊息加密，但 SaaS pod 實際接受 HTTP Basic over SSL，因此不需要簽章或加密，
 * 也不需要 WSDL 執行期解析。
 */
export class FusionSoapClient {
  private readonly options: ResolvedFusionClientOptions;
  private readonly auth: FusionAuthProvider;
  private readonly transport: FusionHttpTransport;

  constructor(options: FusionClientOptions) {
    this.options = resolveFusionClientOptions(options);
    this.auth = new FusionAuthProvider(this.options);
    this.transport = new FusionHttpTransport(this.options, this.auth);
  }

  /** 授權標頭供應者（供診斷、或需要自行發請求時取用）。 */
  get authProvider(): FusionAuthProvider {
    return this.auth;
  }

  /** 服務的完整端點 URL。 */
  serviceUrl(service: FusionSoapService): string {
    return `${this.options.baseUrl}${service.path}`;
  }

  /**
   * 呼叫一個 SOAP operation，回傳 `{operation}Response` 節點的正規化內容。
   *
   * 回應中的 `xsi:nil="true"` 會轉為 `null`，其餘值一律保持字串（Fusion 的 id 是 `long`，
   * 轉 number 有精度風險）。
   */
  async call<T = Record<string, unknown>>(
    service: FusionSoapService,
    operation: string,
    parameters: readonly SoapParameter[],
    options?: FusionSoapCallOptions,
  ): Promise<T> {
    const envelope = buildSoapEnvelope({
      operation,
      typesNamespace: service.typesNamespace,
      serviceNamespace: service.serviceNamespace,
      parameters,
    });

    const description = `SOAP ${operation}`;
    const responseKey = `${operation}Response`;

    return this.transport.execute<T>({
      method: 'POST',
      url: this.serviceUrl(service),
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        Accept: 'text/xml',
        SOAPAction: `${service.soapActionNamespace}${operation}`,
        ...(options?.headers ?? {}),
      },
      body: envelope,
      description,
      operation: options?.operation ?? operation,
      endpoint: service.path,
      ...(options?.context ? { context: options.context } : {}),
      maxRetries: options?.maxRetries ?? 0,
      classifyError: classifySoapHttpError,
      parseResponse: async (response: Response): Promise<T> => {
        const xml = await response.text();
        const parsed = parseSoapXml(xml);

        // fault 檢查交給 inspectResult；此處僅保留原始解析結果供其判讀。
        const envelopeNode = parsed?.['Envelope'] as Record<string, unknown> | undefined;
        const bodyNode = envelopeNode?.['Body'] as Record<string, unknown> | undefined;

        if (bodyNode && 'Fault' in bodyNode) {
          return bodyNode as T;
        }

        const responseNode = bodyNode?.[responseKey];

        // 少數 operation 回應為空 body（無 result），回傳空物件而非 null，簡化下游判斷。
        return (responseNode ?? {}) as T;
      },
      // Fusion 幾乎總是以 HTTP 500 回 fault，但規範上 SOAP 1.1 允許 fault 走 2xx；
      // 這條路徑確保那種情況同樣被分類為不可重試的錯誤，而不是被當成成功回傳。
      inspectResult: (result: T, desc: string, status: number): FusionRequestError | null => {
        const faultNode = (result as Record<string, unknown> | null)?.['Fault'];

        if (faultNode && typeof faultNode === 'object') {
          return buildSoapFaultError(faultNode as Record<string, unknown>, status, desc);
        }

        return null;
      },
      extractRefs: (result: T): Readonly<Record<string, string>> | undefined => {
        const refs = findFirstValues(result, options?.refKeys ?? []);

        return Object.keys(refs).length > 0 ? refs : undefined;
      },
      buildSummary: (result: T): string | null => {
        const summary = findFirstValues(result, options?.summaryKeys ?? []);

        if (Object.keys(summary).length === 0) return null;

        const serialized = JSON.stringify(summary);

        return serialized.length > this.options.maxTextLength
          ? serialized.slice(0, this.options.maxTextLength)
          : serialized;
      },
    });
  }
}
