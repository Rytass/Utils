import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, Module } from '@nestjs/common';
import { WMSBaseModule } from '../src/wms-base.module';
import { WMSBaseModuleOptionsFactory, WMSBaseModuleOptions } from '../src/typings/wms-base-module-options.interface';
import { WMS_MODULE_OPTIONS } from '../src/typings/wms-base-module-providers';
import { LocationService } from '../src/services/location.service';
import { MaterialService } from '../src/services/material.service';
import { OrderService } from '../src/services/order.service';
import { StockService } from '../src/services/stock.service';
import { WarehouseMapService } from '../src/services/warehouse-map.service';
import { LocationEntity } from '../src/models/location.entity';
import { MaterialEntity } from '../src/models/material.entity';
import { StockEntity } from '../src/models/stock.entity';
import { OrderEntity } from '../src/models/order.entity';
import { BatchEntity } from '../src/models/batch.entity';

jest.mock('../src/models/warehouse-map.entity', () => ({
  WarehouseMapEntity: class MockWarehouseMapEntity {},
  WarehouseMapRepo: Symbol('MockWarehouseMapRepo'),
}));

@Injectable()
class MockOptionsFactory implements WMSBaseModuleOptionsFactory {
  createWMSBaseModuleOptions(): WMSBaseModuleOptions {
    return {
      allowNegativeStock: true,
      materialEntity: MaterialEntity,
      locationEntity: LocationEntity,
    };
  }
}

@Injectable()
class ExistingOptionsService implements WMSBaseModuleOptionsFactory {
  createWMSBaseModuleOptions(): WMSBaseModuleOptions {
    return {
      allowNegativeStock: false,
      materialEntity: MaterialEntity,
      locationEntity: LocationEntity,
    };
  }
}

@Injectable()
class MockDependency {
  getValue(): string {
    return 'injected-value';
  }
}

@Module({
  providers: [MockDependency],
  exports: [MockDependency],
})
class MockDependencyModule {}

@Module({
  providers: [ExistingOptionsService],
  exports: [ExistingOptionsService],
})
class ExistingOptionsModule {}

describe('WMSBaseModule', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('forRoot', () => {
    it('should create module with static configuration', async () => {
      const options: WMSBaseModuleOptions = {
        allowNegativeStock: false,
        materialEntity: MaterialEntity,
        locationEntity: LocationEntity,
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
          WMSBaseModule.forRoot(options),
        ],
      }).compile();

      // Verify the module options are provided correctly
      const moduleOptions = module.get(WMS_MODULE_OPTIONS);

      expect(moduleOptions).toEqual(options);

      // Verify all services are available
      expect(module.get(LocationService)).toBeInstanceOf(LocationService);
      expect(module.get(MaterialService)).toBeInstanceOf(MaterialService);
      expect(module.get(StockService)).toBeInstanceOf(StockService);
      expect(module.get(OrderService)).toBeInstanceOf(OrderService);
      expect(module.get(WarehouseMapService)).toBeInstanceOf(WarehouseMapService);

      await module.close();
    });

    it('should create module with different options', async () => {
      const options: WMSBaseModuleOptions = {
        allowNegativeStock: true,
        materialEntity: MaterialEntity,
        locationEntity: LocationEntity,
      };

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
          WMSBaseModule.forRoot(options),
        ],
      }).compile();

      const moduleOptions = module.get(WMS_MODULE_OPTIONS);

      expect(moduleOptions).toEqual(options);
      expect(moduleOptions.allowNegativeStock).toBe(true);

      await module.close();
    });
  });

  describe('forRootAsync', () => {
    it('should create module with useFactory configuration', async () => {
      const factoryFunction = jest.fn().mockReturnValue({
        allowNegativeStock: true,
        materialEntity: MaterialEntity,
        locationEntity: LocationEntity,
      });

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
          WMSBaseModule.forRootAsync({
            useFactory: factoryFunction,
          }),
        ],
      }).compile();

      // Verify factory was called
      expect(factoryFunction).toHaveBeenCalled();

      // Verify the module options are provided correctly
      const moduleOptions = module.get(WMS_MODULE_OPTIONS);

      expect(moduleOptions.allowNegativeStock).toBe(true);

      // Verify all services are available
      expect(module.get(LocationService)).toBeInstanceOf(LocationService);
      expect(module.get(MaterialService)).toBeInstanceOf(MaterialService);
      expect(module.get(StockService)).toBeInstanceOf(StockService);
      expect(module.get(OrderService)).toBeInstanceOf(OrderService);
      expect(module.get(WarehouseMapService)).toBeInstanceOf(WarehouseMapService);

      await module.close();
    });

    it('should create module with useFactory and inject dependencies', async () => {
      const factoryFunction = jest.fn((dep: MockDependency) => ({
        allowNegativeStock: dep.getValue() === 'injected-value',
        materialEntity: MaterialEntity,
        locationEntity: LocationEntity,
      }));

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
          WMSBaseModule.forRootAsync({
            imports: [MockDependencyModule],
            useFactory: factoryFunction,
            inject: [MockDependency],
          }),
        ],
      }).compile();

      // Verify factory was called with injected dependency
      expect(factoryFunction).toHaveBeenCalled();
      const moduleOptions = module.get(WMS_MODULE_OPTIONS);

      expect(moduleOptions.allowNegativeStock).toBe(true);

      await module.close();
    });

    it('should create module with useClass configuration', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
          WMSBaseModule.forRootAsync({
            useClass: MockOptionsFactory,
          }),
        ],
      }).compile();

      const moduleOptions = module.get(WMS_MODULE_OPTIONS);

      expect(moduleOptions.allowNegativeStock).toBe(true);
      expect(moduleOptions.materialEntity).toBe(MaterialEntity);

      // Verify the factory class was instantiated and used
      expect(module.get(MockOptionsFactory)).toBeInstanceOf(MockOptionsFactory);

      await module.close();
    });

    it('should create module with useClass configuration and verify provider registration', async () => {
      // Create a different factory to test the useClass provider creation branch
      @Injectable()
      class TestOptionsFactory implements WMSBaseModuleOptionsFactory {
        createWMSBaseModuleOptions(): WMSBaseModuleOptions {
          return {
            allowNegativeStock: false,
            materialEntity: MaterialEntity,
            locationEntity: LocationEntity,
          };
        }
      }

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
          WMSBaseModule.forRootAsync({
            useClass: TestOptionsFactory,
          }),
        ],
      }).compile();

      // Verify module options are correct
      const moduleOptions = module.get(WMS_MODULE_OPTIONS);

      expect(moduleOptions.allowNegativeStock).toBe(false);
      expect(moduleOptions.materialEntity).toBe(MaterialEntity);
      expect(moduleOptions.locationEntity).toBe(LocationEntity);

      // Verify the useClass provider was registered correctly (this tests line 52-59)
      const factoryInstance = module.get(TestOptionsFactory);

      expect(factoryInstance).toBeInstanceOf(TestOptionsFactory);
      expect(factoryInstance.createWMSBaseModuleOptions()).toEqual({
        allowNegativeStock: false,
        materialEntity: MaterialEntity,
        locationEntity: LocationEntity,
      });

      await module.close();
    });

    it('should handle forRootAsync without useClass (covering empty options.useClass branch)', async () => {
      // Test the case where useClass is undefined, testing the false branch of the ternary operator on line 52
      const factoryFunction = jest.fn().mockReturnValue({
        allowNegativeStock: true,
        materialEntity: MaterialEntity,
        locationEntity: LocationEntity,
      });

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
          WMSBaseModule.forRootAsync({
            useFactory: factoryFunction,
            // NOTE: No useClass provided - this tests the false branch
          }),
        ],
      }).compile();

      expect(factoryFunction).toHaveBeenCalled();

      const moduleOptions = module.get(WMS_MODULE_OPTIONS);

      expect(moduleOptions.allowNegativeStock).toBe(true);

      await module.close();
    });

    it('should create module with useExisting configuration', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
          WMSBaseModule.forRootAsync({
            imports: [ExistingOptionsModule],
            useExisting: ExistingOptionsService,
          }),
        ],
      }).compile();

      const moduleOptions = module.get(WMS_MODULE_OPTIONS);

      expect(moduleOptions.allowNegativeStock).toBe(false);
      expect(moduleOptions.materialEntity).toBe(MaterialEntity);

      // Verify the existing service was used
      expect(module.get(ExistingOptionsService)).toBeInstanceOf(ExistingOptionsService);

      await module.close();
    });

    it('should handle async useFactory with promises', async () => {
      const asyncFactoryFunction = jest.fn().mockResolvedValue({
        allowNegativeStock: false,
        materialEntity: MaterialEntity,
        locationEntity: LocationEntity,
      });

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
          WMSBaseModule.forRootAsync({
            useFactory: asyncFactoryFunction,
          }),
        ],
      }).compile();

      expect(asyncFactoryFunction).toHaveBeenCalled();
      const moduleOptions = module.get(WMS_MODULE_OPTIONS);

      expect(moduleOptions.allowNegativeStock).toBe(false);

      await module.close();
    });

    it('should work with additional imports in forRootAsync', async () => {
      @Injectable()
      class ExternalService {
        getConfig(): { allowNegativeStock: boolean } {
          return { allowNegativeStock: true };
        }
      }

      @Module({
        providers: [ExternalService],
        exports: [ExternalService],
      })
      class ExternalServiceModule {}

      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          WMSBaseModule.forRootAsync({
            imports: [
              TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
              ExternalServiceModule,
            ],
            useFactory: (extService: ExternalService) => ({
              ...extService.getConfig(),
              materialEntity: MaterialEntity,
              locationEntity: LocationEntity,
            }),
            inject: [ExternalService],
          }),
        ],
      }).compile();

      const moduleOptions = module.get(WMS_MODULE_OPTIONS);

      expect(moduleOptions.allowNegativeStock).toBe(true);

      await module.close();
    });

    it('should handle configuration without optional imports', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
          WMSBaseModule.forRootAsync({
            useFactory: () => ({
              allowNegativeStock: false,
              materialEntity: MaterialEntity,
              locationEntity: LocationEntity,
            }),
          }),
        ],
      }).compile();

      const moduleOptions = module.get(WMS_MODULE_OPTIONS);

      expect(moduleOptions).toBeDefined();
      expect(moduleOptions.allowNegativeStock).toBe(false);

      await module.close();
    });
  });

  describe('module providers and exports', () => {
    it('should export all required services', async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({
            type: 'sqlite',
            database: ':memory:',
            autoLoadEntities: true,
            synchronize: true,
            logging: false,
          }),
          TypeOrmModule.forFeature([LocationEntity, MaterialEntity, StockEntity, OrderEntity, BatchEntity]),
          WMSBaseModule.forRoot({
            allowNegativeStock: false,
            materialEntity: MaterialEntity,
            locationEntity: LocationEntity,
          }),
        ],
      }).compile();

      // Test that all exported services can be retrieved
      const locationService = module.get(LocationService);
      const materialService = module.get(MaterialService);
      const stockService = module.get(StockService);
      const orderService = module.get(OrderService);
      const warehouseMapService = module.get(WarehouseMapService);

      expect(locationService).toBeInstanceOf(LocationService);
      expect(materialService).toBeInstanceOf(MaterialService);
      expect(stockService).toBeInstanceOf(StockService);
      expect(orderService).toBeInstanceOf(OrderService);
      expect(warehouseMapService).toBeInstanceOf(WarehouseMapService);

      await module.close();
    });
  });
});
