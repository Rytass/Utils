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

@Module({})
export class MemberBaseModule {
  static forRootAsync(options: MemberBaseModuleAsyncOptionsDto): DynamicModule {
    return {
      module: MemberBaseModule,
      imports: [...(options?.imports ?? []), MemberBaseModelsModule],
      providers: [
        ...this.createAsyncProvider(options),
        ...OptionProviders,
        ...ResolvedRepoProviders,
        MemberBaseService,
        MemberBaseAdminService,
        {
          provide: APP_GUARD,
          useClass: CasbinGuard,
        },
      ],
      exports: [
        MemberBaseModelsModule,
        MemberBaseService,
        MemberBaseAdminService,
        CASBIN_ENFORCER,
        ACCESS_TOKEN_SECRET,
        ENABLE_GLOBAL_GUARD,
      ],
    };
  }

  static forRoot(options?: MemberBaseModuleOptionsDto): DynamicModule {
    return {
      module: MemberBaseModule,
      imports: [MemberBaseModelsModule],
      providers: [
        {
          provide: MEMBER_BASE_MODULE_OPTIONS,
          useValue: options,
        },
        ...OptionProviders,
        ...ResolvedRepoProviders,
        MemberBaseService,
        MemberBaseAdminService,
        {
          provide: APP_GUARD,
          useClass: CasbinGuard,
        },
      ],
      exports: [
        MemberBaseModelsModule,
        MemberBaseService,
        MemberBaseAdminService,
        CASBIN_ENFORCER,
        ACCESS_TOKEN_SECRET,
        ENABLE_GLOBAL_GUARD,
      ],
    };
  }

  private static createAsyncProvider(
    options: MemberBaseModuleAsyncOptionsDto,
  ): Provider[] {
    if (options.useExisting || options.useFactory) {
      return [this.createAsyncOptionsProvider(options)];
    }

    return [
      this.createAsyncOptionsProvider(options),
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

  private static createAsyncOptionsProvider(
    options: MemberBaseModuleAsyncOptionsDto,
  ): Provider {
    if (options.useFactory) {
      return {
        provide: MEMBER_BASE_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: MEMBER_BASE_MODULE_OPTIONS,
      useFactory: async (optionsFactory: MemberBaseModuleOptionFactory) =>
        await optionsFactory.createMemberOptions(),
      inject: [
        (options.useExisting ||
          options.useClass) as Type<MemberBaseModuleOptionFactory>,
      ],
    };
  }
}
