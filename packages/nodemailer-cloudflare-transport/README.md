# nodemailer-cloudflare-transport

A [Nodemailer](https://nodemailer.com/) transport for the
[Cloudflare Email Service](https://developers.cloudflare.com/email-service/)
**REST API**. Send transactional email from any Node.js backend, serverless
function, or CI pipeline using your existing Nodemailer code.

## Why the REST API?

Cloudflare exposes email sending in two ways:

| Mechanism | Runtime | Usable from Node.js |
| ------------------------------------ | --------------- | ------------------- |
| Email Service **REST API**           | Any HTTP client | ✅ Yes              |
| Email Service **Workers binding**    | Cloudflare Workers only | ❌ No       |
| Email Routing `send_email` binding   | Cloudflare Workers only | ❌ No (verified recipients only) |

A Nodemailer transport runs in Node.js, so this package targets the REST API —
the only path callable outside a Worker.

> Recipient objects in the REST API use `{ address, name }` and the reply field
> is `reply_to`. This intentionally differs from the Workers binding
> (`{ email, name }` / `replyTo`).

## Installation

```bash
npm install nodemailer nodemailer-cloudflare-transport
# or
yarn add nodemailer nodemailer-cloudflare-transport
```

`nodemailer` is a peer dependency. Requires Node.js 18+ (uses the global
`fetch`).

## Prerequisites

1. A verified sending domain in the Cloudflare Email Service.
2. A Cloudflare **account ID**.
3. A Cloudflare **API token** with the "Send Email" permission.

## Usage

```ts
import nodemailer from 'nodemailer';
import { CloudflareTransport } from 'nodemailer-cloudflare-transport';

const transporter = nodemailer.createTransport(
  new CloudflareTransport({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    apiToken: process.env.CLOUDFLARE_API_TOKEN!,
  }),
);

const info = await transporter.sendMail({
  from: 'Your App <no-reply@yourdomain.com>',
  to: 'Jane Doe <jane@example.com>',
  cc: ['team@example.com'],
  replyTo: 'support@yourdomain.com',
  subject: 'Welcome!',
  html: '<h1>Thanks for joining!</h1>',
  text: 'Thanks for joining!',
  attachments: [{ filename: 'invoice.pdf', content: pdfBuffer }],
});

console.log(info.messageId, info.accepted, info.rejected);
```

## Options

| Option      | Type        | Required | Default                                  | Description                                            |
| ----------- | ----------- | -------- | ---------------------------------------- | ------------------------------------------------------ |
| `accountId` | `string`    | Yes      | —                                        | Cloudflare account ID (the `{account_id}` path param). |
| `apiToken`  | `string`    | Yes      | —                                        | API token with the "Send Email" permission.            |
| `baseUrl`   | `string`    | No       | `https://api.cloudflare.com/client/v4`   | Override the API base URL.                              |
| `fetch`     | `FetchLike` | No       | global `fetch`                           | Inject a custom `fetch` (testing / custom runtimes).   |

## Delivery semantics

The REST API reports per-recipient status as `delivered`, `queued`, and
`permanent_bounces`. This transport uses **partial tolerance**:

- `info.accepted` = `delivered` + `queued`
- `info.rejected` = `permanent_bounces`
- The send resolves as long as **at least one** recipient was delivered or
  queued.
- If **every** recipient permanently bounces, or the API returns an error, the
  send rejects with a `CloudflareEmailError` carrying the HTTP status and the
  Cloudflare `errors` array.

```ts
import { CloudflareEmailError } from 'nodemailer-cloudflare-transport';

try {
  await transporter.sendMail(/* ... */);
} catch (error) {
  if (error instanceof CloudflareEmailError) {
    console.error(error.httpStatus, error.errors);
  }
}
```

## License

MIT
