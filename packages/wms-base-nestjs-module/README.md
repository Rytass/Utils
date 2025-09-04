# 📦 Rytass Utils - Warehouse Management System (WMS) NestJS Module

Enterprise-grade warehouse management system module for NestJS applications. Provides comprehensive inventory tracking, location management, batch processing, and stock control with support for custom entity extensions.

## Features

- [x] **Hierarchical Location Management** - Tree structure using materialized path (mpath)
- [x] **Stock Management** - Real-time inventory tracking with transaction history
- [x] **Batch Processing** - Batch-based inventory operations
- [x] **Order Management** - Support for multiple custom order types
- [x] **Material Management** - Product/SKU management system
- [x] **Negative Stock Support** - Optional negative inventory for pre-orders
- [x] **Entity Customization** - Extend base entities with custom fields
- [x] **Transaction Safety** - Full database transaction support
- [x] **TypeORM Integration** - Seamless integration with TypeORM

## Installation

```bash
npm install @rytass/wms-base-nestjs-module
# or
yarn add @rytass/wms-base-nestjs-module
```

## Quick Start

### Basic Module Setup

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WMSBaseModule } from '@rytass/wms-base-nestjs-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'wms_user',
      password: 'password',
      database: 'wms_db',
      autoLoadEntities: true,
      synchronize: true,
    }),
    WMSBaseModule.forRoot({
      allowNegativeStock: false, // Optional: Allow negative inventory
    }),
  ],
})
export class AppModule {}
```

### Using WMS Services

```typescript
import { Injectable } from '@nestjs/common';
import { OrderService, StockService, LocationService, MaterialService } from '@rytass/wms-base-nestjs-module';

@Injectable()
export class InventoryService {
  constructor(
    private readonly orderService: OrderService,
    private readonly stockService: StockService,
    private readonly locationService: LocationService,
    private readonly materialService: MaterialService,
  ) {}

  async checkStock(materialId: string, locationId: string) {
    return this.stockService.find({
      materialIds: [materialId],
      locationIds: [locationId],
    });
  }
}
```

## Core Concepts

### 🏗️ Entity Structure

The WMS module provides base entities that can be extended:

- **LocationEntity** - Warehouse locations (hierarchical)
- **MaterialEntity** - Products/SKUs
- **BatchEntity** - Inventory batches
- **OrderEntity** - Orders/transactions
- **StockEntity** - Stock levels and movements

### 🎯 Custom Entity Extension

Create custom entities by extending base entities:

```typescript
// models/custom-location.entity.ts
import { Entity, Column, ChildEntity } from 'typeorm';
import { LocationEntity } from '@rytass/wms-base-nestjs-module';

@ChildEntity()
export class CustomLocationEntity extends LocationEntity {
  @Column('varchar')
  warehouseCode: string;

  @Column('varchar')
  zone: string;

  @Column('int')
  temperature: number;
}

// models/custom-material.entity.ts
@ChildEntity()
export class CustomMaterialEntity extends MaterialEntity {
  @Column('varchar')
  barcode: string;

  @Column('decimal')
  weight: number;

  @Column('json')
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
}
```

### 🔧 Module Configuration

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WMSBaseModule } from '@rytass/wms-base-nestjs-module';
import { CustomLocationEntity } from './models/custom-location.entity';
import { CustomMaterialEntity } from './models/custom-material.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // TypeORM configuration
    }),
    TypeOrmModule.forFeature([CustomLocationEntity, CustomMaterialEntity]),
    WMSBaseModule.forRootAsync({
      imports: [TypeOrmModule.forFeature([CustomLocationEntity, CustomMaterialEntity])],
      useFactory: () => ({
        allowNegativeStock: false,
        locationEntity: CustomLocationEntity,
        materialEntity: CustomMaterialEntity,
      }),
    }),
  ],
})
export class AppModule {}
```

## Services API

### 📍 LocationService

Manages warehouse locations with hierarchical structure.

```typescript
@Injectable()
export class LocationManagementService {
  constructor(private readonly locationService: LocationService) {}

  // Create a new location
  async createLocation(data: any) {
    return this.locationService.create({
      id: 'WAREHOUSE-A-1',
      name: 'Warehouse A - Section 1',
      parentId: 'WAREHOUSE-A', // Optional: parent location
      customField: 'value',
    });
  }

  // Find location by ID
  async getLocation(id: string) {
    return this.locationService.findById(id);
  }

  // Get location tree
  async getLocationTree() {
    return this.locationService.findTrees();
  }

  // Archive location (soft delete)
  async archiveLocation(id: string) {
    return this.locationService.archive(id);
  }

  // Get all child locations
  async getChildLocations(parentId: string) {
    return this.locationService.findDescendants(parentId);
  }
}
```

### 📊 StockService

Handles inventory levels and stock movements.

```typescript
@Injectable()
export class StockManagementService {
  constructor(private readonly stockService: StockService) {}

  // Check stock levels
  async checkStock(options: StockFindDto) {
    const stockLevel = await this.stockService.find({
      materialIds: ['MATERIAL-001'],
      locationIds: ['LOCATION-001'],
      batchIds: ['BATCH-001'], // Optional
    });

    return stockLevel; // Returns total quantity
  }

  // Get stock with details
  async getStockDetails(options: StockFindAllDto) {
    const stockDetails = await this.stockService.findAll({
      materialIds: ['MATERIAL-001'],
      locationIds: ['LOCATION-001'],
      sorter: StockSorter.CREATED_AT_DESC,
      skip: 0,
      take: 10,
    });

    return stockDetails; // Returns StockCollectionDto with transactions
  }

  // Get stock transactions history
  async getStockHistory(options: StockFindDto) {
    return this.stockService.findTransactions({
      materialIds: ['MATERIAL-001'],
      locationIds: ['LOCATION-001'],
      exactLocationMatch: true, // Only exact location, not children
    });
  }
}
```

### 📦 OrderService

Manages orders and stock movements.

```typescript
import { OrderEntity } from '@rytass/wms-base-nestjs-module';

// Define custom order types
@ChildEntity()
export class InboundOrderEntity extends OrderEntity {
  @Column('varchar')
  supplier: string;

  @Column('varchar')
  purchaseOrderNumber: string;
}

@ChildEntity()
export class OutboundOrderEntity extends OrderEntity {
  @Column('varchar')
  customer: string;

  @Column('varchar')
  shippingAddress: string;
}

@Injectable()
export class OrderManagementService {
  constructor(private readonly orderService: OrderService) {}

  // Create inbound order (stock in)
  async createInboundOrder(data: any) {
    return this.orderService.createOrder(InboundOrderEntity, {
      order: {
        supplier: 'Supplier ABC',
        purchaseOrderNumber: 'PO-2024-001',
      },
      batches: [
        {
          id: 'BATCH-001',
          locationId: 'LOCATION-001',
          materialId: 'MATERIAL-001',
          quantity: 100, // Positive for inbound
        },
      ],
    });
  }

  // Create outbound order (stock out)
  async createOutboundOrder(data: any) {
    return this.orderService.createOrder(OutboundOrderEntity, {
      order: {
        customer: 'Customer XYZ',
        shippingAddress: '123 Main St',
      },
      batches: [
        {
          id: 'BATCH-001',
          locationId: 'LOCATION-001',
          materialId: 'MATERIAL-001',
          quantity: -50, // Negative for outbound
        },
      ],
    });
  }

  // Transfer stock between locations
  async transferStock(fromLocation: string, toLocation: string, materialId: string, quantity: number) {
    return this.orderService.createOrder(OrderEntity, {
      order: {},
      batches: [
        {
          id: `TRANSFER-${Date.now()}-OUT`,
          locationId: fromLocation,
          materialId: materialId,
          quantity: -quantity,
        },
        {
          id: `TRANSFER-${Date.now()}-IN`,
          locationId: toLocation,
          materialId: materialId,
          quantity: quantity,
        },
      ],
    });
  }
}
```

### 🏷️ MaterialService

Manages products/SKUs in the warehouse.

```typescript
@Injectable()
export class MaterialManagementService {
  constructor(private readonly materialService: MaterialService) {}

  // Create new material
  async createMaterial(data: any) {
    return this.materialService.create({
      id: 'SKU-001',
      name: 'Product Name',
      description: 'Product Description',
      customFields: data.customFields,
    });
  }

  // Find material by ID
  async getMaterial(id: string) {
    return this.materialService.findById(id);
  }

  // Update material
  async updateMaterial(id: string, data: any) {
    return this.materialService.update(id, data);
  }

  // List all materials
  async listMaterials() {
    return this.materialService.findAll();
  }
}
```

## Advanced Usage

### 🔄 Transaction Management

All order operations are wrapped in database transactions for consistency:

```typescript
@Injectable()
export class TransactionalService {
  constructor(
    private readonly orderService: OrderService,
    private readonly dataSource: DataSource,
  ) {}

  async complexOperation() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Multiple operations in single transaction
      const order1 = await this.orderService.createOrder(OrderEntity, {
        order: {},
        batches: [
          /* ... */
        ],
      });

      const order2 = await this.orderService.createOrder(OrderEntity, {
        order: {},
        batches: [
          /* ... */
        ],
      });

      await queryRunner.commitTransaction();
      return { order1, order2 };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

### 🚫 Negative Stock Handling

Configure the module to allow or prevent negative stock:

```typescript
// Module configuration
WMSBaseModule.forRoot({
  allowNegativeStock: true, // Enable for pre-orders
});

// In service
@Injectable()
export class PreOrderService {
  constructor(private readonly orderService: OrderService) {}

  async createPreOrder(customerId: string, items: any[]) {
    // With allowNegativeStock: true, this won't throw error
    return this.orderService.createOrder(OrderEntity, {
      order: { customerId },
      batches: items.map(item => ({
        id: `PRE-ORDER-${Date.now()}`,
        locationId: 'VIRTUAL-LOCATION',
        materialId: item.materialId,
        quantity: -item.quantity, // Can go negative
      })),
    });
  }
}
```

### 🌳 Location Hierarchy

Work with hierarchical location structures:

```typescript
@Injectable()
export class LocationHierarchyService {
  constructor(private readonly locationService: LocationService) {}

  async setupWarehouse() {
    // Create root warehouse
    const warehouse = await this.locationService.create({
      id: 'WH-001',
      name: 'Main Warehouse',
    });

    // Create zones
    const zoneA = await this.locationService.create({
      id: 'WH-001-A',
      name: 'Zone A',
      parentId: 'WH-001',
    });

    // Create racks
    const rack1 = await this.locationService.create({
      id: 'WH-001-A-R1',
      name: 'Rack 1',
      parentId: 'WH-001-A',
    });

    // Create bins
    const bin1 = await this.locationService.create({
      id: 'WH-001-A-R1-B1',
      name: 'Bin 1',
      parentId: 'WH-001-A-R1',
    });

    return { warehouse, zoneA, rack1, bin1 };
  }

  async getWarehouseStock(warehouseId: string) {
    // Gets stock for warehouse and all child locations
    return this.stockService.find({
      locationIds: [warehouseId],
      exactLocationMatch: false, // Include all descendants
    });
  }
}
```

### 📈 Stock Reports

Generate inventory reports and analytics:

```typescript
@Injectable()
export class ReportingService {
  constructor(
    private readonly stockService: StockService,
    private readonly locationService: LocationService,
  ) {}

  async getInventoryReport() {
    const allStock = await this.stockService.findAll({
      sorter: StockSorter.QUANTITY_DESC,
    });

    return {
      totalItems: allStock.data.length,
      totalQuantity: allStock.data.reduce((sum, item) => sum + item.quantity, 0),
      byLocation: await this.groupByLocation(allStock.data),
      byMaterial: await this.groupByMaterial(allStock.data),
      lowStock: allStock.data.filter(item => item.quantity < 10),
    };
  }

  async getMovementHistory(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.stockService.findTransactions({
      createdAfter: since,
      sorter: StockSorter.CREATED_AT_DESC,
    });
  }
}
```

## Configuration Options

### Module Options

```typescript
interface WMSBaseModuleOptions {
  // Allow stock to go negative (for pre-orders, backorders)
  allowNegativeStock?: boolean;

  // Custom entity classes
  stockEntity?: new () => StockEntity;
  locationEntity?: new () => LocationEntity;
  materialEntity?: new () => MaterialEntity;
  batchEntity?: new () => BatchEntity;
  orderEntity?: new () => OrderEntity;
}
```

### Stock Query Options

```typescript
interface StockFindDto {
  // Filter by materials
  materialIds?: string[];

  // Filter by locations
  locationIds?: string[];

  // Filter by batches
  batchIds?: string[];

  // Only exact location match (not children)
  exactLocationMatch?: boolean;

  // Date range filters
  createdAfter?: Date;
  createdBefore?: Date;
}

enum StockSorter {
  CREATED_AT_ASC = 'CREATED_AT_ASC',
  CREATED_AT_DESC = 'CREATED_AT_DESC',
  QUANTITY_ASC = 'QUANTITY_ASC',
  QUANTITY_DESC = 'QUANTITY_DESC',
}
```

## Error Handling

The module provides specific error classes:

```typescript
import {
  StockQuantityNotEnoughError,
  LocationNotFoundError,
  LocationAlreadyExistedError,
  LocationCannotArchiveError,
} from '@rytass/wms-base-nestjs-module';

@Injectable()
export class ErrorHandlingService {
  constructor(private readonly orderService: OrderService) {}

  async safeCreateOrder(orderData: any) {
    try {
      return await this.orderService.createOrder(OrderEntity, orderData);
    } catch (error) {
      if (error instanceof StockQuantityNotEnoughError) {
        // Handle insufficient stock
        console.error('Not enough stock available');
        throw new BadRequestException('Insufficient inventory');
      }

      if (error instanceof LocationNotFoundError) {
        // Handle location not found
        console.error('Location does not exist');
        throw new NotFoundException('Invalid location');
      }

      throw error;
    }
  }
}
```

## Best Practices

### 1. Use Transactions for Multiple Operations

```typescript
// Good - Atomic operations
await this.dataSource.transaction(async manager => {
  await this.orderService.createOrder(/* ... */);
  await this.locationService.create(/* ... */);
});

// Avoid - Non-atomic operations
await this.orderService.createOrder(/* ... */);
await this.locationService.create(/* ... */);
```

### 2. Implement Proper Batch Management

```typescript
// Good - Unique batch IDs
const batchId = `${orderId}-${materialId}-${Date.now()}`;

// Avoid - Duplicate batch IDs
const batchId = 'BATCH-001';
```

### 3. Use Type-Safe Custom Entities

```typescript
// Good - Strongly typed
class TypedOrderEntity extends OrderEntity {
  @Column()
  orderId!: string;
}

// Avoid - Using base entity with any
const order = await this.orderService.createOrder(OrderEntity, {
  order: { anyField: 'value' } as any,
});
```

### 4. Optimize Location Queries

```typescript
// Good - Use exactLocationMatch when appropriate
const warehouseStock = await this.stockService.find({
  locationIds: ['WH-001'],
  exactLocationMatch: false, // Include all child locations
});

// For specific location only
const binStock = await this.stockService.find({
  locationIds: ['WH-001-A-R1-B1'],
  exactLocationMatch: true, // Only this specific bin
});
```

## Migration Guide

### From Custom Implementation

```typescript
// Before - Custom stock tracking
class CustomInventoryService {
  async updateStock(product: string, quantity: number) {
    // Custom logic
  }
}

// After - Using WMS module
@Injectable()
class InventoryService {
  constructor(private orderService: OrderService) {}

  async updateStock(materialId: string, quantity: number) {
    return this.orderService.createOrder(OrderEntity, {
      order: {},
      batches: [
        {
          id: `ADJUSTMENT-${Date.now()}`,
          locationId: 'DEFAULT',
          materialId,
          quantity,
        },
      ],
    });
  }
}
```

## Troubleshooting

### Common Issues

1. **StockQuantityNotEnoughError**
   - Check if `allowNegativeStock` is configured correctly
   - Verify current stock levels before creating outbound orders

2. **LocationNotFoundError**
   - Ensure location exists before referencing in orders
   - Check if location hasn't been archived (soft deleted)

3. **Transaction Rollback**
   - Wrap multiple operations in transactions
   - Check for unique constraint violations on batch IDs

## License

MIT
