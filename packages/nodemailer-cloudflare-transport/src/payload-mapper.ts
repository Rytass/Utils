import type MailMessage from 'nodemailer/lib/mailer/mail-message';
import type Mail from 'nodemailer/lib/mailer';
import { CloudflareAttachment, CloudflareRecipient, CloudflareSendPayload } from './typings';

/** A single parsed address as produced by Nodemailer's `getAddresses()`. */
interface ParsedAddress {
  readonly address: string;
  readonly name: string;
}

/** The grouped result of `MimeNode.getAddresses()`, keyed by header name. */
interface GroupedAddresses {
  readonly from?: readonly ParsedAddress[];
  readonly to?: readonly ParsedAddress[];
  readonly cc?: readonly ParsedAddress[];
  readonly bcc?: readonly ParsedAddress[];
  readonly 'reply-to'?: readonly ParsedAddress[];
}

const toRecipient = (parsed: ParsedAddress): CloudflareRecipient =>
  parsed.name ? { address: parsed.address, name: parsed.name } : parsed.address;

const toRecipients = (parsed: readonly ParsedAddress[] | undefined): readonly CloudflareRecipient[] =>
  (parsed ?? []).map(toRecipient);

/**
 * Resolve a Nodemailer content node (string, Buffer, stream, file path or URL)
 * into a Buffer using Nodemailer's own resolver, then promisify the callback.
 */
const resolveContent = (mail: MailMessage, source: object, key: string): Promise<Buffer> =>
  new Promise<Buffer>((resolve, reject) => {
    mail.resolveContent(source, key, (error: Error | null, value: string | Buffer) => {
      if (error) {
        reject(error);

        return;
      }

      resolve(Buffer.isBuffer(value) ? value : Buffer.from(value));
    });
  });

/**
 * Normalize Nodemailer's flexible `headers` option into the flat
 * `Record<string, string>` the Cloudflare API expects. Array form
 * (`[{ key, value }]`) and object form are both supported; values are
 * coerced to strings and Nodemailer's `{ prepared, value }` wrapper is unwrapped.
 */
const normalizeHeaders = (headers: Mail.Options['headers']): Record<string, string> | undefined => {
  if (!headers) return undefined;

  const entries: ReadonlyArray<readonly [string, unknown]> = Array.isArray(headers)
    ? headers.map(header => [header.key, header.value] as const)
    : Object.entries(headers);

  const normalized = entries.reduce<Record<string, string>>((accumulator, [key, raw]) => {
    const value = raw !== null && typeof raw === 'object' && 'value' in raw ? (raw as { value: unknown }).value : raw;

    return { ...accumulator, [key]: String(value) };
  }, {});

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const mapAttachment = async (mail: MailMessage, attachment: Mail.Attachment): Promise<CloudflareAttachment> => {
  const content = await resolveContent(mail, attachment, 'content');

  return {
    content: content.toString('base64'),
    filename: typeof attachment.filename === 'string' ? attachment.filename : (attachment.cid ?? 'attachment'),
    type: attachment.contentType,
    disposition: attachment.contentDisposition ?? (attachment.cid ? 'inline' : 'attachment'),
  };
};

/**
 * Build the Cloudflare Email Service REST payload from a resolved Nodemailer
 * mail message. Addresses come from Nodemailer's parser (already shaped as
 * `{ address, name }`, matching the Cloudflare REST contract), while the body
 * and attachments are resolved through `mail.resolveContent`.
 */
export const buildCloudflarePayload = async (mail: MailMessage): Promise<CloudflareSendPayload> => {
  const addresses = mail.message.getAddresses() as unknown as GroupedAddresses;

  const from = toRecipients(addresses.from)[0];

  if (!from) {
    throw new Error('nodemailer-cloudflare-transport: a "from" address is required');
  }

  const to = toRecipients(addresses.to);

  if (to.length === 0) {
    throw new Error('nodemailer-cloudflare-transport: at least one "to" recipient is required');
  }

  const cc = toRecipients(addresses.cc);
  const bcc = toRecipients(addresses.bcc);
  const replyTo = toRecipients(addresses['reply-to'])[0];

  const { data } = mail;

  const text = data.text != null ? (await resolveContent(mail, data, 'text')).toString('utf-8') : undefined;

  const html = data.html != null ? (await resolveContent(mail, data, 'html')).toString('utf-8') : undefined;

  const attachments = data.attachments?.length
    ? await Promise.all(data.attachments.map(attachment => mapAttachment(mail, attachment)))
    : undefined;

  const headers = normalizeHeaders(data.headers);

  return {
    from,
    to,
    ...(cc.length > 0 ? { cc } : {}),
    ...(bcc.length > 0 ? { bcc } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject: typeof data.subject === 'string' ? data.subject : '',
    ...(text != null ? { text } : {}),
    ...(html != null ? { html } : {}),
    ...(headers ? { headers } : {}),
    ...(attachments ? { attachments } : {}),
  };
};
