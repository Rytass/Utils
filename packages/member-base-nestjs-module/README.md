# Member Base System for NestJS Projects

Members, passwords, tokens and Casbin authorization for NestJS — plus a pluggable authentication gateway and an optional OpenID Connect provider endpoint.

## What you can build with it

| Capability | Entry point | Status |
| --------------------------------------------- | ---------------------------- | ------------------- |
| Members, password policy, JWT session, Casbin | package root                 | always on           |
| Account/password login                        | package root                 | always on           |
| Google / Facebook / custom OAuth2 login       | package root                 | configure to enable |
| Login against any OIDC issuer (relying party) | package root                 | configure to enable |
| Login against an LDAP / Active Directory      | `/ldap`                      | opt-in subpath      |
| **Be** an OIDC provider for other services    | `/oidc-provider`             | opt-in subpath      |
| GraphQL DTOs                                  | `/graphql`                   | opt-in subpath      |

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

## Installation

```bash
npm install @rytass/member-base-nestjs-module
```

Required peer dependencies:

```bash
npm install @nestjs/common @nestjs/core @nestjs/typeorm typeorm argon2 jsonwebtoken
```

Optional peer dependencies — install only the ones you use:

| Package | Needed when |
| ------------------------ | ------------------------------------------------------------- |
| `typeorm-adapter` | You set `casbinAdapterOptions` (database-backed Casbin policy) |
| `@nestjs/graphql`, `graphql` | You import from `@rytass/member-base-nestjs-module/graphql` |
| `ldapts` | You import from `@rytass/member-base-nestjs-module/ldap` |
| `oidc-provider` | You import from `@rytass/member-base-nestjs-module/oidc-provider` |

Nothing is pulled in by importing the package root: an entry point you never import is never resolved, so its dependency is never required and its tables are never created. See [Subpath isolation](#subpath-isolation).

### Breaking change in 0.5.0: `typeorm-adapter` is no longer bundled

`typeorm-adapter` used to be a regular dependency of this package. It is now an
**optional peer dependency**. If you set `casbinAdapterOptions`, install it yourself:

```bash
npm install typeorm-adapter
```

Nothing to do if you do not set `casbinAdapterOptions`.

Why: `typeorm-adapter` declares `typeorm` as its own `dependency` (`^0.3.17`) rather
than a peer dependency. While it was bundled here, any consumer whose `typeorm`
version fell outside that range got a **second copy of TypeORM** installed under
`node_modules/typeorm-adapter/node_modules/`. Because `getMetadataArgsStorage()` is a
module-level singleton, the two copies split the entity metadata registry and produced
errors such as `Entity metadata for X was not found` — with nothing pointing back to
this package. The same nesting also pulled in `reflect-metadata@^0.1.13` alongside the
`^0.2.x` that NestJS 11 and TypeORM require, splitting the `Reflect` polyfill too.

Making it optional means your `typeorm` version is the only one installed.

If you set `casbinAdapterOptions` without installing `typeorm-adapter`, the module
throws at startup with an explicit message rather than booting into a broken
authorization state.

## Inheritance

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

| Part      | Where it comes from                                                              |
| --------- | -------------------------------------------------------------------------------- |
| `sub`     | The member id in the access token                                                |
| `dom`     | `payload.domain` from the token, falling back to `DEFAULT_CASBIN_DOMAIN`         |
| `obj`     | The first element of each `AllowActions` pair                                    |
| `act`     | The second element                                                               |

So the policy `addPolicy('article-admin', 'articles', 'article', 'create')` above is matched by `@AllowActions([['article', 'create']])` when the caller's token carries `domain: 'articles'` — which `login(account, password, { domain: 'articles' })` puts there.

Listing several pairs is an **OR**: the call is allowed if any one of them passes. To decide the domain per request instead of taking it from the token — when the target depends on GraphQL arguments, say — supply a [`casbinDomainResolver`](#request-aware-authorization-casbindomainresolver-and-decision-tracing). To use your own decorator in place of `AllowActions`, set `casbinPermissionDecorator`.

## Default Admin Bootstrap

Instead of hand-writing the seeding code above, you can declare a default administrator directly in the module options. On application startup the module will create the account and grant it **super-admin (allow-all) permissions**.

```typescript
MemberBaseModule.forRoot({
  memberEntity: MyMemberEntity,
  casbinAdapterOptions: { type: 'postgres', /* ... */ }, // required to grant permissions
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

### GraphQL Support

You should resolve token into graphql context named **token** by yourself or use module provided helper.

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
      fieldResolverEnhancers: ['guards'], // Important!!
      debug: true,
      playground: true,
      autoTransformHttpErrors: true,
      context: GraphQLContextTokenResolver, // ({ req }: { req: Request }) => { token: string | null }
    }),
  ],
})
export class AppModule {}
```

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

## Deployment Topologies

Five combinations cover nearly every deployment. Each is complete — the module configuration plus whatever `main.ts` needs.

### Choosing one

| Question | Topology |
| ------------------------------------------------------------- | ------------------------- |
| Users have accounts here, nothing else involved | [A. Standalone](#a-standalone) |
| Users sign in with Google/Facebook too | [B. Social login](#b-standalone-with-social-login) |
| Corporate directory owns the passwords | [C. Directory-backed](#c-directory-backed-active-directory) |
| Another system already owns identity, this app consumes it | [D. Relying party](#d-relying-party-of-an-existing-issuer) |
| Other services should authenticate against **this** app | [E. Identity provider](#e-identity-provider) |
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
  async callback(@Req() req: Request, @Res() res: Response, @Query('code') code: string, @Query('state') state: string): Promise<void> {
    const tx = JSON.parse(req.cookies.oidc_tx ?? '{}');

    if (!tx.state || tx.state !== state) throw new BadRequestException('Invalid state');

    const { member } = await this.gateway.handleCallback('corp-idp', { code, codeVerifier: tx.codeVerifier, nonce: tx.nonce });

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

Register a service provider through the admin API (guarded by your own Casbin policy):

```bash
curl -X POST https://idp.example.com/oidc-clients \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"Reporting","redirectUris":["https://reporting.example.com/auth/callback"],"skipConsent":true}'
# => { "clientId": "...", "clientSecret": "...", ... }  secret shown once
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

| Option | Type | Default | Purpose |
| ---------------------- | ---------------------------------- | -------- | ----------------------------------------------- |
| `authProviders` | `AuthenticationProvider[]` | `[]` | Extra sources; password is always registered |
| `autoProvision` | `boolean \| (identity) => Promise<string \| null>` | `true` | What happens when an external identity has no member |
| `linkExistingAccount` | `boolean \| 'verified-only'` | `true` | Whether an external identity may claim a matching local account |
| `syncOnAuthenticate` | `(params) => Promise<void>` | — | Write directory attributes back after resolution; nothing runs by default |
| `oauth2Providers` | `OAuth2Provider[]` | `[]` | Google / Facebook / custom OAuth2 |
| `oauth2ClientDestUrl` | `string` | `'/login'` | Where the OAuth2 callback redirects |

Every pre-existing option (token secrets and lifetimes, password policy, Casbin, cookie mode, default admin) is unchanged and documented in its own section below.

### `MemberBaseOidcProviderModule` options

| Option                        | Type                                      | Default                | Purpose                                                          |
| ----------------------------- | ----------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| `issuer`                      | `string`                                  | required               | Issuer identifier; must match the public URL                     |
| `jwks`                        | `{ keys: [] }`                            | ephemeral + warn       | Signing keys; required outside development                       |
| `cookieKeys`                  | `string[]`                                | random                 | Keys protecting the provider's cookies                           |
| `routePrefix`                 | `string`                                  | `'oidc'`               | Path the endpoints are mounted on                                |
| `interaction.loginPageUrl`    | `string \| (params) => string`            | built-in page          | Your own login page; the browser is redirected here              |
| `interaction.consentPageUrl`  | `string \| (params) => string`            | built-in page          | Your own consent page                                            |
| `interaction.renderLogin`     | `(params) => string`                      | built-in page          | Render login HTML in-process; ignored when `loginPageUrl` is set |
| `interaction.renderConsent`   | `(params) => string`                      | built-in page          | Render consent HTML in-process; ignored when `consentPageUrl` is set |
| `interaction.allowedChannels` | `string[]`                                | all credential channels | Which sources the login form may use                            |
| `interaction.autoConsent`     | `boolean \| (clientId) => boolean`        | client's `skipConsent` | Skip the consent step entirely                                   |
| `claims.extra`                | `(member) => object`                      | —                      | Additional identity claims                                       |
| `claims.additionalScopes`     | `string[]`                                | —                      | Extra accepted scopes                                            |
| `claims.scopeClaims`          | `Record<string, string[]>`                | —                      | Which claims each scope releases                                 |
| `ssoBridge.*`                 | see [Session bridging](#session-bridging) | all enabled            | Local/issuer session interop                                     |
| `ttl`                         | `Partial<Record<...>>`                    | 1h access, 14d refresh | Token lifetimes                                                  |
| `purgeIntervalSeconds`        | `number`                                  | `3600`                 | Expired payload sweep; `0` disables                              |
| `advanced`                    | `Record<string, unknown>`                 | —                      | Merged last into oidc-provider config                            |

### Which tables exist

| Table | Created by |
| ---------------------------- | ------------------------------------ |
| `members` (+ your subclass) | package root, always |
| `member_login_logs` | package root, always |
| `member_password_histories` | package root, always |
| `member_oauth_records` | package root, always |
| `casbin_rule` | `casbinAdapterOptions` |
| `oidc_payloads`, `oidc_clients` | importing `/oidc-provider` only |

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

| Option | Default | Effect |
| --- | --- | --- |
| `autoProvision` | `true` | Provision a passwordless member the first time an unknown external identity authenticates |
| `autoProvision` | `false` | Reject identities that have no local member yet |
| `autoProvision` | `(identity) => Promise<string \| null>` | Decide per identity — a directory group check, an approval workflow |
| `linkExistingAccount` | `true` | An unbound external identity claims a local member whose `account` equals the identifier |
| `linkExistingAccount` | `'verified-only'` | Same, but only when the provider reported `identifierVerified: true` |
| `linkExistingAccount` | `false` | Never link; fall through to provisioning |

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
    MemberBaseModule.forRoot({ /* ... */ }),
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

`oidc-provider` is a Koa application that reads the raw request stream. Middleware registered through `configure(consumer)` runs *after* Nest's body parser, which has already consumed that stream, so every form-encoded POST (`/token`, `/introspection`, `/revocation`) would break. Mounting before `listen()` puts the provider ahead of the body parser.

| Endpoint | Protection |
| --- | --- |
| `/oidc/.well-known/openid-configuration`, `/auth`, `/token`, `/me`, `/jwks`, `/session/end` | Public (mounted middleware) |
| `/oidc/interaction/:uid` and everything under it | `@IsPublic()` |
| `/oidc-clients` (registration CRUD) | `@AllowActions([['OidcClient', 'read' \| 'write']])` |

Client administration runs through **your own Casbin policy** — the same rules that govern every other resource decide who may register a service provider. The global guard stays on; nothing has to be disabled.

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
| `GET`  | *(the uid itself)* | —                                       | Entry point; resolves or redirects to your page |
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

| Status | Endpoint   | Meaning                                                                             |
| ------ | ---------- | ----------------------------------------------------------------------------------- |
| `400`  | `/login`   | `channel` is not in `interaction.allowedChannels`                                     |
| `401`  | `/login`   | `{ error: 'invalid_credentials', message: 'Invalid account or password' }`            |
| `400`  | `/consent` | The interaction awaits a different prompt, or carries no authenticated subject        |
| `403`  | `/session` | `ssoBridge.acceptLocalSession` is off                                                 |
| `400`  | `/session` | The interaction awaits consent, not login                                             |
| `401`  | `/session` | No member-base session, its member is gone, or `reauthentication_required`            |

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
interaction: { loginPageUrl: '/sign-in?theme=dark' }
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

A session whose `authTime` is later than the interaction's own issue time proves the member authenticated *during this flow*, which is exactly what `prompt=login` and `max_age` ask for. An older session falls back to the ordinary skip rules, so the relying party's demand for a fresh login is never silently voided. Without this endpoint the only route back is a full-page redirect to `/oidc/interaction/{uid}`, which loops forever under `prompt=login`.

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
import { renderDefaultLoginPage, renderDefaultConsentPage, escapeHtml } from '@rytass/member-base-nestjs-module/oidc-provider';
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

### Authorization stays with each service provider

`findAccount` publishes identity claims only. **No roles are emitted.** This issuer answers *who a subject is*; what that subject may do is each service provider's decision, made against data it controls rather than a claim frozen into a token whose lifetime it cannot influence. Add identity attributes via `claims.extra`:

```ts
claims: {
  extra: async member => ({ name: member.name, email: member.email }),
}
```

### Session bridging

An application that is both an issuer and a resource server has two session concepts. The bridge is on by default and keeps them consistent:

| Direction | Behaviour |
| --- | --- |
| Issuer to local | A successful interaction login also sets the member-base cookies |
| Local to issuer | An existing member-base session satisfies the login prompt |
| Local to issuer, on demand | `POST /oidc/interaction/:uid/session` closes the prompt from a session your own login flow established |
| Logout | Clears both |

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

await provider.findUser('wangxx');                 // by account attribute
await provider.findAllUsers();                     // everything under baseDN
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

Refresh tokens issued before this release carry no `authTime`. Refreshing one leaves the claim absent rather than inventing a value, so checks that require a known authentication time fail closed.

## Upgrade Notes

### The OIDC interaction layer is now API-first

Four changes to `@rytass/member-base-nestjs-module/oidc-provider`. Full documentation in [The interaction API](#the-interaction-api).

**The interaction routes are now actually reachable.** `mountMemberBaseOidcProvider` used to register its middleware with `app.use('/oidc', handler)`. Express strips a mount path for the handler and then **puts it back** before the request reaches the next layer, so Nest — which registers the interaction routes without the prefix — never matched `/oidc/interaction/:uid` and every interactive login answered `404`. The middleware is now registered without a mount path and strips the prefix itself, which makes the rewrite outlive it. Nest's global prefix, if you set one, is put back on the way through. Nothing in your application changes; the flow simply works.

**Consent has a user-facing path.** Previously a client with `skipConsent: false` and no `autoConsent` override got `400 Consent is required for this client but no consent screen is configured` — third-party authorization could not complete at all. Now the member is sent to `interaction.consentPageUrl`, or to `renderConsent`, or to a built-in page. Set `consentPageUrl` before you register a third-party client.

**Grants answer the whole prompt.** Consent used to grant only the requested scope. Claims and resource scopes are now granted too, and an existing grant is extended rather than replaced. A client requesting a claim outside the scope mapping previously re-triggered the consent prompt forever; that redirect loop is gone.

**The POST endpoints negotiate their response.** `POST /oidc/interaction/:uid/login` answers `200 { redirectTo }` to an API client and `303` to a browser form. A page built on `renderLogin` with a plain `<form>` is unaffected — it sends `Accept: text/html` and still gets the redirect. `renderLogin`'s parameter object gained `submitUrl`; existing renderers that ignore it keep working, though the built-in page's form action was also corrected (a relative `interaction/<uid>/login` resolved to `/oidc/interaction/interaction/<uid>/login`), so a custom renderer that copied that pattern should switch to `submitUrl`.

`@nestjs/core` is now declared as a peer dependency. It was always imported — by `MemberBaseModule` for `APP_GUARD` among others — just never declared, so any working installation already has it.

### Unique index on `member_oauth_records`

`MemberOAuthRecordEntity` now declares a unique index on `(channel, channelIdentifier)`. The primary key already guaranteed "one binding per member per channel"; this adds the complementary guarantee that one external identity maps to exactly one member, and gives the reverse lookup an index.

If you run with `synchronize: true`, index creation fails at startup when duplicates already exist. If you manage migrations yourself, generate one for this index. Check first:

```sql
SELECT channel, "channelIdentifier", count(*)
FROM member_oauth_records
GROUP BY 1, 2
HAVING count(*) > 1;
```

Any row returned is a pre-existing data anomaly (one external identity bound to several members) and needs a decision before the index can be created.

### Additional exported injection tokens

`MemberBaseModule` now also exports `MEMBER_BASE_MODULE_OPTIONS`, `ACCESS_TOKEN_EXPIRATION`, `REFRESH_TOKEN_SECRET`, `REFRESH_TOKEN_EXPIRATION`, `COOKIE_MODE`, `ACCESS_TOKEN_COOKIE_NAME`, `REFRESH_TOKEN_COOKIE_NAME`, `CASBIN_PERMISSION_CHECKER` and `CUSTOMIZED_JWT_PAYLOAD`, so modules layered on top can read the same configuration instead of duplicating it. This is additive; nothing that was exported before has changed.

## Recent Changes (Types and Authorization Behavior)

- Centralized token payload type: added `AuthTokenPayloadBase` to standardize `{ id; account?; domain? }` across the module.
- Cookie mode refinements:
  - Guard now validates the access token stored in a cookie; the refresh token is only used for refreshing, not for general authorization.
  - New configurable cookie-name tokens: `ACCESS_TOKEN_COOKIE_NAME` (default `access_token`) and `REFRESH_TOKEN_COOKIE_NAME` (default `refresh_token`).
  - In cookie mode, the OAuth2 callback sets BOTH `access_token` and `refresh_token` cookies (`httpOnly` + `secure`) to avoid an immediate refresh roundtrip.
  - Token resolution order: Authorization header (Bearer) first, then cookie (when cookie mode is enabled).
- RBAC safety:
  - `CASBIN_ENFORCER` may be `null`. If a route requires RBAC via `@AllowActions()` and no enforcer is present, access is denied; if the route only has `@Authenticated()`, a valid token is sufficient.
- Naming consistency (non-breaking):
  - Added aliases: `MemberBaseModuleOptions` (= `MemberBaseModuleOptionsDTO`), `MemberBaseModuleAsyncOptions` (= `MemberBaseModuleAsyncOptionsDTO`), `MemberBaseOptionsFactory` (= `MemberBaseModuleOptionFactoryInterface`).
  - Added repository token aliases: `BASE_MEMBER_REPOSITORY`, `RESOLVED_MEMBER_REPOSITORY`.
- OAuth2 interface cleanup:
  - `GoogleOAuth2Provider`/`FacebookOAuth2Provider` declare only delta fields (e.g., `scope?`); shared properties live in `BaseOAuth2Provider`.

Note: These changes are backward compatible (including type and token aliases). Cookie mode behavior is now stricter and clearer: authorization uses the access token, not the refresh token. If you previously relied on the refresh token for authorization, please switch to the access token.

### Type Names and Tokens

- Prefer the alias types for module options in your imports:
  - `MemberBaseModuleOptions` (= `MemberBaseModuleOptionsDTO`)
  - `MemberBaseModuleAsyncOptions` (= `MemberBaseModuleAsyncOptionsDTO`)
  - `MemberBaseOptionsFactory` (= `MemberBaseModuleOptionFactoryInterface`)
- All injection tokens are consolidated under a single source and re-exported from the package index. Import them from `@rytass/member-base-nestjs-module` (they originate from `src/typings/member-base.tokens.ts`).

### Cookie Mode Usage Example

Enable cookie mode and optionally override cookie names via providers. Authorization resolves tokens in this order: Authorization header (Bearer) first, then cookie.

```ts
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  MemberBaseModule,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
} from '@rytass/member-base-nestjs-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({ /* ... */ }),
    MemberBaseModule.forRoot({
      cookieMode: true,
      // other options...
    }),
  ],
  providers: [
    // Optional: override cookie names
    { provide: ACCESS_TOKEN_COOKIE_NAME, useValue: 'access_token' },
    { provide: REFRESH_TOKEN_COOKIE_NAME, useValue: 'refresh_token' },
  ],
})
export class AppModule {}
```

Recommended cookie attributes when setting cookies at the edge (reverse proxy or Nest):
- `httpOnly: true` to prevent access from JavaScript
- `secure: true` to limit to HTTPS
- `sameSite: 'lax' | 'strict'` depending on your cross-site needs
- `domain` and `path` as needed for your deployment
