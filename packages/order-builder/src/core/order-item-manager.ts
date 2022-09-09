import {
  BaseOrderItem,
  OrderItem,
  FlattenOrderItem,
  OrderItemRecord,
} from './typings';
import { OrderItemRecordCollection } from './order-item-record-collection';
import { Policy } from '../policies';
import { minus, plus, times } from '../utils/decimal';
import { Order } from './order';

/**
 * OrderItemManager
 */
export class OrderItemManager<Item extends OrderItem = OrderItem> {
  private _collectionMap: Map<string, OrderItemRecordCollection> = new Map();
  private _items: Item[];

  /**
   * Get all items from user.
   */
  get items(): Item[] {
    return this._items;
  }

  /**
   * Get item record collection map.
   */
  get collectionMap(): Map<string, OrderItemRecordCollection> {
    return this._collectionMap;
  }

  /**
   * To flatten items by item.quantity.
   */
  get flattenItems(): FlattenOrderItem<Item>[] {
    return this._items.reduce((total, item) => {
      total.push(
        ...Array.from(Array(item.quantity)).map((_, index) => {
          const uuid = `${item.id}-${index + 1}`;
          const unitPrice = minus(
            item.unitPrice,
            this._collectionMap.get(`${item.id}-${index + 1}`)?.discountValue ||
              0
          );

          return {
            ...item,
            unitPrice,
            uuid,
            quantity: unitPrice ? 1 : 0,
          } as FlattenOrderItem<Item>;
        })
      );

      return total;
    }, [] as FlattenOrderItem<Item>[]);
  }

  constructor(items: Item[]) {
    this._items = items;
  }

  initCollectionMap(): void {
    this._collectionMap.clear();
  }

  getCurrentItemRecords(
    policyMap: Map<string, Policy>
  ): OrderItemRecord<Item>[] {
    return this.flattenItems
      .map((flattenItem) => {
        const record =
          this.collectionMap.get(flattenItem.uuid) ||
          new OrderItemRecordCollection(flattenItem);

        this._collectionMap.set(flattenItem.uuid, record);

        return record;
      })
      .map(itemRecord => ({
        itemId: itemRecord.itemId,
        originItem: itemRecord.originItem as Item,
        initialValue: itemRecord.initialValue,
        discountValue: itemRecord.discountValue,
        finalPrice: itemRecord.currentValue,
        discountRecords: itemRecord.discountRecords,
        appliedPolicies: itemRecord.discountRecords
          .map(discountRecord => policyMap.get(discountRecord.policyId))
          .filter(policy => policy) as Policy[],
      }));
  }

  updateCollection<T extends FlattenOrderItem<OrderItem>>(
    item: T,
    resolve: (record: OrderItemRecordCollection) => OrderItemRecordCollection
  ): void {
    const storedRecord =
      this._collectionMap.get(item.uuid) || new OrderItemRecordCollection(item);

    this._collectionMap.set(item.uuid, resolve(storedRecord));
  }

  addItem<I extends Item>(arg0: I | I[]): void {
    const items = Array.isArray(arg0) ? arg0 : [arg0];

    this._items = [...this._items, ...items];
  }

  removeItem<RemoveItem extends BaseOrderItem = BaseOrderItem>(
    arg0: string | RemoveItem | RemoveItem[],
    arg1?: number
  ): void {
    const items: RemoveItem[] = Array.isArray(arg0)
      ? arg0
      : [
          {
            id: typeof arg0 === 'string' ? arg0 : arg0.id,
            quantity:
              typeof arg0 !== 'string'
                ? arg0.quantity
                : typeof arg1 === 'number'
                ? Math.max(arg1, 0)
                : 0,
          } as RemoveItem,
        ];

    const toRemoveItemMap = new Map<string, RemoveItem>(
      items.map(item => [item.id, item])
    );

    this._items = this._items.reduce((items, item) => {
      const matchedToRemoveItem = toRemoveItemMap.get(item.id);

      if (!matchedToRemoveItem) return [...items, item];

      const predictQuantity = minus(
        item.quantity,
        matchedToRemoveItem.quantity
      );

      return predictQuantity > 0
        ? [
            ...items,
            {
              ...item,
              quantity: predictQuantity,
            },
          ]
        : items;
    }, [] as Item[]);
  }
}
