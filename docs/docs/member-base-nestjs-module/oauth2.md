---
sidebar_position: 2
---

# OAuth2

This module includes built-in OAuth2 login flows for both Google and Facebook. You only need to provide your Client ID, Client Secret, and Redirect URI to set up your OAuth2 login channel. If you need support for other identity providers, we also offer customizable configuration options.

After completing the setup, the module automatically binds the GET /auth/login/:channel route. When a user navigates to this route, they are immediately 301 redirected to the Identity Provider’s login page to initiate the OAuth2 authentication process.

You’ll need to whitelist /auth/callbacks/:channel as your redirect URI in your OAuth2 provider’s settings. The module will then automatically handle exchanging the authorization code for an access token, and using that access token to fetch the platform-specific identifier, which is used as the unique account identifier.

Please note that the system considers accounts with the same identifier to belong to the same user. For example, if you log in via Google and the returned email is abc@rytass.com, and there’s already an account in the database with that email—even if it hasn’t previously been used with Google OAuth2—the module will automatically bind and log in using that existing account.

```typescript title="src/app.module.ts"
import { Module } from '@nestjs/common';
import { MemberBaseModule } from '@rytass/member-base-nestjs-module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MemberBaseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        oauth2Providers: [
          {
            channel: 'google',
            clientId: config.get('GOOGLE_CLIENT_ID'),
            clientSecret: config.get('GOOGLE_CLIENT_SECRET'),
            redirectUri: `${config.get('SITE_HOST')}/auth/callbacks/google`,
          },
          {
            channel: 'facebook',
            clientId: config.get('FACEBOOK_CLIENT_ID'),
            clientSecret: config.get('FACEBOOK_CLIENT_SECRET'),
            redirectUri: `${config.get('SITE_HOST')}/auth/callbacks/facebook`,
          },
        ],
        oauth2ClientDestUrl: `${config.get('SITE_HOST')}`,
      }),
    }),
  ],
})
export class AppModule {}
```

After configured, navigate to /auth/login/google, the module will redirect you to Google's OAuth identity page.

If authenticated, redirect uri is /auth/callbacks/google, and so on.

## Custom OAuth2 Identity Provider

```typescript title="src/app.module.ts"
import { Module } from '@nestjs/common';
import { MemberBaseModule } from '@rytass/member-base-nestjs-module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MemberBaseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        oauth2Providers: [
          {
            channel: 'rytass', // Custom Provider
            clientId: config.get('RYTASS_CLIENT_ID'),
            clientSecret: config.get('RYTASS_CLIENT_SECRET'),
            redirectUri: `${config.get('SITE_HOST')}/auth/callbacks/rytass`,
            scope: ['email', 'profile'],
            requestUrl: 'https://auth.rytass.com/oauth2/auth',
            getAccessTokenFromCode: async (code: string) => {
              const response = await fetch('https://auth.rytass.com/oauth2/token', {
                method: 'POST',
                body: JSON.stringify({
                  code,
                  clientId: config.get('RYTASS_CLIENT_ID'),
                  clientSecret: config.get('RYTASS_CLIENT_SECRET'),
                  redirectUri: `${config.get('SITE_HOST')}/auth/callbacks/rytass`,
                  grant_type: 'authorization_code',
                }),
              }).then(res => res.json());

              return response.accessToken;
            },
            getAccountFromAccessToken: async (accessToken: string) => {
              const response = await fetch('https://api.rytass.com/profile', {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }).then(res => res.json());

              return response.email;
            },
          },
        ],
        oauth2ClientDestUrl: `${config.get('SITE_HOST')}`,
      }),
    }),
  ],
})
export class AppModule {}
```
