import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChildEntity, Column } from 'typeorm';
import { WMSModule } from '../src';
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

describe('OrderService', () => {
  let module: TestingModule;
  let orderService: OrderService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          // database: 'wms_test_db.sqlite',
          database: 'ordera.sqlite',
          autoLoadEntities: true,
          synchronize: true,
          logging: 'all',
          logger: 'advanced-console',
        }),
        WMSModule.forRootAsync({
          imports: [TypeOrmModule.forFeature([OrderAEntity, OrderBEntity])],
          useFactory: () => ({
            allowNegativeStock: true,
          }),
        }),
      ],
    }).compile();

    orderService = module.get<OrderService>(OrderService);
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
          locationId: '2',
          materialId: 'A',
          quantity: -1,
        },
        {
          id: '2',
          locationId: 'chihuahua',
          materialId: 'A',
          quantity: 8,
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
          locationId: '2',
          materialId: 'A',
          quantity: -1,
        },
        {
          id: '5',
          locationId: 'chihuahua',
          materialId: 'B',
          quantity: 8,
        },
      ],
    });

    console.log('orderA', orderA);
    console.log('orderB', orderB);
  });
});
