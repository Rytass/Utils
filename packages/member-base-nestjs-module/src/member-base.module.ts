import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { MemberBaseModelsModule } from './models/models.module';
import { MemberBaseService } from './services/member-base.service';
import { MemberBaseAdminService } from './services/member-base-admin.service';
import { ResolvedRepoProviders } from './constants/resolved-repo-providers';
import {
  ACCESS_TOKEN_SECRET,
  CASBIN_ENFORCER,
  ENABLE_GLOBAL_GUARD,
  MEMBER_BASE_MODULE_OPTIONS,
  RESOLVED_MEMBER_REPO,
} from './typings/member-base.tokens';
import { APP_GUARD } from '@nestjs/core';
import { MemberBaseModuleAsyncOptionsDTO } from './typings/member-base-module-async-options';
import { OptionProviders } from './constants/option-providers';
import { CasbinGuard } from './guards/casbin.guard';
import { MemberBaseModuleOptionsDTO } from './typings/member-base-module-options.dto';
import { MemberBaseModuleOptionFactoryInterface } from './typings/member-base-module-option-factory';
import { PasswordValidatorService } from './services/password-validator.service';
import { OAuthService } from './services/oauth.service';
import { OAuthCallbacksController } from './controllers/oauth-callbacks.controller';
import { BaseMemberEntity } from './models/base-member.entity';

const providers = [
  ...OptionProviders,
  ...ResolvedRepoProviders,
  PasswordValidatorService,
  MemberBaseService,
  MemberBaseAdminService,
  OAuthService,
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
  CASBIN_ENFORCER,
  ACCESS_TOKEN_SECRET,
  ENABLE_GLOBAL_GUARD,
  RESOLVED_MEMBER_REPO,
];

const controllers = [OAuthCallbacksController];

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
      providers: [...this.createAsyncProvider(options), ...providers],
      controllers,
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
        ...providers,
      ],
      controllers,
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
