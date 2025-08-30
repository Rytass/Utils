import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { locationMock } from '../__mocks__/location.mock';
import { materialMock } from '../__mocks__/material.mock';
import {
  LocationEntity,
  LocationService,
  MaterialService,
  OrderEntity,
  OrderService,
  WMSBaseModule,
} from '../src';
import { StockEntity } from '../src/models/stock.entity';
import { StockService } from '../src/services/stock.service';

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
          logging: 'all',
          logger: 'advanced-console',
        }),
        WMSBaseModule.forRootAsync({
          imports: [TypeOrmModule.forFeature([StockEntity])],
          useFactory: () => ({}),
        }),
      ],
    }).compile();

    stockService = module.get<StockService>(StockService);
    const locationService =
      module.get<LocationService<LocationEntity>>(LocationService);

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
  });

  describe('findTransactions', () => {
    it('should return transactions filtered by materialIds', async () => {
      const transactions = await stockService.findTransactions({
        materialIds: [materialMock.m1.id],
      });

      expect(transactions.transactionLogs).toHaveLength(2);
      expect(transactions.transactionLogs[0].materialId).toBe(
        materialMock.m1.id,
      );

      expect(transactions.transactionLogs[1].materialId).toBe(
        materialMock.m1.id,
      );
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
  });
});
