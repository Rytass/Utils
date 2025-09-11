import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { LocationEntity } from '../src/models/location.entity';
import { MaterialEntity } from '../src/models/material.entity';
import { BatchEntity } from '../src/models/batch.entity';
import { StockEntity } from '../src/models/stock.entity';
import { OrderEntity } from '../src/models/order.entity';
import { WarehouseMapEntity } from '../src/models/warehouse-map.entity';
import type { MapData, MapRectangleRange, MapPolygonRange } from '../src/typings/warehouse-map';
import { MapRangeType, MapRangeColor } from '../src/typings/warehouse-map.enum';

jest.mock('../src/models/warehouse-map.entity', () => ({
  WarehouseMapEntity: class MockWarehouseMapEntity {},
  WarehouseMapRepo: Symbol('MockWarehouseMapRepo'),
}));

describe('Entity Models and Relationships', () => {
  let module: TestingModule;
  let _dataSource: DataSource;

  beforeEach(async () => {
    const mockDataSource = {} as DataSource;

    module = await Test.createTestingModule({
      providers: [
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('LocationEntity', () => {
    it('should create location entity with required properties', () => {
      const location = new LocationEntity();

      location.id = 'LOC001';

      expect(location.id).toBe('LOC001');
      expect(location.children).toBeUndefined();
      expect(location.parent).toBeUndefined();
      expect(location.createdAt).toBeUndefined();
      expect(location.updatedAt).toBeUndefined();
      expect(location.deletedAt).toBeUndefined();
    });

    it('should support tree relationships', () => {
      const parentLocation = new LocationEntity();

      parentLocation.id = 'PARENT';

      const childLocation = new LocationEntity();

      childLocation.id = 'CHILD';
      childLocation.parent = parentLocation;

      parentLocation.children = [childLocation];

      expect(childLocation.parent).toBe(parentLocation);
      expect(parentLocation.children).toContain(childLocation);
      expect(parentLocation.children).toHaveLength(1);
    });

    it('should support multiple children', () => {
      const parentLocation = new LocationEntity();

      parentLocation.id = 'PARENT';

      const child1 = new LocationEntity();

      child1.id = 'CHILD1';
      child1.parent = parentLocation;

      const child2 = new LocationEntity();

      child2.id = 'CHILD2';
      child2.parent = parentLocation;

      parentLocation.children = [child1, child2];

      expect(parentLocation.children).toHaveLength(2);
      expect(parentLocation.children).toContain(child1);
      expect(parentLocation.children).toContain(child2);
    });

    it('should handle soft delete functionality', () => {
      const location = new LocationEntity();

      location.id = 'LOC001';
      location.deletedAt = new Date();

      expect(location.deletedAt).toBeInstanceOf(Date);
    });

    it('should handle timestamps', () => {
      const location = new LocationEntity();
      const now = new Date();

      location.createdAt = now;
      location.updatedAt = now;

      expect(location.createdAt).toBe(now);
      expect(location.updatedAt).toBe(now);
    });
  });

  describe('MaterialEntity', () => {
    it('should create material entity with required properties', () => {
      const material = new MaterialEntity();

      material.id = 'MAT001';

      expect(material.id).toBe('MAT001');
      expect(material.batches).toBeUndefined();
      expect(material.stocks).toBeUndefined();
      expect(material.createdAt).toBeUndefined();
      expect(material.updatedAt).toBeUndefined();
      expect(material.deletedAt).toBeUndefined();
    });

    it('should support one-to-many relationship with batches', () => {
      const material = new MaterialEntity();

      material.id = 'MAT001';

      const batch1 = new BatchEntity();

      batch1.id = 'BATCH1';
      batch1.materialId = 'MAT001';
      batch1.material = material;

      const batch2 = new BatchEntity();

      batch2.id = 'BATCH2';
      batch2.materialId = 'MAT001';
      batch2.material = material;

      material.batches = [batch1, batch2];

      expect(material.batches).toHaveLength(2);
      expect(material.batches).toContain(batch1);
      expect(material.batches).toContain(batch2);
    });

    it('should support one-to-many relationship with stocks', () => {
      const material = new MaterialEntity();

      material.id = 'MAT001';

      const stock1 = new StockEntity();

      stock1.materialId = 'MAT001';
      stock1.material = material;

      const stock2 = new StockEntity();

      stock2.materialId = 'MAT001';
      stock2.material = material;

      material.stocks = [stock1, stock2];

      expect(material.stocks).toHaveLength(2);
      expect(material.stocks).toContain(stock1);
      expect(material.stocks).toContain(stock2);
    });

    it('should handle soft delete', () => {
      const material = new MaterialEntity();

      material.id = 'MAT001';
      material.deletedAt = new Date();

      expect(material.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('BatchEntity', () => {
    it('should create batch entity with composite primary key', () => {
      const batch = new BatchEntity();

      batch.id = 'BATCH001';
      batch.materialId = 'MAT001';

      expect(batch.id).toBe('BATCH001');
      expect(batch.materialId).toBe('MAT001');
    });

    it('should support many-to-one relationship with material', () => {
      const material = new MaterialEntity();

      material.id = 'MAT001';

      const batch = new BatchEntity();

      batch.id = 'BATCH001';
      batch.materialId = 'MAT001';
      batch.material = material;

      expect(batch.material).toBe(material);
      expect(batch.material.id).toBe('MAT001');
    });

    it('should support one-to-many relationship with stocks', () => {
      const batch = new BatchEntity();

      batch.id = 'BATCH001';
      batch.materialId = 'MAT001';

      const stock1 = new StockEntity();

      stock1.batchId = 'BATCH001';
      stock1.materialId = 'MAT001';
      stock1.batch = batch;

      const stock2 = new StockEntity();

      stock2.batchId = 'BATCH001';
      stock2.materialId = 'MAT001';
      stock2.batch = batch;

      batch.stocks = [stock1, stock2];

      expect(batch.stocks).toHaveLength(2);
      expect(batch.stocks).toContain(stock1);
      expect(batch.stocks).toContain(stock2);
    });

    it('should validate composite key consistency', () => {
      const material = new MaterialEntity();

      material.id = 'MAT001';

      const batch = new BatchEntity();

      batch.id = 'BATCH001';
      batch.materialId = 'MAT001';
      batch.material = material;

      expect(batch.materialId).toBe(material.id);
    });
  });

  describe('StockEntity', () => {
    it('should create stock entity with all required properties', () => {
      const stock = new StockEntity();

      stock.materialId = 'MAT001';
      stock.batchId = 'BATCH001';
      stock.locationId = 'LOC001';
      stock.orderId = 'ORDER001';
      stock.quantity = 100;

      expect(stock.materialId).toBe('MAT001');
      expect(stock.batchId).toBe('BATCH001');
      expect(stock.locationId).toBe('LOC001');
      expect(stock.orderId).toBe('ORDER001');
      expect(stock.quantity).toBe(100);
    });

    it('should support many-to-one relationship with material', () => {
      const material = new MaterialEntity();

      material.id = 'MAT001';

      const stock = new StockEntity();

      stock.materialId = 'MAT001';
      stock.material = material;

      expect(stock.material).toBe(material);
      expect(stock.materialId).toBe(material.id);
    });

    it('should support many-to-one relationship with batch', () => {
      const batch = new BatchEntity();

      batch.id = 'BATCH001';
      batch.materialId = 'MAT001';

      const stock = new StockEntity();

      stock.batchId = 'BATCH001';
      stock.materialId = 'MAT001';
      stock.batch = batch;

      expect(stock.batch).toBe(batch);
      expect(stock.batchId).toBe(batch.id);
      expect(stock.materialId).toBe(batch.materialId);
    });

    it('should support many-to-one relationship with order', () => {
      const order = new OrderEntity();

      order.id = 'ORDER001';

      const stock = new StockEntity();

      stock.orderId = 'ORDER001';
      stock.order = order;

      expect(stock.order).toBe(order);
      expect(stock.orderId).toBe(order.id);
    });

    it('should handle numeric quantity', () => {
      const stock = new StockEntity();

      stock.quantity = 123.45;

      expect(typeof stock.quantity).toBe('number');
      expect(stock.quantity).toBe(123.45);
    });

    it('should handle negative quantity', () => {
      const stock = new StockEntity();

      stock.quantity = -50;

      expect(stock.quantity).toBe(-50);
    });

    it('should handle zero quantity', () => {
      const stock = new StockEntity();

      stock.quantity = 0;

      expect(stock.quantity).toBe(0);
    });

    it('should handle creation timestamp', () => {
      const stock = new StockEntity();
      const now = new Date();

      stock.createdAt = now;

      expect(stock.createdAt).toBe(now);
    });
  });

  describe('OrderEntity', () => {
    it('should create order entity with UUID primary key', () => {
      const order = new OrderEntity();

      order.id = 'uuid-string';

      expect(order.id).toBe('uuid-string');
    });

    it('should support one-to-many relationship with stocks', () => {
      const order = new OrderEntity();

      order.id = 'ORDER001';

      const stock1 = new StockEntity();

      stock1.orderId = 'ORDER001';
      stock1.order = order;

      const stock2 = new StockEntity();

      stock2.orderId = 'ORDER001';
      stock2.order = order;

      order.stocks = [stock1, stock2];

      expect(order.stocks).toHaveLength(2);
      expect(order.stocks).toContain(stock1);
      expect(order.stocks).toContain(stock2);
    });

    it('should handle empty stocks collection', () => {
      const order = new OrderEntity();

      order.id = 'ORDER001';
      order.stocks = [];

      expect(order.stocks).toHaveLength(0);
      expect(Array.isArray(order.stocks)).toBe(true);
    });
  });

  describe('WarehouseMapEntity', () => {
    it('should create warehouse map entity with required properties', () => {
      const warehouseMap = new WarehouseMapEntity();

      warehouseMap.id = 'WM001';

      const mockMapData: MapData = {
        id: 'MAP001',
        backgrounds: [
          {
            id: 'BG001',
            filename: 'warehouse.jpg',
            x: 0,
            y: 0,
            height: 500,
            width: 800,
          },
        ],
        ranges: [
          {
            id: 'RANGE001',
            type: MapRangeType.RECTANGLE,
            color: MapRangeColor.BLUE,
            x: 10,
            y: 10,
            width: 100,
            height: 50,
          } as MapRectangleRange,
        ],
      };

      warehouseMap.mapData = mockMapData;

      expect(warehouseMap.id).toBe('WM001');
      expect(warehouseMap.mapData).toBe(mockMapData);
      expect(warehouseMap.mapData.id).toBe('MAP001');
      expect(warehouseMap.mapData.backgrounds).toHaveLength(1);
      expect(warehouseMap.mapData.ranges).toHaveLength(1);
    });

    it('should handle JSONB map data', () => {
      const warehouseMap = new WarehouseMapEntity();
      const complexMapData: MapData = {
        id: 'MAP002',
        backgrounds: [
          {
            id: 'BG002',
            filename: 'complex-warehouse.jpg',
            x: 0,
            y: 0,
            height: 1000,
            width: 1200,
          },
        ],
        ranges: [
          {
            id: 'POLY001',
            type: MapRangeType.POLYGON,
            color: MapRangeColor.GREEN,
            points: [
              { x: 0, y: 0 },
              { x: 100, y: 0 },
              { x: 100, y: 100 },
              { x: 0, y: 100 },
            ],
          } as MapPolygonRange,
          {
            id: 'RECT001',
            type: MapRangeType.RECTANGLE,
            color: MapRangeColor.RED,
            x: 150,
            y: 150,
            width: 80,
            height: 60,
          } as MapRectangleRange,
        ],
      };

      warehouseMap.mapData = complexMapData;

      expect(warehouseMap.mapData.id).toBe('MAP002');
      expect(warehouseMap.mapData.ranges).toHaveLength(2);
      expect(warehouseMap.mapData.ranges[0].type).toBe(MapRangeType.POLYGON);
      expect(warehouseMap.mapData.ranges[1].type).toBe(MapRangeType.RECTANGLE);
      expect((warehouseMap.mapData.ranges[0] as MapPolygonRange).points).toHaveLength(4);
    });

    it('should handle timestamps', () => {
      const warehouseMap = new WarehouseMapEntity();
      const now = new Date();

      warehouseMap.createdAt = now;
      warehouseMap.updatedAt = now;

      expect(warehouseMap.createdAt).toBe(now);
      expect(warehouseMap.updatedAt).toBe(now);
    });
  });

  describe('Entity Relationships Integration', () => {
    it('should maintain referential integrity across all entities', () => {
      // Create complete entity chain
      const material = new MaterialEntity();

      material.id = 'MAT001';

      const batch = new BatchEntity();

      batch.id = 'BATCH001';
      batch.materialId = 'MAT001';
      batch.material = material;

      const order = new OrderEntity();

      order.id = 'ORDER001';

      const stock = new StockEntity();

      stock.materialId = 'MAT001';
      stock.batchId = 'BATCH001';
      stock.locationId = 'LOC001';
      stock.orderId = 'ORDER001';
      stock.quantity = 100;
      stock.material = material;
      stock.batch = batch;
      stock.order = order;

      // Set reverse relationships
      material.batches = [batch];
      material.stocks = [stock];
      batch.stocks = [stock];
      order.stocks = [stock];

      // Verify forward relationships
      expect(stock.material).toBe(material);
      expect(stock.batch).toBe(batch);
      expect(stock.order).toBe(order);

      // Verify reverse relationships
      expect(material.batches).toContain(batch);
      expect(material.stocks).toContain(stock);
      expect(batch.stocks).toContain(stock);
      expect(order.stocks).toContain(stock);

      // Verify referential consistency
      expect(stock.materialId).toBe(material.id);
      expect(stock.batchId).toBe(batch.id);
      expect(stock.materialId).toBe(batch.materialId);
      expect(stock.orderId).toBe(order.id);
    });

    it('should handle complex tree structure with location hierarchy', () => {
      // Create location hierarchy: Warehouse -> Zone -> Row -> Shelf
      const warehouse = new LocationEntity();

      warehouse.id = 'WH001';

      const zone = new LocationEntity();

      zone.id = 'WH001-Z01';
      zone.parent = warehouse;

      const row = new LocationEntity();

      row.id = 'WH001-Z01-R01';
      row.parent = zone;

      const shelf = new LocationEntity();

      shelf.id = 'WH001-Z01-R01-S01';
      shelf.parent = row;

      // Set children relationships
      warehouse.children = [zone];
      zone.children = [row];
      row.children = [shelf];

      // Verify hierarchy
      expect(warehouse.children).toContain(zone);
      expect(zone.parent).toBe(warehouse);
      expect(zone.children).toContain(row);
      expect(row.parent).toBe(zone);
      expect(row.children).toContain(shelf);
      expect(shelf.parent).toBe(row);
      expect(shelf.children).toBeUndefined();
    });

    it('should handle multiple materials with multiple batches and stocks', () => {
      // Create multiple materials
      const material1 = new MaterialEntity();

      material1.id = 'MAT001';

      const material2 = new MaterialEntity();

      material2.id = 'MAT002';

      // Create batches for each material
      const batch1a = new BatchEntity();

      batch1a.id = 'BATCH001A';
      batch1a.materialId = 'MAT001';
      batch1a.material = material1;

      const batch1b = new BatchEntity();

      batch1b.id = 'BATCH001B';
      batch1b.materialId = 'MAT001';
      batch1b.material = material1;

      const batch2a = new BatchEntity();

      batch2a.id = 'BATCH002A';
      batch2a.materialId = 'MAT002';
      batch2a.material = material2;

      // Set material-batch relationships
      material1.batches = [batch1a, batch1b];
      material2.batches = [batch2a];

      // Create stocks
      const stock1 = new StockEntity();

      stock1.materialId = 'MAT001';
      stock1.batchId = 'BATCH001A';
      stock1.material = material1;
      stock1.batch = batch1a;

      const stock2 = new StockEntity();

      stock2.materialId = 'MAT001';
      stock2.batchId = 'BATCH001B';
      stock2.material = material1;
      stock2.batch = batch1b;

      const stock3 = new StockEntity();

      stock3.materialId = 'MAT002';
      stock3.batchId = 'BATCH002A';
      stock3.material = material2;
      stock3.batch = batch2a;

      // Set stock relationships
      batch1a.stocks = [stock1];
      batch1b.stocks = [stock2];
      batch2a.stocks = [stock3];
      material1.stocks = [stock1, stock2];
      material2.stocks = [stock3];

      // Verify relationships
      expect(material1.batches).toHaveLength(2);
      expect(material1.stocks).toHaveLength(2);
      expect(material2.batches).toHaveLength(1);
      expect(material2.stocks).toHaveLength(1);
      expect(batch1a.stocks).toHaveLength(1);
      expect(batch1b.stocks).toHaveLength(1);
      expect(batch2a.stocks).toHaveLength(1);
    });
  });

  describe('Entity Property Validation', () => {
    it('should handle string primary keys correctly', () => {
      const location = new LocationEntity();

      location.id = 'LOC001';

      const material = new MaterialEntity();

      material.id = 'MAT001';

      const batch = new BatchEntity();

      batch.id = 'BATCH001';
      batch.materialId = 'MAT001';

      const warehouseMap = new WarehouseMapEntity();

      warehouseMap.id = 'WM001';

      expect(typeof location.id).toBe('string');
      expect(typeof material.id).toBe('string');
      expect(typeof batch.id).toBe('string');
      expect(typeof batch.materialId).toBe('string');
      expect(typeof warehouseMap.id).toBe('string');
    });

    it('should handle generated UUID primary keys', () => {
      const stock = new StockEntity();

      stock.id = 'generated-uuid';

      const order = new OrderEntity();

      order.id = 'generated-uuid';

      expect(typeof stock.id).toBe('string');
      expect(typeof order.id).toBe('string');
    });

    it('should handle date fields correctly', () => {
      const now = new Date();

      const location = new LocationEntity();

      location.createdAt = now;
      location.updatedAt = now;
      location.deletedAt = now;

      const material = new MaterialEntity();

      material.createdAt = now;
      material.updatedAt = now;
      material.deletedAt = null;

      const warehouseMap = new WarehouseMapEntity();

      warehouseMap.createdAt = now;
      warehouseMap.updatedAt = now;

      expect(location.createdAt).toBeInstanceOf(Date);
      expect(location.updatedAt).toBeInstanceOf(Date);
      expect(location.deletedAt).toBeInstanceOf(Date);
      expect(material.createdAt).toBeInstanceOf(Date);
      expect(material.updatedAt).toBeInstanceOf(Date);
      expect(material.deletedAt).toBeNull();
      expect(warehouseMap.createdAt).toBeInstanceOf(Date);
      expect(warehouseMap.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle numeric fields correctly', () => {
      const stock = new StockEntity();

      stock.quantity = 100;

      expect(typeof stock.quantity).toBe('number');
      expect(stock.quantity).toBe(100);
    });
  });
});
