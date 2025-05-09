# 📦 Warehouse Management System for NestJS Projects


## 🏗️ Inheritance Structure

```ts
// models/custom-location.entity.ts
@ChildEntity()
export class CustomLocationEntity extends LocationEntity {
  @Column('varchar')
  customField: string;
}

// models/custom-order-a.entity.ts
@ChildEntity()
export class OrderAEntity extends OrderEntity {
  @Column('varchar')
  customFieldA: string;
}

// models/custom-order-b.entity.ts
@ChildEntity()
export class OrderBEntity extends OrderEntity {
  @Column('varchar')
  customFieldB: string;
}
```

## 🧩 Module Setup

```ts
@Module({
  imports: [
    TypeOrmModule.forRoot({
      // ... typeorm configuration
    }),
    WMSModule.forRootAsync({
      imports: [
        TypeOrmModule.forFeature([
          OrderAEntity,
          OrderBEntity,
          CustomLocationEntity,
        ]),
      ],
      useFactory: () => ({
        // allowNegativeStock: true,
        materialEntity: CustomLocationEntity,
      }),
    }),
  ],
})
export class AppModule {}
```

## ⚙️ Config Options

### `allowNegativeStock` (boolean)

Optional flag that allows stock deduction to go below zero.  
Useful for pre-order or backfill scenarios where temporary negative stock is acceptable.

**Used in:**  
`order.service.ts` – Checks this flag before validating stock deduction logic to avoid throwing `StockNotEnoughError`.

### `Single Custom Entity`

Extend base entities to provide custom implementations.

```ts
stockEntity?: new () => StockEntity; // default: StockEntity
locationEntity?: new () => LocationEntity; // default: LocationEntity
materialEntity?: new () => MaterialEntity; // default: MaterialEntity
batchEntity?: new () => BatchEntity; // default: BatchEntity
orderEntity?: new () => OrderEntity; // default: OrderEntity
```

### `Multiple Custom Order Entities`

Register multiple custom order entities via `TypeOrmModule.forFeature`.

Pass the custom order entity as the first argument to `orderService.createOrder(...)` to allow creating different custom orders.

```ts
await orderService.createOrder(OrderAEntity, {
  order: {
    customFieldA: '11',
    customIntFieldAA: -1,
  },
  batches: [
    {
      id: '1',
      locationId: locationMock.child1.id,
      materialId: materialMock.m1.id,
      quantity: 1,
    },
  ],
});

await orderService.createOrder(OrderBEntity, {
  order: {
    customFieldB: '22',
    customIntFieldBB: 5,
  },
  batches: [
    {
      id: '2',
      locationId: locationMock.child1.id,
      materialId: materialMock.m1.id,
      quantity: 2,
    },
  ],
});
```

## 📂 Key Services

### `order.service.ts`

Handles order creation, batch creation, and stock management.
- Uses `allowNegativeStock` to determine whether to throw when stock is insufficient.

### `stock.service.ts`

- `.find`: Returns the total stock quantity for the given criteria.
- `.findTransactions`: Returns the stock transaction logs matching the given criteria.

### `location.service.ts`

Manages location hierarchy and traversal using `mpath`.

