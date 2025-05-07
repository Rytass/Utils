import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BatchEntity } from '../models/batch.entity';
import { OrderEntity } from '../models/order.entity';
import { StockEntity } from '../models/stock.entity';
import { OrderCreateDto } from '../typings/order-create.dto';
import {
  RESOLVED_BATCH_REPO,
  RESOLVED_ORDER_REPO,
} from '../typings/wms-module-providers';

@Injectable()
export class OrderService {
  constructor(
    @Inject(RESOLVED_ORDER_REPO)
    private readonly orderRepo: Repository<OrderEntity>,
    @Inject(RESOLVED_BATCH_REPO)
    private readonly batchRepo: Repository<BatchEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createOrder(args: OrderCreateDto): Promise<OrderEntity> {
    const order = await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(BatchEntity).save(args.batches);

      const order = await manager.getRepository(OrderEntity).save(
        this.orderRepo.create({
          ...args,
        }),
      );

      await manager.getRepository(StockEntity).save(
        args.batches.map((batch) => ({
          orderId: order.id,
          batchId: batch.id,
          locationId: batch.locationId,
          materialId: batch.materialId,
          quantity: batch.quantity,
        })),
      );

      return order;
    });

    return order;
  }
}
