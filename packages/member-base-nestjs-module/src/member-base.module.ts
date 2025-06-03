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
} from './typings/member-base-providers';
import { APP_GUARD } from '@nestjs/core';
import { MemberBaseModuleAsyncOptionsDto } from './typings/member-base-module-async-options';
import { OptionProviders } from './constants/option-providers';
import { CasbinGuard } from './guards/casbin.guard';
import { MemberBaseModuleOptionsDto } from './typings/member-base-module-options.dto';
import { MemberBaseModuleOptionFactory } from './typings/member-base-module-option-factory';
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

const exports = [
  PasswordValidatorService,
  MemberBaseModelsModule,
  MemberBaseService,
  MemberBaseAdminService,
  OAuthService,
  CASBIN_ENFORCER,
  ACCESS_TOKEN_SECRET,
  ENABLE_GLOBAL_GUARD,
];

const controllers = [OAuthCallbacksController];

@Global()
@Module({})
export class MemberBaseModule {
  static forRootAsync<T extends BaseMemberEntity = BaseMemberEntity>(
    options: MemberBaseModuleAsyncOptionsDto<T>,
  ): DynamicModule {
    return {
      module: MemberBaseModule,
      imports: [...(options?.imports ?? []), MemberBaseModelsModule],
      providers: [...this.createAsyncProvider(options), ...providers],
      controllers,
      exports,
    };
  }

  static forRoot<T extends BaseMemberEntity = BaseMemberEntity>(
    options?: MemberBaseModuleOptionsDto<T>,
  ): DynamicModule {
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
      exports,
    };
  }

  private static createAsyncProvider<
    T extends BaseMemberEntity = BaseMemberEntity,
  >(options: MemberBaseModuleAsyncOptionsDto<T>): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider<T>(options)];
    }

    return [
      this.createAsyncOptionsProvider<T>(options),
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
    T extends BaseMemberEntity = BaseMemberEntity,
  >(options: MemberBaseModuleAsyncOptionsDto<T>): Provider {
    if (options.useFactory) {
      return {
        provide: MEMBER_BASE_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: MEMBER_BASE_MODULE_OPTIONS,
      useFactory: async (optionsFactory: MemberBaseModuleOptionFactory<T>) =>
        await optionsFactory.createMemberOptions(),
      inject: [
        (options.useExisting || options.useClass) as Type<
          MemberBaseModuleOptionFactory<T>
        >,
      ],
    };
  }
}
