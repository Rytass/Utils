import { OrderItem, FlattenOrderItem } from './typings';
import { minus, plus } from '../utils/decimal';

export interface ItemDiscountRecord {
  policyId: string,
  itemId: string,
  discountValue: number,
}

/**
 * OrderItemRecordCollection
 */
export class OrderItemRecordCollection<
Item extends OrderItem = OrderItem> {
  readonly itemId: string;
  readonly initialValue: number;
  readonly originItem: Omit<FlattenOrderItem<Item>, 'uuid' | 'quantity'> | Item;
  private _discountRecords: ItemDiscountRecord[] = [];

  get discountRecords(): ItemDiscountRecord[] {
    return this._discountRecords;
  }

  get discountValue(): number {
    return this.discountRecords.reduce((total, discount) => (
      plus(
        total,
        discount.discountValue
      )
    ), 0);
  }

  get currentValue(): number {
    return minus(this.initialValue, this.discountValue);
  }

  constructor(item: FlattenOrderItem<Item>) {
    const { uuid, quantity, ...originItem } = item;

    this.originItem = originItem;
    this.itemId = uuid;
    this.initialValue = item.unitPrice;
  }

  addDiscountRecord(discount: ItemDiscountRecord): void {
    this._discountRecords.push(discount);
  }
}
