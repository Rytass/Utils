---
sidebar_position: 1
---

# Configuration

This is a membership management system based on a NestJS module. You can use this module to build a comprehensive membership system that meets ISO 27001 audit requirements. The module will automatically record various foundational elements, including hashed password history, audit logs, and password validation rules.

The module also includes a complete Casbin permission management model, allowing you to freely switch between common permission models such as RBAC, Domain with RBAC, and ABAC to tailor the system to your needs.

First, you need to configure it using `forRoot` in your root module. If you need to pre-load other modules, `forRootAsync` might be your choice.

```typescript title="src/app.module.ts"
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberBaseModule } from '@rytass/member-base-nestjs-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      username: 'cms',
      password: 'password',
      database: 'cms',
      schema: 'cms',
      synchronize: true,
      autoLoadEntities: true,
      uuidExtension: 'uuid-ossp',
    }),
    MemberBaseModule.forRoot(),
  ],
})
export class AppModule {}
```

## References

### Methods

#### `forRoot()`

```tsx
static forRoot(options?: MemberBaseModuleOptions);
```

**Parameters:**

| Name                                      | Type                       | Default           | Description                                                       |
| ----------------------------------------- | -------------------------- | ----------------- | ----------------------------------------------------------------- |
| loginFailedBanThreshold                   | number                     | 5                 | Number of allowed password attempts                               |
| loginFailedAutoUnlockSeconds              | number                     | null              | Auto-unlock a banned account after this many seconds              |
| forceRejectLoginOnPasswordExpired         | boolean                    | false             | Reject login when the password has expired                        |
| loginLogEnabled                           | boolean                    | true              | Write a row to `member_login_logs` on every attempt               |
| loginLogRecordIp                          | boolean                    | true              | Store the caller's address with that row                          |
| resetPasswordTokenExpiration              | number                     | 3600              | Seconds of reset password token expiration                        |
| resetPasswordTokenSecret                  | string                     | random            | Reset password token secret                                       |
| accessTokenSecret                         | string                     | random            | Access token secret                                               |
| accessTokenExpiration                     | number                     | 900               | Seconds of access token expiration                                |
| refreshTokenSecret                        | string                     | random            | Refresh token secret                                              |
| refreshTokenExpiration                    | number                     | 7776000           | Seconds of refresh token expiration (90 days)                     |
| onlyResetRefreshTokenExpirationByPassword | boolean                    | false             | Refresh token expiration only reassigned by password change       |
| customizedJwtPayload                      | (member) => Payload        | -                 | Customize the JWT access token payload                            |
| cookieMode                                | boolean                    | false             | Use cookies instead of the authorization header                   |
| accessTokenCookieName                     | string                     | `access_token`    | Access token cookie name                                          |
| refreshTokenCookieName                    | string                     | `refresh_token`   | Refresh token cookie name                                         |
| cookiePath                                | string                     | `/`               | Cookie Path attribute                                             |
| cookieSameSite                            | 'lax'/'strict'/'none'      | `lax`             | Cookie SameSite attribute                                         |
| cookieSecure                              | boolean                    | derived           | Secure attribute; defaults to https or any non-loopback host      |
| cookieDomain                              | string                     | absent            | Domain attribute; set to share across subdomains                  |
| enableGlobalGuard                         | boolean                    | true              | Enable Casbin globally                                            |
| casbinAdapterOptions                      | TypeORMAdapterOptions      | -                 | TypeORM configuration for casbin policies storage                 |
| casbinModelString                         | string                     | RBAC w/ Domain    | Casbin model string                                               |
| casbinPermissionDecorator                 | ReflectableDecorator       | AllowActions      | Custom permission decorator                                       |
| casbinPermissionChecker                   | (params) => result         | built-in          | Custom permission check function                                  |
| casbinDomainResolver                      | (params) => domain         | -                 | Resolve the domain per request (default checker only)             |
| superAdminRole                            | string                     | `::SUPER_ADMIN::` | Role the default checker treats as allow-all                      |
| defaultCasbinDomain                       | string                     | `::DEFAULT::`     | Domain that grouping is keyed to                                  |
| memberEntity                              | TypeORM Entity             | BaseMemberEntity  | Custom member entity                                              |
| passwordShouldIncludeUppercase            | boolean                    | true              | Password Policy: Uppercase                                        |
| passwordShouldIncludeLowercase            | boolean                    | true              | Password Policy: Lowercase                                        |
| passwordShouldIncludeDigit                | boolean                    | true              | Password Policy: Digit                                            |
| passwordShouldIncludeSpecialCharacters    | boolean                    | false             | Password Policy: Special Characters                               |
| passwordMinLength                         | number                     | 8                 | Password Policy: Min Length                                       |
| passwordPolicyRegExp                      | RegExp                     | -                 | Password Policy: RegExp (overrides the options above)             |
| passwordHistoryLimit                      | number                     | -                 | Password Policy: reject reuse of the last N passwords             |
| passwordAgeLimitInDays                    | number                     | -                 | Password Policy: change reminder when expired                     |
| passwordHashOptions                       | PasswordHashOptions        | argon2 default    | argon2 cost parameters for every password hashed                  |
| authProviders                             | AuthenticationProvider[]   | []                | Extra authentication sources; password is always registered       |
| autoProvision                             | boolean \| function        | true              | What happens when an external identity has no member              |
| linkExistingAccount                       | boolean \| 'verified-only' | true              | Whether an external identity may claim a matching account         |
| syncOnAuthenticate                        | (params) => Promise        | -                 | Write directory attributes back after resolution                  |
| defaultAdminAccount                       | string                     | -                 | Create this account with super-admin on startup                   |
| defaultAdminPassword                      | string                     | generated         | Omit and a policy-compliant password is generated and logged once |
| oauth2Providers                           | OAuth2Provider[]           | []                | Configure OAuth2 login channels                                   |
| oauth2ClientDestUrl                       | string                     | `/login`          | Redirect target in the client after OAuth2 login                  |

`httpOnly` is not configurable and is always on. Cookie attributes left unset are derived per request, so neither development nor production needs to set them.

`passwordHashOptions` only affects hashes produced from then on — argon2 reads each hash's parameters out of the hash itself, so raising the cost never invalidates an existing password.

`loginLogEnabled: false` also disables `loginFailedAutoUnlockSeconds`, which reads the last failed attempt out of `member_login_logs`; the combination logs a warning on boot.

#### `forRootAsync()`

```tsx
static forRootAsync(options: MemberBaseModuleAsyncOptions);
```

**Parameters:**

| Name        | Type                                        | Default   | Description                              |
| ----------- | ------------------------------------------- | --------- | ---------------------------------------- |
| imports     | DynamicModule[]                             | []        | Modules imported before this one         |
| useFactory  | (...args: any[]) => MemberBaseModuleOptions | undefined | Factory method to generate async options |
| inject      | any[]                                       | []        | Tokens injected into useFactory          |
| useClass    | Type\<MemberBaseOptionsFactory\>            | undefined | Options provider class                   |
| useExisting | Type\<MemberBaseOptionsFactory\>            | undefined | Existing options provider class          |
