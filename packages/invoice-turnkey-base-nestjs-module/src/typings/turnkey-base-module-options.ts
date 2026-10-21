import { ModuleMetadata, Type } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface TurnkeyBaseModuleOptions {
  /** Turnkey 的 /data（與 Turnkey 共用的 volume），必填 */
  readonly dataPath: string;
  /** Turnkey 自己的 DB：TypeORM 具名連線的名稱或 DataSource；唯讀帳號 */
  readonly turnkeyDataSource: string | DataSource;
  readonly environment: 'TEST' | 'PRODUCTION';
  readonly workers?: {
    /** 預設 true；純 API 的實例設 false */
    readonly enabled?: boolean;
    /** 預設 10000 */
    readonly pollIntervalMs?: number;
    /** 是否掃描 RecvTarget 處理收到的訊息，預設 true；設 false 時收到的檔案原地不動 */
    readonly inbound?: boolean;
    /** 處理完的 RecvTarget 檔搬到哪裡，預設 `<dataPath>/sidecar/inbound` */
    readonly inboundArchivePath?: string;
    /** WRITTEN 超過幾分鐘仍無結果就發出 submission.stalled（不改狀態），預設 120 */
    readonly stalledAfterMinutes?: number;
  };
  readonly validation?: {
    /** B2C，預設 48 */
    readonly issueDeadlineHours?: number;
    /** B2B，預設 168 */
    readonly b2bIssueDeadlineHours?: number;
    /** 選填的 XML 檢查（例如自備 XSD），丟出錯誤即視為檢核失敗 */
    readonly xmlValidator?: (xml: string, messageType: string) => void | Promise<void>;
  };
  readonly notifications?: {
    /** 取號後剩餘號碼低於此數發出 invoice-track.running-low，預設 50 */
    readonly invoiceTrackRunningLowThreshold?: number;
    /** 憑證到期前幾天開始每天發 certificate.expiring，預設 30 */
    readonly certificateExpiryNoticeDays?: number;
  };
  /** 證明聯輸出（PDF、PNG、A4_PDF）的預設值；呼叫 render() 時傳入的參數優先 */
  readonly print?: {
    /** 中文字型檔（TTF、OTF 或 TTC）路徑；PDF、PNG、A4_PDF 必填 */
    readonly fontPath?: string;
    /** 熱感紙寬度（mm），預設 57 */
    readonly paperWidthMm?: number;
  };
  /** 加密 turnkey_companies 的 QR Code 金鑰等欄位 */
  readonly secretEncryptionKey: string;
}

export interface TurnkeyBaseModuleOptionsFactory {
  createTurnkeyBaseModuleOptions(): Promise<TurnkeyBaseModuleOptions> | TurnkeyBaseModuleOptions;
}

export interface TurnkeyBaseModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  readonly useFactory?: (...args: never[]) => Promise<TurnkeyBaseModuleOptions> | TurnkeyBaseModuleOptions;
  readonly inject?: (string | symbol | Type<unknown>)[];
  readonly useClass?: Type<TurnkeyBaseModuleOptionsFactory>;
  readonly useExisting?: Type<TurnkeyBaseModuleOptionsFactory>;
}
