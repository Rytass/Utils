import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import { PaymentsModuleAsyncOptionsDto } from './typings/payments-module-async-options.dto';
import { PAYMENTS_MODULE_OPTIONS } from './typings/symbol';
import { PaymentsModuleOptionFactory } from './typings/payments-option-factory';
import { PaymentsModuleOptionsDto } from './typings/payments-module-options.dto';
import { OptionsProviders } from './typings/options.provider';

@Global()
@Module({})
export class PaymentsModule {
  static forRootAsync(options: PaymentsModuleAsyncOptionsDto): DynamicModule {
    return {
      module: PaymentsModule,
      imports: options?.imports ?? [],
      providers: [...this.createAsyncProvider(options), ...OptionsProviders],
      exports: [],
    };
  }

  static forRoot(options: PaymentsModuleOptionsDto): DynamicModule {
    return {
      module: PaymentsModule,
      providers: [
        {
          provide: PAYMENTS_MODULE_OPTIONS,
          useValue: options,
        },
        ...OptionsProviders,
      ],
      exports: [],
    };
  }

  private static createAsyncProvider(options: PaymentsModuleAsyncOptionsDto): Provider[] {
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

  private static createAsyncOptionsProvider(options: PaymentsModuleAsyncOptionsDto): Provider {
    if (options.useFactory) {
      return {
        provide: PAYMENTS_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject || [],
      };
    }

    return {
      provide: PAYMENTS_MODULE_OPTIONS,
      useFactory: async (optionsFactory: PaymentsModuleOptionFactory) => await optionsFactory.createPaymentsOptions(),
      inject: [(options.useExisting || options.useClass) as Type<PaymentsModuleOptionFactory>],
    };
  }
}
