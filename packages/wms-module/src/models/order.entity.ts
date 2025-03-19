import { Entity, PrimaryGeneratedColumn } from 'typeorm';

export const OrderRepo = Symbol('OrderRepo');

@Entity('orders')
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
}
