import { DeepPartial } from 'typeorm';
import { OrderEntity } from '../models/order.entity';

export interface BatchCreateDto {
  id: string;
  materialId: string;
  locationId: string;
  quantity: number;
}

export type OrderCreateDto<O extends OrderEntity = OrderEntity> = DeepPartial<
  Omit<O, 'batches'>
> & {
  batches: BatchCreateDto[];
};
