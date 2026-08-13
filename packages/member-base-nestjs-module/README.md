# Member Base System for NestJS Projects

Members, passwords, tokens and Casbin authorization for NestJS — plus a pluggable authentication gateway and an optional OpenID Connect provider endpoint.

## What you can build with it

| Capability                                    | Entry point      | Status              |
| --------------------------------------------- | ---------------- | ------------------- |
| Members, password policy, JWT session, Casbin | package root     | always on           |
| Account/password login                        | package root     | always on           |
| Google / Facebook / custom OAuth2 login       | package root     | configure to enable |
| Login against any OIDC issuer (relying party) | package root     | configure to enable |
| Login against an LDAP / Active Directory      | `/ldap`          | opt-in subpath      |
| **Be** an OIDC provider for other services    | `/oidc-provider` | opt-in subpath      |
| GraphQL DTOs                                  | `/graphql`       | opt-in subpath      |

Authentication sources and the issuer endpoint are independent: any source can back the issuer. Jump to [Deployment Topologies](#deployment-topologies) for complete, copy-pasteable setups of each combination.

```
        authentication sources                    this application
  ┌─────────────────────────────┐           ┌──────────────────────────┐
  │ account + password (built-in)│──┐        │  AuthenticationGateway   │
  │ Google / Facebook / OAuth2   │──┤        │           │              │
  │ any OIDC issuer              │──┼───────▶│    member + Casbin       │
  │ LDAP / Active Directory      │──┤        │           │              │
  │ your own provider            │──┘        │  ┌────────┴───────────┐  │
  └─────────────────────────────┘           │  │ own API (guarded)  │  │
                                             │  │ OIDC endpoint      │──┼──▶ other services
                                             │  └────────────────────┘  │
                                             └──────────────────────────┘
```

### How this document is arranged

It is long because the package covers a lot; you are not meant to read it start to finish.

| If you want to                | Read                                                                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Get something running         | [Installation](#installation), [Defining Your Member Entity](#defining-your-member-entity), then the topology that matches you                                  |
| Understand permissions        | [RBAC with Domains](#rbac-with-domains-configuration) and [Request-Aware Authorization](#request-aware-authorization-casbindomainresolver-and-decision-tracing) |
| Tell 401 from 403             | [How the Guard Reports a Denial](#how-the-guard-reports-a-denial)                                                                                               |
| Seed the first administrator  | [Default Admin Bootstrap](#default-admin-bootstrap)                                                                                                             |
| Serve GraphQL                 | [GraphQL Support](#graphql-support)                                                                                                                             |
| Put the session in a cookie   | [Sessions and Cookies](#sessions-and-cookies)                                                                                                                   |
| Look up an option             | [Configuration Reference](#configuration-reference)                                                                                                             |
| Add a login source            | [Authentication Gateway](#authentication-gateway), [LDAP](#authenticating-against-an-ldap-directory), [OIDC issuer](#authenticating-against-an-oidc-issuer)     |
| Become an issuer yourself     | [Acting as an OpenID Connect Provider](#acting-as-an-openid-connect-provider)                                                                                   |
| Upgrade an existing install   | [CHANGELOG.md](./CHANGELOG.md) — each release carries its own migration notes                                                                                   |
| Find what something is called | [Type Aliases and Injection Tokens](#type-aliases-and-injection-tokens)                                                                                         |

## Installation

```bash
npm install @rytass/member-base-nestjs-module
```

Required peer dependencies:

```bash
npm install @nestjs/common @nestjs/core @nestjs/typeorm typeorm argon2 jsonwebtoken
```

Optional peer dependencies — install only the ones you use:

| Package                      | Needed when                                                       |
| ---------------------------- | ----------------------------------------------------------------- |
| `typeorm-adapter`            | You set `casbinAdapterOptions` (database-backed Casbin policy)    |
| `@nestjs/graphql`, `graphql` | You import from `@rytass/member-base-nestjs-module/graphql`       |
| `ldapts`                     | You import from `@rytass/member-base-nestjs-module/ldap`          |
| `oidc-provider`              | You import from `@rytass/member-base-nestjs-module/oidc-provider` |

Nothing is pulled in by importing the package root: an entry point you never import is never resolved, so its dependency is never required and its tables are never created. See [Subpath isolation](#subpath-isolation).

### `typeorm-adapter` is an optional peer dependency

Install it yourself when you set `casbinAdapterOptions`, and not otherwise:

```bash
npm install typeorm-adapter
```

It is not bundled because `typeorm-adapter` declares `typeorm` as its own `dependency`
(`^0.3.17`) rather than a peer dependency. Bundled, any consumer whose `typeorm` version
fell outside that range got a **second copy of TypeORM** under
`node_modules/typeorm-adapter/node_modules/`. `getMetadataArgsStorage()` is a
module-level singleton, so the two copies split the entity metadata registry and produced
errors such as `Entity metadata for X was not found`, with nothing pointing back to this
package. The same nesting pulled in `reflect-metadata@^0.1.13` alongside the `^0.2.x` that
NestJS 11 and TypeORM require, splitting the `Reflect` polyfill too. Keeping it optional
means your `typeorm` version is the only one installed.

Setting `casbinAdapterOptions` without installing it throws at startup with an explicit
message rather than booting into a broken authorization state.

## Defining Your Member Entity

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberBaseModule } from '@rytass/member-base-nestjs-module';
import { MemberEntity } from './models/member.entity.ts';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // ... typeorm configuration
    }),
    MemberBaseModule.forRoot({
      memberEntity: MemberEntity, // register custom child entity
    }),
  ],
})
export class AppModule {}

// models/member.entity.ts
import { BaseMemberEntity } from '@rytass/member-base-nestjs-module';
import { ChildEntity, Column, OneToMany, Relation } from 'typeorm';
import { MemberOrderEntity } from './member-order.entity.ts';

@ChildEntity()
export class MemberEntity extends BaseMemberEntity {
  @Column({ type: 'boolean', default: 0 })
  isVerified: boolean;

  @OneToMany(() => MemberOrderEntity, order => order.member)
  orders: Relation<MemberOrderEntity[]>;
}

// models/member-order.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Relation, JoinColumn } from 'typeorm';
import { MemberEntity } from './member.entity.ts';

@Entity('member_orders')
export class MemberOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  memberId: string;

  @ManyToOne(() => MemberEntity, member => member.orders)
  @JoinColumn({ name: 'memberId', referencedColumnName: 'id' })
  member: Relation<MemberEntity>;
}

// services/member.service.ts
import { DataSource, Repository } from 'typeorm';
import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { MemberLoginLogRepo, MemberLoginLogEntity } from '@rytass/member-base-nestjs-module';
import { MemberEntity } from '../models/member.entity.ts';

@Injectable()
export class MemberService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(MemberLoginLogRepo)
    private readonly memberLoginLogRepo: Repository<MemberLoginLogEntity>,
  ) {}

  async getMemberAuditLogs(id: string): Promise<MemberLoginLogEntity[]> {
    const qb = this.memberLoginLogRepo.createQueryBuilder('logs');

    qb.andWhere('logs.memberId = :id', { id });

    const logs = await qb.getMany();

    return logs;
  }

  async getMemberWithOrders(id: string): Promise<MemberEntity> {
    const qb = this.dataSource.getRepository(MemberEntity).createQueryBuilder('members');

    qb.leftJoinAndSelect('members.orders', 'orders');
    qb.andWhere('members.id = :id', { id });

    const member = await qb.getOne();

    if (!member) {
      throw new BadRequestException('Member not found');
    }

    return member;
  }
}
```

## RBAC with Domains Configuration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberBaseModule } from '@rytass/member-base-nestjs-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // ... typeorm configuration
    }),
    MemberBaseModule.forRoot({
      casbinAdapterOptions: {
        type: 'postgres',
        host: 'localhost',
        username: 'rytass',
        password: 'rytass',
        database: 'rytass',
        schema: 'members',
      },
    }),
  ],
})
export class AppModule {}

// controllers/article.controller.ts
import { Controller, Get, Post } from '@nestjs/common';
import { IsPublic, AllowActions } from '@rytass/member-base-nestjs-module';

@Controller('/articles')
export class ArticleController {
  @Get('/')
  @IsPublic()
  list() {
    // allow everyone
  }

  @Post('/')
  @AllowActions([
    ['article', 'create'], // [Subject, Action] — the domain is not declared here
  ])
  create() {
    // Only allowed members
  }
}

// services/member.service.ts
import { Injectable } from '@nestjs/common';
import { MemberBaseService, CASBIN_ENFORCER } from '@rytass/member-base-nestjs-module';
import type { Enforcer } from 'casbin';

@Injectable()
export class MemberService {
  constructor(
    private readonly memberBaseService: MemberBaseService,
    @Inject(CASBIN_ENFORCER)
    private readonly enforcer: Enforcer,
  ) {}

  // Create member and assign permissions
  async onApplicationBootstrap() {
    // Set role domain actions
    await this.enforcer.addPolicy('article-admin', 'articles', 'article', 'create');
    await this.enforcer.addPolicy('article-admin', 'articles', 'article', 'update');
    await this.enforcer.addPolicy('article-admin', 'articles', 'article', 'list');
    await this.enforcer.addPolicy('article-admin', 'articles', 'article', 'delete');

    const member = await this.memberBaseService.register('creator', 'complex-password');

    await this.enforcer.addGroupingPolicy(member.id, 'article-admin', 'articles');
  }
}
```

You can use MemberBaseService.login to get accessToken and put it in header (Authorization) with Bearer prefix to authorize the request.

### How a declared action becomes an enforcement

The model is `r = sub, dom, obj, act`, and the guard calls `enforcer.enforce(memberId, domain, subject, action)`. Only `subject` and `action` come from the decorator; **`domain` is never declared on the route**:

| Part  | Where it comes from                                                      |
| ----- | ------------------------------------------------------------------------ |
| `sub` | The member id in the access token                                        |
| `dom` | `payload.domain` from the token, falling back to `DEFAULT_CASBIN_DOMAIN` |
| `obj` | The first element of each `AllowActions` pair                            |
| `act` | The second element                                                       |

So the policy `addPolicy('article-admin', 'articles', 'article', 'create')` above is matched by `@AllowActions([['article', 'create']])` when the caller's token carries `domain: 'articles'` — which `login(account, password, { domain: 'articles' })` puts there.

Listing several pairs is an **OR**: the call is allowed if any one of them passes. To decide the domain per request instead of taking it from the token — when the target depends on GraphQL arguments, say — supply a [`casbinDomainResolver`](#request-aware-authorization-casbindomainresolver-and-decision-tracing). To use your own decorator in place of `AllowActions`, set `casbinPermissionDecorator`.

With `enableGlobalGuard` on (the default) and no `casbinAdapterOptions`, there is no enforcer at all: `CASBIN_ENFORCER` resolves to `null`, and the guard then **denies** every route carrying `@AllowActions()` with a `CasbinEnforcerUnavailableError` (403). A route marked only `@Authenticated()` still passes on a valid token, and `@IsPublic()` still bypasses the guard entirely. That is the failure direction you want, but it does mean a policy-guarded route is unreachable until the adapter is configured.

Turning `enableGlobalGuard` off inverts this: the guard returns before any of those checks, so `@AllowActions()` routes are all **allowed** rather than all denied. Decorate deliberately if you take that route.

## Request-Aware Authorization (casbinDomainResolver and Decision Tracing)

By default, the built-in permission checker enforces against `payload.domain ?? DEFAULT_CASBIN_DOMAIN`. For per-resource multi-domain models (e.g. the target domain depends on GraphQL arguments), provide a `casbinDomainResolver`. The resolver receives the original Nest `ExecutionContext` (and the underlying request), returns one or more candidate domains, and the default checker allows the call if ANY returned domain passes ANY declared action (the same OR semantics as `AllowActions`). Returning an empty array denies immediately.

The checker result is normalized into a `CasbinAuthorizationDecision` and attached to `request.casbinDecision`, so downstream interceptors / services can audit which domain actually granted access.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { MemberBaseModule } from '@rytass/member-base-nestjs-module';
import type { CasbinDomainResolverParams } from '@rytass/member-base-nestjs-module';

@Module({
  imports: [
    MemberBaseModule.forRoot({
      casbinAdapterOptions: {
        /* ... */
      },
      // Resolve target domains from the request instead of the token payload.
      casbinDomainResolver: ({ context, payload }: CasbinDomainResolverParams): string[] => {
        if (!context) return [];

        // GraphQL: read resource ids from resolver args, e.g. query documents(projectId: ID!)
        const args = GqlExecutionContext.create(context).getArgs<{ projectId?: string; organizationId?: string }>();

        // Multi-layer domain fallback: project first, then its organization, then the tenant.
        return [
          ...(args.projectId ? [`project:${args.projectId}`] : []),
          ...(args.organizationId ? [`organization:${args.organizationId}`] : []),
          ...(typeof payload.tenantId === 'string' ? [`tenant:${payload.tenantId}`] : []),
        ];
      },
    }),
  ],
})
export class AppModule {}
```

Reading the decision for auditing (e.g. logging when access was granted through organization inheritance):

```typescript
// interceptors/authorization-audit.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { CasbinAuthorizationDecision } from '@rytass/member-base-nestjs-module';
import { Observable } from 'rxjs';

@Injectable()
export class AuthorizationAuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = GqlExecutionContext.create(context).getContext<{
      req: { casbinDecision?: CasbinAuthorizationDecision };
    }>().req;

    const decision = request.casbinDecision;

    if (decision?.allowed && decision.matchedDomain?.startsWith('organization:')) {
      // Access was granted via an inherited organization-level policy; keep an audit trail.
      console.log('organization inheritance access', decision.matchedDomain, decision.matchedAction);
    }

    return next.handle();
  }
}
```

Notes:

- `casbinDomainResolver` only affects the DEFAULT checker. When a custom `casbinPermissionChecker` is provided, the resolver is ignored — the custom checker receives `context` / `request` in its params (`CasbinPermissionCheckerParams`) and decides on its own.
- Custom checkers may keep returning `Promise<boolean>` (legacy signature, fully backward compatible) or return a rich `CasbinAuthorizationDecision` (`{ allowed, matchedDomain?, matchedAction?, meta? }`) for tracing.
- Without `casbinDomainResolver`, the default checker behavior is unchanged (`payload.domain ?? DEFAULT_CASBIN_DOMAIN`).

## How the Guard Reports a Denial

`CasbinGuard` can refuse a call for five unrelated reasons, and it throws a different exception for each. Every class is exported from the package root, so an application distinguishes them with `instanceof` rather than by reading a message:

| Cause                                                        | Exception                             | Status | Message                              | `code` |
| ------------------------------------------------------------ | ------------------------------------- | ------ | ------------------------------------ | ------ |
| No token presented                                           | `MissingAccessTokenError`             | 401    | `Access token is missing`            | 120    |
| Token did not verify (bad signature, expired, malformed)     | `InvalidAccessTokenError`             | 401    | `Access token is invalid or expired` | 121    |
| Authenticated, policy said no                                | `PermissionDeniedError`               | 403    | `Permission denied`                  | 122    |
| Handler carries no permission decorator                      | `RouteMissingPermissionMetadataError` | 403    | `Route has no permission metadata`   | 123    |
| `@AllowActions()` route with `CASBIN_ENFORCER` set to `null` | `CasbinEnforcerUnavailableError`      | 403    | `Casbin enforcer is not configured`  | 124    |

The two 401s are the only denials that mean the session is unusable. Everything else means the session is fine and this particular call is not allowed — a distinction worth honouring, because treating a 403 as an expired session logs out a user who was merely reading a page containing one field they lack permission for.

The last two rows are configuration mistakes rather than runtime denials. They stay 403 so the deny direction is unchanged and a route nobody declared does not page whoever watches the 5xx rate, but they are separate classes because they are fixed by editing code, not by granting a policy. The undecorated-handler case is additionally logged once per handler, naming it:

```
WARN [CasbinGuard] Route ArticleController.archive carries none of @AllowActions(), @Authenticated() or @IsPublic(), so it is denied to everyone including a super admin. Decorate it or remove it.
```

A checker returning a `CasbinAuthorizationDecision` may set `reason`, which becomes the message of the 403 — so keep it fit for the caller to read, and put anything internal in `meta`. The whole decision is attached to the thrown `PermissionDeniedError` as `.decision` and to the request as `request.casbinDecision`, neither of which is serialized into the response:

```typescript
// filters/authorization.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { PermissionDeniedError } from '@rytass/member-base-nestjs-module';

@Catch(PermissionDeniedError)
export class AuthorizationFilter implements ExceptionFilter {
  catch(exception: PermissionDeniedError, host: ArgumentsHost): void {
    // exception.decision?.matchedDomain / .matchedAction / .meta
    console.warn('denied', exception.decision);

    // ... respond as usual
  }
}
```

### Over GraphQL

This package cannot set a GraphQL error code itself — that would make `graphql` a hard dependency rather than an optional peer. What it can do is give Apollo an exception carrying a status, which arrives as `extensions.originalError.statusCode`. Map it once in `formatError` and every resolver gets the right code:

```typescript
// app.module.ts
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  formatError: (error: GraphQLFormattedError): GraphQLFormattedError => {
    const status = (error.extensions?.originalError as { statusCode?: number } | undefined)?.statusCode;

    if (status === 401) return { ...error, extensions: { ...error.extensions, code: 'UNAUTHENTICATED' } };
    if (status === 403) return { ...error, extensions: { ...error.extensions, code: 'FORBIDDEN' } };

    return error;
  },
});
```

A GraphQL response then carries `FORBIDDEN` on the one field the caller lacks permission for while the rest returns data, which is what lets a page degrade gracefully instead of the client concluding the session ended:

```json
{
  "data": { "auditTrail": "...", "memberOptions": null },
  "errors": [{ "path": ["memberOptions"], "extensions": { "code": "FORBIDDEN" } }]
}
```

That the denied field be **nullable** is the condition for it, and it is your schema's decision, not this package's: a denial on a non-null field null-propagates to the root, so `data` comes back `null` and there is nothing left to degrade to.

## Default Admin Bootstrap

Instead of hand-writing the seeding code above, you can declare a default administrator directly in the module options. On application startup the module will create the account and grant it **super-admin (allow-all) permissions**.

```typescript
MemberBaseModule.forRoot({
  memberEntity: MyMemberEntity,
  casbinAdapterOptions: { type: 'postgres' /* ... */ }, // required to grant permissions
  defaultAdminAccount: 'root',
  // defaultAdminPassword: 'Sup3rStr0ng', // optional — omit to auto-generate
});
```

Behavior:

- **On first startup**, the `defaultAdminAccount` is created and bound to the well-known `SUPER_ADMIN_ROLE` grouping (in `DEFAULT_CASBIN_DOMAIN`). The built-in permission checker treats any member holding this role as allow-all — it passes every guarded action regardless of domain, without enumerating policies.
- **Idempotent**: if the account already exists at startup, the module does nothing (safe across restarts).
- **Password**: if `defaultAdminPassword` is omitted, a policy-compliant random password is generated and written to the log **once** (at creation). Supplied passwords are never logged; a supplied password that fails the policy aborts startup with `PasswordDoesNotMeetPolicyError`.
- **No Casbin configured**: if `casbinAdapterOptions` is not set (the enforcer is unavailable), the account is still created but the super-admin grant is skipped with a warning.
- **Custom checker caveat**: the allow-all short-circuit lives in the module's default permission checker. If you provide your own `casbinPermissionChecker`, honor `SUPER_ADMIN_ROLE` yourself if you want the same behavior.

`SUPER_ADMIN_ROLE` is exported, so you can grant super-admin to other members too:

```typescript
import { SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN, CASBIN_ENFORCER } from '@rytass/member-base-nestjs-module';

await enforcer.addGroupingPolicy(member.id, SUPER_ADMIN_ROLE, DEFAULT_CASBIN_DOMAIN);
```

## GraphQL Support

Guards work over GraphQL exactly as they do over HTTP — `@AllowActions()`, `@Authenticated()` and `@IsPublic()` all behave the same, and `CasbinGuard` reads the underlying request itself. The one thing to remember is `fieldResolverEnhancers`, without which field resolvers run unguarded:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLModule } from '@nestjs/graphql';
import { GraphQLContextTokenResolver } from '@rytass/member-base-nestjs-module';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      fieldResolverEnhancers: ['guards'], // Important!! Field resolvers are unguarded without it.
      debug: true,
      playground: true,
      autoTransformHttpErrors: true,
      // Optional: publishes the caller's token as context.token for your own resolvers.
      context: GraphQLContextTokenResolver,
    }),
  ],
})
export class AppModule {}
```

`GraphQLContextTokenResolver` is a **convenience for your own resolvers**, not part of authorization: it puts the raw token on `context.token`, header first and cookie second. Authorization does not go through it, so omitting it changes nothing about who may call what.

The pre-built export assumes the defaults. Build your own whenever the module is configured differently, so that `context.token` agrees with what the guard actually accepted:

```typescript
import { createGraphQLContextTokenResolver } from '@rytass/member-base-nestjs-module';

context: createGraphQLContextTokenResolver({
  cookieName: 'sid', // match accessTokenCookieName
  cookieMode: true, // match cookieMode
});
```

Both mirror the module's own options. `cookieMode: false` matters in particular: the guard ignores cookies entirely in that mode, and a resolver that kept reading them would hand your resolvers a token the guard had refused — one left over from before the mode was turned off, for instance.

## Sessions and Cookies

By default a caller presents its token in the `Authorization` header and the module writes no cookies at all. `cookieMode: true` adds the cookie as a second source.

**Reading** then happens on every request, header first: `Authorization: Bearer` wins, and the cookie is consulted only if there is no header. Only the **access token** cookie is ever read. The module never reads the refresh token cookie at all — it only writes it, so that a refresh route of your own can pick it up and hand the value to `memberBaseService.refreshToken(token)`. There is no refresh endpoint in this package, and no route it provides will accept a refresh token as a session.

**Writing** is narrower than reading. The module sets cookies only where it completes a login itself, and both cookies are written together so the caller does not need an immediate refresh round trip:

| Where                                | When                                             | Writes           |
| ------------------------------------ | ------------------------------------------------ | ---------------- |
| `GET /auth/callbacks/:channel`       | An OAuth2 provider is configured                 | access + refresh |
| [`OidcSsoBridge`](#session-bridging) | `/oidc-provider` is mounted and the bridge is on | access + refresh |

A login you drive yourself — `memberBaseService.login(...)` — returns a token pair and writes nothing. Set it with the exported `resolveCookieOptions` to get the same attributes the module would have used.

Names and attributes come from the [cookie options](#cookie-options); each `Max-Age` follows its own token's lifetime.

All of it is configured through the [cookie options](#cookie-options). Nothing is required — each has a working default:

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberBaseModule } from '@rytass/member-base-nestjs-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      /* ... */
    }),
    MemberBaseModule.forRoot({
      cookieMode: true,

      // All optional. Shown with the values they already default to, except
      // the names, which are changed here to avoid colliding with another
      // service on the same host.
      accessTokenCookieName: 'sid',
      refreshTokenCookieName: 'sid_r',
      cookiePath: '/',
      cookieSameSite: 'lax',
      // cookieSecure — omitted: https gets Secure, localhost does not
      // cookieDomain — omitted: host-only, so only this host can read it
    }),
  ],
})
export class AppModule {}
```

An OAuth callback on `https://app.example.com` then answers with:

```
Set-Cookie: sid=...;   Max-Age=900;     Path=/; Expires=<GMT date>; HttpOnly; Secure; SameSite=Lax
Set-Cookie: sid_r=...; Max-Age=7776000; Path=/; Expires=<GMT date>; HttpOnly; Secure; SameSite=Lax
```

Both cookies are written, each with its own token's lifetime as `Max-Age`. On `http://localhost:3000` they are identical but without `Secure`, so local development works without a separate configuration. (`Expires` is Express mirroring `Max-Age`; it is not separately configurable.)

### What each default adapts to

| Attribute  | Adapts how                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Secure`   | Set when the request is https, and for every host except `localhost`, `127.0.0.1` and `::1`, where a Secure cookie is never stored over plain http |
| `Domain`   | Not emitted, so the browser scopes the cookie to exactly the host that served the response                                                         |
| `Path`     | `/`, so one cookie serves every route                                                                                                              |
| `Max-Age`  | From `accessTokenExpiration` / `refreshTokenExpiration`                                                                                            |
| `HttpOnly` | Always on, not configurable                                                                                                                        |

Behind a reverse proxy, enable `app.set('trust proxy', 1)`. `X-Forwarded-Proto` then settles the `Secure` flag directly, which matters because a proxy that does not forward the original `Host` — nginx's default when `proxy_set_header Host` is omitted — otherwise makes an https deployment look like plain localhost. `cookieSecure: true` forces the flag if neither signal is available.

The OIDC provider module is not subject to any of this: `OidcSsoBridge` takes `Secure` from the `issuer` it was configured with, since that describes the public URL and no proxy can rewrite it. `cookieSecure` still overrides it.

### Sharing a session across subdomains

The default is host-only: a cookie set by `idp.example.com` is not sent to `app.example.com`. To share one session across siblings, name the parent explicitly:

```ts
MemberBaseModule.forRoot({ cookieMode: true, cookieDomain: '.example.com' });
```

This is opt-in on purpose. Every subdomain under that name can then read the session, including any hosted by someone else, so it should be a deliberate decision rather than a default.

### Do not override the DI tokens

Earlier versions of this document suggested overriding `ACCESS_TOKEN_COOKIE_NAME` / `REFRESH_TOKEN_COOKIE_NAME` from the application's `providers` array. **That does not work**, because Nest resolves providers per module:

- `CasbinGuard` and `OAuthCallbacksController` are declared by `MemberBaseModule` itself, so they resolve its own binding directly.
- `OidcSsoBridge` is declared in the OIDC provider module and reaches the same binding through `MemberBaseModule`'s `@Global()` export — falling back to the default names if it is absent, since it injects them `@Optional()`.

An application-level provider reaches only the application's own components. The module keeps writing the default names, with no error or warning to indicate it. Use the options above.

## Deployment Topologies

Five combinations cover nearly every deployment. Each is complete — the module configuration plus whatever `main.ts` needs.

### Choosing one

| Question                                                      | Topology                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| Users have accounts here, nothing else involved               | [A. Standalone](#a-standalone)                                      |
| Users sign in with Google/Facebook too                        | [B. Social login](#b-standalone-with-social-login)                  |
| Corporate directory owns the passwords                        | [C. Directory-backed](#c-directory-backed-active-directory)         |
| Another system already owns identity, this app consumes it    | [D. Relying party](#d-relying-party-of-an-existing-issuer)          |
| Other services should authenticate against **this** app       | [E. Identity provider](#e-identity-provider)                        |
| Directory owns passwords **and** other services need identity | [F. Directory-backed issuer](#f-directory-backed-identity-provider) |

### A. Standalone

The baseline: local accounts, local authorization, nothing external.

```ts
@Module({
  imports: [
    MemberBaseModule.forRoot({
      memberEntity: MemberEntity,
      accessTokenSecret: process.env.JWT_ACCESS_SECRET,
      refreshTokenSecret: process.env.JWT_REFRESH_SECRET,
      cookieMode: true,
      casbinAdapterOptions: { type: 'postgres' /* ... */ },
    }),
  ],
})
export class AppModule {}
```

```ts
const { accessToken, refreshToken } = await memberBaseService.login(account, password, { ip });
```

Nothing else to install. No subpath, no extra table.

### B. Standalone with social login

Adds Google/Facebook on top of A. The callback controller is registered automatically.

```ts
MemberBaseModule.forRoot({
  // ...everything from A
  oauth2Providers: [
    { channel: 'google', clientId, clientSecret, redirectUri: 'https://app.example.com/oauth2/google/callback' },
  ],
  oauth2ClientDestUrl: '/login',

  // Social identifiers are email addresses, so restrict account takeover to
  // providers that actually verified them.
  linkExistingAccount: 'verified-only',
});
```

> The bundled Facebook flow does not check an email verification flag. With the default `linkExistingAccount: true` that is an account takeover path — see [Provisioning and linking policy](#provisioning-and-linking-policy).

### C. Directory-backed (Active Directory)

The directory owns passwords; this application owns roles. No password is ever stored locally.

```bash
npm install ldapts
```

```ts
import { LdapAuthProvider } from '@rytass/member-base-nestjs-module/ldap';

MemberBaseModule.forRoot({
  // ...everything from A
  authProviders: [
    new LdapAuthProvider({
      url: 'ldaps://dc.corp.local',
      bindDN: 'CN=svc-account,OU=Service,DC=corp,DC=local',
      bindPassword: process.env.LDAP_BIND_PASSWORD,
      baseDN: 'DC=corp,DC=local',
    }),
  ],

  // Having a domain account does not imply being entitled to this system.
  // Returning null rejects the login; returning a member id accepts it.
  autoProvision: async identity => {
    const groups = (identity.attributes?.groups ?? []) as string[];

    if (!groups.includes('APP_USERS')) return null;

    const existing = await memberBaseService.findByAccount(identity.identifier);

    if (existing) return existing.id;

    const [member] = await memberBaseService.registerWithoutPassword(identity.identifier);

    return member.id;
  },
});
```

```ts
const { member } = await gateway.authenticate('ldap', { account, password }, { ip });
const tokenPair = await gateway.login('ldap', { account, password }, { ip });
```

Local accounts still work — the password provider is always registered, so an emergency admin account is unaffected by directory outages.

### D. Relying party of an existing issuer

Someone else runs the IdP; this application consumes it. Members are provisioned on first login and carry local roles.

```ts
import { OidcAuthProvider } from '@rytass/member-base-nestjs-module';

MemberBaseModule.forRoot({
  // ...everything from A
  authProviders: [
    new OidcAuthProvider({
      channel: 'corp-idp',
      issuer: 'https://idp.example.com/oidc',
      clientId,
      clientSecret,
      redirectUri: 'https://app.example.com/auth/callback',
    }),
  ],
});
```

The provider holds no per-attempt state, so the application decides where the PKCE verifier and nonce live:

```ts
@Controller('auth')
export class SsoController {
  constructor(private readonly gateway: AuthenticationGateway) {}

  @IsPublic()
  @Get('login')
  async login(@Res() res: Response): Promise<void> {
    const request = await this.gateway.getProvider('corp-idp').createAuthorizationRequest!();

    res.cookie('oidc_tx', JSON.stringify(request), { httpOnly: true, sameSite: 'lax', maxAge: 600_000 });
    res.redirect(request.url);
  }

  @IsPublic()
  @Get('callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('code') code: string,
    @Query('state') state: string,
  ): Promise<void> {
    const tx = JSON.parse(req.cookies.oidc_tx ?? '{}');

    if (!tx.state || tx.state !== state) throw new BadRequestException('Invalid state');

    const { member } = await this.gateway.handleCallback('corp-idp', {
      code,
      codeVerifier: tx.codeVerifier,
      nonce: tx.nonce,
    });

    res.clearCookie('oidc_tx');
    res.cookie('access_token', this.memberBaseService.signAccessToken(member), { httpOnly: true });
    res.redirect('/');
  }
}
```

State validation stays with the caller because the caller is what persisted it.

### E. Identity provider

Other services authenticate against this application. Members sign in with local passwords.

```bash
npm install oidc-provider
```

```ts
import { MemberBaseOidcProviderModule } from '@rytass/member-base-nestjs-module/oidc-provider';

@Module({
  imports: [
    MemberBaseModule.forRoot({
      // ...everything from A. cookieMode: true is required for session bridging.
    }),
    MemberBaseOidcProviderModule.forRoot({
      issuer: 'https://idp.example.com/oidc',
      jwks: JSON.parse(process.env.OIDC_JWKS),
      cookieKeys: [process.env.OIDC_COOKIE_KEY],
      // Your pages. The module redirects here and exposes an API they drive.
      interaction: {
        loginPageUrl: '/sign-in',
        consentPageUrl: '/authorize',
      },
    }),
  ],
})
export class AppModule {}
```

```ts
// main.ts — must run before listen()
import { mountMemberBaseOidcProvider } from '@rytass/member-base-nestjs-module/oidc-provider';

const app = await NestFactory.create(AppModule);

mountMemberBaseOidcProvider(app);

await app.listen(3000);
```

Register a service provider through `OidcClientService`. The module exposes no administration endpoint of its own — see [Administering service providers](#administering-service-providers):

```ts
const created = await this.oidcClientService.create({
  name: 'Reporting',
  redirectUris: ['https://reporting.example.com/auth/callback'],
  skipConsent: true,
});
// => { clientId: '...', clientSecret: '...', ... }  secret readable once
```

`skipConsent: true` suits a first-party client. Leave it false for anything third-party and the member is asked to authorize the release of claims — see [The interaction API](#the-interaction-api).

This application remains a normal resource server at the same time: its own guarded endpoints keep working, and a member who signs in at the interaction page is also signed in locally (see [Session bridging](#session-bridging)).

### F. Directory-backed identity provider

C and E combined, and the reason the two layers are separate. Active Directory owns the passwords; this application issues OIDC identities to every downstream service; roles stay with each service.

```bash
npm install ldapts oidc-provider
```

```ts
import { LdapAuthProvider } from '@rytass/member-base-nestjs-module/ldap';
import { MemberBaseOidcProviderModule } from '@rytass/member-base-nestjs-module/oidc-provider';

@Module({
  imports: [
    MemberBaseModule.forRoot({
      memberEntity: MemberEntity,
      accessTokenSecret: process.env.JWT_ACCESS_SECRET,
      refreshTokenSecret: process.env.JWT_REFRESH_SECRET,
      cookieMode: true,
      casbinAdapterOptions: { type: 'postgres' /* ... */ },

      authProviders: [
        new LdapAuthProvider({
          url: process.env.LDAP_URL,
          bindDN: process.env.LDAP_BIND_DN,
          bindPassword: process.env.LDAP_BIND_PASSWORD,
          baseDN: process.env.LDAP_BASE_DN,
        }),
      ],
    }),

    MemberBaseOidcProviderModule.forRoot({
      issuer: process.env.OIDC_ISSUER,
      jwks: JSON.parse(process.env.OIDC_JWKS),
      cookieKeys: [process.env.OIDC_COOKIE_KEY],

      interaction: {
        // Directory first; the local password provider stays available for
        // break-glass accounts when the directory is unreachable.
        allowedChannels: ['ldap', 'password'],

        loginPageUrl: '/sign-in',
        consentPageUrl: '/authorize',
      },

      claims: {
        // Identity attributes only. Roles are deliberately not published.
        extra: async member => ({ name: member.name, email: member.email }),
      },
    }),
  ],
})
export class AppModule {}
```

```ts
// main.ts
mountMemberBaseOidcProvider(app);

await app.listen(3000);
```

End to end:

```
 [User] --account/password--> [interaction page]
                                    |
                                    v
                          gateway.authenticate('ldap')
                                    |
                          bind against directory
                                    |
                          resolve or provision member
                                    |
                                    v
                       accountId = local member id
                                    |
                                    v
        [OIDC endpoint] --id_token--> [Service A] --> its own Casbin decides
                        --id_token--> [Service B] --> its own Casbin decides
```

The subject is the local member id rather than the directory's identifier, so renaming or re-creating a directory account does not break any downstream binding.

## Configuration Reference

### `MemberBaseModule` — authentication gateway options

| Option                | Type                                               | Default    | Purpose                                                                   |
| --------------------- | -------------------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| `authProviders`       | `AuthenticationProvider[]`                         | `[]`       | Extra sources; password is always registered                              |
| `autoProvision`       | `boolean \| (identity) => Promise<string \| null>` | `true`     | What happens when an external identity has no member                      |
| `linkExistingAccount` | `boolean \| 'verified-only'`                       | `true`     | Whether an external identity may claim a matching local account           |
| `syncOnAuthenticate`  | `(params) => Promise<void>`                        | —          | Write directory attributes back after resolution; nothing runs by default |
| `oauth2Providers`     | `OAuth2Provider[]`                                 | `[]`       | Google / Facebook / custom OAuth2                                         |
| `oauth2ClientDestUrl` | `string`                                           | `'/login'` | Where the OAuth2 callback redirects                                       |

`OAuth2Provider` is a union. Everything shared lives on `BaseOAuth2Provider` — `channel`, `clientId`, `clientSecret`, `redirectUri` and an optional `getState` — and each member adds only what it needs. Google and Facebook add an optional `scope`; anything else is a custom provider and has to say how to exchange a code and read an identifier back:

```ts
oauth2Providers: [
  { channel: 'google', clientId, clientSecret, redirectUri, scope: ['email', 'profile'] },
  {
    channel: 'line',
    clientId,
    clientSecret,
    redirectUri,
    scope: ['profile'],
    requestUrl: 'https://access.line.me/oauth2/v2.1/authorize',
    getAccessTokenFromCode: async code => '...',
    getAccountFromAccessToken: async accessToken => '...',
  },
];
```

### Cookie options

Mainly used when `cookieMode: true`. Left unset, each attribute has a working default that needs no configuration in either development or production — derived from the request, except that the OIDC session bridge takes `Secure` from its configured `issuer` instead (see [Sessions and Cookies](#sessions-and-cookies)).

`accessTokenCookieName`, `cookiePath` and `cookieDomain` are also used by the OIDC session bridge when reading a session and when clearing one at logout, neither of which is gated on `cookieMode`.

| Option                   | Type                          | Default                         | Purpose                                          |
| ------------------------ | ----------------------------- | ------------------------------- | ------------------------------------------------ |
| `accessTokenCookieName`  | `string`                      | `'access_token'`                | Name of the access token cookie                  |
| `refreshTokenCookieName` | `string`                      | `'refresh_token'`               | Name of the refresh token cookie                 |
| `cookiePath`             | `string`                      | `'/'`                           | Path attribute                                   |
| `cookieSameSite`         | `'lax' \| 'strict' \| 'none'` | `'lax'`                         | SameSite attribute                               |
| `cookieSecure`           | `boolean`                     | https, or any non-loopback host | Secure attribute                                 |
| `cookieDomain`           | `string`                      | absent (host-only)              | Domain attribute; set to share across subdomains |

`httpOnly` is not configurable and is always on: a session token readable from JavaScript is a session token one XSS away from being stolen.

Every pre-existing option (token secrets and lifetimes, password policy, Casbin, cookie mode, default admin) is unchanged and documented in its own section below.

### Hashing, Casbin naming and the login log

| Option                | Type                  | Default             | Purpose                                             |
| --------------------- | --------------------- | ------------------- | --------------------------------------------------- |
| `passwordHashOptions` | `PasswordHashOptions` | argon2's own        | argon2 cost parameters for every password hashed    |
| `superAdminRole`      | `string`              | `'::SUPER_ADMIN::'` | Role the default checker treats as allow-all        |
| `defaultCasbinDomain` | `string`              | `'::DEFAULT::'`     | Domain that grouping is keyed to                    |
| `loginLogEnabled`     | `boolean`             | `true`              | Write a row to `member_login_logs` on every attempt |
| `loginLogRecordIp`    | `boolean`             | `true`              | Store the caller's address with that row            |

**Hash cost.** The right cost is a property of the hardware, so the package does not pick one for you. Raising it does not invalidate existing hashes — argon2 reads each hash's parameters out of the hash itself, so old passwords keep verifying and are re-hashed at the new cost the next time they are changed.

```ts
passwordHashOptions: { memoryCost: 65536, timeCost: 3, parallelism: 4 },
```

**Casbin naming.** Change these only when an existing policy table already uses those strings for something else. Every grouping policy keeps the name it was written with, so renaming after members hold the grouping leaves them without it — grant the new name before switching.

**Login log.** `loginLogRecordIp: false` keeps recording attempts without retaining an address, which is usually what a retention policy actually asks for. Turning the log off entirely also disables `loginFailedAutoUnlockSeconds`, which reads the last failed attempt out of that table; the combination logs a warning on boot rather than leaving an account locked for reasons nobody can find.

The address is stored as a `cidr`, so it carries the prefix length for its family — `/32` for IPv4 and `/128` for IPv6. `toInetCidr(ip)` is exported if you write your own rows into that table and need the same format.

### `MemberBaseOidcProviderModule` options

| Option                        | Type                                      | Default                 | Purpose                                                              |
| ----------------------------- | ----------------------------------------- | ----------------------- | -------------------------------------------------------------------- |
| `issuer`                      | `string`                                  | required                | Issuer identifier; must match the public URL                         |
| `jwks`                        | `{ keys: [] }`                            | ephemeral + warn        | Signing keys; required outside development                           |
| `cookieKeys`                  | `string[]`                                | random                  | Keys protecting the provider's cookies                               |
| `routePrefix`                 | `string`                                  | `'oidc'`                | Path the endpoints are mounted on                                    |
| `interaction.loginPageUrl`    | `string \| (params) => string`            | built-in page           | Your own login page; the browser is redirected here                  |
| `interaction.consentPageUrl`  | `string \| (params) => string`            | built-in page           | Your own consent page                                                |
| `interaction.renderLogin`     | `(params) => string`                      | built-in page           | Render login HTML in-process; ignored when `loginPageUrl` is set     |
| `interaction.renderConsent`   | `(params) => string`                      | built-in page           | Render consent HTML in-process; ignored when `consentPageUrl` is set |
| `interaction.allowedChannels` | `string[]`                                | all credential channels | Which sources the login form may use                                 |
| `interaction.autoConsent`     | `boolean \| (clientId) => boolean`        | client's `skipConsent`  | Skip the consent step entirely                                       |
| `claims.extra`                | `(member) => object`                      | —                       | Additional identity claims                                           |
| `claims.additionalScopes`     | `string[]`                                | —                       | Extra accepted scopes                                                |
| `claims.scopeClaims`          | `Record<string, string[]>`                | —                       | Which claims each scope releases                                     |
| `ssoBridge.*`                 | see [Session bridging](#session-bridging) | all enabled             | Local/issuer session interop                                         |
| `clients.allowPublic`         | `boolean`                                 | `true`                  | Whether public (PKCE-only) clients may be registered                 |
| `clients.validate`            | `(input, context) => void \| Promise`     | —                       | Extra registration rules; throw to reject                            |
| `clients.secretCipher`        | `{ encrypt, decrypt }`                    | plaintext               | Encrypt `client_secret` at rest                                      |
| `features.rpInitiatedLogout`  | `boolean`                                 | `true`                  | `/session/end`                                                       |
| `features.revocation`         | `boolean`                                 | `true`                  | `/revocation`                                                        |
| `features.introspection`      | `boolean`                                 | `true`                  | `/introspection`                                                     |
| `features.userinfo`           | `boolean`                                 | `true`                  | `/me`                                                                |
| `requirePkce`                 | `boolean`                                 | `true`                  | Turn off only for a legacy client that cannot be changed             |
| `proxy`                       | `boolean`                                 | `true`                  | Trust `X-Forwarded-*` when deriving request URLs                     |
| `clientBasedCors`             | `boolean`                                 | `true`                  | Answer preflights from a client's registered origins                 |
| `ttl`                         | `Partial<Record<...>>`                    | 1h access, 14d refresh  | Token lifetimes                                                      |
| `purgeIntervalSeconds`        | `number`                                  | `3600`                  | Expired payload sweep; `0` disables                                  |
| `advanced`                    | `Record<string, unknown>`                 | —                       | Merged last into oidc-provider config                                |

`features` merges one key at a time, so turning a single endpoint off leaves the rest alone. `advanced.features` replaces the whole object instead — that is what the typed toggles exist to avoid, and `advanced` deliberately keeps the last word. `devInteractions` is not configurable: it would shadow this module's interaction routes.

`buildOidcConfiguration(params)` is exported for when you want to see what all of this resolves to. It returns the object handed to oidc-provider without loading the ESM-only dependency, so it can be asserted on from a test.

### Which tables exist

| Table                           | Created by                      |
| ------------------------------- | ------------------------------- |
| `members` (+ your subclass)     | package root, always            |
| `member_login_logs`             | package root, always            |
| `member_password_histories`     | package root, always            |
| `member_oauth_records`          | package root, always            |
| `casbin_rule`                   | `casbinAdapterOptions`          |
| `oidc_payloads`, `oidc_clients` | importing `/oidc-provider` only |

Column bounds follow one rule: **bounded when this package or a spec decides the value, unbounded when the application does.** So `oidc_clients.clientSecret`, `.name` and `.scope` are `text` — their length is the application's business, and with `secretCipher` the stored secret is whatever an external cipher produced. `clientId` stays `varchar(255)` because it is the primary key and a btree key cannot be unbounded, and `tokenEndpointAuthMethod` stays `varchar(64)` because the specs fix its values. Everything in `oidc_payloads` is generated by oidc-provider, so all of it is bounded.

## Authentication Gateway

Authentication sources are pluggable. The built-in account/password provider is always registered and is the only one registered by default, so an application that configures nothing behaves exactly as before.

```ts
import { AuthenticationGateway, PASSWORD_CHANNEL } from '@rytass/member-base-nestjs-module';

// Authenticate through any registered channel and get the local member back
const { member, identity } = await gateway.authenticate(PASSWORD_CHANNEL, { account, password }, { ip });

// Or authenticate and receive a member-base token pair in one call
const tokenPair = await gateway.login(PASSWORD_CHANNEL, { account, password }, { ip, domain });
```

### Registering another source

A provider answers "who is this subject"; the gateway maps that answer onto a local member.

```ts
import type { AuthenticationProvider, AuthenticatedIdentity } from '@rytass/member-base-nestjs-module';

class DirectoryAuthProvider implements AuthenticationProvider<{ account: string; password: string }> {
  readonly channel = 'ldap';
  readonly kind = 'credential' as const;

  async authenticate(credentials): Promise<AuthenticatedIdentity> {
    const entry = await bindAndSearch(credentials);

    return {
      channel: this.channel,
      identifier: entry.objectGUID, // immutable, unlike an account name
      identifierVerified: true,
      attributes: { name: entry.displayName, groups: entry.memberOf },
    };
  }
}

MemberBaseModule.forRoot({
  authProviders: [new DirectoryAuthProvider()],
});
```

Prefer an identifier the directory cannot change (an OIDC `sub`, an Active Directory `objectGUID`) over an account name or email — the local binding is keyed on it.

### Resolving an identity to a member

```
identity (channel, identifier, verified?)
        |
        +-- identity carries memberId ----------------> member (password provider)
        |
        v
  lookup binding (channel, identifier)
        |
        +-- found ------------------------------------> member
        |
        v
  lookup local member where account = identifier
        |
        +-- found and linking allowed ----------------> link + warn -> member
        +-- found and linking refused ----------------> reject
        |
        v
  autoProvision
        +-- true -------------------------------------> provision passwordless member
        +-- function ---------------------------------> member id, or null to reject
        +-- false ------------------------------------> reject
```

Bindings are stored in `member_oauth_records`, exported under the clearer aliases `MemberExternalIdentityEntity` / `MemberExternalIdentityRepo`.

### Provisioning and linking policy

| Option                | Default                                 | Effect                                                                                    |
| --------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `autoProvision`       | `true`                                  | Provision a passwordless member the first time an unknown external identity authenticates |
| `autoProvision`       | `false`                                 | Reject identities that have no local member yet                                           |
| `autoProvision`       | `(identity) => Promise<string \| null>` | Decide per identity — a directory group check, an approval workflow                       |
| `linkExistingAccount` | `true`                                  | An unbound external identity claims a local member whose `account` equals the identifier  |
| `linkExistingAccount` | `'verified-only'`                       | Same, but only when the provider reported `identifierVerified: true`                      |
| `linkExistingAccount` | `false`                                 | Never link; fall through to provisioning                                                  |

```ts
MemberBaseModule.forRoot({
  autoProvision: async identity => {
    const groups = (identity.attributes?.groups ?? []) as string[];

    return groups.includes('APP_USERS') ? (await findOrCreate(identity)).id : null;
  },
  linkExistingAccount: 'verified-only',
});
```

> **Account takeover warning.** With `linkExistingAccount: true` (the default, matching the behaviour the OAuth2 flows always had), any provider that does not verify its identifier lets a matching local account be claimed. The bundled Facebook flow, for instance, never checks an email verification flag. A warning is printed on boot while linking is enabled, and again on every actual takeover with the channel, identifier and member id. Set `'verified-only'` to require verification.

## Acting as an OpenID Connect Provider

The application becomes an issuer other services can authenticate against, on top of whatever authentication sources the gateway has registered. Shipped behind its own entry point: without importing it, neither the dependency nor the two tables exist.

```bash
npm install oidc-provider   # optional peer dependency
```

```ts
import { MemberBaseOidcProviderModule } from '@rytass/member-base-nestjs-module/oidc-provider';

@Module({
  imports: [
    MemberBaseModule.forRoot({
      /* ... */
    }),
    MemberBaseOidcProviderModule.forRoot({
      issuer: 'https://idp.example.com/oidc',
      jwks: JSON.parse(process.env.OIDC_JWKS),
      cookieKeys: [process.env.OIDC_COOKIE_KEY],

      // Your own pages. Omitting them serves a built-in development page and
      // logs a warning — see The interaction API below.
      interaction: {
        loginPageUrl: '/sign-in',
        consentPageUrl: '/authorize',
      },
    }),
  ],
})
export class AppModule {}
```

### Mounting the protocol endpoints

The protocol endpoints **cannot** be a Nest controller and must be mounted from `main.ts`:

```ts
import { mountMemberBaseOidcProvider } from '@rytass/member-base-nestjs-module/oidc-provider';

const app = await NestFactory.create(AppModule);

mountMemberBaseOidcProvider(app); // before listen()

await app.listen(3000);
```

`oidc-provider` is a Koa application that reads the raw request stream. Middleware registered through `configure(consumer)` runs _after_ Nest's body parser, which has already consumed that stream, so every form-encoded POST (`/token`, `/introspection`, `/revocation`) would break. Mounting before `listen()` puts the provider ahead of the body parser.

| Endpoint                                                                                    | Protection                  |
| ------------------------------------------------------------------------------------------- | --------------------------- |
| `/oidc/.well-known/openid-configuration`, `/auth`, `/token`, `/me`, `/jwks`, `/session/end` | Public (mounted middleware) |
| `/oidc/interaction/:uid` and everything under it                                            | `@IsPublic()`               |

Those are the only routes the module registers. Client administration is **not** among them: it ships as [`OidcClientService`](#administering-service-providers), so nothing is reachable until your application chooses to expose it.

The middleware is registered without a mount path. `app.use(path, handler)` would make Express strip the path for the handler and then put it back before the request reaches Nest's router, which registers the interaction routes without the prefix — every interaction would 404. Stripping it inside the middleware makes the rewrite outlive it, and Nest's global prefix (if any) is put back on the way through.

### The interaction API

This package is a backend module. The intended arrangement is that **your application owns the login and consent pages and their URLs**; the module redirects the browser to them and exposes the API that resolves the interaction.

```
SP ---> GET /oidc/auth ---> 303 /oidc/interaction/{uid}
                                      |  this module
                 +--------------------+--------------------+
                 |                    |                    |
           SSO bridge           auto consent        303 to your page
           resolves it          resolves it         /sign-in?uid=..&prompt=..
                                                             |
                              +------------------------------+ your page calls
                              |                              |
                  GET .../{uid}/details          POST .../{uid}/login
                  (what to render)               POST .../{uid}/consent
                                                 POST .../{uid}/session
                                                 POST .../{uid}/abort
                                                             |
                                                             v  200 { redirectTo }
                                                  location.assign(redirectTo)
```

All paths below are relative to `/<routePrefix>/interaction/:uid` (default prefix `oidc`).

| Method | Path               | Body                                    | Purpose                                         |
| ------ | ------------------ | --------------------------------------- | ----------------------------------------------- |
| `GET`  | _(the uid itself)_ | —                                       | Entry point; resolves or redirects to your page |
| `GET`  | `/details`         | —                                       | Everything the page needs to render             |
| `POST` | `/login`           | `{ account, password, channel? }`       | Verify credentials and resolve the prompt       |
| `POST` | `/session`         | —                                       | Resolve it from an existing member-base session |
| `POST` | `/consent`         | `{ scopes?, claims?, resourceScopes? }` | Record the grant                                |
| `POST` | `/abort`           | `{ errorDescription? }`                 | Refuse; the client is told `access_denied`      |

Every route lives under `interaction/:uid` because `oidc-provider` scopes the `_interaction` cookie to the path it redirected to, and **that cookie — not the uid in the path — is what identifies the interaction**. Two consequences worth knowing before you deploy:

- Your page must call these endpoints with credentials included (`fetch(url, { credentials: 'include' })`).
- The cookie is `SameSite=Lax`, so the page has to be on the same registrable domain as the issuer (`app.example.com` and `idp.example.com` are fine). For a genuinely different domain, set `advanced: { cookies: { keys: [...], short: { sameSite: 'none', secure: true } } }` and enable CORS with credentials. `advanced` is merged last, so repeat `keys` when you override `cookies`.
- A request without that cookie — a page opened directly, or an interaction that has expired (`ttl.Interaction`, one hour by default) — is rejected by `oidc-provider` before any handler here runs. Treat it as "start again from `/oidc/auth`" rather than as a recoverable error.

#### Response shape

The POST endpoints answer according to the request's `Accept` header, so one endpoint serves both a fetch-driven page and a plain HTML form:

| Caller                  | `Accept`                  | Response                |
| ----------------------- | ------------------------- | ----------------------- |
| `fetch` / `axios`       | `*/*`, `application/json` | `200 { redirectTo }`    |
| Browser form submission | `text/html,...`           | `303` to the same place |

`*/*` deliberately does not count as a request for HTML: an API client wants the location as data, since a redirect it cannot read is no use to it. The success status is explicitly `200` rather than Nest's default `201` for a POST, which would claim a resource was created at a `Location` the response does not carry.

Failures are reported as status codes, never as a redirect that would read as success:

| Status | Endpoint   | Meaning                                                                        |
| ------ | ---------- | ------------------------------------------------------------------------------ |
| `400`  | `/login`   | `channel` is not in `interaction.allowedChannels`                              |
| `401`  | `/login`   | `{ error: 'invalid_credentials', message: 'Invalid account or password' }`     |
| `400`  | `/consent` | The interaction awaits a different prompt, or carries no authenticated subject |
| `403`  | `/session` | `ssoBridge.acceptLocalSession` is off                                          |
| `400`  | `/session` | The interaction awaits consent, not login                                      |
| `401`  | `/session` | No member-base session, its member is gone, or `reauthentication_required`     |

The login failure is deliberately generic. Distinguishing "no such account" from "wrong password" would turn the endpoint into an account oracle, so the same 401 is returned for both. A browser form gets the page again with the message rendered instead.

#### What `/details` returns

```ts
{
  uid: string;
  prompt: { name: 'login' | 'consent'; reasons: string[] };
  client: { clientId: string; name: string } | null;
  params: {
    clientId: string;
    scope: string | null;
    redirectUri: string | null;
    responseType: string | null;
    state: string | null;
    prompt: string | null;      // what the client asked for, e.g. 'login'
    maxAge: number | null;
  };
  channels: string[];           // credential channels; empty unless a login is pending
  consent: {                    // null unless a consent is pending
    missingScopes: string[];
    missingClaims: string[];
    missingResourceScopes: Record<string, string[]>;
  } | null;
  session: { accountId: string; account: string | null } | null;
}
```

The client is reported by id and name only. The registration row carries a secret and this response is assembled field by field rather than spread, so the secret can never reach a page.

#### Where the browser is sent

`loginPageUrl` and `consentPageUrl` accept a string or a function.

A **string** keeps whatever query it already carries and gains the three values a page cannot work without — plus `error` when the browser is being sent back after a failed submission:

```ts
interaction: {
  loginPageUrl: '/sign-in?theme=dark';
}
// => 303 /sign-in?theme=dark&uid=<uid>&prompt=login&client_id=reporting
```

A relative URL stays relative and an absolute one stays absolute; `https://app.example.com/sign-in` is redirected to verbatim with the same parameters appended.

A **function** receives the whole interaction and decides for itself:

```ts
interaction: {
  loginPageUrl: ({ uid, promptName, promptReasons, clientId, params, error }) =>
    params.prompt === 'login' ? `/sign-in/step-up?uid=${uid}` : `/sign-in?uid=${uid}`,
}
```

| Field           | Type                      | Notes                                                        |
| --------------- | ------------------------- | ------------------------------------------------------------ |
| `uid`           | `string`                  | The interaction identifier                                   |
| `promptName`    | `string`                  | `'login'` or `'consent'`                                     |
| `promptReasons` | `readonly string[]`       | Why the prompt fired, from `oidc-provider`                   |
| `clientId`      | `string`                  | The requesting service provider                              |
| `params`        | `Record<string, unknown>` | The raw authorization request, including `prompt`, `max_age` |
| `error`         | `string \| undefined`     | Set only when returning after a failed login                 |

#### A page driving the flow

```tsx
// /sign-in?uid=...&prompt=login&client_id=...
const uid = searchParams.get('uid');
const base = `/oidc/interaction/${uid}`;

const details = await fetch(`${base}/details`, { credentials: 'include' }).then(r => r.json());
// => { prompt: { name: 'login' }, client: { name: 'Reporting' }, channels: ['password'], ... }

const res = await fetch(`${base}/login`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ account, password }),
});

if (res.status === 401) return setError('Invalid account or password');

const { redirectTo } = await res.json();

location.assign(redirectTo);
```

The consent page is the same shape, reading `details.consent` and posting to `/consent` (or `/abort` on refusal):

```ts
// details.consent => { missingScopes, missingClaims, missingResourceScopes }
await fetch(`${base}/consent`, { method: 'POST', credentials: 'include', headers, body: JSON.stringify({}) });
```

An empty body grants everything the prompt lists. Naming `scopes` / `claims` / `resourceScopes` narrows the grant to the **intersection** of what was requested and what was chosen, so a page can never grant something the client did not ask for. Leaving out something the client requires means the prompt fires again on the retry, so only narrow deliberately.

#### When your login page runs its own flow

If the page authenticates by itself — a social sign-in, or your own GraphQL mutation — it does not need `/login`. Once it has established a member-base session, `POST .../session` closes the interaction:

```ts
await fetch(`${base}/session`, { method: 'POST', credentials: 'include' }).then(r => r.json());
```

A session whose `authTime` is later than the interaction's own issue time proves the member authenticated _during this flow_, which is exactly what `prompt=login` and `max_age` ask for. An older session falls back to the ordinary skip rules, so the relying party's demand for a fresh login is never silently voided. Without this endpoint the only route back is a full-page redirect to `/oidc/interaction/{uid}`, which loops forever under `prompt=login`.

#### Rendering HTML in-process instead

Serving the page from a URL is the intended arrangement, but `renderLogin` / `renderConsent` return HTML directly when that suits better. Each is used only when the matching `*PageUrl` is absent, so the resolution order is:

```
loginPageUrl    ->  renderLogin    ->  built-in login page    (+ warning)
consentPageUrl  ->  renderConsent  ->  built-in consent page  (+ warning)
```

Both receive the absolute path to post to, so the returned HTML never has to guess how a relative action resolves:

```ts
interaction: {
  renderLogin: ({ uid, channels, error, submitUrl }) => `
    <form method="post" action="${submitUrl}">
      ${error ? `<p>${error}</p>` : ''}
      <input name="account"><input name="password" type="password">
      <button>Sign in</button>
    </form>`,

  renderConsent: ({ uid, clientId, clientName, missingScopes, missingClaims, missingResourceScopes, submitUrl, abortUrl }) => `
    <h1>${clientName} wants access</h1>
    <ul>${missingScopes.map(s => `<li>${s}</li>`).join('')}</ul>
    <form method="post" action="${abortUrl}"><button>Deny</button></form>
    <form method="post" action="${submitUrl}"><button>Allow</button></form>`,
}
```

A form submitted this way arrives with `Accept: text/html` and therefore gets a `303`, so no JavaScript is required.

#### The built-in pages

When neither option is configured, a plain built-in page is served and a warning is logged the first time it is reached. They exist so the endpoint is usable the moment it is mounted, and are **not** intended for production — no branding, no translations. Consent falling back to a page is a change from earlier versions, which answered `400` and simply failed the authorization.

Both are exported if you want to start from them:

```ts
import {
  renderDefaultLoginPage,
  renderDefaultConsentPage,
  escapeHtml,
} from '@rytass/member-base-nestjs-module/oidc-provider';
```

#### Types

Everything the interaction layer exchanges is exported from the same entry point, so a page or a custom renderer can be typed against it rather than against `unknown`:

| Type                         | Describes                                                          |
| ---------------------------- | ------------------------------------------------------------------ |
| `OidcInteractionDetailsView` | The `GET /details` response                                        |
| `OidcConsentBody`            | The `POST /consent` body                                           |
| `OidcAbortBody`              | The `POST /abort` body                                             |
| `OidcInteractionPageUrl`     | `loginPageUrl` / `consentPageUrl` — a string or a function         |
| `OidcInteractionPageParams`  | What the function form of those options receives                   |
| `OidcLoginRenderParams`      | What `renderLogin` receives                                        |
| `OidcConsentRenderParams`    | What `renderConsent` receives                                      |
| `OidcPromptDetails`          | `missingOIDCScope` / `missingOIDCClaims` / `missingResourceScopes` |

```ts
import type {
  OidcInteractionDetailsView,
  OidcConsentBody,
  OidcConsentRenderParams,
} from '@rytass/member-base-nestjs-module/oidc-provider';

const details: OidcInteractionDetailsView = await fetch(`${base}/details`, {
  credentials: 'include',
}).then(r => r.json());
```

### Administering service providers

Registering a client is a management operation, so the module ships it as a **service and no endpoint**: `OidcClientService` is exported by `MemberBaseOidcProviderModule` and nothing is reachable until your application decides to expose it. That keeps the transport (REST, GraphQL, a CLI, a seeding script), the route, the payload shape and the permission name yours — a GraphQL-only application gains no REST surface it did not ask for.

| Method                             | Returns                      | Notes                                                                       |
| ---------------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| Method                             | Returns                      | Notes                                                                       |
| ---------------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| `list()`                           | `OidcClientView[]`           | Newest first, never includes the stored secret                              |
| `findOne(clientId)`                | `OidcClientView \| null`     | For nullable lookups                                                        |
| `get(clientId)`                    | `OidcClientView`             | Throws `OidcClientNotFoundError`                                            |
| `create(input)`                    | `CreatedOidcClient`          | The generated secret is readable **once**, here; `null` for a public client |
| `update(clientId, input, options)` | `OidcClientView`             | `mode: 'replace'` (default) or `'merge'`; never touches the secret          |
| `rotateSecret(clientId)`           | `{ clientId, clientSecret }` | Explicit, never a side effect of an edit                                    |
| `remove(clientId)`                 | `OidcClientView`             | Soft removes, and returns what was removed                                  |
| `restore(clientId)`                | `OidcClientView`             | Brings a removed client back, secret and all                                |

`OidcClientView` is the entity minus `clientSecret`, plus `hasSecret: boolean`. Pass `confidential: false` to `create` to register a public client that authenticates with PKCE alone.

#### Replace or merge

`update` defaults to replacing the record, which is right for a PUT and wrong for an edit form that forgot to submit a field — the field is cleared, and the symptom (`invalid_client`) looks nothing like the cause (a missing `grant_types`). Pass `mode: 'merge'` to leave omitted fields alone:

```ts
await this.oidcClientService.update(clientId, { name: 'Renamed' }, { mode: 'merge' });
```

Validation runs against the merged result either way, so a patch cannot produce a combination a full replace would have rejected.

#### What is rejected before it reaches the database

Three checks are built in, because without them the failure is either silent corruption or an `invalid_client` with nothing wrong visible in the table:

| Rejected                                                      | Raises                              | Why                                                            |
| ------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| A comma in `redirectUris` / `postLogoutRedirectUris`          | `InvalidOidcRedirectUriError`       | The columns are `simple-array`; the uri would be stored as two |
| A fragment in `redirectUris`                                  | `InvalidOidcRedirectUriError`       | Forbidden by OIDC Core 3.1.2.1                                 |
| `responseTypes` with `code` but no `authorization_code` grant | `InconsistentOidcClientGrantsError` | Every request from that client answers `invalid_client`        |
| An id already held by a live client                           | `OidcClientAlreadyExistsError`      | `save` on an existing key overwrites it, secret and all        |
| An id held by a removed client                                | `OidcClientIdRetiredError`          | `clientId` is the primary key and removal is soft              |
| A public client while `allowPublic: false`                    | `PublicOidcClientNotAllowedError`   | The deployment registers confidential clients only             |

Use `restore(clientId)` rather than reusing a retired id. Every one of these extends `BadRequestException` and carries a `code`, so a resolver can map them to whatever its transport expects:

| Error                               | `code` |
| ----------------------------------- | ------ |
| `OidcClientNotFoundError`           | 114    |
| `OidcClientAlreadyExistsError`      | 115    |
| `OidcClientIdRetiredError`          | 116    |
| `PublicOidcClientNotAllowedError`   | 117    |
| `InvalidOidcRedirectUriError`       | 118    |
| `InconsistentOidcClientGrantsError` | 119    |

All six are exported from `@rytass/member-base-nestjs-module/oidc-provider`.

Anything beyond those three is your policy, not this module's, and goes in `clients.validate`:

```ts
MemberBaseOidcProviderModule.forRoot({
  issuer: 'https://idp.example.com/oidc',
  clients: {
    allowPublic: false, // a deployment-level "every client is confidential"
    validate: (input, { operation, clientId, existing }) => {
      if (input.redirectUris?.some(uri => !uri.startsWith('https://'))) {
        throw new BadRequestException('redirect uris must be https');
      }
    },
  },
});
```

The hook receives the complete state about to be written — on a merge that is the merged result — so it never has to reconstruct what the record will look like.

#### Encrypting `client_secret` at rest

The column cannot be hashed: `client_secret_basic` is compared against the plaintext by oidc-provider, and `client_secret_jwt` uses it as an HMAC key. Reversible encryption is the only option that keeps the protocol working, and `clients.secretCipher` keeps the key out of this package:

```ts
interface OidcSecretCipher {
  encrypt(plain: string): string | Promise<string>;
  decrypt(stored: string): string | Promise<string>;
}
```

Either may be async, so a Vault Transit or KMS call is as valid an implementation as local AES. It is called in exactly two places: `create` / `rotateSecret` before the value is stored, and the adapter before the metadata reaches oidc-provider. `list`, `get` and `findOne` never touch the column, so they never call it.

A local AES-256-GCM implementation, with a version prefix so a future key rotation can tell old ciphertext apart:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const key = Buffer.from(process.env.OIDC_CLIENT_SECRET_KEY, 'base64'); // 32 bytes

clients: {
  secretCipher: {
    encrypt: plain => {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

      return ['v1', iv, cipher.getAuthTag(), body].map(part => part.toString('base64url')).join('.');
    },
    decrypt: stored => {
      const [version, iv, tag, body] = stored.split('.');

      if (version !== 'v1') throw new Error(`Unknown client secret cipher version: ${version}`);

      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));

      decipher.setAuthTag(Buffer.from(tag, 'base64url'));

      return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
    },
  },
}
```

The column is `text`, so ciphertext length is not a consideration — local AES, Vault Transit's `vault:v1:…` and a KMS blob all fit.

One thing to know: **a secret that cannot be decrypted throws.** Returning nothing would answer `invalid_client` on every request with a perfectly normal-looking row, so the adapter raises instead, naming the client.

Turning it on does **not** migrate rows already stored in plaintext: their decrypt fails on the next token request. Rotate every existing client's secret when you enable it.

Expose the service under whichever guard your application already uses:

```ts
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

### Authorization stays with each service provider

`findAccount` publishes identity claims only. **No roles are emitted.** This issuer answers _who a subject is_; what that subject may do is each service provider's decision, made against data it controls rather than a claim frozen into a token whose lifetime it cannot influence. Add identity attributes via `claims.extra`:

```ts
claims: {
  extra: async member => ({ name: member.name, email: member.email }),
}
```

### Session bridging

An application that is both an issuer and a resource server has two session concepts. The bridge is on by default and keeps them consistent:

| Direction                  | Behaviour                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Issuer to local            | A successful interaction login also sets the member-base cookies                                       |
| Local to issuer            | An existing member-base session satisfies the login prompt                                             |
| Local to issuer, on demand | `POST /oidc/interaction/:uid/session` closes the prompt from a session your own login flow established |
| Logout                     | Clears both                                                                                            |

Two request parameters are always honoured, because ignoring them would void the relying party's own security decision:

- `prompt=login` — always shows the login page, whatever local session exists
- `max_age` — a session older than the client accepts cannot stand in; a token predating the `authTime` claim can never satisfy it and fails closed. `max_age=0` is treated as `prompt=login`.

Requires `cookieMode: true`; a redirect-based login cannot hand a header-bearer token to a browser, and a warning is logged if the combination is misconfigured.

### Operational notes

- **JWKS**: omitting `jwks` generates an ephemeral key with a loud warning. Every restart invalidates issued tokens and multiple instances sign with different keys — development only.
- **Bundlers cannot see this dependency.** `oidc-provider` is ESM-only and is loaded through an opaque dynamic import, so it will not appear in a generated `package.json` (Nx `generatePackageJson`). List it in your application's own dependencies; a missing install fails at boot with an explicit message rather than mysteriously at runtime.
- **Payload sweep**: `oidc-provider` never deletes expired artefacts. A sweep runs hourly by default (`purgeIntervalSeconds`); set it to `0` and drive `OidcMaintenanceService.purgeExpired()` from your own scheduler.
- **Consent**: defaults to each client's own `skipConsent` column, so a third-party client never has consent granted on its behalf. Override with `interaction.autoConsent`. Anything not auto-consented goes to `interaction.consentPageUrl` — see [The interaction API](#the-interaction-api).
- **Grants answer the whole prompt.** Scopes, claims and resource scopes are all granted together, and an existing grant is extended rather than replaced. Granting only the scope would leave the claims outstanding, the prompt would fire again on the retry, and the flow would become a redirect loop rather than a clean failure.
- PKCE is required for every client.

## Authenticating Against an LDAP Directory

Shipped behind its own entry point so `ldapts` is only needed by applications that actually talk to a directory.

```bash
npm install ldapts   # optional peer dependency
```

```ts
import { LdapAuthProvider } from '@rytass/member-base-nestjs-module/ldap';

MemberBaseModule.forRoot({
  authProviders: [
    new LdapAuthProvider({
      url: 'ldaps://dc.corp.local',
      bindDN: 'CN=svc-account,OU=Service,DC=corp,DC=local',
      bindPassword,
      baseDN: 'DC=corp,DC=local',
      accountAttribute: 'sAMAccountName', // or userPrincipalName
    }),
  ],
});

const { member } = await gateway.authenticate('ldap', { account, password });
```

The password is never stored or hashed locally — the service account locates the user, then the user's own DN is bound with the supplied password.

Behaviour worth knowing:

- The local binding is keyed on `objectGUID`, not the account name, so renaming an account in the directory does not orphan its member.
- A typed `DOMAIN\account` has its NetBIOS prefix stripped; `sAMAccountName` cannot contain a backslash, so passing it through verbatim would fail a perfectly valid login. UPNs pass through untouched.
- Filter values are escaped (RFC 4515), so an account containing `*` or `(` is matched literally instead of altering the filter.
- An empty password is rejected before any bind is attempted — many directories treat a bind with no password as an anonymous bind and accept it.
- Accounts flagged disabled in `userAccountControl` are rejected before the password is verified (`rejectDisabledAccounts: false` to opt out).

### Reading the directory without a login

A directory is a source of truth for attributes, not only for passwords. These are plain queries — **nothing is scheduled and nothing runs unless you call it**:

```ts
const provider = gateway.getProvider('ldap') as LdapAuthProvider;

await provider.findUser('wangxx'); // by account attribute
await provider.findAllUsers(); // everything under baseDN
await provider.findByDn('CN=Wang,OU=Users,DC=...'); // by distinguished name

// Map an entry onto the identity shape the gateway consumes, so a
// reconciliation job and a login share one attribute mapping.
const identity = provider.toIdentity(entry);
```

`toIdentity` surfaces `attributes.disabled`, so a reconciliation job can act on accounts that were disabled in the directory out-of-band.

### Writing directory attributes back (opt-in)

By default a login **never** writes directory attributes to the member: that costs a write per authentication, and which fields a directory may overwrite is an application decision. Opt in with `syncOnAuthenticate`:

```ts
MemberBaseModule.forRoot({
  syncOnAuthenticate: async ({ identity, member, provisioned }) => {
    await memberRepo.update(member.id, {
      name: identity.attributes?.name as string,
      department: identity.attributes?.department as string,
    });
  },
});
```

The same hook runs when directory entries are fed through `gateway.resolve()`, so a scheduled reconciliation reuses the login path rather than duplicating it:

```ts
// Your application owns the schedule — interval, pacing and failure handling
// are its decisions, so no scheduler ships in this module.
@Cron(CronExpression.EVERY_HOUR)
async reconcile(): Promise<void> {
  const entries = await provider.findAllUsers();

  for (const entry of entries) {
    await gateway.resolve(provider.toIdentity(entry));
  }
}
```

`provisioned` tells the handler whether the member was just created or already existed.

### Subpath isolation

An application that never imports `@rytass/member-base-nestjs-module/ldap` never resolves that module, so `ldapts` is never required and its absence is not an error. This is a property of module resolution rather than bundler tree-shaking — backend builds externalize `node_modules` and do not tree-shake them at all — and is covered by a regression test.

## Authenticating Against an OIDC Issuer

`OidcAuthProvider` makes this module a relying party for any standards-compliant OIDC issuer. Unlike the bundled OAuth2 flows it performs discovery, uses PKCE, and verifies the id token signature, issuer, audience and nonce before trusting any claim.

```ts
import { OidcAuthProvider } from '@rytass/member-base-nestjs-module';

MemberBaseModule.forRoot({
  authProviders: [
    new OidcAuthProvider({
      channel: 'corp-idp',
      issuer: 'https://idp.example.com/oidc', // discovery target
      clientId,
      clientSecret,
      redirectUri: 'https://app.example.com/auth/callback',
      scope: ['openid', 'profile', 'email'],
    }),
  ],
});
```

The provider is stateless, so the application decides where the per-attempt secrets live:

```ts
// 1. Start the flow — persist the returned values (a signed cookie works well)
const request = await gateway.getProvider('corp-idp').createAuthorizationRequest();

res.cookie('oidc_tx', JSON.stringify(request), { httpOnly: true, maxAge: 600_000 });
res.redirect(request.url);

// 2. On the callback — validate state yourself, then hand the secrets back
const tx = JSON.parse(req.cookies.oidc_tx);

if (tx.state !== req.query.state) throw new BadRequestException('Invalid state');

const { member } = await gateway.handleCallback('corp-idp', {
  code: String(req.query.code),
  codeVerifier: tx.codeVerifier,
  nonce: tx.nonce,
});
```

### Back-channel calls on an internal address

When this application runs next to the issuer — a sidecar container, a service on the same cluster — routing server-to-server calls through the public hostname leaves and re-enters the network for no reason, and often does not resolve at all.

```ts
new OidcAuthProvider({
  channel: 'corp-idp',
  issuer: 'https://idp.example.com/oidc', // public identity, appears in the id token
  internalBaseUrl: 'http://localhost:4530/oidc', // where back-channel calls actually go
  // ...
});
```

Discovery, token exchange, JWKS and userinfo are rewritten by replacing the issuer prefix. Two things deliberately do not change:

- **The authorization URL is never rewritten** — the browser has to reach the public address.
- **The issuer is still validated against its public identifier** — the discovery document must declare the public issuer even when served from the internal address, otherwise id token verification would break.

Endpoints the issuer publishes on a different origin are left untouched rather than blindly redirected.

Notes:

- `identifierClaim` defaults to `sub`, the only claim an issuer guarantees is stable. Pointing it at `email` makes the binding follow a mutable value and defers `identifierVerified` to the `email_verified` claim.
- Signature algorithms are pinned to the asymmetric families. An issuer cannot downgrade to HMAC and have its own public key accepted as a shared secret.
- Signing keys are cached and refetched on a `kid` miss, so key rotation needs no restart. A failed discovery is never cached.
- No extra dependency: id tokens are verified with Node's built-in JWK support.

## Credential Verification Without Tokens

`login()` authenticates and immediately issues a member-base token pair. Flows that own their own session mechanics — an OIDC provider interaction, a custom SSO bridge — would throw those tokens away, so `verifyCredentials()` performs the identical checks and returns the member instead.

```ts
// Same checks as login(): ban threshold (with optional auto unlock), password
// expiry policy, argon2 verification. Same side effects: failure counter reset
// or increment, login log entry.
const member = await memberBaseService.verifyCredentials(account, password, { ip });
```

Two lookups are also available for flows that need to resolve a member outside a login:

```ts
const byId = await memberBaseService.findById(id); // MemberEntity | null
const byAccount = await memberBaseService.findByAccount(account); // MemberEntity | null
```

## The `authTime` Claim

Access and refresh tokens carry an `authTime` claim (epoch seconds) recording when the member actually proved its identity. `refreshToken()` forwards the original value rather than re-stamping it, so a long-lived session cannot masquerade as freshly authenticated — which is what any downstream `max_age` / `prompt=login` / step-up check depends on.

```ts
// Fresh login: authTime = now
const pair = await memberBaseService.login(account, password);

// Explicit control when signing directly
memberBaseService.signAccessToken(member, domain, { authTime: 1700000000 });

// Omit the claim entirely (authentication time unknown)
memberBaseService.signAccessToken(member, domain, { authTime: null });
```

A refresh token that carries no `authTime` — one issued before the claim existed — leaves it absent on refresh rather than inventing a value, so a check that requires a known authentication time fails closed.

## Type Aliases and Injection Tokens

Every injection token has a single definition and is re-exported from the package root, so they are imported from `@rytass/member-base-nestjs-module` rather than from a deep path.

Several things carry two names. **Both are exported in every case** — the aliases were added without withdrawing anything, so no import needs changing.

The option types have shorter aliases, which are the ones to prefer in new code:

| Prefer                         | Also exported as                         |
| ------------------------------ | ---------------------------------------- |
| `MemberBaseModuleOptions`      | `MemberBaseModuleOptionsDTO`             |
| `MemberBaseModuleAsyncOptions` | `MemberBaseModuleAsyncOptionsDTO`        |
| `MemberBaseOptionsFactory`     | `MemberBaseModuleOptionFactoryInterface` |

The repository tokens have longer, more explicit aliases. Either name resolves to the same symbol, so pick whichever reads better:

| Token                  | Also exported as             |
| ---------------------- | ---------------------------- |
| `BaseMemberRepo`       | `BASE_MEMBER_REPOSITORY`     |
| `RESOLVED_MEMBER_REPO` | `RESOLVED_MEMBER_REPOSITORY` |

`AuthTokenPayloadBase` is the shared shape of a decoded token — `{ id; account?; domain? }` — and is what `casbinPermissionChecker` and `casbinDomainResolver` receive.
