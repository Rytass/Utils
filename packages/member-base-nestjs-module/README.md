# Member Base System for NestJS Projects

## Inheritance

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberBaseRootModule } from '@rytass/member-base-nestjs-module';
import { MemberEntity } from './models/member.entity.ts';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // ... typeorm configuration
    }),
    MemberBaseRootModule.forRoot({
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
import { MemberBaseRootModule } from '@rytass/member-base-nestjs-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // ... typeorm configuration
    }),
    MemberBaseRootModule.forRoot({
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
