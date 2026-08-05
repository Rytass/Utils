# Rytass Utils - Oracle Fusion ERP Client (NestJS)

NestJS module for [`@rytass/erp-oracle-fusion`](../erp-oracle-fusion). Wires the Fusion REST client
and FBDI service into dependency injection, resolves configuration from any provider, binds the
observability sink through DI, and bridges the NestJS logger.

Client behaviour itself, meaning REST semantics, error classification, the FBDI template engine and
ESS jobs, is documented in the [core package README](../erp-oracle-fusion/README.md). This document
covers module assembly only.

## Features

- [x] Synchronous and asynchronous module registration
- [x] Configuration from any injectable provider (ConfigService, Vault, literals)
- [x] `FusionRestClient` and `FusionFbdiService` as injectable providers
- [x] Observability sink bound through DI (`useClass`, `useExisting`, `useFactory`)
- [x] NestJS `Logger` bridged into the client automatically
- [x] Optional global registration

## Installation

```bash
npm install @rytass/erp-oracle-fusion-nestjs
# or
yarn add @rytass/erp-oracle-fusion-nestjs
```

The core package `@rytass/erp-oracle-fusion` comes along as a dependency; there is no need to add it
separately.

## Registration

```ts
import { FusionClientModule } from '@rytass/erp-oracle-fusion-nestjs';

@Module({
  imports: [
    FusionClientModule.forRoot({
      config: {
        baseUrl: 'https://your-pod.fa.ap1.oraclecloud.com',
        auth: {
          // type defaults to 'oauth2_client_credentials'
          tokenUrl: 'https://idcs-xxx.identity.oraclecloud.com/oauth2/v1/token',
          clientId: '...',
          clientSecret: '...',
        },
      },
    }),
  ],
})
export class AppModule {}
```

When configuration comes from a provider, use `forRootAsync`:

```ts
FusionClientModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    baseUrl: config.getOrThrow('FUSION_BASE_URL'),
    auth: {
      tokenUrl: config.getOrThrow('FUSION_OAUTH_TOKEN_URL'),
      clientId: config.getOrThrow('FUSION_CLIENT_ID'),
      clientSecret: config.getOrThrow('FUSION_CLIENT_SECRET'),
      scope: config.get('FUSION_OAUTH_SCOPE'),
    },
  }),
});
```

## Configuration

### FusionClientModuleOptions

| Property        | Type                       | Required | Default | Description                                          |
| --------------- | -------------------------- | -------- | ------- | ---------------------------------------------------- |
| `config`        | `FusionClientModuleConfig` | Yes      | -       | Client configuration, see below                      |
| `isGlobal`      | `boolean`                  | No       | `false` | Register as a global module                          |
| `callLogSink`   | `FusionCallLogSinkOptions` | No       | -       | Observability sink binding; defaults to a no-op sink |
| `disableLogger` | `boolean`                  | No       | `false` | Disable the NestJS `Logger` bridge                   |

`forRootAsync` additionally accepts `imports`, `inject` and `useFactory` with the usual NestJS
semantics.

`FusionClientModuleConfig` mirrors the core package's `FusionClientOptions` minus `callLogSink` and
`logger`, which this module injects for you. See the
[core configuration table](../erp-oracle-fusion/README.md#configuration) for every field and its
default value.

## Usage

```ts
@Injectable()
export class LedgerService {
  constructor(
    private readonly fusion: FusionRestClient,
    private readonly fbdi: FusionFbdiService,
  ) {}

  async listLedgers(): Promise<Ledger[]> {
    return this.fusion.getAll<Ledger>('ledgersLOV');
  }
}
```

## Sharing the Client Across Modules

`forRoot` and `forRootAsync` must be called **exactly once**. Calling either twice creates two
clients with independent OAuth token caches.

The recommended topology is a wrapper module that assembles the client once and re-exports it, which
keeps dependencies visible in module definitions and lets tests assemble only what they need:

```ts
@Module({
  imports: [FusionClientModule.forRootAsync({ /* ... */ })],
  exports: [FusionClientModule],
})
export class MyFusionModule {}

@Module({ imports: [MyFusionModule], providers: [LedgerService] })
export class LedgerModule {}
```

Alternatively pass `isGlobal: true` if you would rather not touch every consuming module, at the
cost of making the dependency implicit.

## Observability

Implement `FusionCallLogSink` and bind it through DI:

```ts
@Injectable()
export class FusionCallLogService implements FusionCallLogSink {
  async record(entry: FusionCallLogEntry): Promise<void> {
    try {
      await this.repository.insert(entry);
    } catch {
      // Contract: the sink must never throw.
    }
  }
}

FusionClientModule.forRootAsync({
  // ...
  callLogSink: { imports: [ObservabilityModule], useExisting: FusionCallLogService },
});
```

> **Warning**
> The module hosting the sink must not depend on `FusionRestClient`. `FusionClientModule` resolves
> the sink at startup, so a sink module that also consumes the client forms a module cycle. Keep the
> sink in a small module that depends only on its own storage layer.

## API Reference

| Export                      | Description                                   |
| --------------------------- | --------------------------------------------- |
| `FusionClientModule`        | `forRoot`, `forRootAsync`                     |
| `NoopFusionCallLogSink`     | Default sink; discards every record           |
| `FUSION_CLIENT_OPTIONS`     | DI token holding the client configuration     |
| `FUSION_CALL_LOG_SINK`      | DI token holding the bound observability sink |
| `FusionClientModuleOptions` | Module option types                           |

For convenience this package re-exports the core symbols most applications need
(`FusionRestClient`, `FusionFbdiService`, the three error classes, `FusionCallLogEntry` and so on).
The full FBDI template API (`defineFbdiTemplate`, `GL_JOURNAL_TEMPLATE` and friends) should be
imported directly from [`@rytass/erp-oracle-fusion`](../erp-oracle-fusion).

## Troubleshooting

**`Nest can't resolve dependencies of the FusionRestClient`.** The consuming module does not import
a module that provides the client. Either wrap `forRoot(Async)` in a module that exports
`FusionClientModule`, or register with `isGlobal: true`.

**`A circular dependency between modules`.** The module hosting the observability sink depends on
`FusionRestClient`. Move the sink into a module that depends only on its storage layer.

**Tokens are re-issued constantly, or configuration appears duplicated.** `forRoot(Async)` was
called more than once, producing two clients. Assemble once and re-export.

**No client log output.** The NestJS `Logger` bridge is enabled by default under the
`FusionRestClient` context. Setting `disableLogger: true` silences it entirely.

## Requirements

- `@nestjs/common` >= 10 (peer dependency)
- `@rytass/erp-oracle-fusion` (dependency)

## Development

```bash
yarn nx test @rytass/erp-oracle-fusion-nestjs
yarn nx lint @rytass/erp-oracle-fusion-nestjs
yarn nx build @rytass/erp-oracle-fusion-nestjs
```

## License

MIT
