import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { locationMock } from '../__mocks__/location.mock';
import { materialMock } from '../__mocks__/material.mock';
import { LocationEntity, LocationService, MaterialService, OrderEntity, OrderService, WMSBaseModule } from '../src';
import { StockEntity } from '../src/models/stock.entity';
import { StockService } from '../src/services/stock.service';
import { StockSorter } from '../src/typings/stock-sorter.enum';

jest.mock('../src/models/warehouse-map.entity', () => ({
  WarehouseMapEntity: class MockWarehouseMapEntity {},
  WarehouseMapRepo: Symbol('MockWarehouseMapRepo'),
}));

describe('stock', () => {
  let module: TestingModule;
  let stockService: StockService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          autoLoadEntities: true,
          synchronize: true,
          logging: false,
        }),
        WMSBaseModule.forRootAsync({
          imports: [TypeOrmModule.forFeature([StockEntity])],
          useFactory: () => ({}),
        }),
      ],
    }).compile();

    stockService = module.get<StockService>(StockService);
    const locationService = module.get<LocationService<LocationEntity>>(LocationService);

    const orderService = module.get<OrderService>(OrderService);
    const materialService = module.get<MaterialService>(MaterialService);

    await locationService.create(locationMock.parent);

    await Promise.all([
      locationService.create(locationMock.child1),
      locationService.create(locationMock.child2),
      materialService.create(materialMock.m1),
      materialService.create(materialMock.m2),
    ]);

    await orderService.createOrder(OrderEntity, {
      order: {},
      batches: [
        {
          id: 'BatchId',
          locationId: locationMock.child1.id,
          materialId: materialMock.m1.id,
          quantity: 1,
        },
        {
          id: 'BatchId',
          locationId: locationMock.child1.id,
          materialId: materialMock.m1.id,
          quantity: 2,
        },
        {
          id: 'BatchId',
          locationId: locationMock.child2.id,
          materialId: materialMock.m2.id,
          quantity: 3,
        },
        {
          id: 'BatchId',
          locationId: locationMock.child2.id,
          materialId: materialMock.m2.id,
          quantity: 4,
        },
      ],
    });
  });

  describe('find', () => {
    it('should return the sum of stocks filtered by locationIds and all their descendants', async () => {
      const quantity = await stockService.find({
        locationIds: [locationMock.parent.id],
      });

      expect(quantity).toBe(1 + 2 + 3 + 4);
    });

    it('should return stocks filtered by materialIds', async () => {
      const quantityM1 = await stockService.find({
        materialIds: [materialMock.m1.id],
      });

      expect(quantityM1).toBe(1 + 2);

      const quantityM2 = await stockService.find({
        materialIds: [materialMock.m2.id],
      });

      expect(quantityM2).toBe(3 + 4);
    });

    it('should return 0 if no match', async () => {
      const total = await stockService.find({ materialIds: ['non-existent'] });

      expect(total).toBe(0);
    });

    it('should sum all if no filter provided', async () => {
      const total = await stockService.find({});

      expect(total).toBe(1 + 2 + 3 + 4);
    });

    it('should respect exactLocationMatch option', async () => {
      const exactQuantity = await stockService.find({
        locationIds: [locationMock.parent.id],
        exactLocationMatch: true,
      });

      // Should only include stocks directly in parent location, not descendants
      expect(exactQuantity).toBe(0);

      const descendantsQuantity = await stockService.find({
        locationIds: [locationMock.child1.id],
        exactLocationMatch: true,
      });

      // Should include stocks exactly in child1 location
      expect(descendantsQuantity).toBe(1 + 2);
    });

    it('should filter by batchIds', async () => {
      const batchQuantity = await stockService.find({
        batchIds: ['BatchId'],
      });

      expect(batchQuantity).toBe(1 + 2 + 3 + 4);
    });

    it('should combine multiple filters', async () => {
      const combinedQuantity = await stockService.find({
        locationIds: [locationMock.child1.id],
        materialIds: [materialMock.m1.id],
        exactLocationMatch: true,
      });

      expect(combinedQuantity).toBe(1 + 2);
    });
  });

  describe('findTransactions', () => {
    it('should return transactions filtered by materialIds', async () => {
      const transactions = await stockService.findTransactions({
        materialIds: [materialMock.m1.id],
      });

      expect(transactions.transactionLogs).toHaveLength(2);
      expect(transactions.transactionLogs[0].materialId).toBe(materialMock.m1.id);

      expect(transactions.transactionLogs[1].materialId).toBe(materialMock.m1.id);
    });

    it('should sort transactions by CREATED_AT_ASC when specified', async () => {
      const transactions = await stockService.findTransactions({
        sorter: StockSorter.CREATED_AT_ASC,
      });

      expect(transactions.transactionLogs).toHaveLength(4);
      // Verify ascending order by checking if first created item is first
      const firstDate = transactions.transactionLogs[0].createdAt;
      const lastDate = transactions.transactionLogs[transactions.transactionLogs.length - 1].createdAt;

      expect(firstDate.getTime()).toBeLessThanOrEqual(lastDate.getTime());
    });

    it('should sort transactions by CREATED_AT_DESC when explicitly specified', async () => {
      const transactions = await stockService.findTransactions({
        sorter: StockSorter.CREATED_AT_DESC,
      });

      expect(transactions.transactionLogs).toHaveLength(4);
      // Verify descending order by checking if newest item is first
      const firstDate = transactions.transactionLogs[0].createdAt;
      const lastDate = transactions.transactionLogs[transactions.transactionLogs.length - 1].createdAt;

      expect(firstDate.getTime()).toBeGreaterThanOrEqual(lastDate.getTime());
    });

    it('should use CREATED_AT_DESC as default when sorter not specified', async () => {
      const transactions = await stockService.findTransactions({});

      expect(transactions.transactionLogs).toHaveLength(4);
      // Should default to descending order
      const firstDate = transactions.transactionLogs[0].createdAt;
      const lastDate = transactions.transactionLogs[transactions.transactionLogs.length - 1].createdAt;

      expect(firstDate.getTime()).toBeGreaterThanOrEqual(lastDate.getTime());
    });

    it('should return empty array if no match', async () => {
      const transactions = await stockService.findTransactions({
        materialIds: ['non-existent'],
      });

      expect(transactions.transactionLogs).toHaveLength(0);
    });

    it('should return all transactions if no filter provided', async () => {
      const transactions = await stockService.findTransactions({});

      expect(transactions.transactionLogs).toHaveLength(4);
    });

    it('should return paginated transactions', async () => {
      const transactionsPage2 = await stockService.findTransactions({
        offset: 2,
        limit: 2,
      });

      expect(transactionsPage2.transactionLogs).toHaveLength(2);
    });

    it('should return empty array if offset exceeds total pages', async () => {
      const transactions = await stockService.findTransactions({
        offset: 4,
        limit: 2,
      });

      expect(transactions.transactionLogs).toHaveLength(0);
    });

    it('should respect limit boundary (max 100)', async () => {
      const transactions = await stockService.findTransactions({
        limit: 200,
      });

      // Should cap at 100 even though requested 200, but we only have 4 records
      expect(transactions.limit).toBe(100);
      expect(transactions.transactionLogs).toHaveLength(4);
    });

    it('should use default limit when not specified', async () => {
      const transactions = await stockService.findTransactions({});

      expect(transactions.limit).toBe(20);
      expect(transactions.offset).toBe(0);
    });

    it('should filter by batchIds in transactions', async () => {
      const transactions = await stockService.findTransactions({
        batchIds: ['BatchId'],
      });

      expect(transactions.transactionLogs).toHaveLength(4);
      expect(transactions.transactionLogs.every(t => t.batchId === 'BatchId')).toBe(true);
    });

    it('should filter by locationIds with exactLocationMatch', async () => {
      const transactions = await stockService.findTransactions({
        locationIds: [locationMock.child1.id],
        exactLocationMatch: true,
      });

      expect(transactions.transactionLogs).toHaveLength(2);
      expect(transactions.transactionLogs.every(t => t.locationId === locationMock.child1.id)).toBe(true);
    });

    it('should return total count correctly', async () => {
      const transactions = await stockService.findTransactions({
        limit: 2,
      });

      expect(transactions.total).toBe(4);
      expect(transactions.transactionLogs).toHaveLength(2);
    });

    it('should return proper StockCollectionDto structure', async () => {
      const transactions = await stockService.findTransactions({});

      expect(transactions).toHaveProperty('transactionLogs');
      expect(transactions).toHaveProperty('total');
      expect(transactions).toHaveProperty('offset');
      expect(transactions).toHaveProperty('limit');

      if (transactions.transactionLogs.length > 0) {
        const log = transactions.transactionLogs[0];

        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('materialId');
        expect(log).toHaveProperty('batchId');
        expect(log).toHaveProperty('locationId');
        expect(log).toHaveProperty('orderId');
        expect(log).toHaveProperty('quantity');
        expect(log).toHaveProperty('createdAt');
      }
    });

    it('should handle empty array filters gracefully', async () => {
      // Test empty locationIds array
      const transactionsEmptyLocation = await stockService.findTransactions({
        locationIds: [],
      });

      expect(transactionsEmptyLocation.transactionLogs).toHaveLength(4);

      // Test empty materialIds array
      const transactionsEmptyMaterial = await stockService.findTransactions({
        materialIds: [],
      });

      expect(transactionsEmptyMaterial.transactionLogs).toHaveLength(4);

      // Test empty batchIds array
      const transactionsEmptyBatch = await stockService.findTransactions({
        batchIds: [],
      });

      expect(transactionsEmptyBatch.transactionLogs).toHaveLength(4);
    });

    it('should handle complex filter combinations without exact location match', async () => {
      const transactions = await stockService.findTransactions({
        locationIds: [locationMock.parent.id],
        materialIds: [materialMock.m1.id],
        batchIds: ['BatchId'],
        exactLocationMatch: false,
      });

      expect(transactions.transactionLogs).toHaveLength(2);
      expect(transactions.transactionLogs.every(t => t.materialId === materialMock.m1.id)).toBe(true);
    });

    it('should handle offset greater than total records', async () => {
      const transactions = await stockService.findTransactions({
        offset: 10,
        limit: 5,
      });

      expect(transactions.transactionLogs).toHaveLength(0);
      expect(transactions.total).toBe(4);
      expect(transactions.offset).toBe(10);
      expect(transactions.limit).toBe(5);
    });
  });

  describe('find with empty arrays', () => {
    it('should handle empty locationIds array', async () => {
      const quantity = await stockService.find({
        locationIds: [],
      });

      expect(quantity).toBe(10); // Sum of all stocks
    });

    it('should handle empty materialIds array', async () => {
      const quantity = await stockService.find({
        materialIds: [],
      });

      expect(quantity).toBe(10); // Sum of all stocks
    });

    it('should handle empty batchIds array', async () => {
      const quantity = await stockService.find({
        batchIds: [],
      });

      expect(quantity).toBe(10); // Sum of all stocks
    });

    it('should handle all empty arrays together', async () => {
      const quantity = await stockService.find({
        locationIds: [],
        materialIds: [],
        batchIds: [],
      });

      expect(quantity).toBe(10); // Sum of all stocks
    });
  });

  afterAll(async () => {
    await module.close();
  });
});
