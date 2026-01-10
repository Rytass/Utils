# Member Module API Reference

## MemberBaseModule

```typescript
@Global()
@Module({})
class MemberBaseModule {
  static forRoot(options?: MemberBaseModuleOptions): DynamicModule;
  static forRootAsync(options: MemberBaseModuleAsyncOptions): DynamicModule;
}
```

---

## Services

### MemberBaseService

```typescript
class MemberBaseService<T extends BaseMemberEntity = BaseMemberEntity> {
  // 認證
  login(account: string, password: string, ip?: string): Promise<TokenPairDto>;
  login(account: string, password: string, options?: LoginOptions): Promise<TokenPairDto>;
  refreshToken(refreshToken: string, options?: RefreshOptions): Promise<TokenPairDto>;

  // 註冊
  register(account: string, password: string, options?: RegisterOptions): Promise<T>;
  registerWithoutPassword(account: string, options?: RegisterOptions): Promise<[T, string]>;

  // 密碼管理
  changePassword(id: string, originPassword: string, newPassword: string): Promise<T>;
  changePasswordWithToken(token: string, newPassword: string): Promise<T>;
  getResetPasswordToken(account: string): Promise<string>;

  // Token 簽署
  signAccessToken(member: T, domain?: string): string;
  signRefreshToken(member: T, domain?: string): string;

  // 管理
  resetLoginFailedCounter(id: string): Promise<T>;
}
```

### MemberBaseAdminService

```typescript
class MemberBaseAdminService<T extends BaseMemberEntity> {
  archiveMember(id: string): Promise<void>;
  resetMemberPassword(id: string, newPassword: string, ignorePolicy?: boolean): Promise<T>;
}
```

### PasswordValidatorService

```typescript
class PasswordValidatorService {
  validatePassword(password: string, memberId?: string): Promise<boolean>;
  generateValidPassword(): string;
  shouldUpdatePassword<T extends BaseMemberEntity>(member: T): boolean;
}
```

### OAuthService

```typescript
class OAuthService {
  // 取得登入 URL
  getGoogleOAuthLoginUrl(): Promise<string>;
  getFacebookOAuthLoginUrl(): Promise<string>;
  getCustomOAuthLoginUrl(channel: string): Promise<string>;

  // 使用 authorization code 登入
  loginWithGoogleOAuth2Code(code: string, state?: string): Promise<TokenPairDto & { state? }>;
  loginWithFacebookOAuth2Code(code: string, state?: string): Promise<TokenPairDto & { state? }>;
  loginWithCustomOAuth2Code(channel: string, code: string, state?: string): Promise<TokenPairDto & { state? }>;
}
```

---

## Entities

### BaseMemberEntity

```typescript
@Entity('members')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
class BaseMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  account: string;

  @Column()
  password: string;  // Argon2 hash

  @Column()
  passwordChangedAt: Date;

  @Column({ nullable: true })
  resetPasswordRequestedAt: Date | null;

  @Column({ type: 'int2', default: 0 })
  loginFailedCounter: number;

  @Column({ default: false })
  shouldUpdatePassword: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;

  // Relations
  @OneToMany(() => MemberLoginLogEntity, log => log.member)
  loginLogs: Relation<MemberLoginLogEntity[]>;

  @OneToMany(() => MemberPasswordHistoryEntity, h => h.member)
  passwordHistories: Relation<MemberPasswordHistoryEntity[]>;

  @OneToMany(() => MemberOAuthRecordEntity, r => r.member)
  oauthRecords: Relation<MemberOAuthRecordEntity[]>;
}
```

### MemberLoginLogEntity

```typescript
@Entity('member_login_logs')
class MemberLoginLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  memberId: string;

  @Column()
  success: boolean;

  @Column({ type: 'cidr', nullable: true })
  ip: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
```

### MemberPasswordHistoryEntity

```typescript
@Entity('member_password_histories')
class MemberPasswordHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  memberId: string;

  @Column()
  password: string;  // Argon2 hash

  @CreateDateColumn()
  createdAt: Date;
}
```

### MemberOAuthRecordEntity

```typescript
@Entity('member_oauth_records')
class MemberOAuthRecordEntity {
  @PrimaryColumn('uuid')
  memberId: string;

  @PrimaryColumn()
  channel: string;  // 'google' | 'facebook' | custom

  @Column()
  channelIdentifier: string;  // OAuth provider user ID

  @ManyToOne(() => BaseMemberEntity)
  member: Relation<BaseMemberEntity>;
}
```

---

## Decorators

### Route Decorators

```typescript
// 公開路由（跳過所有驗證）
@IsPublic()

// 需要有效 Token（不檢查權限）
@Authenticated()

// RBAC 權限檢查（[Subject, Action][] 二元組，domain 自動從 JWT payload 取得）
@AllowActions([
  [subject, action],
  // 多條件為 OR 關係
])
```

### Parameter Decorators

```typescript
// 注入會員 ID
@MemberId() memberId: string

// 注入會員帳號
@Account() account: string

// 檢查特定權限
@HasPermission(object, action)
```

---

## Injection Tokens

```typescript
// 認證
ACCESS_TOKEN_SECRET: string
ACCESS_TOKEN_EXPIRATION: number
REFRESH_TOKEN_SECRET: string
REFRESH_TOKEN_EXPIRATION: number
RESET_PASSWORD_TOKEN_SECRET: string
RESET_PASSWORD_TOKEN_EXPIRATION: number

// 密碼策略
PASSWORD_MIN_LENGTH: number
PASSWORD_SHOULD_INCLUDE_UPPERCASE: boolean
PASSWORD_SHOULD_INCLUDE_LOWERCASE: boolean
PASSWORD_SHOULD_INCLUDE_DIGIT: boolean
PASSWORD_SHOULD_INCLUDE_SPECIAL_CHARACTER: boolean
PASSWORD_POLICY_REGEXP: RegExp | undefined
PASSWORD_HISTORY_LIMIT: number | undefined
PASSWORD_AGE_LIMIT_IN_DAYS: number | undefined
FORCE_REJECT_LOGIN_ON_PASSWORD_EXPIRED: boolean

// Casbin
CASBIN_ENFORCER: Enforcer | null
CASBIN_PERMISSION_DECORATOR: ReflectableDecorator
CASBIN_PERMISSION_CHECKER: Function
ENABLE_GLOBAL_GUARD: boolean

// Repository
RESOLVED_MEMBER_REPO: Repository<BaseMemberEntity>
BASE_MEMBER_REPOSITORY: Repository<BaseMemberEntity>

// OAuth2
OAUTH2_PROVIDERS: OAuth2ProviderConfig[]
OAUTH2_CLIENT_DEST_URL: string

// Cookie
COOKIE_MODE: boolean
ACCESS_TOKEN_COOKIE_NAME: string
REFRESH_TOKEN_COOKIE_NAME: string
LOGIN_FAILED_AUTO_UNLOCK_SECONDS: number | null
```

---

## DTOs

### TokenPairDto

```typescript
interface TokenPairDto {
  accessToken: string;
  refreshToken: string;
}
```

### AuthTokenPayloadBase

```typescript
interface AuthTokenPayloadBase {
  id: string;
  account?: string;
  domain?: string;
  [key: string]: unknown;
}
```

---

## OAuth2 Provider Config

### Google

```typescript
interface GoogleOAuth2Provider {
  channel: 'google';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];  // default: ['openid', 'email']
  getState?: () => string | Promise<string>;
}
```

### Facebook

```typescript
interface FacebookOAuth2Provider {
  channel: 'facebook';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];  // default: ['public_profile', 'email']
  getState?: () => string | Promise<string>;
}
```

### Custom

```typescript
interface CustomOAuth2Provider {
  channel: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  requestUrl: string;
  getAccessTokenFromCode: (code: string) => Promise<string>;
  getAccountFromAccessToken: (token: string) => Promise<string>;
  getState?: () => string | Promise<string>;
}
```

---

## Errors

| 類別 | HTTP | 代碼 | 訊息 |
|------|------|------|------|
| MemberNotFoundError | 400 | 100 | Member not found |
| PasswordDoesNotMeetPolicyError | 400 | 101 | Password does not meet the policy |
| InvalidPasswordError | 400 | 102 | Invalid password |
| PasswordValidationError | 500 | 103 | Password validation error |
| InvalidToken | 400 | 104 | Invalid token |
| MemberAlreadyExistedError | 400 | 105 | Member already existed |
| PasswordChangedError | 400 | 106 | Password changed, please sign in again |
| MemberBannedError | 400 | 107 | Member banned |
| PasswordExpiredError | 400 | 108 | Password expired |
| PasswordShouldUpdatePasswordError | 400 | 109 | Member should update password |
| PasswordInHistoryError | 400 | 110 | Password is in history |

---

## Casbin Model

```ini
[request_definition]
r = sub, dom, obj, act

[policy_definition]
p = sub, dom, obj, act

[role_definition]
g = _, _, _  # subject, role, domain

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = g(r.sub, p.sub, r.dom) && r.dom == p.dom && r.obj == p.obj && r.act == p.act
```

---

## Complete Example

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberBaseModule, BaseMemberEntity } from '@rytass/member-base-nestjs-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'user',
      password: 'password',
      database: 'mydb',
      entities: [BaseMemberEntity],
      synchronize: true,
    }),

    MemberBaseModule.forRoot({
      accessTokenSecret: process.env.JWT_SECRET,
      accessTokenExpiration: 900,
      refreshTokenSecret: process.env.JWT_REFRESH_SECRET,
      refreshTokenExpiration: 7776000,

      passwordMinLength: 12,
      passwordShouldIncludeUppercase: true,
      passwordShouldIncludeLowercase: true,
      passwordShouldIncludeDigit: true,
      passwordShouldIncludeSpecialCharacters: true,
      passwordHistoryLimit: 5,
      passwordAgeLimitInDays: 90,

      loginFailedBanThreshold: 5,
      loginFailedAutoUnlockSeconds: 1800,

      casbinAdapterOptions: {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'user',
        password: 'password',
        database: 'mydb',
      },

      oauth2Providers: [
        {
          channel: 'google',
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          redirectUri: 'https://myapp.com/auth/google/callback',
        },
      ],
    }),
  ],
})
export class AppModule {}

// auth.controller.ts
import { Controller, Post, Body, Get, Query, Inject } from '@nestjs/common';
import {
  MemberBaseService,
  OAuthService,
  IsPublic,
  Authenticated,
  MemberId,
  CASBIN_ENFORCER,
} from '@rytass/member-base-nestjs-module';
import { Enforcer } from 'casbin';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly memberService: MemberBaseService,
    private readonly oauthService: OAuthService,
    @Inject(CASBIN_ENFORCER) private readonly enforcer: Enforcer,
  ) {}

  @Post('register')
  @IsPublic()
  async register(@Body() body: { account: string; password: string }) {
    const member = await this.memberService.register(body.account, body.password);
    return { id: member.id, account: member.account };
  }

  @Post('login')
  @IsPublic()
  async login(@Body() body: { account: string; password: string }) {
    return this.memberService.login(body.account, body.password);
  }

  @Post('refresh')
  @IsPublic()
  async refresh(@Body() body: { refreshToken: string }) {
    return this.memberService.refreshToken(body.refreshToken);
  }

  @Get('profile')
  @Authenticated()
  async profile(@MemberId() memberId: string) {
    return { memberId };
  }

  @Get('google')
  @IsPublic()
  async googleLogin() {
    const url = await this.oauthService.getGoogleOAuthLoginUrl();
    return { url };
  }

  @Get('google/callback')
  @IsPublic()
  async googleCallback(@Query('code') code: string) {
    return this.oauthService.loginWithGoogleOAuth2Code(code);
  }

  @Post('assign-role')
  @Authenticated()
  async assignRole(
    @Body() body: { memberId: string; role: string; domain: string },
  ) {
    await this.enforcer.addGroupingPolicy(body.memberId, body.role, body.domain);
    return { success: true };
  }
}

// protected.controller.ts
import { Controller, Get, Post, Delete, Param } from '@nestjs/common';
import { AllowActions, MemberId } from '@rytass/member-base-nestjs-module';

@Controller('articles')
export class ArticleController {
  @Get()
  @AllowActions([['articles', 'article', 'list']])
  async list() {
    return { articles: [] };
  }

  @Post()
  @AllowActions([['articles', 'article', 'create']])
  async create(@MemberId() memberId: string) {
    return { created: true, by: memberId };
  }

  @Delete(':id')
  @AllowActions([['articles', 'article', 'delete']])
  async delete(@Param('id') id: string) {
    return { deleted: id };
  }
}
```

---

## Dependencies

**Required:**
- @nestjs/common ^10
- @nestjs/typeorm ^10
- typeorm ^0.3
- jsonwebtoken ^9
- argon2 ^0.31
- casbin ^5
- typeorm-adapter ^1
- axios
- generate-password ^1.7
- luxon ^3

**Optional:**
- @nestjs/graphql (GraphQL support)
- cookie-parser (Cookie mode)
