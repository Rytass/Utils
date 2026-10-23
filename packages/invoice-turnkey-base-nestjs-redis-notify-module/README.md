# Rytass Utils - Invoice Turnkey Base NestJS Redis Notify Module

Publishes the events of [`@rytass/invoice-turnkey-base-nestjs-module`](https://github.com/Rytass/Utils/tree/main/packages/invoice-turnkey-base-nestjs-module) (the `turnkey_events` outbox) to Redis, either as Streams or as Pub/Sub messages. The module does not register Core; it only uses the `TurnkeyEventService` that `TurnkeyBaseModule` already provides, so register `TurnkeyBaseModule` (directly or through the REST module) first.

> Turnkey itself is not part of this package. See [Running Turnkey](https://github.com/Rytass/Utils/tree/main/packages/invoice-turnkey-base-nestjs-module#running-turnkey) in the base module and the [Turnkey Docker guide](https://github.com/Rytass/Utils/blob/main/docker/invoice-turnkey/README.md) for building the image and configuring Turnkey.

> Status: early development (0.x).

## Installation

```bash
yarn add @rytass/invoice-turnkey-base-nestjs-redis-notify-module ioredis @nestjs/typeorm typeorm pg
```

## Usage

```typescript
import { Module } from '@nestjs/common';
import { TurnkeyRedisNotifyModule } from '@rytass/invoice-turnkey-base-nestjs-redis-notify-module';

@Module({
  imports: [
    TurnkeyRedisNotifyModule.forRoot({
      redis: 'redis://redis:6379',
      mode: 'STREAM',
      keyPrefix: 'turnkey',
      maxLen: 100000,
    }),
  ],
})
export class AppModule {}
```

`forRootAsync` accepts `imports`, `useFactory` and `inject`:

```typescript
TurnkeyRedisNotifyModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    redis: { host: config.getOrThrow<string>('REDIS_HOST'), port: 6379, password: config.get('REDIS_PASSWORD') },
    mode: 'STREAM',
  }),
});
```

## Options

| Option           | Default   | Description                                                                                 |
| ---------------- | --------- | ------------------------------------------------------------------------------------------- |
| `redis`          | required  | ioredis options object, or a `redis://` URL                                                 |
| `mode`           | `STREAM`  | `STREAM` or `PUBSUB`, see below                                                             |
| `keyPrefix`      | `turnkey` | Prefix for the stream key and the Pub/Sub channel names                                     |
| `channel`        | `redis`   | Name of the cursor row in `turnkey_event_cursors` and of the advisory lock                  |
| `pollIntervalMs` | `5000`    | Polling interval; a base `emit` also wakes a round immediately                              |
| `maxLen`         | -         | STREAM only: trims the stream with `MAXLEN ~ maxLen` (approximate); unset means no trimming |

## Modes

### STREAM (default, reliable)

Each event is appended to the stream `${keyPrefix}:events`:

```
XADD turnkey:events * id <event.id> type <type> companyTaxId <taxId> data <json>
```

Consumers read with `XREAD` or a consumer group and keep their own position. Deduplicate on `id`: if Redis stores the entry but the reply is lost, the module retries and the same event can appear twice. The cursor advances only after `XADD` returns.

### PUBSUB (may lose messages)

Each event is published to `${keyPrefix}:${companyTaxId}:${type}` with the JSON event as the message, for example `turnkey:12345678:invoice.issued`. The cursor advances as soon as `PUBLISH` returns, which only means Redis accepted the message. Pub/Sub does not store messages, so a subscriber that is offline at that moment never receives it and the module does not resend it. Use this mode only when losing events is acceptable.

## Delivery semantics

- A round reads the cursor, reads up to 100 events after it, writes them in order and advances the cursor after each successful write. A failed write stops the round; the next round retries from the failed event.
- Only one instance publishes per `channel`. The module takes a PostgreSQL session advisory lock (two-key form, so it does not collide with the base module's locks) on the base `DataSource`. Other instances skip the round until the lock is free.
- `onApplicationShutdown` stops polling, waits for the running round, releases the lock and closes the Redis connection.

## Notes

- The Redis connection is created on the first round, so a Redis outage at boot does not stop the application; the round is retried on the next poll.
- Stream entries are never deleted by the cursor logic. Use `maxLen` or your own retention policy.
