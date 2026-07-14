# Member Base System for NestJS Projects

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
import { IsPublic, AllowedActions } from '@rytass/member-base-nestjs-module';

@Controller('/articles')
export class ArticleController {
  @Get('/')
  @IsPublic()
  list() {
    // allow everyone
  }

  @Post('/')
  @AllowedActions([
    ['articles', 'article', 'create'], // Domain, Subject, Action
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
