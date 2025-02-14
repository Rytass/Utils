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
    CMSBaseModule.forRoot(),
  ],
})
export class AppModule {}
```

## References

### Methods

#### `forRoot()`

```tsx
static forRoot(options?: CMSBaseModuleOptionsDto);
```

**Parameters:**

| Name                                      | Type                  | Default        | Description                                                   |
| ----------------------------------------- | --------------------- | -------------- | ------------------------------------------------------------- |
| loginFailedBanThreshold                   | number                | 5              | Number of allowed password attempts                           |
| resetPasswordTokenExpiration              | number                | 3600           | Seconds of reset password token expiration                    |
| resetPasswordTokenSecret                  | string                |                | Reset password token secret, will generate automatically      |
| cookieMode                                | boolean               |                | Use cookie [token] to replace header authorization token      |
| accessTokenSecret                         | string                |                | Access token secret, will generate automatically              |
| accessTokenExpiration                     | number                | 900            | Seconds of access token expiration                            |
| refreshTokenSecret                        | string                |                | Refresh token secret, will generate automatically             |
| refreshTokenExpiration                    | number                | 900            | Seconds of refresh token expiration                           |
| onlyResetRefreshTokenExpirationByPassword | boolean               | false          | Refresh token expiration only reassign by password request    |
| enableGlobalGuard                         | boolean               | true           | Enable Casbin globally                                        |
| casbinAdapterOptions                      | TypeORMAdapterOptions |                | TypeORM configuration for casbin policies storage             |
| casbinModelString                         | string                | RBAC w/ Domain | Casbin modal string                                           |
| memberEntity                              | TypeORM Entity        | undefined      | Custom BaseMemberEntity                                       |
| passwordShouldIncludeUppercase            | boolean               | true           | Password Policy: Uppercase                                    |
| passwordShouldIncludeLowercase            | boolean               | true           | Password Policy: Lowercase                                    |
| passwordShouldIncludeDigit                | boolean               | true           | Password Policy: Digit                                        |
| passwordShouldIncludeSpecialCharacters    | boolean               | false          | Password Policy: Special Characters                           |
| passwordMinLength                         | number                | 8              | Password Policy: Min Length                                   |
| passwordPolicyRegExp                      | RegExp                |                | Password Policy: RegExp (Will overwrite above configure)      |
| passwordHistoryLimit                      | number                |                | Password Policy: Password History Check (Not duplicate)       |
| passwordAgeLimitInDays                    | number                |                | Password Policy: Change reminder (When expired)               |
| forceRejectLoginOnPasswordExpired         | boolean               | false          | If true, reject login when password is expired                |
| customizedJwtPayload                      | (member) => Payload   |                | Customize jwt access token payload                            |
| oauth2Providers                           | OAuth2Provider[]      |                | Configure OAuth2 login channel                                |
| oauth2ClientDestUrl                       | string                | /login         | After oauth2 logged in, url redirect target in client         |

#### `forRootAsync()`

```tsx
static forRootAsync(options: CMSBaseModuleAsyncOptionsDto);
```

**Parameters:**

| Name             | Type                                        | Default    | Description                                           |
| ---------------- | ------------------------------------------- | ---------- | ----------------------------------------------------- |
| imports          | DynamicModule[]                             | []         | Imported module before CMS module                     |
| useFactory       | (...args: any[]) => CMSBaseModuleOptionsDto | undefined  | Factory method to generate async options              |
| injects          | any[]                                       | []         | Inject symbol for useFactory method                   |
| useClass         | Type\<CMSBaseModuleOptionFactory\>          | undefined  | Options provider class                                |
| useExisting      | Type\<CMSBaseModuleOptionFactory\>          | undefined  | Options provider class symbol                         |
