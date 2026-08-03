---
sidebar_position: 3
---

# OIDC Provider

This module can turn your application into an OpenID Connect provider, so other services sign their users in against it. It ships behind its own entry point: importing the package root never reaches it, which means `oidc-provider` is never resolved and the two tables it needs are never created.

```bash
npm install oidc-provider
```

`oidc-provider` is ESM-only and is loaded through an opaque dynamic import, so bundlers cannot see it — it will not appear in a generated `package.json` (Nx `generatePackageJson`). List it in your application's own dependencies. A missing install fails at boot with an explicit message rather than mysteriously at runtime.

```typescript title="src/app.module.ts"
import { MemberBaseOidcProviderModule } from '@rytass/member-base-nestjs-module/oidc-provider';

@Module({
  imports: [
    MemberBaseModule.forRoot({
      /* ... */ cookieMode: true,
    }),
    MemberBaseOidcProviderModule.forRoot({
      issuer: 'https://idp.example.com/oidc',
      jwks: JSON.parse(process.env.OIDC_JWKS),
      cookieKeys: [process.env.OIDC_COOKIE_KEY],
      interaction: {
        loginPageUrl: '/sign-in',
        consentPageUrl: '/authorize',
      },
    }),
  ],
})
export class AppModule {}
```

The protocol endpoints **cannot** be a Nest controller and must be mounted from `main.ts` before `listen()`:

```typescript title="src/main.ts"
import { mountMemberBaseOidcProvider } from '@rytass/member-base-nestjs-module/oidc-provider';

const app = await NestFactory.create(AppModule);

mountMemberBaseOidcProvider(app);

await app.listen(3000);
```

`oidc-provider` is a Koa application that reads the raw request stream. Middleware registered through `configure(consumer)` runs after Nest's body parser, which has already consumed that stream, so every form-encoded POST (`/token`, `/introspection`, `/revocation`) would break.

## References

### `forRoot()`

```tsx
static forRoot(options: MemberBaseOidcProviderOptions);
```

**Parameters:**

| Name                        | Type                                | Default                | Description                                               |
| --------------------------- | ----------------------------------- | ---------------------- | --------------------------------------------------------- |
| issuer                      | string                              | required               | Issuer identifier; must match the public URL              |
| jwks                        | { keys: object[] }                  | ephemeral + warning    | Signing keys for id tokens; required outside development  |
| cookieKeys                  | string[]                            | random                 | Keys protecting the provider's own cookies                |
| routePrefix                 | string                              | `oidc`                 | Path the endpoints are mounted on                         |
| interaction.loginPageUrl    | string \| (params) => string        | built-in page          | Your own login page; the browser is redirected here       |
| interaction.consentPageUrl  | string \| (params) => string        | built-in page          | Your own consent page                                     |
| interaction.renderLogin     | (params) => string                  | built-in page          | Render login HTML in-process; ignored when the URL is set |
| interaction.renderConsent   | (params) => string                  | built-in page          | Render consent HTML in-process                            |
| interaction.allowedChannels | string[]                            | all channels           | Which authentication sources the login form may use       |
| interaction.autoConsent     | boolean \| (clientId) => boolean    | client's `skipConsent` | Skip the consent step                                     |
| claims.extra                | (member) => object                  | -                      | Additional identity claims                                |
| claims.additionalScopes     | string[]                            | -                      | Extra accepted scopes                                     |
| claims.scopeClaims          | Record\<string, string[]\>          | -                      | Which claims each scope releases                          |
| ssoBridge.enabled           | boolean                             | true                   | Keep the local session and the issuer session consistent  |
| clients.allowPublic         | boolean                             | true                   | Whether public (PKCE-only) clients may be registered      |
| clients.validate            | (input, context) => void \| Promise | -                      | Extra registration rules; throw to reject                 |
| clients.secretCipher        | { encrypt, decrypt }                | stored in plaintext    | Encrypt `client_secret` at rest; either may be async      |
| features.rpInitiatedLogout  | boolean                             | true                   | `/session/end`                                            |
| features.revocation         | boolean                             | true                   | `/revocation`                                             |
| features.introspection      | boolean                             | true                   | `/introspection`                                          |
| features.userinfo           | boolean                             | true                   | `/me`                                                     |
| requirePkce                 | boolean                             | true                   | Turn off only for a legacy client that cannot be changed  |
| proxy                       | boolean                             | true                   | Trust `X-Forwarded-*` when deriving request URLs          |
| clientBasedCors             | boolean                             | true                   | Answer preflights from a client's registered origins      |
| ttl                         | Partial\<Record\<...\>\>            | 1h access, 14d refresh | Token lifetimes                                           |
| purgeIntervalSeconds        | number                              | 3600                   | Expired payload sweep; `0` disables it                    |
| advanced                    | Record\<string, unknown\>           | -                      | Merged last into the oidc-provider configuration          |

`features` merges one key at a time, so turning a single endpoint off leaves the rest alone. `advanced.features` replaces the whole object instead. `devInteractions` is not configurable — it would shadow this module's interaction routes.

### Registered routes

| Endpoint                                                                                    | Protection                  |
| ------------------------------------------------------------------------------------------- | --------------------------- |
| `/oidc/.well-known/openid-configuration`, `/auth`, `/token`, `/me`, `/jwks`, `/session/end` | Public (mounted middleware) |
| `/oidc/interaction/:uid` and everything under it                                            | `@IsPublic()`               |

Those are the only routes the module registers. Client administration is **not** among them — it ships as `OidcClientService`, so nothing is reachable until your application chooses to expose it.

## Administering service providers

Registering a client is a management operation, so the module ships it as a service and no endpoint. The transport, route, payload shape and permission name stay yours; a GraphQL-only application gains no REST surface it did not ask for.

| Method                             | Returns                    | Notes                                                             |
| ---------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| `list()`                           | OidcClientView[]           | Newest first, never includes the stored secret                    |
| `findOne(clientId)`                | OidcClientView \| null     | For nullable lookups                                              |
| `get(clientId)`                    | OidcClientView             | Throws `OidcClientNotFoundError`                                  |
| `create(input)`                    | CreatedOidcClient          | The generated secret is readable once; `null` for a public client |
| `update(clientId, input, options)` | OidcClientView             | `mode: 'replace'` (default) or `'merge'`                          |
| `rotateSecret(clientId)`           | { clientId, clientSecret } | Explicit, never a side effect of an edit                          |
| `remove(clientId)`                 | OidcClientView             | Soft removes, and returns what was removed                        |
| `restore(clientId)`                | OidcClientView             | Brings a removed client back                                      |

```typescript
@Resolver()
export class OidcClientResolver {
  constructor(private readonly oidcClientService: OidcClientService) {}

  @AllowActions([['OidcClient', 'write']])
  @Mutation(() => OidcClientDto)
  async createOidcClient(@Args('input') input: CreateOidcClientArgs): Promise<OidcClientView> {
    return this.oidcClientService.create(input);
  }
}
```

`update` replaces the record by default, which is correct for a PUT and is also how an edit form that forgot to submit `grantTypes` silently clears it. Pass `{ mode: 'merge' }` to leave omitted fields alone; validation runs against the merged result either way.

### What is rejected before it reaches the database

| Rejected                                                      | Raises                            | Why                                                            |
| ------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------- |
| A comma in `redirectUris` / `postLogoutRedirectUris`          | InvalidOidcRedirectUriError       | The columns are `simple-array`; the uri would be stored as two |
| A fragment in `redirectUris`                                  | InvalidOidcRedirectUriError       | Forbidden by OIDC Core 3.1.2.1                                 |
| `responseTypes` with `code` but no `authorization_code` grant | InconsistentOidcClientGrantsError | Every request from that client answers `invalid_client`        |
| An id already held by a live client                           | OidcClientAlreadyExistsError      | `save` on an existing key overwrites it, secret and all        |
| An id held by a removed client                                | OidcClientIdRetiredError          | `clientId` is the primary key and removal is soft              |
| A public client while `allowPublic: false`                    | PublicOidcClientNotAllowedError   | The deployment registers confidential clients only             |

All extend `BadRequestException` and carry a `code` (114–119). Anything beyond these is your own policy and goes in `clients.validate`, which receives the complete state about to be written.

### Encrypting `client_secret` at rest

The column cannot be hashed: `client_secret_basic` is compared against the plaintext by oidc-provider, and `client_secret_jwt` uses it as an HMAC key. Reversible encryption is the only option that keeps the protocol working.

```typescript
clients: {
  secretCipher: {
    encrypt: plain => vault.encrypt(plain),   // may be async
    decrypt: stored => vault.decrypt(stored),
  },
}
```

Called on `create` and `rotateSecret`, undone by the adapter on read. The column is `text`, so ciphertext length is not a consideration. A secret that cannot be decrypted throws, naming the client, rather than degrading into `invalid_client` on every request. Enabling it does not migrate rows already stored in plaintext — rotate every existing client's secret.

## Authorization stays with each service provider

`findAccount` publishes identity claims only. **No roles are emitted.** This issuer answers who a subject is; what that subject may do is each service provider's decision, made against data it controls rather than a claim frozen into a token whose lifetime it cannot influence.

## Operational notes

- **JWKS**: omitting `jwks` generates an ephemeral key with a loud warning. Every restart invalidates issued tokens and multiple instances sign with different keys — development only.
- **Payload sweep**: `oidc-provider` never deletes expired artefacts. A sweep runs hourly by default; set `purgeIntervalSeconds: 0` and drive `OidcMaintenanceService.purgeExpired()` from your own scheduler.
- **Session bridging** requires `cookieMode: true`; a redirect-based login cannot hand a header-bearer token to a browser.
- PKCE is required for every client unless `requirePkce` says otherwise.
