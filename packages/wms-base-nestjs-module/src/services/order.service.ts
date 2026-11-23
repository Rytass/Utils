import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, DeepPartial, EntityManager, In } from 'typeorm';
import { BatchMaterialMismatchError, StockQuantityNotEnoughError } from '../constants/errors/base.error';
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
      await this.ensureBatches(args.batches, manager);

      const order = await manager.getRepository(customOrder).save(
        manager.getRepository(customOrder).create({
          ...(args.order as DeepPartial<T>),
        }),
      );

      if (!(await this.canCreateStocks(args.batches, manager))) {
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

  /**
   * Inserts only the batches that do not exist yet. A batch is the lot, not the
   * movement: an outbound from a lot received earlier passes the same batch id,
   * and must reuse that row rather than insert it again.
   */
  private async ensureBatches(batches: BatchCreateDto[], manager: EntityManager): Promise<void> {
    const uniqueBatches = new Map<string, BatchCreateDto>();

    batches.forEach(batch => {
      if (!uniqueBatches.has(batch.id)) {
        uniqueBatches.set(batch.id, batch);
      } else if (uniqueBatches.get(batch.id)?.materialId !== batch.materialId) {
        throw new BatchMaterialMismatchError();
      }
    });

    if (!uniqueBatches.size) return;

    const existing = await manager.getRepository(BatchEntity).find({
      where: { id: In([...uniqueBatches.keys()]) },
    });

    existing.forEach(row => {
      if (row.materialId !== uniqueBatches.get(row.id)?.materialId) {
        throw new BatchMaterialMismatchError();
      }

      uniqueBatches.delete(row.id);
    });

    if (!uniqueBatches.size) return;

    await manager.getRepository(BatchEntity).insert(
      [...uniqueBatches.values()].map(batch => ({
        id: batch.id,
        key: batch.key ?? batch.id,
        materialId: batch.materialId,
      })),
    );
  }

  /**
   * Checks the order's lines together, after netting lines that hit the same
   * place: two -8 lines against 10 on hand must fail, though each passes alone.
   * Both the location total and each lot at that location must stay >= 0, so a
   * lot cannot go negative while other lots keep the location total positive.
   */
  private async canCreateStocks(batches: BatchCreateDto[], manager?: EntityManager): Promise<boolean> {
    if (this.allowNegativeStock) {
      return true;
    }

    const locationDeltas = new Map<string, { locationId: string; materialId: string; quantity: number }>();
    const lotDeltas = new Map<string, { locationId: string; materialId: string; batchId: string; quantity: number }>();

    batches.forEach(batch => {
      const locationKey = `${batch.locationId}:${batch.materialId}`;
      const lotKey = `${locationKey}:${batch.id}`;
      const quantity = Number(batch.quantity);

      const location = locationDeltas.get(locationKey) ?? {
        locationId: batch.locationId,
        materialId: batch.materialId,
        quantity: 0,
      };

      location.quantity += quantity;
      locationDeltas.set(locationKey, location);

      const lot = lotDeltas.get(lotKey) ?? {
        locationId: batch.locationId,
        materialId: batch.materialId,
        batchId: batch.id,
        quantity: 0,
      };

      lot.quantity += quantity;
      lotDeltas.set(lotKey, lot);
    });

    const checks = [
      ...[...locationDeltas.values()].map(delta => ({ ...delta, batchIds: undefined })),
      ...[...lotDeltas.values()].map(delta => ({ ...delta, batchIds: [delta.batchId] })),
    ]
      // A net inbound cannot take anything below zero.
      .filter(delta => delta.quantity < 0);

    const results = await Promise.all(
      checks.map(async delta => {
        const stock = await this.stockService.find(
          {
            locationIds: [delta.locationId],
            materialIds: [delta.materialId],
            batchIds: delta.batchIds,
            exactLocationMatch: true,
          },
          manager,
        );

        return stock + delta.quantity >= 0;
      }),
    );

    return results.every(result => result);
  }

  async canCreateStock(batch: BatchCreateDto, manager?: EntityManager): Promise<boolean> {
    return this.canCreateStocks([batch], manager);
  }
}
