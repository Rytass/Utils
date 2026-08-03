import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { Repository } from 'typeorm';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { MemberBaseOidcModelsModule } from './models/oidc-models.module';
import { OidcPayloadEntity, OidcPayloadRepo } from './models/oidc-payload.entity';
import { OidcClientEntity, OidcClientRepo } from './models/oidc-client.entity';
import { createOidcAdapterFactory } from './oidc-adapter';
import { assertOidcProviderInstalled, createOidcProvider, type FindAccountFn } from './oidc.factory';
import { MEMBER_BASE_OIDC_OPTIONS, OIDC_PROVIDER_INSTANCE, OIDC_ROUTE_PREFIX } from './oidc.tokens';
import { OidcInteractionsController } from './interactions.controller';
import { OidcClientService } from './oidc-client.service';
import { OidcSsoBridge } from './sso-bridge.service';
import { OidcMaintenanceService } from './oidc-maintenance.service';
import { MemberBaseService } from '../services/member-base.service';
import type {
  MemberBaseOidcProviderAsyncOptions,
  MemberBaseOidcProviderOptions,
  MemberBaseOidcProviderOptionsFactory,
} from './oidc-provider.options';

const DEFAULT_SCOPES = ['openid', 'offline_access', 'profile', 'email'];

const DEFAULT_SCOPE_CLAIMS: Record<string, string[]> = {
  openid: ['sub'],
  profile: ['preferred_username', 'name'],
  email: ['email'],
};

const DEFAULT_TTL: Record<string, number> = {
  AccessToken: 3600,
  AuthorizationCode: 600,
  IdToken: 3600,
  RefreshToken: 14 * 24 * 3600,
  Interaction: 3600,
  Session: 14 * 24 * 3600,
  Grant: 14 * 24 * 3600,
};

/**
 * Development-only signing key.
 *
 * Regenerated on every boot, so any token issued before a restart stops
 * verifying, and two instances would sign with different keys. Loud on purpose.
 */
const generateEphemeralJwks = (): { keys: Record<string, unknown>[] } => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

  console.warn(
    '[MemberBase] No jwks was supplied to MemberBaseOidcProviderModule, so an ephemeral signing key was generated. ' +
      'Every restart invalidates previously issued tokens and multiple instances will sign with different keys. ' +
      'Supply a persistent jwks before running this anywhere but development.',
  );

  return { keys: [privateKey.export({ format: 'jwk' }) as Record<string, unknown>] };
};

const providerFactory: Provider = {
  provide: OIDC_PROVIDER_INSTANCE,
  useFactory: async (
    options: MemberBaseOidcProviderOptions,
    payloadRepo: Repository<OidcPayloadEntity>,
    clientRepo: Repository<OidcClientEntity>,
    memberBaseService: MemberBaseService,
  ) => {
    await assertOidcProviderInstalled();

    const findAccount: FindAccountFn = async (_ctx, sub) => {
      const member = await memberBaseService.findById(sub);

      if (!member || member.deletedAt) return undefined;

      return {
        accountId: sub,
        claims: async (): Promise<Record<string, unknown>> => ({
          sub,
          preferred_username: member.account,
          // No roles are published. This issuer answers "who is this subject";
          // what the subject may do is each service provider's decision, made
          // against data it controls rather than a claim frozen into a token.
          ...(await options.claims?.extra?.(member)),
        }),
      };
    };

    return createOidcProvider({
      issuer: options.issuer,
      adapter: createOidcAdapterFactory(payloadRepo, clientRepo, options.clients?.secretCipher),
      findAccount,
      jwks: options.jwks ?? generateEphemeralJwks(),
      cookieKeys: options.cookieKeys ?? [randomBytes(32).toString('hex')],
      routePrefix: options.routePrefix ?? 'oidc',
      scopes: [...DEFAULT_SCOPES, ...(options.claims?.additionalScopes ?? [])],
      claims: { ...DEFAULT_SCOPE_CLAIMS, ...options.claims?.scopeClaims },
      ttl: { ...DEFAULT_TTL, ...options.ttl },
      features: options.features,
      requirePkce: options.requirePkce,
      proxy: options.proxy,
      clientBasedCors: options.clientBasedCors,
      advanced: options.advanced,
    });
  },
  inject: [MEMBER_BASE_OIDC_OPTIONS, OidcPayloadRepo, OidcClientRepo, MemberBaseService],
};

const routePrefixProvider: Provider = {
  provide: OIDC_ROUTE_PREFIX,
  useFactory: (options: MemberBaseOidcProviderOptions): string => options.routePrefix ?? 'oidc',
  inject: [MEMBER_BASE_OIDC_OPTIONS],
};

const sharedProviders = [
  providerFactory,
  routePrefixProvider,
  OidcSsoBridge,
  OidcMaintenanceService,
  OidcClientService,
];

const sharedExports = [
  OIDC_PROVIDER_INSTANCE,
  OIDC_ROUTE_PREFIX,
  MEMBER_BASE_OIDC_OPTIONS,
  OidcSsoBridge,
  OidcClientService,
];

// Only the interaction routes are registered. Client administration is exported
// as OidcClientService instead, so the host application decides whether it is
// reachable at all, over which transport, and behind which permission.
const controllers = [OidcInteractionsController];

/**
 * Turns the host application into an OpenID Connect provider.
 *
 * Importing this module is the entire opt-in: without it neither the
 * oidc-provider dependency nor the two tables exist. The protocol endpoints
 * still have to be mounted from main.ts — see mountMemberBaseOidcProvider,
 * which explains why they cannot be a controller.
 */
@Module({})
export class MemberBaseOidcProviderModule {
  static forRoot(options: MemberBaseOidcProviderOptions): DynamicModule {
    return {
      module: MemberBaseOidcProviderModule,
      imports: [MemberBaseOidcModelsModule],
      providers: [{ provide: MEMBER_BASE_OIDC_OPTIONS, useValue: options }, ...sharedProviders],
      controllers,
      exports: sharedExports,
    };
  }

  static forRootAsync(options: MemberBaseOidcProviderAsyncOptions): DynamicModule {
    return {
      module: MemberBaseOidcProviderModule,
      imports: [...(options.imports ?? []), MemberBaseOidcModelsModule],
      providers: [...this.createAsyncProviders(options), ...sharedProviders],
      controllers,
      exports: sharedExports,
    };
  }

  private static createAsyncProviders(options: MemberBaseOidcProviderAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: MEMBER_BASE_OIDC_OPTIONS,
          useFactory: options.useFactory,
          inject: (options.inject ?? []) as never[],
        },
      ];
    }

    const factoryType = (options.useExisting ?? options.useClass) as Type<MemberBaseOidcProviderOptionsFactory>;

    return [
      {
        provide: MEMBER_BASE_OIDC_OPTIONS,
        useFactory: (factory: MemberBaseOidcProviderOptionsFactory) => factory.createOidcProviderOptions(),
        inject: [factoryType],
      },
      ...(options.useClass ? [{ provide: options.useClass, useClass: options.useClass }] : []),
    ];
  }
}
