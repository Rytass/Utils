import {
  DEFAULT_MAX_TEXT_LENGTH,
  DEFAULT_RESPONSE_REF_KEYS,
  DEFAULT_RESPONSE_SUMMARY_KEYS,
} from '../call-log/call-log-helpers';
import { normalizeAuthConfig } from '../typings/auth';
import type { FusionClientOptions, ResolvedFusionClientOptions } from '../typings/client-options';

export const DEFAULT_NAMESPACE = 'fscmRestApi';
export const DEFAULT_API_VERSION = '11.13.18.05';
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;
export const DEFAULT_PAGE_SIZE = 500;
export const DEFAULT_TIMEOUT_MS = 60_000;

/** 套上預設值，讓下游永遠拿到完整設定，不需在各處重複處理 undefined。 */
export function resolveFusionClientOptions(options: FusionClientOptions): ResolvedFusionClientOptions {
  if (!options.baseUrl) {
    throw new Error('FusionClientOptions.baseUrl is required');
  }

  if (!options.auth) {
    throw new Error('FusionClientOptions.auth is required');
  }

  return {
    baseUrl: options.baseUrl.replace(/\/+$/, ''),
    auth: normalizeAuthConfig(options.auth),
    defaultNamespace: options.defaultNamespace ?? DEFAULT_NAMESPACE,
    defaultApiVersion: options.defaultApiVersion ?? DEFAULT_API_VERSION,
    restFrameworkVersion: options.restFrameworkVersion ?? null,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    retryBaseDelayMs: options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
    defaultPageSize: options.defaultPageSize ?? DEFAULT_PAGE_SIZE,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    fetchImpl: options.fetchImpl ?? null,
    operationResolver: options.operationResolver ?? null,
    responseRefKeys: options.responseRefKeys ?? DEFAULT_RESPONSE_REF_KEYS,
    responseSummaryKeys: options.responseSummaryKeys ?? DEFAULT_RESPONSE_SUMMARY_KEYS,
    maxTextLength: options.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH,
    callLogSink: options.callLogSink ?? null,
    logger: options.logger ?? null,
  };
}
