# Rytass Utils - Invoice Turnkey Base NestJS NATS Notify Module

Publishes the events of [`@rytass/invoice-turnkey-base-nestjs-module`](../invoice-turnkey-base-nestjs-module) (the `turnkey_events` outbox) to NATS JetStream. The module does not register Core; it only uses the `TurnkeyEventService` that `TurnkeyBaseModule` already provides, so register `TurnkeyBaseModule` (directly or through the REST module) first.

> Status: early development (0.x).

## Installation

```bash
yarn add @rytass/invoice-turnkey-base-nestjs-nats-notify-module @nats-io/transport-node @nats-io/jetstream @nestjs/typeorm typeorm pg
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { TurnkeyNatsNotifyModule } from '@rytass/invoice-turnkey-base-nestjs-nats-notify-module';

@Module({
  imports: [
    TurnkeyNatsNotifyModule.forRoot({
      servers: ['nats://nats:4222'],
      subjectPrefix: 'turnkey',
    }),
  ],
})
export class AppModule {}
```

`forRootAsync` accepts `imports`, `useFactory` and `inject`:

```typescript
TurnkeyNatsNotifyModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    servers: config.getOrThrow<string>('NATS_URL'),
    connectionOptions: { user: config.get('NATS_USER'), pass: config.get('NATS_PASS') },
  }),
});
```

## Options

| Option              | Default   | Description                                                                 |
| ------------------- | --------- | --------------------------------------------------------------------------- |
| `servers`           | required  | NATS server URL(s)                                                          |
| `subjectPrefix`     | `turnkey` | Subject prefix, see below                                                   |
| `channel`           | `nats`    | Name of the cursor row in `turnkey_event_cursors` and of the advisory lock  |
| `pollIntervalMs`    | `5000`    | Polling interval; a base `emit` also wakes a round immediately              |
| `connectionOptions` | -         | Other `connect` options (`user`, `pass`, `token`, `tls`, `name`, ...)       |

## Subjects and payload

Each event is published to `${subjectPrefix}.${companyTaxId}.${type}`, for example `turnkey.12345678.invoice.issued`. Subscribe with `turnkey.12345678.>` for one company or `turnkey.>` for all.

The payload is JSON:

```json
{ "id": "42", "type": "invoice.issued", "companyTaxId": "12345678", "data": {}, "createdAt": "2026-01-01T00:00:00.000Z" }
```

`id` is the outbox sequence number. It is also sent as the JetStream `msgID`, so JetStream deduplicates retries within its duplicate window (2 minutes by default).

## JetStream prerequisite

The module publishes into an existing stream; it does not create one. Create a stream that captures the prefix before starting the app:

```bash
nats stream add TURNKEY --subjects "turnkey.>" --storage file --retention limits --max-age 14d
```

Without a matching stream, publishing fails with "no stream matches subject", the cursor does not move, and the error is logged on every round.

## Delivery semantics

- A round reads the cursor, reads up to 100 events after it, publishes them in order and advances the cursor after each publish is acknowledged by JetStream. A failed publish stops the round; the next round retries from the failed event.
- Delivery is at least once. If the process dies between the ack and the cursor update, the event is published again with the same `msgID`, which JetStream drops inside its duplicate window.
- Only one instance publishes per `channel`. The module takes a PostgreSQL session advisory lock (two-key form, so it does not collide with the base module's locks) on the base `DataSource`. Other instances skip the round until the lock is free.
- `onApplicationShutdown` stops polling, waits for the running round, releases the lock and drains the NATS connection.

## Notes

- The NATS connection is created on the first round, so a NATS outage at boot does not stop the application; the round is retried on the next poll.
- Events are never removed from the outbox by this module. Retention is the stream's responsibility.
