import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WMSModule } from '../src';
import { OrderEntity } from '../src/models/order.entity';
import { OrderService } from '../src/services/order.service';

describe('OrderService', () => {
  let module: TestingModule;
  let orderService: OrderService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: 'wms_test_db.sqlite',
          autoLoadEntities: true,
          synchronize: true,
          logging: 'all',
          logger: 'advanced-console',
        }),
        WMSModule.forRootAsync({
          imports: [TypeOrmModule.forFeature([OrderEntity])],
          useFactory: () => ({
            allowNegativeStock: true,
          }),
        }),
      ],
    }).compile();

    orderService = module.get<OrderService>(OrderService);
  });

  it('should be defined', async () => {
    expect(orderService).toBeDefined();

    const stocks = await orderService.createOrder({
      batches: [
        {
          id: '5',
          locationId: '2',
          materialId: 'A',
          quantity: -1,
        },
        {
          id: '5',
          locationId: 'chihuahua',
          materialId: 'A',
          quantity: 8,
        },
      ],
    });
  });
});
