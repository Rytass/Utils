/**
 * @jest-environment node
 */

import nodemailer from 'nodemailer';
import {
  CloudflareEmailError,
  CloudflareFetchRequest,
  CloudflareFetchResponse,
  CloudflareSendPayload,
  CloudflareSendResult,
  CloudflareTransport,
} from '../src';

const ACCOUNT_ID = 'account-123';
const API_TOKEN = 'token-abc';
const ENDPOINT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/email/sending/send`;

type FetchMock = jest.Mock<Promise<CloudflareFetchResponse>, [string, CloudflareFetchRequest]>;

const okResult = (result: Partial<CloudflareSendResult> = {}): CloudflareFetchResponse => ({
  ok: true,
  status: 200,
  json: async () => ({
    success: true,
    errors: [],
    messages: [],
    result: {
      delivered: [],
      permanent_bounces: [],
      queued: [],
      ...result,
    },
  }),
});

const makeFetch = (response: CloudflareFetchResponse): FetchMock => jest.fn(async () => response);

const makeTransporter = (fetchImpl: FetchMock): nodemailer.Transporter =>
  nodemailer.createTransport(new CloudflareTransport({ accountId: ACCOUNT_ID, apiToken: API_TOKEN, fetch: fetchImpl }));

const lastPayload = (fetchImpl: FetchMock): CloudflareSendPayload =>
  JSON.parse(fetchImpl.mock.calls[0][1].body) as CloudflareSendPayload;

describe('CloudflareTransport', () => {
  describe('constructor', () => {
    it('throws when accountId is missing', () => {
      expect(() => new CloudflareTransport({ accountId: '', apiToken: API_TOKEN })).toThrow(/accountId/);
    });

    it('throws when apiToken is missing', () => {
      expect(() => new CloudflareTransport({ accountId: ACCOUNT_ID, apiToken: '' })).toThrow(/apiToken/);
    });
  });

  describe('send', () => {
    it('posts to the correct endpoint with bearer auth', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'] }));

      await makeTransporter(fetchImpl).sendMail({
        from: 'no-reply@yourdomain.com',
        to: 'jane@example.com',
        subject: 'Hi',
        text: 'Hello',
      });

      expect(fetchImpl).toHaveBeenCalledTimes(1);

      const [url, init] = fetchImpl.mock.calls[0];

      expect(url).toBe(ENDPOINT);
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe(`Bearer ${API_TOKEN}`);
      expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('maps addresses, subject and body into the REST payload', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'] }));

      await makeTransporter(fetchImpl).sendMail({
        from: 'No Reply <no-reply@yourdomain.com>',
        to: 'Jane Doe <jane@example.com>, bob@example.com',
        cc: { name: 'Team', address: 'team@example.com' },
        replyTo: 'support@yourdomain.com',
        subject: 'Welcome!',
        html: '<h1>Hi</h1>',
        text: 'Hi',
      });

      const payload = lastPayload(fetchImpl);

      // `from` keeps its display name as an { address, name } object.
      expect(payload.from).toEqual({ address: 'no-reply@yourdomain.com', name: 'No Reply' });
      // Named recipient -> object; bare recipient -> plain string.
      expect(payload.to).toEqual([{ address: 'jane@example.com', name: 'Jane Doe' }, 'bob@example.com']);

      expect(payload.cc).toEqual([{ address: 'team@example.com', name: 'Team' }]);
      // REST API uses snake_case reply_to (not the Workers binding's replyTo).
      expect(payload.reply_to).toBe('support@yourdomain.com');
      expect(payload.subject).toBe('Welcome!');
      expect(payload.html).toBe('<h1>Hi</h1>');
      expect(payload.text).toBe('Hi');
    });

    it('maps bcc recipients into the payload', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'] }));

      await makeTransporter(fetchImpl).sendMail({
        from: 'no-reply@yourdomain.com',
        to: 'jane@example.com',
        bcc: ['audit@yourdomain.com', { name: 'Ops', address: 'ops@yourdomain.com' }],
        subject: 'Hi',
        text: 'Hello',
      });

      expect(lastPayload(fetchImpl).bcc).toEqual([
        'audit@yourdomain.com',
        { address: 'ops@yourdomain.com', name: 'Ops' },
      ]);
    });

    it('honours a custom baseUrl when building the endpoint', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'] }));

      const transporter = nodemailer.createTransport(
        new CloudflareTransport({
          accountId: ACCOUNT_ID,
          apiToken: API_TOKEN,
          baseUrl: 'https://gateway.example.com/cf/',
          fetch: fetchImpl,
        }),
      );

      await transporter.sendMail({
        from: 'no-reply@yourdomain.com',
        to: 'jane@example.com',
        subject: 'Hi',
        text: 'Hello',
      });

      expect(fetchImpl.mock.calls[0][0]).toBe(
        `https://gateway.example.com/cf/accounts/${ACCOUNT_ID}/email/sending/send`,
      );
    });

    it('normalizes array-form headers', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'] }));

      await makeTransporter(fetchImpl).sendMail({
        from: 'no-reply@yourdomain.com',
        to: 'jane@example.com',
        subject: 'Hi',
        text: 'Hello',
        headers: [{ key: 'X-Entity-Ref-ID', value: 'ref-42' }],
      });

      expect(lastPayload(fetchImpl).headers).toMatchObject({ 'X-Entity-Ref-ID': 'ref-42' });
    });

    it('falls back to cid then a default when an attachment has no filename', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'] }));

      await makeTransporter(fetchImpl).sendMail({
        from: 'no-reply@yourdomain.com',
        to: 'jane@example.com',
        subject: 'Inline',
        html: '<img src="cid:logo" />',
        attachments: [{ cid: 'logo', content: 'png-bytes', contentType: 'image/png' }],
      });

      expect(lastPayload(fetchImpl).attachments?.[0]).toMatchObject({
        filename: 'logo',
        type: 'image/png',
        disposition: 'inline',
      });
    });

    it('succeeds when recipients are only queued', async () => {
      const fetchImpl = makeFetch(okResult({ queued: ['later@example.com'] }));

      const info = await makeTransporter(fetchImpl).sendMail({
        from: 'no-reply@yourdomain.com',
        to: 'later@example.com',
        subject: 'Hi',
        text: 'Hello',
      });

      expect(info.accepted).toEqual(['later@example.com']);
      expect(info.rejected).toEqual([]);
    });

    it('base64-encodes attachments', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'] }));

      await makeTransporter(fetchImpl).sendMail({
        from: 'no-reply@yourdomain.com',
        to: 'jane@example.com',
        subject: 'Invoice',
        text: 'See attached',
        attachments: [{ filename: 'invoice.txt', content: 'hello-file', contentType: 'text/plain' }],
      });

      const payload = lastPayload(fetchImpl);

      expect(payload.attachments).toEqual([
        {
          content: Buffer.from('hello-file').toString('base64'),
          filename: 'invoice.txt',
          type: 'text/plain',
          disposition: 'attachment',
        },
      ]);
    });

    it('forwards custom headers as a flat record', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'] }));

      await makeTransporter(fetchImpl).sendMail({
        from: 'no-reply@yourdomain.com',
        to: 'jane@example.com',
        subject: 'Digest',
        text: 'Body',
        headers: { 'X-Campaign-ID': 'weekly-digest' },
      });

      expect(lastPayload(fetchImpl).headers).toMatchObject({ 'X-Campaign-ID': 'weekly-digest' });
    });

    it('returns accepted (delivered + queued) and rejected lists', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'], queued: ['later@example.com'] }));

      const info = await makeTransporter(fetchImpl).sendMail({
        from: 'no-reply@yourdomain.com',
        to: ['jane@example.com', 'later@example.com'],
        subject: 'Hi',
        text: 'Hello',
      });

      expect(info.accepted).toEqual(['jane@example.com', 'later@example.com']);
      expect(info.rejected).toEqual([]);
      expect(info.messageId).toMatch(/@yourdomain\.com>$/);
    });

    it('tolerates partial bounces (succeeds while reporting rejected recipients)', async () => {
      const fetchImpl = makeFetch(
        okResult({ delivered: ['jane@example.com'], permanent_bounces: ['ghost@example.com'] }),
      );

      const info = await makeTransporter(fetchImpl).sendMail({
        from: 'no-reply@yourdomain.com',
        to: ['jane@example.com', 'ghost@example.com'],
        subject: 'Hi',
        text: 'Hello',
      });

      expect(info.accepted).toEqual(['jane@example.com']);
      expect(info.rejected).toEqual(['ghost@example.com']);
    });

    it('rejects when every recipient permanently bounces', async () => {
      const fetchImpl = makeFetch(okResult({ permanent_bounces: ['ghost@example.com'] }));

      await expect(
        makeTransporter(fetchImpl).sendMail({
          from: 'no-reply@yourdomain.com',
          to: 'ghost@example.com',
          subject: 'Hi',
          text: 'Hello',
        }),
      ).rejects.toBeInstanceOf(CloudflareEmailError);
    });

    it('rejects when the API reports no accepted and no rejected recipients', async () => {
      const fetchImpl = makeFetch(okResult());

      await expect(
        makeTransporter(fetchImpl).sendMail({
          from: 'no-reply@yourdomain.com',
          to: 'jane@example.com',
          subject: 'Hi',
          text: 'Hello',
        }),
      ).rejects.toBeInstanceOf(CloudflareEmailError);
    });

    it('rejects with CloudflareEmailError carrying the API error code', async () => {
      const fetchImpl = makeFetch({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          errors: [{ code: 10001, message: 'email.sending.error.invalid_request_schema' }],
          messages: [],
          result: null,
        }),
      });

      const error = await makeTransporter(fetchImpl)
        .sendMail({
          from: 'no-reply@yourdomain.com',
          to: 'jane@example.com',
          subject: 'Hi',
          text: 'Hello',
        })
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(CloudflareEmailError);
      expect((error as CloudflareEmailError).httpStatus).toBe(400);
      expect((error as CloudflareEmailError).errors[0].code).toBe(10001);
    });

    it('rejects when no "from" address is provided', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'] }));

      await expect(
        makeTransporter(fetchImpl).sendMail({
          to: 'jane@example.com',
          subject: 'Hi',
          text: 'Hello',
        }),
      ).rejects.toThrow(/"from" address is required/);

      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('rejects when no "to" recipient is provided', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'] }));

      await expect(
        makeTransporter(fetchImpl).sendMail({
          from: 'no-reply@yourdomain.com',
          subject: 'Hi',
          text: 'Hello',
        }),
      ).rejects.toThrow(/at least one "to" recipient is required/);

      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('unwraps Nodemailer prepared header values ({ prepared, value })', async () => {
      const fetchImpl = makeFetch(okResult({ delivered: ['jane@example.com'] }));

      await makeTransporter(fetchImpl).sendMail({
        from: 'no-reply@yourdomain.com',
        to: 'jane@example.com',
        subject: 'Hi',
        text: 'Hello',
        headers: { 'X-Custom': { prepared: true, value: 'raw-value' } },
      });

      expect(lastPayload(fetchImpl).headers).toMatchObject({ 'X-Custom': 'raw-value' });
    });
  });
});
