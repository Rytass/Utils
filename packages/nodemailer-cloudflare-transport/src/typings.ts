/**
 * Type definitions for the Cloudflare Email Service REST transport.
 *
 * Wire-format confirmed against the official documentation (2026-06):
 *   POST https://api.cloudflare.com/client/v4/accounts/{accountId}/email/sending/send
 *
 * Note: the REST API recipient objects use `{ address, name }` and the reply
 * field is snake_case `reply_to`. This intentionally differs from the Workers
 * binding API (which uses `{ email, name }` and `replyTo`).
 */

export interface CloudflareFetchRequest {
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

export interface CloudflareFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

/**
 * Minimal `fetch` surface this transport relies on. Structurally compatible
 * with the global `fetch` (Node.js 18+), but narrow enough to inject a mock in
 * tests or to run on any runtime that exposes a `fetch`-like function.
 */
export type FetchLike = (url: string, init: CloudflareFetchRequest) => Promise<CloudflareFetchResponse>;

export interface CloudflareTransportOptions {
  /** Cloudflare account identifier (the `{account_id}` in the REST path). */
  readonly accountId: string;
  /** Cloudflare API token with the "Send Email" permission. */
  readonly apiToken: string;
  /**
   * Override the API base URL.
   * @default 'https://api.cloudflare.com/client/v4'
   */
  readonly baseUrl?: string;
  /**
   * Inject a custom `fetch` implementation. Useful for testing or for runtimes
   * that do not expose a global `fetch`.
   * @default globalThis.fetch
   */
  readonly fetch?: FetchLike;
}

/** A recipient as accepted by the Cloudflare REST API. */
export type CloudflareRecipient = string | CloudflareAddress;

export interface CloudflareAddress {
  readonly address: string;
  readonly name?: string;
}

export interface CloudflareAttachment {
  /** Base64-encoded file content. */
  readonly content: string;
  readonly filename: string;
  /** MIME type, e.g. `application/pdf`. */
  readonly type?: string;
  readonly disposition?: 'attachment' | 'inline';
}

/** The JSON body sent to the Cloudflare Email Service `send` endpoint. */
export interface CloudflareSendPayload {
  readonly from: CloudflareRecipient;
  readonly to: readonly CloudflareRecipient[];
  readonly cc?: readonly CloudflareRecipient[];
  readonly bcc?: readonly CloudflareRecipient[];
  readonly reply_to?: CloudflareRecipient;
  readonly subject: string;
  readonly text?: string;
  readonly html?: string;
  readonly headers?: Record<string, string>;
  readonly attachments?: readonly CloudflareAttachment[];
}

/** Per-recipient delivery status returned by the API. */
export interface CloudflareSendResult {
  readonly delivered: readonly string[];
  readonly permanent_bounces: readonly string[];
  readonly queued: readonly string[];
}

export interface CloudflareApiError {
  readonly code: number;
  readonly message: string;
}

/** The full envelope returned by the Cloudflare REST API. */
export interface CloudflareSendResponse {
  readonly success: boolean;
  readonly errors: readonly CloudflareApiError[];
  readonly messages: readonly unknown[];
  readonly result: CloudflareSendResult | null;
}

/** Numeric error codes documented for the REST API. */
export enum CloudflareEmailErrorCode {
  INVALID_REQUEST_SCHEMA = 10001,
  INTERNAL_SERVER = 10002,
  THROTTLED = 10004,
  EMAIL_INVALID = 10200,
  NO_CONTENT_LENGTH = 10201,
  TOO_BIG = 10202,
  SENDING_DISABLED = 10203,
}

export interface CloudflareEnvelope {
  readonly from: string | false;
  readonly to: readonly string[];
}

/**
 * The `info` object handed back to Nodemailer on a successful (or partially
 * successful) send. Mirrors the conventional Nodemailer `SentMessageInfo`
 * shape (`messageId` / `accepted` / `rejected` / `envelope` / `response`) and
 * augments it with the Cloudflare-specific `queued` list and raw `result`.
 */
export interface CloudflareSentMessageInfo {
  readonly messageId: string;
  readonly envelope: CloudflareEnvelope;
  /** `delivered` + `queued` recipients. */
  readonly accepted: readonly string[];
  /** `permanent_bounces` recipients. */
  readonly rejected: readonly string[];
  readonly queued: readonly string[];
  readonly response: string;
  readonly result: CloudflareSendResult;
}
