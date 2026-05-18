import { DeepPartial } from 'typeorm';
import { OrderEntity } from '../models/order.entity';

export interface BatchCreateDto {
  id: string;
  /**
   * Human-facing batch identifier persisted to `BatchEntity.key`. Falls back
   * to `id` when omitted. The (key, materialId) pair must be unique.
   */
  key?: string;
  materialId: string;
  locationId: string;
  quantity: number;
}

export type OrderDto<O extends OrderEntity = OrderEntity> = DeepPartial<Omit<O, 'stocks'>>;

export type OrderCreateDto<O extends OrderEntity = OrderEntity> = {
  order: OrderDto<O>;
  batches: BatchCreateDto[];
};
