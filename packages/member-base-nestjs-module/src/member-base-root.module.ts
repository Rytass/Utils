import { MemberBaseRootModuleOptionsDto } from './typings/member-base-root-module-options.dto';
import { MemberBaseModule } from './member-base.module';
import { MemberBaseRootModuleAsyncOptionsDto } from './typings/member-base-root-module-async-options';
import { OptionProviders } from './constants/option-providers';
import { DynamicModule, Provider, Type } from '@nestjs/common';
import { MEMBER_BASE_MODULE_OPTIONS } from './typings/member-base-providers';
import { MemberBaseRootModuleOptionFactory } from './typings/member-base-root-module-option-factory';
import { APP_GUARD } from '@nestjs/core';
import { CasbinGuard } from './guards/casbin.guard';

export class MemberBaseRootModule {
  static forRootAsync(
    options: MemberBaseRootModuleAsyncOptionsDto,
  ): DynamicModule {
    return {
      module: MemberBaseModule,
      imports: options?.imports ?? [],
      providers: [
        ...this.createAsyncProvider(options),
        ...OptionProviders,
        {
          provide: APP_GUARD,
          useClass: CasbinGuard,
        },
      ],
    };
  }

  static forRoot(options?: MemberBaseRootModuleOptionsDto): DynamicModule {
    return {
      module: MemberBaseModule,
      providers: [
        {
          provide: MEMBER_BASE_MODULE_OPTIONS,
          useValue: options,
        },
        ...OptionProviders,
        {
          provide: APP_GUARD,
          useClass: CasbinGuard,
        },
      ],
    };
  }

  private static createAsyncProvider(
    options: MemberBaseRootModuleAsyncOptionsDto,
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
    options: MemberBaseRootModuleAsyncOptionsDto,
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
      useFactory: async (optionsFactory: MemberBaseRootModuleOptionFactory) =>
        await optionsFactory.createMemberOptions(),
      inject: [
        (options.useExisting ||
          options.useClass) as Type<MemberBaseRootModuleOptionFactory>,
      ],
    };
  }
}
