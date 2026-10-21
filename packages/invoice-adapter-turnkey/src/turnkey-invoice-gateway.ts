import { InvoiceAllowanceState, InvoiceGateway, InvoiceState, InvoiceVoidOptions, TaxType } from '@rytass/invoice';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { createHash, randomUUID } from 'crypto';
import {
  TURNKEY_ALLOWANCE_STATE,
  TURNKEY_DEFAULT_ALLOWANCE_REASON,
  TURNKEY_DEFAULT_TIMEOUT_MS,
  TURNKEY_IDEMPOTENCY_KEY_HEADER,
  TURNKEY_INVOICE_STATE,
} from './constants';
import { toAllowanceRequestBody, toIssueRequestBody, toTurnkeyAllowance, toTurnkeyInvoice } from './mappers';
import { TurnkeyInvoice } from './turnkey-invoice';
import { TurnkeyInvoiceAllowance } from './turnkey-allowance';
import { TurnkeyInvoiceError, toTurnkeyError } from './turnkey-invoice-error';
import {
  TurnkeyAllowanceItem,
  TurnkeyAllowanceOptions,
  TurnkeyAllowanceResponse,
  TurnkeyDeliveryMode,
  TurnkeyInvoiceGatewayOptions,
  TurnkeyInvoiceIssueOptions,
  TurnkeyInvoiceQueryOptions,
  TurnkeyInvoiceResponse,
  TurnkeyMobileBarcodeValidationResponse,
  TurnkeyNpoCodeValidationResponse,
  TurnkeyAllowanceProofResponse,
  TurnkeyBinaryProofFormat,
  TurnkeyInvoiceProofResponse,
  TurnkeyPaymentItem,
  TurnkeyProofFormat,
  TurnkeyProofRequestOptions,
  TurnkeySubmissionResponse,
} from './typings';

/** 去掉結尾的 '/'；不用 regex，避免 /\/+$/ 在大量斜線時的多項式回溯 */
const trimTrailingSlashes = (value: string): string => {
  let end = value.length;

  while (end > 0 && value[end - 1] === '/') end -= 1;

  return value.slice(0, end);
};

export class TurnkeyInvoiceGateway implements InvoiceGateway<
  TurnkeyPaymentItem,
  TurnkeyInvoice,
  TurnkeyInvoiceQueryOptions
> {
  private readonly companyUrl: string;

  private readonly deliveryMode: TurnkeyDeliveryMode;

  private readonly headers: Record<string, string>;

  private readonly timeoutMs: number;

  constructor(options: TurnkeyInvoiceGatewayOptions) {
    this.companyUrl = `${trimTrailingSlashes(options.baseUrl)}/companies/${encodeURIComponent(options.companyTaxId)}`;
    this.deliveryMode = options.deliveryMode ?? 'STORAGE';
    this.headers = options.headers ?? {};
    this.timeoutMs = options.timeoutMs ?? TURNKEY_DEFAULT_TIMEOUT_MS;
  }

  private requestConfig(idempotencyKey?: string, params?: Record<string, string>): AxiosRequestConfig {
    return {
      headers: {
        ...this.headers,
        ...(idempotencyKey ? { [TURNKEY_IDEMPOTENCY_KEY_HEADER]: idempotencyKey } : {}),
      },
      timeout: this.timeoutMs,
      ...(params ? { params } : {}),
    };
  }

  private async send<T>(request: Promise<AxiosResponse<T>>): Promise<T> {
    try {
      const { data } = await request;

      return data;
    } catch (error) {
      throw toTurnkeyError(error);
    }
  }

  async issue(options: TurnkeyInvoiceIssueOptions): Promise<TurnkeyInvoice> {
    const body = toIssueRequestBody(options, this.deliveryMode);

    const response = await this.send(
      axios.post<TurnkeyInvoiceResponse>(`${this.companyUrl}/invoices`, body, this.requestConfig(options.orderId)),
    );

    return toTurnkeyInvoice(response);
  }

  async void(invoice: TurnkeyInvoice, options: InvoiceVoidOptions): Promise<TurnkeyInvoice> {
    const response = await this.send(
      axios.post<TurnkeyInvoiceResponse>(
        `${this.companyUrl}/invoices/${encodeURIComponent(invoice.invoiceNumber)}/void`,
        { reason: options.reason },
        this.requestConfig(`void:${invoice.invoiceNumber}`),
      ),
    );

    invoice.turnkeyStatus = response.status;

    if (TURNKEY_INVOICE_STATE[response.status] === InvoiceState.VOID) {
      invoice.setVoid(response.voidedAt ? new Date(response.voidedAt) : undefined);
    }

    return invoice;
  }

  async allowance(
    invoice: TurnkeyInvoice,
    allowanceItems: TurnkeyAllowanceItem[],
    options?: TurnkeyAllowanceOptions,
  ): Promise<TurnkeyInvoice> {
    const fallbackTaxType = invoice.taxType === TaxType.MIXED ? options?.taxType : invoice.taxType;

    if (!fallbackTaxType) {
      throw new Error('Mixed invoice allowance must specify a tax type');
    }

    const body = toAllowanceRequestBody(invoice.invoiceNumber, allowanceItems, fallbackTaxType);

    // 以請求內容雜湊作為序號：重試同一內容會得到相同 key；內容不同則不會誤撞。
    const bodyHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const idempotencyKey = options?.idempotencyKey ?? `allowance:${invoice.invoiceNumber}:${bodyHash}`;

    const response = await this.send(
      axios.post<TurnkeyAllowanceResponse>(`${this.companyUrl}/allowances`, body, this.requestConfig(idempotencyKey)),
    );

    if (response.status === 'FAILED') {
      throw new TurnkeyInvoiceError({
        message: 'Turnkey allowance failed',
        status: 200,
        code: 'ALLOWANCE_FAILED',
        issues: [],
      });
    }

    // 重送相同 Idempotency-Key 時 Turnkey 會回放既有折讓（同一 allowanceNumber），不可重複掛載、重複扣減餘額。
    if (!invoice.allowances.some(existing => existing.allowanceNumber === response.allowanceNumber)) {
      invoice.addAllowance(toTurnkeyAllowance(response, invoice));
    }

    return invoice;
  }

  async invalidAllowance(
    allowance: TurnkeyInvoiceAllowance,
    reason: string = TURNKEY_DEFAULT_ALLOWANCE_REASON,
  ): Promise<TurnkeyInvoice> {
    const response = await this.send(
      axios.post<TurnkeyAllowanceResponse>(
        `${this.companyUrl}/allowances/${encodeURIComponent(allowance.allowanceNumber)}/void`,
        { reason },
        this.requestConfig(`void-allowance:${allowance.allowanceNumber}`),
      ),
    );

    allowance.turnkeyStatus = response.status;

    if (TURNKEY_ALLOWANCE_STATE[response.status] === InvoiceAllowanceState.INVALID) {
      allowance.invalid();
    }

    return allowance.parentInvoice;
  }

  async query(options: TurnkeyInvoiceQueryOptions): Promise<TurnkeyInvoice> {
    const response =
      'orderId' in options
        ? await this.send(
            axios.get<TurnkeyInvoiceResponse>(
              `${this.companyUrl}/invoices`,
              this.requestConfig(undefined, { externalId: options.orderId }),
            ),
          )
        : await this.send(
            axios.get<TurnkeyInvoiceResponse>(
              `${this.companyUrl}/invoices/${encodeURIComponent(options.invoiceNumber)}`,
              this.requestConfig(),
            ),
          );

    const invoice = toTurnkeyInvoice(response);

    // 尚未取得發票號碼（例如 FAILED）時沒有折讓可查。
    if (!response.invoiceNumber) return invoice;

    const allowances = await this.send(
      axios.get<TurnkeyAllowanceResponse[]>(
        `${this.companyUrl}/invoices/${encodeURIComponent(response.invoiceNumber)}/allowances`,
        this.requestConfig(),
      ),
    );

    // 依建立順序還原；addAllowance 會把 nowAmount 更新為累計後的餘額。FAILED 折讓從未成立，不納入。
    allowances
      .filter(allowance => allowance.status !== 'FAILED')
      .forEach(allowance => {
        invoice.addAllowance(toTurnkeyAllowance(allowance, invoice));
      });

    return invoice;
  }

  /**
   * 重送發票（或其作廢）最近一筆 REJECTED／FAILED 的送件，回傳重新查詢後的發票。
   * 修正平台拒收的原因（例如補上買方的交換設定）後再呼叫；最近一筆不是失敗狀態時丟出 NOTHING_TO_RETRY。
   */
  async retry(invoice: TurnkeyInvoice): Promise<TurnkeyInvoice> {
    await this.retryLatestSubmission(invoice.invoiceNumber);

    return this.query({ invoiceNumber: invoice.invoiceNumber });
  }

  /** 重送折讓（或其作廢）最近一筆 REJECTED／FAILED 的送件，回傳重新查詢後的發票。 */
  async retryAllowance(allowance: TurnkeyInvoiceAllowance): Promise<TurnkeyInvoice> {
    await this.retryLatestSubmission(allowance.allowanceNumber);

    return this.query({ invoiceNumber: allowance.parentInvoice.invoiceNumber });
  }

  private async retryLatestSubmission(documentNumber: string): Promise<TurnkeySubmissionResponse> {
    if (!documentNumber) {
      throw new TurnkeyInvoiceError({
        message: 'Document has no number; it was never submitted',
        status: 409,
        code: 'NOTHING_TO_RETRY',
        issues: [],
      });
    }

    const [latest] = await this.send(
      axios.get<TurnkeySubmissionResponse[]>(
        `${this.companyUrl}/submissions`,
        this.requestConfig(undefined, { documentNumber, limit: '1' }),
      ),
    );

    if (!latest || (latest.status !== 'REJECTED' && latest.status !== 'FAILED')) {
      throw new TurnkeyInvoiceError({
        message: latest
          ? `Latest submission of ${documentNumber} is ${latest.status}, nothing to retry`
          : `No submission found for ${documentNumber}`,
        status: 409,
        code: 'NOTHING_TO_RETRY',
        issues: [],
      });
    }

    // 以被重送的送件 id 當 key：回應遺失後再呼叫會回放同一次重送，不會重送兩次。
    return this.send(
      axios.post<TurnkeySubmissionResponse>(
        `${this.companyUrl}/submissions/${encodeURIComponent(latest.id)}/retry`,
        undefined,
        this.requestConfig(`retry:${latest.id}`),
      ),
    );
  }

  /** 查詢折讓原始資料（GET /allowances/{allowanceNumber}）。 */
  async queryAllowance(allowanceNumber: string): Promise<TurnkeyAllowanceResponse> {
    return this.send(
      axios.get<TurnkeyAllowanceResponse>(
        `${this.companyUrl}/allowances/${encodeURIComponent(allowanceNumber)}`,
        this.requestConfig(),
      ),
    );
  }

  /**
   * 列印發票證明聯（POST /invoices/{no}/proof）。
   * JSON 回傳原始資料（日期為 ISO 字串）；其他格式回傳檔案的 Buffer。
   * 每次列印都會在 base 記一筆列印紀錄，第 2 次起為補印。帶同一個 idempotencyKey 重送回傳同一次列印；
   * 省略時每次呼叫產生新的 key（等於一次新的列印）。
   */
  getProof(
    invoiceNumber: string,
    format?: 'JSON',
    options?: TurnkeyProofRequestOptions,
  ): Promise<TurnkeyInvoiceProofResponse>;
  getProof(
    invoiceNumber: string,
    format: TurnkeyBinaryProofFormat,
    options?: TurnkeyProofRequestOptions,
  ): Promise<Buffer>;
  getProof(
    invoiceNumber: string,
    format: TurnkeyProofFormat = 'JSON',
    options: TurnkeyProofRequestOptions = {},
  ): Promise<TurnkeyInvoiceProofResponse | Buffer> {
    return this.requestProof<TurnkeyInvoiceProofResponse>(
      `${this.companyUrl}/invoices/${encodeURIComponent(invoiceNumber)}/proof`,
      format,
      options,
    );
  }

  /** 列印折讓證明單（POST /allowances/{no}/proof）。格式與冪等規則同 getProof。 */
  getAllowanceProof(
    allowanceNumber: string,
    format?: 'JSON',
    options?: TurnkeyProofRequestOptions,
  ): Promise<TurnkeyAllowanceProofResponse>;
  getAllowanceProof(
    allowanceNumber: string,
    format: TurnkeyBinaryProofFormat,
    options?: TurnkeyProofRequestOptions,
  ): Promise<Buffer>;
  getAllowanceProof(
    allowanceNumber: string,
    format: TurnkeyProofFormat = 'JSON',
    options: TurnkeyProofRequestOptions = {},
  ): Promise<TurnkeyAllowanceProofResponse | Buffer> {
    return this.requestProof<TurnkeyAllowanceProofResponse>(
      `${this.companyUrl}/allowances/${encodeURIComponent(allowanceNumber)}/proof`,
      format,
      options,
    );
  }

  private requestProof<T>(
    url: string,
    format: TurnkeyProofFormat,
    options: TurnkeyProofRequestOptions,
  ): Promise<T | Buffer> {
    const config = this.requestConfig(options.idempotencyKey ?? randomUUID());
    const body = { format, ...(options.operator ? { operator: options.operator } : {}) };

    if (format === 'JSON') return this.send(axios.post<T>(url, body, config));

    return this.send(axios.post<Buffer>(url, body, { ...config, responseType: 'arraybuffer' }));
  }

  async isMobileBarcodeValid(code: string): Promise<boolean> {
    const response = await this.send(
      axios.get<TurnkeyMobileBarcodeValidationResponse>(
        `${this.companyUrl}/validation/mobile-barcodes/${encodeURIComponent(code)}`,
        this.requestConfig(),
      ),
    );

    return response.valid;
  }

  async isLoveCodeValid(code: string): Promise<boolean> {
    const response = await this.send(
      axios.get<TurnkeyNpoCodeValidationResponse>(
        `${this.companyUrl}/validation/npo-codes/${encodeURIComponent(code)}`,
        this.requestConfig(),
      ),
    );

    return response.valid;
  }
}
