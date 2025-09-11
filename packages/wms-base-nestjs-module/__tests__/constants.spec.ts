import { Test, TestingModule } from '@nestjs/testing';
import { Provider } from '@nestjs/common';
import { DataSource, Repository, TreeRepository } from 'typeorm';

import { OptionProviders } from '../src/constants/option-providers';
import { ResolvedRepoProviders } from '../src/constants/resolved-repo-providers';
import {
  ALLOW_NEGATIVE_STOCK,
  PROVIDE_BATCH_ENTITY,
  PROVIDE_LOCATION_ENTITY,
  PROVIDE_MATERIAL_ENTITY,
  PROVIDE_ORDER_ENTITY,
  PROVIDE_STOCK_ENTITY,
  PROVIDE_WAREHOUSE_MAP_ENTITY,
  RESOLVED_BATCH_REPO,
  RESOLVED_MATERIAL_REPO,
  RESOLVED_ORDER_REPO,
  RESOLVED_STOCK_REPO,
  RESOLVED_TREE_LOCATION_REPO,
  RESOLVED_WAREHOUSE_MAP_REPO,
  WMS_MODULE_OPTIONS,
} from '../src/typings/wms-base-module-providers';
import { WMSBaseModuleOptions } from '../src/typings/wms-base-module-options.interface';
import { LocationEntity, LocationRepo } from '../src/models/location.entity';
import { MaterialEntity, MaterialRepo } from '../src/models/material.entity';
import { BatchEntity, BatchRepo } from '../src/models/batch.entity';
import { OrderEntity, OrderRepo } from '../src/models/order.entity';
import { StockEntity, StockRepo } from '../src/models/stock.entity';
import { WarehouseMapEntity, WarehouseMapRepo } from '../src/models/warehouse-map.entity';

jest.mock('../src/models/warehouse-map.entity', () => ({
  WarehouseMapEntity: class MockWarehouseMapEntity {},
  WarehouseMapRepo: Symbol('MockWarehouseMapRepo'),
}));

describe('Constants and Providers', () => {
  describe('WMS Module Providers Symbols', () => {
    it('should have unique symbols for all providers', () => {
      const symbols = [
        RESOLVED_TREE_LOCATION_REPO,
        PROVIDE_LOCATION_ENTITY,
        WMS_MODULE_OPTIONS,
        RESOLVED_MATERIAL_REPO,
        PROVIDE_MATERIAL_ENTITY,
        RESOLVED_BATCH_REPO,
        PROVIDE_BATCH_ENTITY,
        RESOLVED_ORDER_REPO,
        PROVIDE_ORDER_ENTITY,
        RESOLVED_STOCK_REPO,
        PROVIDE_STOCK_ENTITY,
        ALLOW_NEGATIVE_STOCK,
        RESOLVED_WAREHOUSE_MAP_REPO,
        PROVIDE_WAREHOUSE_MAP_ENTITY,
      ];

      // Check all symbols are unique
      const uniqueSymbols = new Set(symbols);

      expect(uniqueSymbols.size).toBe(symbols.length);

      // Check all are actually symbols
      symbols.forEach(symbol => {
        expect(typeof symbol).toBe('symbol');
      });
    });

    it('should have meaningful symbol descriptions', () => {
      expect(RESOLVED_TREE_LOCATION_REPO.toString()).toContain('RESOLVED_TREE_LOCATION_REPO');
      expect(PROVIDE_LOCATION_ENTITY.toString()).toContain('PROVIDE_LOCATION_ENTITY');
      expect(WMS_MODULE_OPTIONS.toString()).toContain('WMS_MODULE_OPTIONS');
      expect(ALLOW_NEGATIVE_STOCK.toString()).toContain('ALLOW_NEGATIVE_STOCK');
    });
  });

  describe('OptionProviders', () => {
    let module: TestingModule;

    afterEach(async () => {
      if (module) {
        await module.close();
      }
    });

    it('should provide location entity from options', async () => {
      const options: WMSBaseModuleOptions = {
        locationEntity: LocationEntity,
      };

      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: options,
          },
        ],
      }).compile();

      const locationEntity = module.get(PROVIDE_LOCATION_ENTITY);

      expect(locationEntity).toBe(LocationEntity);
    });

    it('should provide null when location entity not in options', async () => {
      const options: WMSBaseModuleOptions = {};

      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: options,
          },
        ],
      }).compile();

      const locationEntity = module.get(PROVIDE_LOCATION_ENTITY);

      expect(locationEntity).toBeNull();
    });

    it('should provide material entity from options', async () => {
      const options: WMSBaseModuleOptions = {
        materialEntity: MaterialEntity,
      };

      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: options,
          },
        ],
      }).compile();

      const materialEntity = module.get(PROVIDE_MATERIAL_ENTITY);

      expect(materialEntity).toBe(MaterialEntity);
    });

    it('should provide null when material entity not in options', async () => {
      const options: WMSBaseModuleOptions = {};

      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: options,
          },
        ],
      }).compile();

      const materialEntity = module.get(PROVIDE_MATERIAL_ENTITY);

      expect(materialEntity).toBeNull();
    });

    it('should provide batch entity from options', async () => {
      const options: WMSBaseModuleOptions = {
        batchEntity: BatchEntity,
      };

      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: options,
          },
        ],
      }).compile();

      const batchEntity = module.get(PROVIDE_BATCH_ENTITY);

      expect(batchEntity).toBe(BatchEntity);
    });

    it('should provide order entity from options', async () => {
      const options: WMSBaseModuleOptions = {
        orderEntity: OrderEntity,
      };

      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: options,
          },
        ],
      }).compile();

      const orderEntity = module.get(PROVIDE_ORDER_ENTITY);

      expect(orderEntity).toBe(OrderEntity);
    });

    it('should provide stock entity from options', async () => {
      const options: WMSBaseModuleOptions = {
        stockEntity: StockEntity,
      };

      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: options,
          },
        ],
      }).compile();

      const stockEntity = module.get(PROVIDE_STOCK_ENTITY);

      expect(stockEntity).toBe(StockEntity);
    });

    it('should provide allowNegativeStock boolean from options', async () => {
      const options: WMSBaseModuleOptions = {
        allowNegativeStock: true,
      };

      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: options,
          },
        ],
      }).compile();

      const allowNegativeStock = module.get(ALLOW_NEGATIVE_STOCK);

      expect(allowNegativeStock).toBe(true);
    });

    it('should provide false as default for allowNegativeStock when not in options', async () => {
      const options: WMSBaseModuleOptions = {};

      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: options,
          },
        ],
      }).compile();

      const allowNegativeStock = module.get(ALLOW_NEGATIVE_STOCK);

      expect(allowNegativeStock).toBe(false);
    });

    it('should provide warehouse map entity from options', async () => {
      const options: WMSBaseModuleOptions = {
        warehouseMapEntity: WarehouseMapEntity,
      };

      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: options,
          },
        ],
      }).compile();

      const warehouseMapEntity = module.get(PROVIDE_WAREHOUSE_MAP_ENTITY);

      expect(warehouseMapEntity).toBe(WarehouseMapEntity);
    });

    it('should handle undefined options gracefully', async () => {
      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: undefined,
          },
        ],
      }).compile();

      expect(module.get(PROVIDE_LOCATION_ENTITY)).toBeNull();
      expect(module.get(PROVIDE_MATERIAL_ENTITY)).toBeNull();
      expect(module.get(PROVIDE_BATCH_ENTITY)).toBeNull();
      expect(module.get(PROVIDE_ORDER_ENTITY)).toBeNull();
      expect(module.get(PROVIDE_STOCK_ENTITY)).toBeNull();
      expect(module.get(ALLOW_NEGATIVE_STOCK)).toBe(false);
      expect(module.get(PROVIDE_WAREHOUSE_MAP_ENTITY)).toBeNull();
    });

    it('should provide all entities from complete options', async () => {
      const options: WMSBaseModuleOptions = {
        locationEntity: LocationEntity,
        materialEntity: MaterialEntity,
        batchEntity: BatchEntity,
        orderEntity: OrderEntity,
        stockEntity: StockEntity,
        warehouseMapEntity: WarehouseMapEntity,
        allowNegativeStock: true,
      };

      module = await Test.createTestingModule({
        providers: [
          ...OptionProviders,
          {
            provide: WMS_MODULE_OPTIONS,
            useValue: options,
          },
        ],
      }).compile();

      expect(module.get(PROVIDE_LOCATION_ENTITY)).toBe(LocationEntity);
      expect(module.get(PROVIDE_MATERIAL_ENTITY)).toBe(MaterialEntity);
      expect(module.get(PROVIDE_BATCH_ENTITY)).toBe(BatchEntity);
      expect(module.get(PROVIDE_ORDER_ENTITY)).toBe(OrderEntity);
      expect(module.get(PROVIDE_STOCK_ENTITY)).toBe(StockEntity);
      expect(module.get(PROVIDE_WAREHOUSE_MAP_ENTITY)).toBe(WarehouseMapEntity);
      expect(module.get(ALLOW_NEGATIVE_STOCK)).toBe(true);
    });
  });

  describe('ResolvedRepoProviders', () => {
    let module: TestingModule;
    let mockDataSource: DataSource;

    const createTestModule = (overrides: Provider[] = []): Promise<TestingModule> => {
      return Test.createTestingModule({
        providers: [
          ...ResolvedRepoProviders,
          {
            provide: LocationRepo,
            useValue: {} as Repository<LocationEntity>,
          },
          {
            provide: MaterialRepo,
            useValue: {} as Repository<MaterialEntity>,
          },
          {
            provide: BatchRepo,
            useValue: {} as Repository<BatchEntity>,
          },
          {
            provide: OrderRepo,
            useValue: {} as Repository<OrderEntity>,
          },
          {
            provide: StockRepo,
            useValue: {} as Repository<StockEntity>,
          },
          {
            provide: WarehouseMapRepo,
            useValue: {} as Repository<WarehouseMapEntity>,
          },
          {
            provide: PROVIDE_LOCATION_ENTITY,
            useValue: null,
          },
          {
            provide: PROVIDE_MATERIAL_ENTITY,
            useValue: null,
          },
          {
            provide: PROVIDE_BATCH_ENTITY,
            useValue: null,
          },
          {
            provide: PROVIDE_ORDER_ENTITY,
            useValue: null,
          },
          {
            provide: PROVIDE_STOCK_ENTITY,
            useValue: null,
          },
          {
            provide: PROVIDE_WAREHOUSE_MAP_ENTITY,
            useValue: null,
          },
          {
            provide: DataSource,
            useValue: mockDataSource,
          },
          ...overrides,
        ],
      }).compile();
    };

    beforeEach(() => {
      mockDataSource = {
        getTreeRepository: jest.fn(),
        getRepository: jest.fn(),
      } as unknown as DataSource;
    });

    afterEach(async () => {
      if (module) {
        await module.close();
      }
    });

    it('should resolve tree repository when entity is provided and isTreeRepo is true', async () => {
      const mockTreeRepo = {} as TreeRepository<LocationEntity>;

      jest.spyOn(mockDataSource, 'getTreeRepository').mockReturnValue(mockTreeRepo);

      module = await createTestModule([
        {
          provide: PROVIDE_LOCATION_ENTITY,
          useValue: LocationEntity,
        },
      ]);

      const resolvedRepo = module.get(RESOLVED_TREE_LOCATION_REPO);

      expect(resolvedRepo).toBe(mockTreeRepo);
      expect(mockDataSource.getTreeRepository).toHaveBeenCalledWith(LocationEntity);
    });

    it('should resolve regular repository when entity is provided and isTreeRepo is false', async () => {
      const mockRepo = {} as Repository<MaterialEntity>;

      jest.spyOn(mockDataSource, 'getRepository').mockReturnValue(mockRepo);

      module = await createTestModule([
        {
          provide: PROVIDE_MATERIAL_ENTITY,
          useValue: MaterialEntity,
        },
      ]);

      const resolvedRepo = module.get(RESOLVED_MATERIAL_REPO);

      expect(resolvedRepo).toBe(mockRepo);
      expect(mockDataSource.getRepository).toHaveBeenCalledWith(MaterialEntity);
    });

    it('should return base repository when entity is not provided', async () => {
      const mockBaseRepo = {} as Repository<MaterialEntity>;

      module = await createTestModule([
        {
          provide: MaterialRepo,
          useValue: mockBaseRepo,
        },
      ]);

      const resolvedRepo = module.get(RESOLVED_MATERIAL_REPO);

      expect(resolvedRepo).toBe(mockBaseRepo);
      expect(mockDataSource.getRepository).not.toHaveBeenCalled();
      expect(mockDataSource.getTreeRepository).not.toHaveBeenCalled();
    });

    it('should handle all repository types', async () => {
      const mockRepos = {
        location: { name: 'LocationTreeRepo' } as TreeRepository<LocationEntity>,
        material: { name: 'MaterialRepo' } as Repository<MaterialEntity>,
        batch: { name: 'BatchRepo' } as Repository<BatchEntity>,
        order: { name: 'OrderRepo' } as Repository<OrderEntity>,
        stock: { name: 'StockRepo' } as Repository<StockEntity>,
        warehouseMap: { name: 'WarehouseMapRepo' } as Repository<WarehouseMapEntity>,
      };

      // Reset the mock functions
      jest.clearAllMocks();

      jest.spyOn(mockDataSource, 'getTreeRepository').mockReturnValue(mockRepos.location);
      jest.spyOn(mockDataSource, 'getRepository').mockImplementation(entity => {
        if (entity === MaterialEntity) return mockRepos.material;

        if (entity === BatchEntity) return mockRepos.batch;

        if (entity === OrderEntity) return mockRepos.order;

        if (entity === StockEntity) return mockRepos.stock;

        if (entity === WarehouseMapEntity) return mockRepos.warehouseMap;

        return {} as Repository<unknown>;
      });

      module = await createTestModule([
        {
          provide: PROVIDE_LOCATION_ENTITY,
          useValue: LocationEntity,
        },
        {
          provide: PROVIDE_MATERIAL_ENTITY,
          useValue: MaterialEntity,
        },
        {
          provide: PROVIDE_BATCH_ENTITY,
          useValue: BatchEntity,
        },
        {
          provide: PROVIDE_ORDER_ENTITY,
          useValue: OrderEntity,
        },
        {
          provide: PROVIDE_STOCK_ENTITY,
          useValue: StockEntity,
        },
        {
          provide: PROVIDE_WAREHOUSE_MAP_ENTITY,
          useValue: WarehouseMapEntity,
        },
      ]);

      expect(module.get(RESOLVED_TREE_LOCATION_REPO)).toBe(mockRepos.location);
      expect(module.get(RESOLVED_MATERIAL_REPO)).toBe(mockRepos.material);
      expect(module.get(RESOLVED_BATCH_REPO)).toBe(mockRepos.batch);
      expect(module.get(RESOLVED_ORDER_REPO)).toBe(mockRepos.order);
      expect(module.get(RESOLVED_STOCK_REPO)).toBe(mockRepos.stock);
      expect(module.get(RESOLVED_WAREHOUSE_MAP_REPO)).toBe(mockRepos.warehouseMap);

      expect(mockDataSource.getTreeRepository).toHaveBeenCalledWith(LocationEntity);
      expect(mockDataSource.getRepository).toHaveBeenCalledWith(MaterialEntity);
      expect(mockDataSource.getRepository).toHaveBeenCalledWith(BatchEntity);
      expect(mockDataSource.getRepository).toHaveBeenCalledWith(OrderEntity);
      expect(mockDataSource.getRepository).toHaveBeenCalledWith(StockEntity);
      expect(mockDataSource.getRepository).toHaveBeenCalledWith(WarehouseMapEntity);
    });
  });

  describe('Provider Array Structure', () => {
    it('should have correct number of option providers', () => {
      expect(OptionProviders).toHaveLength(7);
    });

    it('should have correct number of resolved repo providers', () => {
      expect(ResolvedRepoProviders).toHaveLength(6);
    });

    it('should have all providers with required properties', () => {
      OptionProviders.forEach(provider => {
        expect(provider).toHaveProperty('provide');
        expect(provider).toHaveProperty('useFactory');
        expect(provider).toHaveProperty('inject');
        expect(Array.isArray(provider.inject)).toBe(true);
      });

      ResolvedRepoProviders.forEach(provider => {
        expect(provider).toHaveProperty('provide');
        expect(provider).toHaveProperty('useFactory');
        expect(provider).toHaveProperty('inject');
        expect(Array.isArray(provider.inject)).toBe(true);
        expect(provider.inject).toHaveLength(3);
      });
    });
  });
});
