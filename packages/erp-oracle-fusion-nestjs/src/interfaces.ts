import type { ModuleMetadata, Type } from '@nestjs/common';
import type { FusionCallLogSink, FusionClientOptions } from '@rytass/erp-oracle-fusion';

/**
 * module 層的 client 設定：與 `FusionClientOptions` 相同，但 `callLogSink` 與 `logger`
 * 改由 module 選項注入（前者透過 DI，後者由 module 自動橋接 NestJS `Logger`）。
 */
export type FusionClientModuleConfig = Omit<FusionClientOptions, 'callLogSink' | 'logger'>;

/** 觀測 sink 的注入方式；未提供時綁定 no-op。 */
export interface FusionCallLogSinkOptions {
  /** 由本 module 直接建立 sink 實例。 */
  readonly useClass?: Type<FusionCallLogSink>;
  /** 沿用其他 module 已建立並 export 的 sink provider。 */
  readonly useExisting?: Type<FusionCallLogSink>;
  readonly useFactory?: (...args: never[]) => FusionCallLogSink | Promise<FusionCallLogSink>;
  readonly inject?: readonly unknown[];
  /** `useExisting`／`useFactory` 的 provider 來源 module。 */
  readonly imports?: ModuleMetadata['imports'];
}

export interface FusionClientModuleOptions {
  readonly config: FusionClientModuleConfig;
  /** 註冊為 global module。預設 false——建議改用 wrapper module 顯式 import。 */
  readonly isGlobal?: boolean;
  readonly callLogSink?: FusionCallLogSinkOptions;
  /** 關閉自動橋接 NestJS `Logger`（預設會橋接）。 */
  readonly disableLogger?: boolean;
}

export interface FusionClientModuleAsyncOptions {
  readonly imports?: ModuleMetadata['imports'];
  readonly inject?: readonly unknown[];
  readonly useFactory: (...args: never[]) => FusionClientModuleConfig | Promise<FusionClientModuleConfig>;
  readonly isGlobal?: boolean;
  readonly callLogSink?: FusionCallLogSinkOptions;
  readonly disableLogger?: boolean;
}
