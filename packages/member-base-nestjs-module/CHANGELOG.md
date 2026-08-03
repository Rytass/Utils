# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.8.1](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.8.0...@rytass/member-base-nestjs-module@0.8.1) (2026-08-03)

### Features

- **member-base-nestjs-module:** make the oidc provider configurable ([6f7c717](https://github.com/Rytass/Utils/commit/6f7c717e0346b714a87a951f138301aa5ae4106b))
- **member-base-nestjs-module:** make hashing, casbin naming and the login log configurable ([e4ec3d7](https://github.com/Rytass/Utils/commit/e4ec3d70010b90d60dd5e0d91f6a9596d716450e))
- **member-base-nestjs-module:** let the client secret cipher be async ([22ae539](https://github.com/Rytass/Utils/commit/22ae539db3d96db4afa071de9a2ba434242275b1))

### Bug Fixes

- **member-base-nestjs-module:** stop bounding oidc client columns this package cannot size ([ba14be9](https://github.com/Rytass/Utils/commit/ba14be9f9c2b069bf356203949d3d2b0723efb3c))
- **member-base-nestjs-module:** record ipv6 login addresses with the right prefix length ([e4ec3d7](https://github.com/Rytass/Utils/commit/e4ec3d70010b90d60dd5e0d91f6a9596d716450e))

### Migration

**`oidc_clients` widens three columns.** `clientSecret`, `name` and `scope` become `text` — the only schema change in this release. With `synchronize: true` nothing is needed. Otherwise:

```sql
ALTER TABLE oidc_clients
  ALTER COLUMN "clientSecret" TYPE text,
  ALTER COLUMN "name" TYPE text,
  ALTER COLUMN "scope" TYPE text;
```

Postgres treats `varchar(n)` to `text` as binary coercible, so no table rewrite happens; the statement takes a brief `ACCESS EXCLUSIVE` lock and returns. Existing rows are untouched and every value that fit before still fits.

**Client registration validates.** Input that 0.8.0 accepted can now be rejected: a comma or fragment in a redirect uri, a `code` response type without the `authorization_code` grant, and an id already held by a live or removed client. Each previously produced either silent corruption or an `invalid_client` with nothing wrong visible in the table, so the rejection is the point — but a seeding script writing one of those shapes now fails at the call.

**Two `OidcClientService` signatures changed.** `remove(clientId)` resolves to the removed `OidcClientView` instead of `void`, and `update` takes a third argument `{ mode: 'replace' | 'merge' }` that defaults to the previous replace semantics.

**The login log records IPv6 correctly.** The address was written as `${ip}/32` regardless of family; on IPv6 that describes a network and Postgres rejects it, so a single login from an IPv6 client aborted the insert. Rows already written are untouched.

## [0.8.0](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.7.0...@rytass/member-base-nestjs-module@0.8.0) (2026-08-03)

### Features

- **member-base-nestjs-module:** expose oidc client administration as a service ([2ac44b7](https://github.com/Rytass/Utils/commit/2ac44b7fe576c31c9a4c3f2ce6459a0d609bddad))

### BREAKING CHANGES

`OidcAdminController` is removed along with the six `/oidc-clients` routes it registered, and `UpsertOidcClientBody` is replaced by `CreateOidcClientInput` / `UpdateOidcClientInput`.

`MemberBaseOidcProviderModule` used to register that controller unconditionally, so importing it added REST routes whether or not the application wanted them. The routes were guarded, so this is not a security fix — it is a scope decision: whether service-provider administration is reachable at all, over which transport, at which path and under which permission name belongs to the host application.

### Migration

Wrap `OidcClientService` in your own resolver or controller and re-expose only what you need:

```ts
@Controller('oidc-clients')
export class OidcClientsController {
  constructor(private readonly oidcClientService: OidcClientService) {}

  @AllowActions([['OidcClient', 'read']])
  @Get()
  list(): Promise<OidcClientView[]> {
    return this.oidcClientService.list();
  }
}
```

Two response shapes differ from the old controller, both deliberately: `create` always carries `clientSecret`, `null` for a public client rather than the key being absent, and a missing client raises `OidcClientNotFoundError` (a `BadRequestException`, code `114`) rather than `NotFoundException` — map it to a 404 in your own handler if you relied on the status.

# [0.7.0](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.6.7...@rytass/member-base-nestjs-module@0.7.0) (2026-08-02)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.6.7](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.6.6...@rytass/member-base-nestjs-module@0.6.7) (2026-08-02)

### Bug Fixes

- **member-base-nestjs-module:** only claim typeorm-adapter is missing when it is ([a7665c6](https://github.com/Rytass/Utils/commit/a7665c6fea8f18e668da19d09814a1b892d4885c))

## [0.6.6](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.6.5...@rytass/member-base-nestjs-module@0.6.6) (2026-08-02)

### Bug Fixes

- **member-base-nestjs-module:** stop misreporting a broken graphql peer ([215b7f8](https://github.com/Rytass/Utils/commit/215b7f838790c0a19652c11a110653c0b0e5a4e3))

## [0.6.5](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.6.4...@rytass/member-base-nestjs-module@0.6.5) (2026-08-02)

### Bug Fixes

- **member-base-nestjs-module:** resolve the graphql peer independently of cwd ([6e0c4e9](https://github.com/Rytass/Utils/commit/6e0c4e9f887f561270b39fc26073a2c536eb76f4))

## [0.6.4](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.6.3...@rytass/member-base-nestjs-module@0.6.4) (2026-08-02)

### Bug Fixes

- **member-base-nestjs-module:** import jsonwebtoken as a default export ([89ec5af](https://github.com/Rytass/Utils/commit/89ec5af122f20273f1db1d525fc1112244d8b4e4))
- **member-base-nestjs-module:** stop the esm build calling bare require() ([e631f67](https://github.com/Rytass/Utils/commit/e631f67575633d20197ed33220a5df8536e75d0e))

## [0.6.3](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.6.2...@rytass/member-base-nestjs-module@0.6.3) (2026-08-01)

### Bug Fixes

- **member-base-nestjs-module:** export BaseMemberRepo under its own name ([9c09c6a](https://github.com/Rytass/Utils/commit/9c09c6ad1146b60f914b5187ae9fcb92eed28045))
- **member-base-nestjs-module:** read the real cookie in the graphql resolver ([e0846a3](https://github.com/Rytass/Utils/commit/e0846a37f3fbfba524bf0b3c69c720d88679f446))

### Migration

`GraphQLContextTokenResolver` read a cookie named `token`, which this package has never written under any configuration, so `context.token` was always empty for a caller that authenticated by cookie. It now reads `access_token`, and `createGraphQLContextTokenResolver({ cookieName, cookieMode })` mirrors a customised module configuration. Authorization was never affected — `CasbinGuard` reads the request directly — so this only matters if your own resolvers consume `context.token`. If you set a `token` cookie yourself to work around it, either rename it or pass `{ cookieName: 'token' }`.

The `Bearer` prefix is now stripped case-insensitively, matching what the guard already did.

## [0.6.2](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.6.1...@rytass/member-base-nestjs-module@0.6.2) (2026-08-01)

### Bug Fixes

- **member-base-nestjs-module:** stop oauth callback cookies breaking local http ([359767b](https://github.com/Rytass/Utils/commit/359767b8ed13d2f4558a4cfb84e995cd411f17ca))

### Features

- **member-base-nestjs-module:** make session cookie names configurable ([cd2789b](https://github.com/Rytass/Utils/commit/cd2789b95b9715e34467448ccf76cf12300720ee))

### Migration

Cookie names and attributes became module options. The cookie **names** are unchanged, and so is every attribute the OIDC session bridge writes; the OAuth callback cookies change.

Overriding `ACCESS_TOKEN_COOKIE_NAME` / `REFRESH_TOKEN_COOKIE_NAME` from your own `providers` array never took effect for the module's own guard, controller and session bridge, and failed silently. Move the value to the options.

| Attribute  | Before                    | After                                                   |
| ---------- | ------------------------- | ------------------------------------------------------- |
| `Secure`   | Always                    | Derived from the request; `cookieSecure` overrides      |
| `Max-Age`  | Absent — a session cookie | From `accessTokenExpiration` / `refreshTokenExpiration` |
| `SameSite` | Absent — browser default  | `Lax`, or `cookieSameSite`                              |
| `Path`     | `/` (Express' default)    | `/`, or `cookiePath`                                    |

Two consequences are worth checking: the callback cookies are no longer session cookies, and `SameSite=Lax` is now explicit — Chrome's implicit default carries a two-minute grace period for top-level POSTs that an explicit `Lax` does not.

One topology needs attention: because `Secure` is no longer unconditional, a deployment terminating TLS at a proxy that neither sets `X-Forwarded-Proto` with `trust proxy` enabled **nor** forwards the original `Host` (nginx sends `Host: localhost` upstream when `proxy_set_header Host` is omitted) looks like plain localhost to the application, and the callback cookie loses `Secure`. Set `cookieSecure: true` for that case. The OIDC session bridge is unaffected: it takes the flag from its configured `issuer`.

## [0.6.1](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.6.0...@rytass/member-base-nestjs-module@0.6.1) (2026-07-31)

### Bug Fixes

- **member-base-nestjs-module:** declare @nestjs/core as a peer dependency ([ea2d631](https://github.com/Rytass/Utils/commit/ea2d631e7ba30dbb7e7e8780aa179b9ebfa0f188))
- **member-base-nestjs-module:** make oidc interaction routes reachable ([6815a92](https://github.com/Rytass/Utils/commit/6815a92402a27b1867c5ae0c4d8ea4d1f2d84da2))
- **member-base-nestjs-module:** pass oidc interaction requests through to nest ([c100695](https://github.com/Rytass/Utils/commit/c1006951aca1c6cd7382c486e385d0a792ee3263))

### Features

- **member-base-nestjs-module:** expose directory queries and an opt-in sync hook ([459b0d9](https://github.com/Rytass/Utils/commit/459b0d969c6db92655f2e570a7f2b2e372609dfb))
- **member-base-nestjs-module:** give oidc consent a user-facing path ([1e2872c](https://github.com/Rytass/Utils/commit/1e2872c9dbb644188807bab96d31cb79aa244347))
- **member-base-nestjs-module:** support ldaps tls options and per-call search base ([4de65ad](https://github.com/Rytass/Utils/commit/4de65ad010015f690da5d357cd2a0c94a544336e))

### Migration

The OIDC interaction layer became API-first, in four parts.

**The interaction routes are now reachable.** `mountMemberBaseOidcProvider` registered its middleware with `app.use('/oidc', handler)`. Express strips a mount path for the handler and puts it back before the next layer, so Nest — which registers the interaction routes without the prefix — never matched `/oidc/interaction/:uid` and every interactive login answered `404`. The middleware is now registered without a mount path and strips the prefix itself. Nothing in your application changes.

**Consent has a user-facing path.** A client with `skipConsent: false` and no `autoConsent` override previously got `400 Consent is required for this client but no consent screen is configured`. The member is now sent to `interaction.consentPageUrl`, to `renderConsent`, or to a built-in page. Set `consentPageUrl` before registering a third-party client.

**Grants answer the whole prompt.** Scopes, claims and resource scopes are granted together and an existing grant is extended rather than replaced, which removes a redirect loop for clients requesting a claim outside the scope mapping.

**The POST endpoints negotiate their response.** `POST /oidc/interaction/:uid/login` answers `200 { redirectTo }` to an API client and `303` to a browser form. `renderLogin`'s parameter object gained `submitUrl`; a custom renderer that copied the built-in page's old relative form action should switch to it.

`@nestjs/core` is now declared as a peer dependency. It was always imported, just never declared.

# [0.6.0](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.5.0...@rytass/member-base-nestjs-module@0.6.0) (2026-07-30)

### Bug Fixes

- **member-base-nestjs-module:** pass oidc interaction requests through to nest ([c100695](https://github.com/Rytass/Utils/commit/c1006951))

### Features

- **member-base-nestjs-module:** route oidc back-channel calls to an internal base ([dda71ae](https://github.com/Rytass/Utils/commit/dda71ae37a90f9ad48a5221d4b1e8cc687bd5fb6))
- **member-base-nestjs-module:** expose directory queries and an opt-in sync hook ([459b0d9](https://github.com/Rytass/Utils/commit/459b0d96))
- **member-base-nestjs-module:** support ldaps tls options and per-call search base ([4de65ad](https://github.com/Rytass/Utils/commit/4de65ad0))

# [0.5.0](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.4.0...@rytass/member-base-nestjs-module@0.5.0) (2026-07-30)

### Bug Fixes

- **member-base-nestjs-module:** make typeorm-adapter an optional peer dependency ([df6f12d](https://github.com/Rytass/Utils/commit/df6f12d2f60416cc7ffbf9523259e6b3e570b7f5))

### Features

- **member-base-nestjs-module:** add credential verification and authTime claim ([7b0270f](https://github.com/Rytass/Utils/commit/7b0270f60534329a5313a9e8f12a7d882fb51b9a))
- **member-base-nestjs-module:** add ldap authentication source ([83beb5d](https://github.com/Rytass/Utils/commit/83beb5dc92341f433bbbc729a160b2071d76fcff))
- **member-base-nestjs-module:** add opt-in openid connect provider endpoint ([bdd5ade](https://github.com/Rytass/Utils/commit/bdd5ade7f6287cdde9a3a30dce4de66454d8c84c))
- **member-base-nestjs-module:** add pluggable authentication gateway ([89ee356](https://github.com/Rytass/Utils/commit/89ee356a309d1efcf40b432d77ee2cc3910548e4))
- **member-base-nestjs-module:** add standards-compliant oidc relying party ([03719f1](https://github.com/Rytass/Utils/commit/03719f1f77204fa4e6adc4e19b97e22e71cc8b1b))

### BREAKING CHANGES

- **member-base-nestjs-module:** consumers that set casbinAdapterOptions must now install
  typeorm-adapter themselves. The module throws at startup with an explicit
  message instead of booting into a broken authorization state.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012F8e8DwRa31CuqD5UdXsJ6

### Migration

`MemberOAuthRecordEntity` declares a unique index on `(channel, channelIdentifier)`. The primary key already guaranteed one binding per member per channel; this adds the complementary guarantee that one external identity maps to exactly one member.

With `synchronize: true`, index creation fails at startup when duplicates already exist. Check first:

```sql
SELECT channel, "channelIdentifier", count(*)
FROM member_oauth_records
GROUP BY 1, 2
HAVING count(*) > 1;
```

Any row returned is a pre-existing anomaly and needs a decision before the index can be created.

# [0.3.0](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.18...@rytass/member-base-nestjs-module@0.3.0) (2026-07-07)

### Features

- **member-base-nestjs-module:** add casbin authorization extension points ([829628f](https://github.com/Rytass/Utils/commit/829628fbfc1ab4541bbdea2b738ae6141ab3f03e))

## [0.2.18](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.17...@rytass/member-base-nestjs-module@0.2.18) (2025-12-05)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.2.17](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.16...@rytass/member-base-nestjs-module@0.2.17) (2025-11-10)

### Bug Fixes

- **member-base-nestjs-module:** ensure generate-password has at least one character type ([5052bc1](https://github.com/Rytass/Utils/commit/5052bc1ead36b07a37af376e68eb3ac09ff996ed))

## [0.2.16](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.15...@rytass/member-base-nestjs-module@0.2.16) (2025-10-20)

### Bug Fixes

- **member-base-nestjs-module:** add missing inject dependency for CUSTOMIZED_JWT_PAYLOAD ([49855c6](https://github.com/Rytass/Utils/commit/49855c66b42d2b5ff1d6d33f187028d8fe2ed9e2))

## [0.2.15](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.14...@rytass/member-base-nestjs-module@0.2.15) (2025-09-22)

### Bug Fixes

- **member-base-nestjs-module:** align casbin payload typings ([f1d5e1a](https://github.com/Rytass/Utils/commit/f1d5e1af7703805425a33f1267e1c06d3b661f77))

### Features

- **member-base-nestjs-module:** add non-breaking options type aliases ([745f6ab](https://github.com/Rytass/Utils/commit/745f6ab12dc96729ab5183d63c46cfa7e79f78ac))
- **member-base-nestjs-module:** add token payload type ([9546e78](https://github.com/Rytass/Utils/commit/9546e78f093d19b3c58ba0f24c10449d29fdc332))
- **member-base-nestjs-module:** centralize injection tokens and add cookie-name tokens ([45c6549](https://github.com/Rytass/Utils/commit/45c654979bcf5b1d3efb7242357fef1d56d55875))
- **member-base-nestjs-module:** prefer header over cookie and validate access token in utils ([d6eb7e6](https://github.com/Rytass/Utils/commit/d6eb7e69429b47611d4667bf5ca4b0ef1f01f440))

## [0.2.14](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.13...@rytass/member-base-nestjs-module@0.2.14) (2025-09-16)

### Bug Fixes

- correct typeorm-adapter import for ESM module resolution ([0a62e46](https://github.com/Rytass/Utils/commit/0a62e46bf4ce800ae2e41df10af8877ef855b030))

## [0.2.13](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.12...@rytass/member-base-nestjs-module@0.2.13) (2025-09-16)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.2.12](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.11...@rytass/member-base-nestjs-module@0.2.12) (2025-09-16)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.2.11](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.10...@rytass/member-base-nestjs-module@0.2.11) (2025-09-15)

### Bug Fixes

- resolve all security vulnerabilities detected by GitHub audit ([0fcdf72](https://github.com/Rytass/Utils/commit/0fcdf72a8a4b1708c09ab0124dfc44e0ea781f2f))

## [0.2.10](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.9...@rytass/member-base-nestjs-module@0.2.10) (2025-09-11)

### Features

- migrate to Nx project-based configuration ([c2d9ca4](https://github.com/Rytass/Utils/commit/c2d9ca46c00ace42bcbf69300dcc43a7346cb9aa))

### Tests

- migrate to standardized test structure ([b7dc99e](https://github.com/Rytass/Utils/commit/b7dc99ef85f5951480dfdae6198cefa252c15423))

### BREAKING CHANGES

- Test directory structure changed from **test** to **tests**

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.2.9](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.8...@rytass/member-base-nestjs-module@0.2.9) (2025-09-09)

### Bug Fixes

- **member-base:** resolve @typescript-eslint/no-explicit-any errors and formatting issues ([7ab7c11](https://github.com/Rytass/Utils/commit/7ab7c11e2bf5af1f5b7ee406db7e1945aaf62d91))

### Features

- add test:coverage script to all packages ([f73bce5](https://github.com/Rytass/Utils/commit/f73bce52024d453755824fa6af784f13da50061f))
- upgrade file-type from v16.5.4 to v21.0.0 ([eb8217b](https://github.com/Rytass/Utils/commit/eb8217b76c4a0d74061f782c082fd4183961bb12))

### BREAKING CHANGES

- file-type v21 is ESM-only, requires Node.js 18+

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>

## [0.2.8](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.7...@rytass/member-base-nestjs-module@0.2.8) (2025-08-19)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.2.7](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.6...@rytass/member-base-nestjs-module@0.2.7) (2025-08-04)

### Bug Fixes

- **member-base-nestjs-module:** use casbinPermissionChecker on @HasPermission decorator ([5cff1c3](https://github.com/Rytass/Utils/commit/5cff1c30eae4b77f44f8b593ae424a9a2041f9ea))

## [0.2.6](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.5...@rytass/member-base-nestjs-module@0.2.6) (2025-08-04)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.2.5](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.4...@rytass/member-base-nestjs-module@0.2.5) (2025-08-04)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.2.4](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.3...@rytass/member-base-nestjs-module@0.2.4) (2025-08-04)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.2.3](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.2...@rytass/member-base-nestjs-module@0.2.3) (2025-08-04)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.2.2](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.1...@rytass/member-base-nestjs-module@0.2.2) (2025-08-04)

### Features

- **member-base-nestjs-module:** add enforcer middleware ([d40c9d8](https://github.com/Rytass/Utils/commit/d40c9d88dc15364c58d9fb68b559f0dbc7e3c58f))

## [0.2.1](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.2.0...@rytass/member-base-nestjs-module@0.2.1) (2025-08-04)

### Features

- **member-base-nestjs-module:** inject enforcer and add @HasPermission param decorator ([d363e52](https://github.com/Rytass/Utils/commit/d363e5214566582822938cc1393d8f17f8cc4c8a))
- **member-base-nestjs-module:** isolate graphql from package ([cf4b7f9](https://github.com/Rytass/Utils/commit/cf4b7f97ba519043e394f40c25aabc9d79e3dbff))

# [0.2.0](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.65...@rytass/member-base-nestjs-module@0.2.0) (2025-07-28)

### Bug Fixes

- **member-base-nestjs-module:** rename exports to support test coverage ([e15d344](https://github.com/Rytass/Utils/commit/e15d3443a7dbfd398ba4bdea76ebe386f6d11314))

## [0.1.65](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.64...@rytass/member-base-nestjs-module@0.1.65) (2025-06-23)

### Features

- **member-base-nestjs-module:** export RESOLVED_MEMBER_REPO ([51da6b4](https://github.com/Rytass/Utils/commit/51da6b4a16a670c7477b0b2b809948870578b92f))

## [0.1.64](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.63...@rytass/member-base-nestjs-module@0.1.64) (2025-06-23)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.1.63](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.62...@rytass/member-base-nestjs-module@0.1.63) (2025-06-22)

### Features

- **member-base-nestjs-module:** add refreshToken function with domain ([a967ab9](https://github.com/Rytass/Utils/commit/a967ab94e75f47b34a3e3183a48eb410128bfccb))

## [0.1.62](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.61...@rytass/member-base-nestjs-module@0.1.62) (2025-06-03)

### Features

- **member-base-nestjs-module:** add default casbin domain ([c562df0](https://github.com/Rytass/Utils/commit/c562df0375c54461e53832cafe67ab5a0cdf5a0d))

## [0.1.61](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.60...@rytass/member-base-nestjs-module@0.1.61) (2025-06-03)

### Bug Fixes

- **member-base-nestjs-module:** add token payload generic ([8ec1316](https://github.com/Rytass/Utils/commit/8ec1316e57da2df44647589c1f8ec218d81d82a8))

## [0.1.60](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.59...@rytass/member-base-nestjs-module@0.1.60) (2025-06-03)

### Bug Fixes

- **member-base-nestjs-module:** use overload to support legacy code ([9de8597](https://github.com/Rytass/Utils/commit/9de85973bb15cb75bc5ae972f59f37e0d9bd9198))

## [0.1.59](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.58...@rytass/member-base-nestjs-module@0.1.59) (2025-06-03)

### Bug Fixes

- **member-base-nestjs-module:** domain options in login and refresh method ([289bfa2](https://github.com/Rytass/Utils/commit/289bfa2f72b24db72e181907abd6338ee8e2c71e))

## [0.1.58](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.57...@rytass/member-base-nestjs-module@0.1.58) (2025-06-03)

### Bug Fixes

- **member-base-nestjs-module:** RBAC w/ domain decorator fix, options member entity generics ([fd4f82d](https://github.com/Rytass/Utils/commit/fd4f82d23309ff6af5273d187d426096d615666f))

## [0.1.57](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.56...@rytass/member-base-nestjs-module@0.1.57) (2025-05-14)

### Features

- **member-base-nestjs-module:** enforce numeric expiresIn for all JWT sign calls ([0a97409](https://github.com/Rytass/Utils/commit/0a974096c9ccaa23d68a4b57122c4e7690da57a0))

## [0.1.56](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.55...@rytass/member-base-nestjs-module@0.1.56) (2025-04-30)

### Bug Fixes

- remove typeorm default date column type for sync issue ([babba5f](https://github.com/Rytass/Utils/commit/babba5fb36d53bf102b1b249923f3c3ffa03efd8))

## [0.1.55](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.54...@rytass/member-base-nestjs-module@0.1.55) (2025-04-30)

### Features

- correct DateColumn type ([f8ddb57](https://github.com/Rytass/Utils/commit/f8ddb572c51664b1c33e84fe2d0c89325a3f8841))

## [0.1.54](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.53...@rytass/member-base-nestjs-module@0.1.54) (2025-04-28)

### Features

- **member-base-nestjs-module:** support loginFailedAutoUnlockSeconds to auto unlock banned members ([32d6841](https://github.com/Rytass/Utils/commit/32d68414e3d567330336c79f10f5032a85133d47))

## [0.1.53](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.52...@rytass/member-base-nestjs-module@0.1.53) (2025-04-22)

### Features

- **member-base-nestjs-module:** add index on foreign keys ([8d96b0b](https://github.com/Rytass/Utils/commit/8d96b0b93c1848a81fc2f90432906b94a508430d))
- **member-base-nestjs-module:** use timestamptz on every timestamp column ([f0fd8b4](https://github.com/Rytass/Utils/commit/f0fd8b4ca38455da50fd5cf0620947686a3eca74))

## [0.1.52](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.51...@rytass/member-base-nestjs-module@0.1.52) (2025-02-19)

### Features

- **member-base-nestjs-module:** export MemberOAuthRecordEntity ([cefa781](https://github.com/Rytass/Utils/commit/cefa781ff3d00401618e13aca9de34e0d19d257a))

## [0.1.51](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.50...@rytass/member-base-nestjs-module@0.1.51) (2025-02-14)

### Bug Fixes

- **member-base-nestjs-module:** missing class inject decorator ([89c4bf7](https://github.com/Rytass/Utils/commit/89c4bf7b89ed800a12333cabe01385617ead278f))

## [0.1.50](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.49...@rytass/member-base-nestjs-module@0.1.50) (2025-02-14)

### Features

- **api:** customized jwt payload ([e284472](https://github.com/Rytass/Utils/commit/e2844724ce84b07b4c79a864f5b512b79d7a3c1c))
- **member-base-nestjs-module:** add oauth2 supports ([7d717ec](https://github.com/Rytass/Utils/commit/7d717ecde3a12f0a8c648758fa41a0190d5f4911))
- **member-base-nestjs-module:** cookie mode support ([b5bb307](https://github.com/Rytass/Utils/commit/b5bb30700add7a58ec6ee09141717034c33d3558))

## [0.1.49](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.48...@rytass/member-base-nestjs-module@0.1.49) (2025-02-02)

### Bug Fixes

- **member-base-nestjs-module:** bypass graphql context properties in default ([a74b9c2](https://github.com/Rytass/Utils/commit/a74b9c26a527a8465519e4f0061a22a5d3e96c51))

## [0.1.48](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.47...@rytass/member-base-nestjs-module@0.1.48) (2025-01-16)

### Features

- **member-base-nestjs-module:** allow customize casbin permissino decorator and checker ([1a2daee](https://github.com/Rytass/Utils/commit/1a2daeea0e5a427fcf598f67fc40a7aabf90be7f))

## [0.1.47](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.46...@rytass/member-base-nestjs-module@0.1.47) (2024-11-18)

### Bug Fixes

- **member-base-nestjs-module:** reset password requestd at after token used ([837c73b](https://github.com/Rytass/Utils/commit/837c73b4499b7397bd35ace72e3a3c4e43643689))

## [0.1.46](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.45...@rytass/member-base-nestjs-module@0.1.46) (2024-09-12)

### Bug Fixes

- **member-base-nestjs-module:** password history check failure ([60a787d](https://github.com/Rytass/Utils/commit/60a787d784121e28f083f12ad424602bdc094e46))

## [0.1.45](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.44...@rytass/member-base-nestjs-module@0.1.45) (2024-08-20)

### Bug Fixes

- **member-base-nestjs-module:** saved id response ([f52836f](https://github.com/Rytass/Utils/commit/f52836fe411731099a275ec16a177154e84247a3))

## [0.1.44](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.43...@rytass/member-base-nestjs-module@0.1.44) (2024-08-20)

### Features

- **member-base-nestjs-module:** add member options to provide other column payload ([a9f5ae8](https://github.com/Rytass/Utils/commit/a9f5ae862f24351325ff048811ddaa7ba85b12f5))

## [0.1.43](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.42...@rytass/member-base-nestjs-module@0.1.43) (2024-08-19)

### Features

- **member-base-nestjs-module:** typing infer ([2ecb3ff](https://github.com/Rytass/Utils/commit/2ecb3ffc2dc9b573c25cfab843983c68d7eb16b6))

## [0.1.42](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.41...@rytass/member-base-nestjs-module@0.1.42) (2024-08-19)

### Features

- **member-base-nestjs-module:** export RESOLVED_MEMBER_REPO symbol ([4fe07b7](https://github.com/Rytass/Utils/commit/4fe07b7ecae1796a73aea740ee69f9c736032e34))

## [0.1.41](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.40...@rytass/member-base-nestjs-module@0.1.41) (2024-08-19)

### Features

- **cms-base-nestjs-module:** export errors as a constant collection ([19d8e88](https://github.com/Rytass/Utils/commit/19d8e88971ee5b13210a89456db0d565a1b5373a))

## [0.1.40](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.39...@rytass/member-base-nestjs-module@0.1.40) (2024-08-13)

### Bug Fixes

- **member-base-nestjs-module:** injectable issue ([f9cca3f](https://github.com/Rytass/Utils/commit/f9cca3fceaac28349ff40c26bfaf74f8b2f3250d))

## [0.1.39](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.38...@rytass/member-base-nestjs-module@0.1.39) (2024-08-13)

### Bug Fixes

- **member-base-nestjs-module:** order of providers ([c1d2d31](https://github.com/Rytass/Utils/commit/c1d2d31927dee6a277579e607660bdde42bb7869))

## [0.1.38](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.37...@rytass/member-base-nestjs-module@0.1.38) (2024-08-08)

### Bug Fixes

- **member-base-nestjs-module:** type definition ([10b30f8](https://github.com/Rytass/Utils/commit/10b30f88732f0651010dc2a210529ca6b1d5160a))

### Features

- **member-base-nestjs-module:** add password history, age, reset policies ([08928b1](https://github.com/Rytass/Utils/commit/08928b14b6edab4e562daccca2bb2db755f96b04))
- **member-base-nestjs-module:** add password policy options ([9e1a008](https://github.com/Rytass/Utils/commit/9e1a008b8b44548b56ad20133c82221ade73066a))
- **member-base-nestjs-module:** warning on accessTokenSecret or refreshTokenSecret not set (using random string) ([14e2a4d](https://github.com/Rytass/Utils/commit/14e2a4d2585575326b2c771dd80b8b02dc6d413d))

## [0.1.37](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.36...@rytass/member-base-nestjs-module@0.1.37) (2024-08-07)

### Features

- **member-base-nestjs-module:** add change password ([283a0a4](https://github.com/Rytass/Utils/commit/283a0a41543bdc6289616a845d352f4f8b99f2c4))

## [0.1.36](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.35...@rytass/member-base-nestjs-module@0.1.36) (2024-08-01)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.1.35](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.34...@rytass/member-base-nestjs-module@0.1.35) (2024-08-01)

### Bug Fixes

- **member-base-nestjs-module:** conditional store payload ([e330954](https://github.com/Rytass/Utils/commit/e3309548780ce8e3eeeea2443ad1ac7ae0c56f8b))

## [0.1.34](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.33...@rytass/member-base-nestjs-module@0.1.34) (2024-08-01)

### Bug Fixes

- **member-base-nestjs-module:** casbin guard logic ([8546f37](https://github.com/Rytass/Utils/commit/8546f37d4047ddec46b81b3eb4da158c190e941f))

## [0.1.33](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.32...@rytass/member-base-nestjs-module@0.1.33) (2024-08-01)

### Bug Fixes

- **member-base-nestjs-module:** add missing export ([c9ac6e4](https://github.com/Rytass/Utils/commit/c9ac6e41b533292a81beaed3cc0607b7e2c1e1eb))

### Features

- **member-base-nestjs-module:** add authenticated decorator ([bada0b8](https://github.com/Rytass/Utils/commit/bada0b809bd2d05b59338eb0a4adf7ee91ac65ff))

## [0.1.32](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.31...@rytass/member-base-nestjs-module@0.1.32) (2024-08-01)

### Features

- **member-base-nestjs-module:** add param decorator ([28a8a9d](https://github.com/Rytass/Utils/commit/28a8a9de1c00921f2e57529449b7eb51d46a9229))

## [0.1.31](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.30...@rytass/member-base-nestjs-module@0.1.31) (2024-08-01)

### Features

- **member-base-nestjs-module:** export graphql dto ([5981597](https://github.com/Rytass/Utils/commit/5981597f6d0b8a47e05ce6ca7328d9ff19d4097c))

## [0.1.30](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.29...@rytass/member-base-nestjs-module@0.1.30) (2024-08-01)

### Bug Fixes

- **member-base-nestjs-module:** add Global decorator ([acde8b6](https://github.com/Rytass/Utils/commit/acde8b644d84c85d1ef599415e06c5a433e737e6))

## [0.1.29](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.28...@rytass/member-base-nestjs-module@0.1.29) (2024-08-01)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.1.28](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.27...@rytass/member-base-nestjs-module@0.1.28) (2024-08-01)

### Features

- **member-base-nestjs-module:** add global decorator ([e155106](https://github.com/Rytass/Utils/commit/e155106f3cf623b6914520a1c0418cd098044834))

## [0.1.27](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.26...@rytass/member-base-nestjs-module@0.1.27) (2024-08-01)

### Features

- **member-base-nestjs-module:** export base module ([f527603](https://github.com/Rytass/Utils/commit/f527603173c89c5b3d06b7d9c6660fabd437c8c0))

## [0.1.26](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.25...@rytass/member-base-nestjs-module@0.1.26) (2024-07-31)

### Features

- **member-base-nestjs-module:** remove enableGraphQL option, module will detect request automatically ([73c1e65](https://github.com/Rytass/Utils/commit/73c1e6566bba71e0679f626696e16cc84901f8a6))

## [0.1.25](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.24...@rytass/member-base-nestjs-module@0.1.25) (2024-07-31)

### Features

- **member-base-nestjs-module:** add restful support on graphql casbin guard ([ba62f94](https://github.com/Rytass/Utils/commit/ba62f94718b1ad83779083a01841ffd5ea8a8b3f))

## [0.1.24](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.23...@rytass/member-base-nestjs-module@0.1.24) (2024-07-31)

### Features

- **member-base-nestjs-module:** simple resolver for graphql context ([3655a05](https://github.com/Rytass/Utils/commit/3655a05b7703f68aca7ea9c7bfac7a224df1c78e))

## [0.1.23](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.22...@rytass/member-base-nestjs-module@0.1.23) (2024-07-31)

### Features

- **member-base-nestjs-module:** add graphql casbin guard support ([3163697](https://github.com/Rytass/Utils/commit/31636976428e404a6e77b096cebc05c30db0e8a9))

## [0.1.22](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.21...@rytass/member-base-nestjs-module@0.1.22) (2024-07-31)

### Bug Fixes

- **member-base-nestjs-module:** add missing export symbols ([8b79c59](https://github.com/Rytass/Utils/commit/8b79c596417bc1585fae5bf6136eb3b0e2811db1))

## [0.1.21](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.20...@rytass/member-base-nestjs-module@0.1.21) (2024-07-31)

### Features

- **member-base-nestjs-module:** enableGlobalGuard option ([f88a9f5](https://github.com/Rytass/Utils/commit/f88a9f528c6850983b7f085f748ea8b0155f1fb2))

## [0.1.20](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.19...@rytass/member-base-nestjs-module@0.1.20) (2024-07-31)

### Features

- **member-base-nestjs-module:** finish casbin header token check and sign jwt tokens ([30bb111](https://github.com/Rytass/Utils/commit/30bb111a5fb33f6a8803349d369251ad58b3798f))

## [0.1.19](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.18...@rytass/member-base-nestjs-module@0.1.19) (2024-07-31)

### Features

- **member-base-nestjs-module:** new reflector ([da916e7](https://github.com/Rytass/Utils/commit/da916e76eff7b51526e0c2bf36f65ee4cf0dd486))

## [0.1.18](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.17...@rytass/member-base-nestjs-module@0.1.18) (2024-07-31)

**Note:** Version bump only for package @rytass/member-base-nestjs-module

## [0.1.17](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.16...@rytass/member-base-nestjs-module@0.1.17) (2024-07-31)

### Features

- **member-base-nestjs-module:** export decorator and set APP_GUARD ([aa049dc](https://github.com/Rytass/Utils/commit/aa049dc6f00bbe10aa246421b7f38c9dc2089e63))

## [0.1.16](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.15...@rytass/member-base-nestjs-module@0.1.16) (2024-07-31)

### Bug Fixes

- **member-base-nestjs-module:** re-define type ([27340ca](https://github.com/Rytass/Utils/commit/27340ca5bdea5d2eae35e01f3f36c07465ed4801))

## [0.1.15](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.14...@rytass/member-base-nestjs-module@0.1.15) (2024-07-31)

### Bug Fixes

- **member-base-nestjs-module:** change to use import() ([c02ad28](https://github.com/Rytass/Utils/commit/c02ad28f713f5a7a668819aac27db0916701e70c))

## [0.1.14](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.13...@rytass/member-base-nestjs-module@0.1.14) (2024-07-31)

### Bug Fixes

- **member-base-nestjs-module:** correct package.json ([c5c11e0](https://github.com/Rytass/Utils/commit/c5c11e0b077ad20249aba4273ed8449d6e23d704))

## [0.1.13](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.12...@rytass/member-base-nestjs-module@0.1.13) (2024-07-31)

### Features

- **member-base-nestjs-module:** add casbin ([dfc58de](https://github.com/Rytass/Utils/commit/dfc58de22b26930271e5af0692ffaf7b0eb1af22))

## [0.1.12](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.11...@rytass/member-base-nestjs-module@0.1.12) (2024-07-30)

### Bug Fixes

- **member-base-nestjs-module:** import path ([7dd221f](https://github.com/Rytass/Utils/commit/7dd221f3e1f3f4f8a114d9c71b557f70cf7af063))

## [0.1.11](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.10...@rytass/member-base-nestjs-module@0.1.11) (2024-07-30)

### Bug Fixes

- **member-base-nestjs-module:** async for root should provide options from useFactory/useClass/useExisting ([18e68ef](https://github.com/Rytass/Utils/commit/18e68ef6da76b39d06c3dd110e933c24e54ac2d7))

### Features

- **cms-base-nestjs-module:** add custom child entity providers ([d8b93d0](https://github.com/Rytass/Utils/commit/d8b93d0fb34372bd1d03715c1cc1c7b4f3701381))

## [0.1.10](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.9...@rytass/member-base-nestjs-module@0.1.10) (2024-07-30)

### Bug Fixes

- **member-base-nestjs-module:** correct member entity option type ([0ae77ca](https://github.com/Rytass/Utils/commit/0ae77ca11d33be280a1787df9937f1fca83460cd))

## [0.1.9](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.8...@rytass/member-base-nestjs-module@0.1.9) (2024-07-30)

### Bug Fixes

- **member-base-nestjs-module:** define options entity ([542d487](https://github.com/Rytass/Utils/commit/542d48744d698c9491d5b541fb66acf6a1f8df97))

## [0.1.8](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.7...@rytass/member-base-nestjs-module@0.1.8) (2024-07-30)

### Features

- **member-base-nestjs-module:** add async providers ([2f11bd0](https://github.com/Rytass/Utils/commit/2f11bd021a31cd3457389d78dbf56f93961c8765))
- **member-base-nestjs-module:** allow custom base member entity ([c38ad1d](https://github.com/Rytass/Utils/commit/c38ad1d55663907c9e4256bf4713b0783c9e1aa5))

## [0.1.7](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.6...@rytass/member-base-nestjs-module@0.1.7) (2024-07-29)

### Features

- **cms-base-nestjs-module:** initial module ([41deec7](https://github.com/Rytass/Utils/commit/41deec71387da26cf8c1afdff8fa768b966904eb))

## [0.1.6](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.5...@rytass/member-base-nestjs-module@0.1.6) (2024-07-24)

### Features

- **member-base-nestjs-module:** add passwordChangedAt column to record the password age ([178fe83](https://github.com/Rytass/Utils/commit/178fe838385fdca6e0340632c884f3a36903644c))
- **member-base-nestjs-module:** change member to base member entity and it can be inherited by user, updated README ([e50c871](https://github.com/Rytass/Utils/commit/e50c871b4bb562a45f360b02996e23cd894a2a05))

## [0.1.5](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.4...@rytass/member-base-nestjs-module@0.1.5) (2024-07-23)

### Features

- **member-base-nestjs-module:** change to use account issue reset password token ([d834d3e](https://github.com/Rytass/Utils/commit/d834d3e4327b9fa44f3340c15e4344460755aeb8))

## [0.1.4](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.3...@rytass/member-base-nestjs-module@0.1.4) (2024-07-23)

### Bug Fixes

- **member-base-nestjs-module:** correct condition sql ([0e84b84](https://github.com/Rytass/Utils/commit/0e84b84b31d8329a35d75f053dad6ba316dcc54f))

## [0.1.3](https://github.com/Rytass/Utils/compare/@rytass/member-base-nestjs-module@0.1.2...@rytass/member-base-nestjs-module@0.1.3) (2024-07-23)

### Features

- **member-base-nestjs-module:** add forget password flow, admin service ([bafde90](https://github.com/Rytass/Utils/commit/bafde909646da8e3c69cba052b25ecd8d51c82fe))
- **member-base-nestjs-module:** add member logs ([628a687](https://github.com/Rytass/Utils/commit/628a687c6fbd06ba09f0a575171211864ced9034))

## 0.1.1 (2024-07-23)

### Features

- **member-base-nestjs-module:** base service implemented ([f4cc532](https://github.com/Rytass/Utils/commit/f4cc532606134ea43fbd09a520fab87766b7c1c6))
