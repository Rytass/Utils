import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, DeepPartial, EntityManager } from 'typeorm';
import { StockQuantityNotEnoughError } from '../constants/errors/base.error';
import { BatchEntity } from '../models/batch.entity';
import { OrderEntity } from '../models/order.entity';
import { StockEntity } from '../models/stock.entity';
import { BatchCreateDto, OrderCreateDto } from '../typings/order-create.dto';
import { ALLOW_NEGATIVE_STOCK } from '../typings/wms-base-module-providers';
import { StockService } from './stock.service';

@Injectable()
export class OrderService {
  constructor(
    @Inject(ALLOW_NEGATIVE_STOCK)
    private readonly allowNegativeStock: boolean,
    @Inject(StockService)
    private readonly stockService: StockService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async createOrder<T extends OrderEntity>(customOrder: new () => T, args: OrderCreateDto<T>): Promise<T> {
    const order = await this.dataSource.transaction(async manager => {
      const uniqueBatches = new Map<string, BatchCreateDto>();
      // key: id:materialId

      args.batches.forEach(batch => {
        const key = `${batch.id}:${batch.materialId}`;

        if (!uniqueBatches.has(key)) {
          uniqueBatches.set(key, batch);
        }
      });

      await manager.getRepository(BatchEntity).insert([...uniqueBatches.values()]);

      const order = await manager.getRepository(customOrder).save(
        manager.getRepository(customOrder).create({
          ...(args.order as DeepPartial<T>),
        }),
      );

      const canCreateStock = await Promise.all(args.batches.map(batch => this.canCreateStock(batch, manager))).then(
        results => results.every(result => result === true),
      );

      if (!canCreateStock) {
        throw new StockQuantityNotEnoughError();
      }

      const stocks = await manager.getRepository(StockEntity).save(
        args.batches.map(batch => ({
          orderId: order.id,
          batchId: batch.id,
          locationId: batch.locationId,
          materialId: batch.materialId,
          quantity: batch.quantity,
        })),
      );

      order.stocks = stocks;

      return order;
    });

    return order;
  }

  async canCreateStock(batch: BatchCreateDto, manager?: EntityManager): Promise<boolean> {
    if (this.allowNegativeStock) {
      return true;
    }

    const stock = await this.stockService.find(
      {
        locationIds: [batch.locationId],
        materialIds: [batch.materialId],
        exactLocationMatch: true,
      },
      manager,
    );

    return stock + batch.quantity >= 0;
  }
}
