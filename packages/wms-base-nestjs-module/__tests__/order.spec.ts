import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChildEntity, Column, Repository } from 'typeorm';
import { locationMock } from '../__mocks__/location.mock';
import { CustomMaterialEntity, materialMock } from '../__mocks__/material.mock';
import {
  BatchEntity,
  LocationEntity,
  LocationService,
  MaterialService,
  RESOLVED_BATCH_REPO,
  RESOLVED_ORDER_REPO,
  RESOLVED_STOCK_REPO,
  StockEntity,
  StockService,
  WMSBaseModule,
} from '../src';
import { StockQuantityNotEnoughError } from '../src/constants/errors/base.error';
import { OrderEntity } from '../src/models/order.entity';
import { OrderService } from '../src/services/order.service';

@ChildEntity()
export class OrderAEntity extends OrderEntity {
  @Column('varchar')
  customFieldA: string;

  @Column('int')
  customIntFieldAA: number;
}

@ChildEntity()
export class OrderBEntity extends OrderEntity {
  @Column('varchar')
  customFieldB: string;
}

jest.mock('../src/models/warehouse-map.entity', () => ({
  WarehouseMapEntity: class MockWarehouseMapEntity {},
  WarehouseMapRepo: Symbol('MockWarehouseMapRepo'),
}));

describe('order', () => {
  let module: TestingModule;
  let orderService: OrderService;
  let stockService: StockService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          autoLoadEntities: true,
          synchronize: true,
        }),
        WMSBaseModule.forRootAsync({
          imports: [TypeOrmModule.forFeature([OrderAEntity, OrderBEntity, CustomMaterialEntity])],
          useFactory: () => ({
            // allowNegativeStock: true,
            materialEntity: CustomMaterialEntity,
          }),
        }),
      ],
    }).compile();

    stockService = module.get<StockService>(StockService);
    orderService = module.get<OrderService>(OrderService);
    const locationService = module.get<LocationService<LocationEntity>>(LocationService);

    const materialService = module.get<MaterialService<CustomMaterialEntity>>(MaterialService);

    await locationService.create(locationMock.parent);

    await Promise.all([
      locationService.create(locationMock.child1),
      locationService.create(locationMock.child2),
      materialService.create(materialMock.m1),
      materialService.create(materialMock.m2),
    ]);
  });

  afterEach(async () => {
    await module.get<Repository<StockEntity>>(RESOLVED_STOCK_REPO).clear();
    await module.get<Repository<BatchEntity>>(RESOLVED_BATCH_REPO).clear();
    await module.get<Repository<OrderEntity>>(RESOLVED_ORDER_REPO).clear();
  });

  afterAll(async () => {
    await module.close();
  });

  it('should create multiple orders with different custom entities', async () => {
    const orderA = await orderService.createOrder(OrderAEntity, {
      order: {
        customFieldA: '11',
        customIntFieldAA: -1,
      },
      batches: [
        {
          id: '1',
          locationId: locationMock.child1.id,
          materialId: materialMock.m1.id,
          quantity: 1,
        },
        {
          id: '2',
          locationId: locationMock.parent.id,
          materialId: materialMock.m1.id,
          quantity: 2,
        },
      ],
    });

    const orderB = await orderService.createOrder(OrderBEntity, {
      order: {
        customFieldB: '11',
      },
      batches: [
        {
          id: '5',
          locationId: locationMock.child1.id,
          materialId: materialMock.m1.id,
          quantity: 3,
        },
        {
          id: '5',
          locationId: locationMock.parent.id,
          materialId: materialMock.m2.id,
          quantity: 4,
        },
      ],
    });

    expect(orderA).toHaveProperty('id');
    expect(orderA).toHaveProperty('customFieldA', '11');
    expect(orderA).toHaveProperty('customIntFieldAA', -1);
    expect(orderA).toHaveProperty('stocks');
    expect(orderA.stocks).toHaveLength(2);
    expect(orderA.stocks[0]).toHaveProperty('id');
    expect(orderA.stocks[0]).toHaveProperty('locationId', locationMock.child1.id);

    expect(orderA.stocks[0]).toHaveProperty('materialId', materialMock.m1.id);
    expect(orderA.stocks[0]).toHaveProperty('quantity', 1);
    expect(orderA.stocks[1]).toHaveProperty('id');
    expect(orderA.stocks[1]).toHaveProperty('locationId', locationMock.parent.id);

    expect(orderA.stocks[1]).toHaveProperty('materialId', materialMock.m1.id);
    expect(orderA.stocks[1]).toHaveProperty('quantity', 2);
    expect(orderB).toHaveProperty('id');
    expect(orderB).toHaveProperty('customFieldB', '11');
    expect(orderB).toHaveProperty('stocks');
    expect(orderB.stocks).toHaveLength(2);
    expect(orderB.stocks[0]).toHaveProperty('id');
    expect(orderB.stocks[0]).toHaveProperty('locationId', locationMock.child1.id);

    expect(orderB.stocks[0]).toHaveProperty('materialId', materialMock.m1.id);
    expect(orderB.stocks[0]).toHaveProperty('quantity', 3);
    expect(orderB.stocks[1]).toHaveProperty('id');
    expect(orderB.stocks[1]).toHaveProperty('locationId', locationMock.parent.id);

    expect(orderB.stocks[1]).toHaveProperty('materialId', materialMock.m2.id);
    expect(orderB.stocks[1]).toHaveProperty('quantity', 4);
  });

  it('should not allow to create order with negative stock quantity when stocks is not enough', async () => {
    await expect(
      orderService.createOrder(OrderAEntity, {
        order: {
          customFieldA: '11',
          customIntFieldAA: -1,
        },
        batches: [
          {
            id: '1',
            locationId: locationMock.child1.id,
            materialId: materialMock.m1.id,
            quantity: 1,
          },
        ],
      }),
    ).resolves.toBeDefined();

    await expect(stockService.find({})).resolves.toBe(1);

    await expect(
      orderService.createOrder(OrderAEntity, {
        order: {
          customFieldA: '11',
          customIntFieldAA: -1,
        },
        batches: [
          {
            id: '2',
            locationId: locationMock.child1.id,
            materialId: materialMock.m1.id,
            quantity: -2,
          },
        ],
      }),
    ).rejects.toThrow(StockQuantityNotEnoughError);
  });
});

describe('order with allowNegativeStock', () => {
  let module: TestingModule;
  let orderService: OrderService;
  let stockService: StockService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          autoLoadEntities: true,
          synchronize: true,
        }),
        WMSBaseModule.forRootAsync({
          imports: [TypeOrmModule.forFeature([OrderAEntity, OrderBEntity, CustomMaterialEntity])],
          useFactory: () => ({
            allowNegativeStock: true,
            materialEntity: CustomMaterialEntity,
          }),
        }),
      ],
    }).compile();

    stockService = module.get<StockService>(StockService);
    orderService = module.get<OrderService>(OrderService);
    const locationService = module.get<LocationService<LocationEntity>>(LocationService);

    const materialService = module.get<MaterialService<CustomMaterialEntity>>(MaterialService);

    await locationService.create(locationMock.parent);

    await Promise.all([
      locationService.create(locationMock.child1),
      locationService.create(locationMock.child2),
      materialService.create(materialMock.m1),
      materialService.create(materialMock.m2),
    ]);
  });

  afterEach(async () => {
    await module.get<Repository<StockEntity>>(RESOLVED_STOCK_REPO).clear();
    await module.get<Repository<BatchEntity>>(RESOLVED_BATCH_REPO).clear();
    await module.get<Repository<OrderEntity>>(RESOLVED_ORDER_REPO).clear();
  });

  afterAll(async () => {
    await module.close();
  });

  it('should allow to create order with negative stock quantity when stocks is not enough', async () => {
    await orderService.createOrder(OrderAEntity, {
      order: {
        customFieldA: '11',
        customIntFieldAA: -1,
      },
      batches: [
        {
          id: '1',
          locationId: locationMock.child1.id,
          materialId: materialMock.m1.id,
          quantity: 1,
        },
      ],
    });

    await expect(stockService.find({})).resolves.toBe(1);

    await expect(
      orderService.createOrder(OrderAEntity, {
        order: {
          customFieldA: '11',
          customIntFieldAA: -1,
        },
        batches: [
          {
            id: '2',
            locationId: locationMock.child1.id,
            materialId: materialMock.m1.id,
            quantity: -2,
          },
        ],
      }),
    ).resolves.toBeDefined();

    await expect(stockService.find({})).resolves.toBe(1 - 2);
  });

  it('should handle duplicate batch IDs with same materialId by creating unique batches', async () => {
    // Create order with duplicate batch ID but same material ID
    const order = await orderService.createOrder(OrderAEntity, {
      order: {
        customFieldA: 'Duplicate batch test',
        customIntFieldAA: 1,
      },
      batches: [
        {
          id: 'DUPLICATE_BATCH_ID',
          locationId: locationMock.child1.id,
          materialId: materialMock.m1.id,
          quantity: 5,
        },
        {
          id: 'DUPLICATE_BATCH_ID',
          locationId: locationMock.child1.id,
          materialId: materialMock.m1.id,
          quantity: 3,
        },
        {
          id: 'DUPLICATE_BATCH_ID',
          locationId: locationMock.child2.id,
          materialId: materialMock.m2.id,
          quantity: 2,
        },
      ],
    });

    expect(order.stocks).toHaveLength(3);
    expect(order.stocks.every(s => s.batchId === 'DUPLICATE_BATCH_ID')).toBe(true);

    // Verify total quantity is correct
    const totalQuantity = order.stocks.reduce((sum, stock) => sum + stock.quantity, 0);

    expect(totalQuantity).toBe(5 + 3 + 2);
  });

  it('should test canCreateStock method indirectly through order creation', async () => {
    // First create positive stock
    await orderService.createOrder(OrderAEntity, {
      order: {
        customFieldA: 'Setup stock',
        customIntFieldAA: 1,
      },
      batches: [
        {
          id: 'SETUP_BATCH',
          locationId: locationMock.child1.id,
          materialId: materialMock.m1.id,
          quantity: 10,
        },
      ],
    });

    // Now try to create negative stock that would result in exactly 0 - should succeed
    const order = await orderService.createOrder(OrderAEntity, {
      order: {
        customFieldA: 'Zero result order',
        customIntFieldAA: 2,
      },
      batches: [
        {
          id: 'ZERO_BATCH',
          locationId: locationMock.child1.id,
          materialId: materialMock.m1.id,
          quantity: -10,
        },
      ],
    });

    expect(order).toBeDefined();
    expect(order.stocks).toHaveLength(1);
    expect(order.stocks[0].quantity).toBe(-10);

    // Verify final stock is 0
    const finalStock = await stockService.find({
      locationIds: [locationMock.child1.id],
      materialIds: [materialMock.m1.id],
      exactLocationMatch: true,
    });

    expect(finalStock).toBe(0);
  });

  it('should handle empty batches array', async () => {
    const order = await orderService.createOrder(OrderAEntity, {
      order: {
        customFieldA: 'Empty batches order',
        customIntFieldAA: 0,
      },
      batches: [],
    });

    expect(order).toBeDefined();
    expect(order.stocks).toHaveLength(0);
  });

  it('should create order with multiple different batch IDs', async () => {
    const order = await orderService.createOrder(OrderBEntity, {
      order: {
        customFieldB: 'Multiple batches test',
      },
      batches: [
        {
          id: 'BATCH_A',
          locationId: locationMock.child1.id,
          materialId: materialMock.m1.id,
          quantity: 1,
        },
        {
          id: 'BATCH_B',
          locationId: locationMock.child2.id,
          materialId: materialMock.m1.id,
          quantity: 2,
        },
        {
          id: 'BATCH_C',
          locationId: locationMock.child1.id,
          materialId: materialMock.m2.id,
          quantity: 3,
        },
      ],
    });

    expect(order.stocks).toHaveLength(3);
    expect(order.stocks.map(s => s.batchId).sort()).toEqual(['BATCH_A', 'BATCH_B', 'BATCH_C']);
    expect(order.stocks.map(s => s.quantity).sort()).toEqual([1, 2, 3]);
  });
});
