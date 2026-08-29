import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { MemberBaseModelsModule } from './models/models.module';
import { MemberBaseService } from './services/member-base.service';
import { MemberBaseAdminService } from './services/member-base-admin.service';
import { ResolvedRepoProviders } from './constants/resolved-repo-providers';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  COOKIE_OPTIONS,
  ACCESS_TOKEN_EXPIRATION,
  ACCESS_TOKEN_SECRET,
  AUTH_PROVIDERS,
  CASBIN_ENFORCER,
  CASBIN_PERMISSION_CHECKER,
  COOKIE_MODE,
  CUSTOMIZED_JWT_PAYLOAD,
  ENABLE_GLOBAL_GUARD,
  MEMBER_BASE_MODULE_OPTIONS,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_EXPIRATION,
  REFRESH_TOKEN_SECRET,
  RESOLVED_MEMBER_REPO,
  REDIRECT_AUTH_OPTIONS,
  REDIRECT_AUTH_MOUNTED_PREFIX,
} from './typings/member-base.tokens';
import { APP_GUARD } from '@nestjs/core';
import { MemberBaseModuleAsyncOptionsDTO } from './typings/member-base-module-async-options';
import { OptionProviders } from './constants/option-providers';
import { CasbinGuard } from './guards/casbin.guard';
import { MemberBaseModuleOptionsDTO } from './typings/member-base-module-options.dto';
import { MemberBaseModuleOptionFactoryInterface } from './typings/member-base-module-option-factory';
import { PasswordValidatorService } from './services/password-validator.service';
import { DefaultAdminBootstrapService } from './services/default-admin-bootstrap.service';
import { OAuthService } from './services/oauth.service';
import { OAuthCallbacksController } from './controllers/oauth-callbacks.controller';
import { BaseMemberEntity } from './models/base-member.entity';
import { AuthenticationGateway } from './services/authentication-gateway.service';
import { PasswordAuthProvider } from './providers/password-auth.provider';
import { createRedirectAuthController } from './controllers/redirect-auth.controller';
import { DEFAULT_REDIRECT_AUTH_ROUTE_PREFIX } from './typings/redirect-auth.options';
import type { Controller } from '@nestjs/common/interfaces';

const providers = [
  ...OptionProviders,
  ...ResolvedRepoProviders,
  PasswordValidatorService,
  MemberBaseService,
  MemberBaseAdminService,
  DefaultAdminBootstrapService,
  OAuthService,
  PasswordAuthProvider,
  AuthenticationGateway,
  {
    provide: APP_GUARD,
    useClass: CasbinGuard,
  },
];

const exportInjectable = [
  PasswordValidatorService,
  MemberBaseModelsModule,
  MemberBaseService,
  MemberBaseAdminService,
  OAuthService,
  AuthenticationGateway,
  PasswordAuthProvider,
  AUTH_PROVIDERS,
  CASBIN_ENFORCER,
  ACCESS_TOKEN_SECRET,
  ENABLE_GLOBAL_GUARD,
  RESOLVED_MEMBER_REPO,
  // Exported so modules layered on top of member-base (an OIDC provider
  // endpoint bridging its own session with the member-base one, for instance)
  // can read the same token and cookie configuration instead of duplicating it.
  MEMBER_BASE_MODULE_OPTIONS,
  ACCESS_TOKEN_EXPIRATION,
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRATION,
  COOKIE_MODE,
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  COOKIE_OPTIONS,
  CASBIN_PERMISSION_CHECKER,
  CUSTOMIZED_JWT_PAYLOAD,
  REDIRECT_AUTH_OPTIONS,
];

const controllers = [OAuthCallbacksController];

/**
 * Controllers for one configuration.
 *
 * The redirect login routes are absent unless asked for. Registering them by
 * default would put two public endpoints on every application that imports this
 * module, which is the mistake `OidcAdminController` made and 0.8.0 corrected.
 */
const resolveControllers = (routePrefix: string | null): Type<Controller>[] =>
  routePrefix === null ? controllers : [...controllers, createRedirectAuthController(routePrefix)];

/**
 * `undefined` means "not configured"; `null` from here means "do not mount".
 *
 * An empty or slash-only prefix is refused rather than defaulted. It would
 * mount `GET /:channel/start` and `GET /:channel/callback` at the application
 * root — two greedy two-segment routes that work well enough for nobody to
 * notice they are swallowing other paths. Defaulting silently would move the
 * routes somewhere the application did not ask for; failing at boot names the
 * mistake while there is still someone reading.
 */
const mountPrefix = (redirectAuth: boolean | { routePrefix?: string } | undefined): string | null => {
  if (!redirectAuth) return null;

  const configured = typeof redirectAuth === 'object' ? redirectAuth.routePrefix : undefined;

  if (configured === undefined) return DEFAULT_REDIRECT_AUTH_ROUTE_PREFIX;

  const trimmed = configured
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .trim();

  // A dot-only segment is refused alongside the empty one: `.` and `..` are
  // path navigation, not a mount point, and they reach the same place — routes
  // at or above the application root — by a different spelling.
  if (!trimmed || /^\.+$/.test(trimmed)) {
    throw new Error(
      `[MemberBase] redirectAuth.routePrefix ${JSON.stringify(configured)} is not a usable path segment. Empty, ` +
        'whitespace, "/" and dot segments all mount GET /:channel/start and GET /:channel/callback at or above the ' +
        'application root, where two greedy two-segment routes shadow other paths. Give it a path segment, or omit ' +
        `it to use "${DEFAULT_REDIRECT_AUTH_ROUTE_PREFIX}".`,
    );
  }

  return trimmed;
};

@Global()
@Module({})
export class MemberBaseModule {
  static forRootAsync<
    MemberEntity extends BaseMemberEntity = BaseMemberEntity,
    TokenPayload extends {
      id: string;
      account?: string;
      domain?: string;
    } = Pick<MemberEntity, 'id' | 'account'> & {
      domain?: string;
    },
  >(options: MemberBaseModuleAsyncOptionsDTO<MemberEntity, TokenPayload>): DynamicModule {
    return {
      module: MemberBaseModule,
      imports: [...(options?.imports ?? []), MemberBaseModelsModule],
      providers: [
        { provide: REDIRECT_AUTH_MOUNTED_PREFIX, useValue: mountPrefix(options?.redirectAuth) },
        ...this.createAsyncProvider(options),
        ...providers,
      ],
      controllers: resolveControllers(mountPrefix(options?.redirectAuth)),
      exports: exportInjectable,
    };
  }

  static forRoot<
    MemberEntity extends BaseMemberEntity = BaseMemberEntity,
    TokenPayload extends {
      id: string;
      account?: string;
      domain?: string;
    } = Pick<MemberEntity, 'id' | 'account'> & {
      domain?: string;
    },
  >(options?: MemberBaseModuleOptionsDTO<MemberEntity, TokenPayload>): DynamicModule {
    return {
      module: MemberBaseModule,
      imports: [MemberBaseModelsModule],
      providers: [
        {
          provide: MEMBER_BASE_MODULE_OPTIONS,
          useValue: options,
        },
        { provide: REDIRECT_AUTH_MOUNTED_PREFIX, useValue: mountPrefix(options?.redirectAuth) },
        ...providers,
      ],
      controllers: resolveControllers(mountPrefix(options?.redirectAuth)),
      exports: exportInjectable,
    };
  }

  private static createAsyncProvider<
    MemberEntity extends BaseMemberEntity = BaseMemberEntity,
    TokenPayload extends {
      id: string;
      account?: string;
      domain?: string;
    } = Pick<MemberEntity, 'id' | 'account'> & {
      domain?: string;
    },
  >(options: MemberBaseModuleAsyncOptionsDTO<MemberEntity, TokenPayload>): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider<MemberEntity, TokenPayload>(options)];
    }

    return [
      this.createAsyncOptionsProvider<MemberEntity, TokenPayload>(options),
      ...(options.useClass
        ? [
            {
              provide: options.useClass,
              useClass: options.useClass,
            },
          ]
        : []),
    ];
  }

  private static createAsyncOptionsProvider<
    MemberEntity extends BaseMemberEntity = BaseMemberEntity,
    TokenPayload extends {
      id: string;
      account?: string;
      domain?: string;
    } = Pick<MemberEntity, 'id' | 'account'> & {
      domain?: string;
    },
  >(options: MemberBaseModuleAsyncOptionsDTO<MemberEntity, TokenPayload>): Provider {
    if (options.useFactory) {
      return {
        provide: MEMBER_BASE_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: MEMBER_BASE_MODULE_OPTIONS,
      useFactory: async (optionsFactory: MemberBaseModuleOptionFactoryInterface<MemberEntity, TokenPayload>) =>
        await optionsFactory.createMemberOptions(),
      inject: [
        (options.useExisting || options.useClass) as Type<
          MemberBaseModuleOptionFactoryInterface<MemberEntity, TokenPayload>
        >,
      ],
    };
  }
}
