import type MailMessage from 'nodemailer/lib/mailer/mail-message';
import { buildCloudflarePayload } from './payload-mapper';
import { CloudflareEmailError } from './errors';
import {
  CloudflareEnvelope,
  CloudflareSendResponse,
  CloudflareSentMessageInfo,
  CloudflareTransportOptions,
  FetchLike,
} from './typings';

const DEFAULT_BASE_URL = 'https://api.cloudflare.com/client/v4';
const TRANSPORT_NAME = 'CloudflareEmailService';
const TRANSPORT_VERSION = '0.1.0';

type SendCallback = (error: Error | null, info?: CloudflareSentMessageInfo) => void;

/**
 * Nodemailer transport backed by the Cloudflare Email Service REST API.
 *
 * @example
 * ```ts
 * import nodemailer from 'nodemailer';
 * import { CloudflareTransport } from 'nodemailer-cloudflare-transport';
 *
 * const transporter = nodemailer.createTransport(
 *   new CloudflareTransport({ accountId: '...', apiToken: '...' }),
 * );
 *
 * await transporter.sendMail({
 *   from: 'no-reply@yourdomain.com',
 *   to: 'jane@example.com',
 *   subject: 'Welcome!',
 *   html: '<h1>Thanks for joining!</h1>',
 * });
 * ```
 */
export class CloudflareTransport {
  public readonly name: string = TRANSPORT_NAME;
  public readonly version: string = TRANSPORT_VERSION;

  private readonly apiToken: string;
  private readonly endpoint: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: CloudflareTransportOptions) {
    if (!options.accountId) {
      throw new Error('nodemailer-cloudflare-transport: "accountId" is required');
    }

    if (!options.apiToken) {
      throw new Error('nodemailer-cloudflare-transport: "apiToken" is required');
    }

    const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');

    this.apiToken = options.apiToken;
    this.endpoint = `${baseUrl}/accounts/${options.accountId}/email/sending/send`;
    this.fetchImpl = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  }

  /**
   * Nodemailer transport entry point. Bridges the promise-based delivery to the
   * `(error, info)` callback Nodemailer expects.
   */
  send(mail: MailMessage, callback: SendCallback): void {
    this.deliver(mail)
      .then(info => callback(null, info))
      .catch((error: unknown) => callback(error instanceof Error ? error : new Error(String(error))));
  }

  private async deliver(mail: MailMessage): Promise<CloudflareSentMessageInfo> {
    const payload = await buildCloudflarePayload(mail);

    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as CloudflareSendResponse;

    if (!response.ok || !body.success || body.result === null) {
      throw CloudflareEmailError.fromResponse(response.status, body);
    }

    const { delivered, queued, permanent_bounces: rejected } = body.result;
    const accepted: readonly string[] = [...delivered, ...queued];

    // Partial-tolerance semantics: succeed as long as at least one recipient was
    // delivered or queued; only fail outright when nothing was accepted.
    if (accepted.length === 0) {
      // Distinguish "everyone bounced" from "the request was accepted but no
      // recipient was processed at all" — the latter has no `errors` and would
      // otherwise surface an unhelpful "unknown error".
      throw rejected.length > 0
        ? CloudflareEmailError.allBounced(response.status, body, rejected)
        : CloudflareEmailError.noRecipientsProcessed(response.status, body);
    }

    return {
      messageId: mail.message.messageId(),
      envelope: mail.message.getEnvelope() as CloudflareEnvelope,
      accepted,
      rejected,
      queued,
      response: `Cloudflare Email Service accepted ${accepted.length} recipient(s)`,
      result: body.result,
    };
  }
}
