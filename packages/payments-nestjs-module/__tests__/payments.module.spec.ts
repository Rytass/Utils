import { Test, TestingModule } from '@nestjs/testing';
import { Module, Injectable } from '@nestjs/common';
import { PaymentsModule } from '../src/payments.module';
import { PAYMENTS_MODULE_OPTIONS, PAYMENTS_GATEWAY } from '../src/typings/symbol';
import { PaymentsModuleOptionFactory } from '../src/typings/payments-option-factory';
import { PaymentsModuleOptionsDto } from '../src/typings/payments-module-options.dto';
import { PaymentGateway } from '@rytass/payments';

describe('PaymentsModule', () => {
  const mockGateway: PaymentGateway = {
    prepare: jest.fn(),
    query: jest.fn(),
  } as unknown as PaymentGateway;

  describe('forRoot', () => {
    it('should provide PAYMENTS_MODULE_OPTIONS with given options', async () => {
      const options: PaymentsModuleOptionsDto = {
        paymentGateway: mockGateway,
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [PaymentsModule.forRoot(options)],
      }).compile();

      const moduleOptions = module.get(PAYMENTS_MODULE_OPTIONS);

      expect(moduleOptions).toBeDefined();
      expect(moduleOptions.paymentGateway).toBe(mockGateway);
    });

    it('should provide PAYMENTS_GATEWAY from options', async () => {
      const options: PaymentsModuleOptionsDto = {
        paymentGateway: mockGateway,
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [PaymentsModule.forRoot(options)],
      }).compile();

      const gateway = module.get(PAYMENTS_GATEWAY);

      expect(gateway).toBe(mockGateway);
    });
  });

  describe('forRootAsync', () => {
    it('should work with useFactory', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          PaymentsModule.forRootAsync({
            useFactory: () => ({
              paymentGateway: mockGateway,
            }),
          }),
        ],
      }).compile();

      const moduleOptions = module.get(PAYMENTS_MODULE_OPTIONS);

      expect(moduleOptions).toBeDefined();
      expect(moduleOptions.paymentGateway).toBe(mockGateway);
    });

    it('should work with async useFactory', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          PaymentsModule.forRootAsync({
            useFactory: async () => ({
              paymentGateway: mockGateway,
            }),
          }),
        ],
      }).compile();

      const moduleOptions = module.get(PAYMENTS_MODULE_OPTIONS);

      expect(moduleOptions).toBeDefined();
      expect(moduleOptions.paymentGateway).toBe(mockGateway);
    });

    it('should work with useFactory and inject', async () => {
      const CONFIG_TOKEN = 'CONFIG_TOKEN';

      @Module({
        providers: [
          {
            provide: CONFIG_TOKEN,
            useValue: { gateway: mockGateway },
          },
        ],
        exports: [CONFIG_TOKEN],
      })
      class ConfigModule {}

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule,
          PaymentsModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (config: { gateway: PaymentGateway }) => ({
              paymentGateway: config.gateway,
            }),
            inject: [CONFIG_TOKEN],
          }),
        ],
      }).compile();

      const moduleOptions = module.get(PAYMENTS_MODULE_OPTIONS);

      expect(moduleOptions).toBeDefined();
      expect(moduleOptions.paymentGateway).toBe(mockGateway);
    });

    it('should work with useClass', async () => {
      @Injectable()
      class TestPaymentsModuleOptionFactory implements PaymentsModuleOptionFactory {
        createPaymentsOptions(): PaymentsModuleOptionsDto {
          return {
            paymentGateway: mockGateway,
          };
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          PaymentsModule.forRootAsync({
            useClass: TestPaymentsModuleOptionFactory,
          }),
        ],
      }).compile();

      const moduleOptions = module.get(PAYMENTS_MODULE_OPTIONS);

      expect(moduleOptions).toBeDefined();
      expect(moduleOptions.paymentGateway).toBe(mockGateway);
    });

    it('should work with async useClass', async () => {
      @Injectable()
      class TestPaymentsModuleOptionFactory implements PaymentsModuleOptionFactory {
        async createPaymentsOptions(): Promise<PaymentsModuleOptionsDto> {
          return {
            paymentGateway: mockGateway,
          };
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          PaymentsModule.forRootAsync({
            useClass: TestPaymentsModuleOptionFactory,
          }),
        ],
      }).compile();

      const moduleOptions = module.get(PAYMENTS_MODULE_OPTIONS);

      expect(moduleOptions).toBeDefined();
      expect(moduleOptions.paymentGateway).toBe(mockGateway);
    });

    it('should work with useExisting', async () => {
      @Injectable()
      class TestPaymentsModuleOptionFactory implements PaymentsModuleOptionFactory {
        createPaymentsOptions(): PaymentsModuleOptionsDto {
          return {
            paymentGateway: mockGateway,
          };
        }
      }

      @Module({
        providers: [TestPaymentsModuleOptionFactory],
        exports: [TestPaymentsModuleOptionFactory],
      })
      class FactoryModule {}

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          FactoryModule,
          PaymentsModule.forRootAsync({
            imports: [FactoryModule],
            useExisting: TestPaymentsModuleOptionFactory,
          }),
        ],
      }).compile();

      const moduleOptions = module.get(PAYMENTS_MODULE_OPTIONS);

      expect(moduleOptions).toBeDefined();
      expect(moduleOptions.paymentGateway).toBe(mockGateway);
    });

    it('should handle empty imports', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          PaymentsModule.forRootAsync({
            useFactory: () => ({
              paymentGateway: mockGateway,
            }),
          }),
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should handle imports array', async () => {
      @Module({})
      class EmptyModule {}

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          PaymentsModule.forRootAsync({
            imports: [EmptyModule],
            useFactory: () => ({
              paymentGateway: mockGateway,
            }),
          }),
        ],
      }).compile();

      expect(module).toBeDefined();
    });

    it('should handle async options without useClass, useFactory, or useExisting', async () => {
      // This tests the false branch of options.useClass in createAsyncProvider
      // when options.useExisting and options.useFactory are also not provided
      // DefaultOptionsFactory is defined for reference but intentionally not used
      // to test the else branch when no factory is provided
      @Injectable()
      class _DefaultOptionsFactory implements PaymentsModuleOptionFactory {
        createPaymentsOptions(): PaymentsModuleOptionsDto {
          return {
            paymentGateway: mockGateway,
          };
        }
      }

      // Manually create the module with minimal options
      // This will trigger the else branch at line 41
      const dynamicModule = PaymentsModule.forRootAsync({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // Verify the module structure is created correctly
      expect(dynamicModule).toBeDefined();
      expect(dynamicModule.module).toBe(PaymentsModule);
      expect(dynamicModule.providers).toBeDefined();
    });
  });
});
