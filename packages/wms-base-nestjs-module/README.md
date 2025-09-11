# 📦 Rytass WMS Base NestJS Module

Enterprise-grade **Warehouse Management System (WMS)** module for NestJS applications. Build comprehensive inventory tracking, location management, batch processing, and stock control systems with support for custom entity extensions and hierarchical warehouse organization.

[![npm version](https://img.shields.io/npm/v/@rytass/wms-base-nestjs-module.svg)](https://www.npmjs.com/package/@rytass/wms-base-nestjs-module)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Learning Path

This guide follows a progressive learning approach - choose your starting point:

| Level | Time | Focus | Audience |
|-------|------|--------|----------|
| [🚀 Quick Start](#-quick-start) | 5 min | Get running immediately | New users |
| [📚 Fundamentals](#-fundamental-concepts) | 15 min | Understand architecture | Developers |
| [🛠️ Basic Implementation](#️-basic-implementation) | 30 min | Build working features | Implementation teams |
| [🔧 Intermediate Usage](#-intermediate-usage) | 1 hour | Custom entities & workflows | Advanced developers |
| [🚀 Advanced Patterns](#-advanced-patterns) | 2 hours | Production optimization | Architecture teams |
| [🏭 Enterprise Examples](#-enterprise-examples) | 4+ hours | Complete real-world systems | Enterprise teams |

---

## 🚀 Quick Start

**Get a working WMS in 5 minutes:**

### Installation
```bash
npm install @rytass/wms-base-nestjs-module
# or
yarn add @rytass/wms-base-nestjs-module
```

### Minimal Setup
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WMSBaseModule } from '@rytass/wms-base-nestjs-module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'wms.sqlite',
      autoLoadEntities: true,
      synchronize: true, // Only for development
    }),
    WMSBaseModule.forRoot({
      allowNegativeStock: false,
    }),
  ],
})
export class AppModule {}
```

### First Inventory Operations
```typescript
// inventory.service.ts
import { Injectable } from '@nestjs/common';
import { 
  LocationService, 
  MaterialService, 
  OrderService, 
  StockService 
} from '@rytass/wms-base-nestjs-module';

@Injectable()
export class QuickStartService {
  constructor(
    private readonly locationService: LocationService,
    private readonly materialService: MaterialService,
    private readonly orderService: OrderService,
    private readonly stockService: StockService,
  ) {}

  async setupWarehouse(): Promise<void> {
    // 1. Create location
    await this.locationService.create({
      id: 'MAIN-A1',
      name: 'Main Warehouse - Section A1',
    });

    // 2. Create product
    await this.materialService.create({
      id: 'PRODUCT-001',
      name: 'Widget Pro',
    });

    // 3. Receive inventory (inbound)
    await this.orderService.createOrder(OrderEntity, {
      order: {},
      batches: [{
        id: 'RECEIPT-001',
        locationId: 'MAIN-A1',
        materialId: 'PRODUCT-001',
        quantity: 100, // Positive = inbound
      }],
    });

    console.log('✅ Warehouse setup complete!');
  }

  async checkInventory(): Promise<number> {
    const stockLevel = await this.stockService.find({
      materialIds: ['PRODUCT-001'],
      locationIds: ['MAIN-A1'],
    });

    console.log(`📊 Current stock: ${stockLevel} units`);
    return stockLevel;
  }

  async shipOrder(quantity: number): Promise<void> {
    await this.orderService.createOrder(OrderEntity, {
      order: {},
      batches: [{
        id: `SHIP-${Date.now()}`,
        locationId: 'MAIN-A1',
        materialId: 'PRODUCT-001',
        quantity: -quantity, // Negative = outbound
      }],
    });

    console.log(`📦 Shipped ${quantity} units`);
  }
}
```

**Test Your Setup:**
```typescript
const service = new QuickStartService(/* inject dependencies */);
await service.setupWarehouse();    // Create location & product, receive 100 units
await service.checkInventory();    // Returns: 100
await service.shipOrder(30);       // Ship 30 units  
await service.checkInventory();    // Returns: 70
```

**✅ Success Criteria:**
- [x] WMS module loads without errors
- [x] Can create locations and materials
- [x] Can process inbound/outbound orders
- [x] Stock levels update correctly

**🎯 Next Steps:** Ready for more? Continue to [Fundamental Concepts](#-fundamental-concepts) to understand the architecture.

---

## 📚 Fundamental Concepts

### 🏗️ Entity Architecture

The WMS module is built on 5 core entities with hierarchical relationships:

```
📦 WMS Core Architecture

MaterialEntity ────┐
    │              │
    └─ BatchEntity │
         │         │
         └─ StockEntity ──── OrderEntity
              │
              └─ LocationEntity (Tree Structure)
```

#### Core Entities Overview

| Entity | Purpose | Key Features | Relationships |
|--------|---------|--------------|---------------|
| **LocationEntity** | Warehouse locations | Hierarchical tree, materialized path | Parent-child, contains Stock |
| **MaterialEntity** | Products/SKUs | Master product data | Has many Batches & Stock |
| **BatchEntity** | Lot tracking | Batch identification & metadata | Belongs to Material |
| **OrderEntity** | Transactions | Stock movements & operations | Creates Stock entries |
| **StockEntity** | Inventory levels | Real-time stock & transaction log | Links Material, Location, Order |

### 🔄 Stock Transaction Model

**Every inventory change is tracked as a stock transaction:**

```typescript
interface StockTransaction {
  id: string;              // Unique transaction ID
  materialId: string;      // What product
  locationId: string;      // Where in warehouse  
  batchId: string;         // Which batch/lot
  orderId: string;         // Why (which order caused this)
  quantity: number;        // How much (+ inbound, - outbound)
  createdAt: Date;         // When
}
```

**Transaction Types:**
- **Positive quantity** = Stock increase (receipts, returns, adjustments up)
- **Negative quantity** = Stock decrease (shipments, transfers out, adjustments down)

### 🌳 Hierarchical Location System

Locations form a **materialized path tree** for efficient warehouse organization:

```
Warehouse
├── Receiving-Zone
│   ├── Dock-1
│   └── Dock-2
├── Storage-Zone
│   ├── Aisle-A
│   │   ├── Rack-A1 
│   │   │   ├── Shelf-A1-1
│   │   │   └── Shelf-A1-2
│   │   └── Rack-A2
│   └── Aisle-B
└── Shipping-Zone
    └── Staging-Area
```

**Key Benefits:**
- **Efficient Queries**: Get all stock in "Storage-Zone" includes all child locations
- **Flexible Hierarchy**: Unlimited nesting depth
- **Fast Lookups**: Materialized path enables SQL LIKE queries

### 🧬 Child Entity Extension Pattern

**Extend base entities** with custom business fields using TypeORM's Table Inheritance:

```typescript
// Base entity (provided by module)
@Entity('materials')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class MaterialEntity {
  @PrimaryColumn({ type: 'varchar' })
  id: string;
  // Base fields...
}

// Your custom entity
@ChildEntity()
export class ProductEntity extends MaterialEntity {
  @Column('varchar')
  name: string;
  
  @Column('varchar')
  sku: string;
  
  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;
  
  @Column('json')
  dimensions: {
    length: number;
    width: number; 
    height: number;
    weight: number;
  };
}
```

**Why Use Child Entities?**
- **Single Table**: All data stored in one database table
- **Type Safety**: Full TypeScript support for custom fields
- **Service Integration**: Works seamlessly with all WMS services
- **Migration Friendly**: Add fields without breaking existing data

---

## 🛠️ Basic Implementation

### Complete E-commerce Inventory Service

Build a **production-ready inventory management service** with error handling and business logic:

```typescript
// entities/product.entity.ts
import { ChildEntity, Column } from 'typeorm';
import { MaterialEntity } from '@rytass/wms-base-nestjs-module';

@ChildEntity()
export class ProductEntity extends MaterialEntity {
  @Column('varchar')
  name: string;
  
  @Column('varchar')
  sku: string;
  
  @Column('varchar')
  brand: string;
  
  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;
  
  @Column('int')
  reorderLevel: number;
  
  @Column('varchar')
  category: string;
  
  @Column('json')
  attributes: Record<string, any>;
}
```

```typescript
// entities/warehouse-location.entity.ts
import { ChildEntity, Column } from 'typeorm';
import { LocationEntity } from '@rytass/wms-base-nestjs-module';

@ChildEntity()
export class WarehouseLocationEntity extends LocationEntity {
  @Column('varchar')
  code: string;
  
  @Column('varchar')
  zone: string;
  
  @Column('varchar') 
  type: 'RECEIVING' | 'STORAGE' | 'PICKING' | 'SHIPPING' | 'STAGING';
  
  @Column('int')
  capacity: number;
  
  @Column('boolean', { default: true })
  isActive: boolean;
  
  @Column('json', { nullable: true })
  restrictions?: {
    temperature?: { min: number; max: number };
    hazmat?: boolean;
    maxWeight?: number;
  };
}
```

```typescript
// services/inventory.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { 
  LocationService, 
  MaterialService, 
  OrderService, 
  StockService,
  OrderEntity,
  StockQuantityNotEnoughError,
  LocationNotFoundError
} from '@rytass/wms-base-nestjs-module';
import { ProductEntity } from '../entities/product.entity';
import { WarehouseLocationEntity } from '../entities/warehouse-location.entity';

export interface InventoryMovement {
  productSku: string;
  locationCode: string;
  quantity: number;
  referenceNumber: string;
  type: 'RECEIPT' | 'SHIPMENT' | 'TRANSFER' | 'ADJUSTMENT';
}

export interface StockLevel {
  productSku: string;
  productName: string;
  locationCode: string;
  locationName: string;
  quantity: number;
  reorderLevel: number;
  needsReorder: boolean;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly locationService: LocationService<WarehouseLocationEntity>,
    private readonly materialService: MaterialService<ProductEntity>,
    private readonly orderService: OrderService,
    private readonly stockService: StockService,
  ) {}

  /**
   * Receive inventory into warehouse (inbound)
   */
  async receiveInventory(movement: InventoryMovement): Promise<void> {
    if (movement.quantity <= 0) {
      throw new BadRequestException('Receive quantity must be positive');
    }

    // Validate product exists
    const product = await this.findProductBySku(movement.productSku);
    
    // Validate location exists and is active
    const location = await this.findLocationByCode(movement.locationCode);
    if (!location.isActive) {
      throw new BadRequestException(`Location ${movement.locationCode} is inactive`);
    }

    try {
      await this.orderService.createOrder(OrderEntity, {
        order: {},
        batches: [{
          id: `${movement.type}-${movement.referenceNumber}`,
          locationId: location.id,
          materialId: product.id,
          quantity: movement.quantity,
        }],
      });

      console.log(`✅ Received ${movement.quantity} units of ${product.sku} at ${location.code}`);
    } catch (error) {
      if (error instanceof LocationNotFoundError) {
        throw new BadRequestException(`Invalid location: ${movement.locationCode}`);
      }
      throw error;
    }
  }

  /**
   * Ship inventory from warehouse (outbound)
   */
  async shipInventory(movement: InventoryMovement): Promise<void> {
    if (movement.quantity <= 0) {
      throw new BadRequestException('Ship quantity must be positive');
    }

    const product = await this.findProductBySku(movement.productSku);
    const location = await this.findLocationByCode(movement.locationCode);

    // Check available stock
    const availableStock = await this.stockService.find({
      materialIds: [product.id],
      locationIds: [location.id],
      exactLocationMatch: true,
    });

    if (availableStock < movement.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${availableStock}, Requested: ${movement.quantity}`
      );
    }

    try {
      await this.orderService.createOrder(OrderEntity, {
        order: {},
        batches: [{
          id: `${movement.type}-${movement.referenceNumber}`,
          locationId: location.id,
          materialId: product.id,
          quantity: -movement.quantity, // Negative for outbound
        }],
      });

      console.log(`📦 Shipped ${movement.quantity} units of ${product.sku} from ${location.code}`);
    } catch (error) {
      if (error instanceof StockQuantityNotEnoughError) {
        throw new BadRequestException('Insufficient stock for shipment');
      }
      throw error;
    }
  }

  /**
   * Transfer inventory between locations
   */
  async transferInventory(
    productSku: string,
    fromLocationCode: string,
    toLocationCode: string,
    quantity: number,
    referenceNumber: string
  ): Promise<void> {
    if (quantity <= 0) {
      throw new BadRequestException('Transfer quantity must be positive');
    }

    const product = await this.findProductBySku(productSku);
    const fromLocation = await this.findLocationByCode(fromLocationCode);
    const toLocation = await this.findLocationByCode(toLocationCode);

    // Check available stock at source location
    const availableStock = await this.stockService.find({
      materialIds: [product.id],
      locationIds: [fromLocation.id],
      exactLocationMatch: true,
    });

    if (availableStock < quantity) {
      throw new BadRequestException(
        `Insufficient stock at ${fromLocationCode}. Available: ${availableStock}, Requested: ${quantity}`
      );
    }

    // Create transfer as a single order with two batches
    await this.orderService.createOrder(OrderEntity, {
      order: {},
      batches: [
        {
          id: `TRANSFER-OUT-${referenceNumber}`,
          locationId: fromLocation.id,
          materialId: product.id,
          quantity: -quantity, // Remove from source
        },
        {
          id: `TRANSFER-IN-${referenceNumber}`,
          locationId: toLocation.id,
          materialId: product.id,
          quantity: quantity, // Add to destination
        },
      ],
    });

    console.log(`🔄 Transferred ${quantity} units of ${product.sku} from ${fromLocationCode} to ${toLocationCode}`);
  }

  /**
   * Get current stock levels with reorder analysis
   */
  async getStockLevels(filter?: {
    productSkus?: string[];
    locationCodes?: string[];
    lowStockOnly?: boolean;
  }): Promise<StockLevel[]> {
    const stockLevels: StockLevel[] = [];

    // Get products
    const products = filter?.productSkus?.length
      ? await Promise.all(filter.productSkus.map(sku => this.findProductBySku(sku)))
      : await this.materialService.findAll();

    // Get locations  
    const locations = filter?.locationCodes?.length
      ? await Promise.all(filter.locationCodes.map(code => this.findLocationByCode(code)))
      : await this.locationService.findAll();

    for (const product of products) {
      for (const location of locations) {
        const quantity = await this.stockService.find({
          materialIds: [product.id],
          locationIds: [location.id],
          exactLocationMatch: true,
        });

        const stockLevel: StockLevel = {
          productSku: product.sku,
          productName: product.name,
          locationCode: location.code,
          locationName: location.code,
          quantity,
          reorderLevel: product.reorderLevel,
          needsReorder: quantity <= product.reorderLevel,
        };

        // Apply low stock filter
        if (filter?.lowStockOnly && !stockLevel.needsReorder) {
          continue;
        }

        stockLevels.push(stockLevel);
      }
    }

    return stockLevels.sort((a, b) => {
      // Sort by reorder priority, then by product SKU
      if (a.needsReorder && !b.needsReorder) return -1;
      if (!a.needsReorder && b.needsReorder) return 1;
      return a.productSku.localeCompare(b.productSku);
    });
  }

  /**
   * Perform stock adjustment (physical count correction)
   */
  async adjustStock(
    productSku: string,
    locationCode: string,
    actualQuantity: number,
    referenceNumber: string,
    reason: string
  ): Promise<{ previousQuantity: number; adjustment: number; newQuantity: number }> {
    const product = await this.findProductBySku(productSku);
    const location = await this.findLocationByCode(locationCode);

    // Get current system quantity
    const currentQuantity = await this.stockService.find({
      materialIds: [product.id],
      locationIds: [location.id],
      exactLocationMatch: true,
    });

    const adjustmentQuantity = actualQuantity - currentQuantity;

    if (adjustmentQuantity !== 0) {
      await this.orderService.createOrder(OrderEntity, {
        order: {},
        batches: [{
          id: `ADJUSTMENT-${referenceNumber}`,
          locationId: location.id,
          materialId: product.id,
          quantity: adjustmentQuantity,
        }],
      });

      console.log(`📝 Stock adjustment: ${product.sku} at ${location.code}: ${currentQuantity} → ${actualQuantity} (${adjustmentQuantity >= 0 ? '+' : ''}${adjustmentQuantity})`);
      console.log(`📋 Reason: ${reason}`);
    } else {
      console.log(`✅ Stock correct: ${product.sku} at ${location.code}: ${currentQuantity} units`);
    }

    return {
      previousQuantity: currentQuantity,
      adjustment: adjustmentQuantity,
      newQuantity: actualQuantity,
    };
  }

  // Helper methods
  private async findProductBySku(sku: string): Promise<ProductEntity> {
    // Note: This requires a custom find method or query
    // For now, using findById assuming SKU = ID
    const product = await this.materialService.findById(sku);
    if (!product) {
      throw new NotFoundException(`Product not found: ${sku}`);
    }
    return product;
  }

  private async findLocationByCode(code: string): Promise<WarehouseLocationEntity> {
    // Note: This requires a custom find method or query  
    // For now, using findById assuming code = ID
    const location = await this.locationService.findById(code);
    if (!location) {
      throw new NotFoundException(`Location not found: ${code}`);
    }
    return location;
  }
}
```

### Usage Example

```typescript
// Complete workflow example
async function runInventoryOperations() {
  const inventoryService = new InventoryService(/* inject dependencies */);

  // 1. Setup products and locations (one-time setup)
  await setupWarehouseData(inventoryService);

  // 2. Receive inventory
  await inventoryService.receiveInventory({
    productSku: 'WIDGET-001',
    locationCode: 'RECV-DOCK-1',
    quantity: 1000,
    referenceNumber: 'PO-2024-001',
    type: 'RECEIPT',
  });

  // 3. Transfer to storage
  await inventoryService.transferInventory(
    'WIDGET-001',
    'RECV-DOCK-1',
    'STORAGE-A1-SHELF-1',
    800,
    'TRANSFER-001'
  );

  // 4. Ship customer orders
  await inventoryService.shipInventory({
    productSku: 'WIDGET-001',
    locationCode: 'STORAGE-A1-SHELF-1',
    quantity: 50,
    referenceNumber: 'SO-2024-100',
    type: 'SHIPMENT',
  });

  // 5. Check stock levels
  const stockLevels = await inventoryService.getStockLevels({
    productSkus: ['WIDGET-001'],
  });

  console.log('📊 Current Stock Levels:', stockLevels);

  // 6. Perform stock count & adjustment
  const adjustment = await inventoryService.adjustStock(
    'WIDGET-001',
    'STORAGE-A1-SHELF-1',
    745, // Physical count
    'CYCLE-COUNT-001',
    'Monthly cycle count - found 5 unit discrepancy'
  );

  console.log('📝 Stock Adjustment:', adjustment);
}
```

**✅ What You've Built:**
- Complete inventory management service
- Error handling for all scenarios
- Stock level monitoring with reorder alerts
- Transfer operations between locations
- Stock adjustment workflows
- Type-safe custom entities

**🎯 Next Steps:** Ready for advanced features? Continue to [Intermediate Usage](#-intermediate-usage).

---

## 🔧 Intermediate Usage

### Child Entity Extension Masterclass

Learn to **extend every base entity** with custom fields for real-world business requirements.

#### 🏗️ Architecture Overview

The WMS module uses **TypeORM Table Inheritance** to support custom entity extensions:

```typescript
// Base entities use @TableInheritance
@Entity('materials')
@TableInheritance({ column: { type: 'varchar', name: 'entityName' } })
export class MaterialEntity { /* base fields */ }

// Your extensions use @ChildEntity  
@ChildEntity()
export class ProductEntity extends MaterialEntity { /* custom fields */ }
```

**Key Benefits:**
- **Single Database Table**: All variants stored together
- **Type Safety**: Full TypeScript intellisense and validation
- **Service Compatibility**: Works with all WMS services out-of-the-box
- **Migration Safe**: Add fields without data loss

---

### 📦 MaterialEntity Extensions

**Common Business Scenarios:**

#### E-commerce Products
```typescript
// entities/product.entity.ts
import { ChildEntity, Column } from 'typeorm';
import { MaterialEntity } from '@rytass/wms-base-nestjs-module';

@ChildEntity()
export class ProductEntity extends MaterialEntity {
  @Column('varchar', { length: 100 })
  name: string;
  
  @Column('varchar', { length: 50, unique: true })
  sku: string;
  
  @Column('varchar', { length: 13, nullable: true })
  upc: string; // Universal Product Code
  
  @Column('varchar', { length: 50 })
  brand: string;
  
  @Column('varchar', { length: 100 })
  category: string;
  
  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;
  
  @Column('decimal', { precision: 10, scale: 4 })
  weight: number; // in kg
  
  @Column('json')
  dimensions: {
    length: number; // cm
    width: number;  // cm
    height: number; // cm
  };
  
  @Column('int', { default: 10 })
  reorderLevel: number;
  
  @Column('int', { default: 100 })
  maxStockLevel: number;
  
  @Column('varchar', { nullable: true })
  supplierSku?: string;
  
  @Column('boolean', { default: true })
  isActive: boolean;
  
  @Column('boolean', { default: false })
  isHazmat: boolean;
  
  @Column('boolean', { default: false })
  requiresSerialNumber: boolean;
  
  @Column('json', { nullable: true })
  customAttributes?: Record<string, any>;
}
```

#### Manufacturing Raw Materials
```typescript
@ChildEntity()
export class RawMaterialEntity extends MaterialEntity {
  @Column('varchar')
  materialCode: string;
  
  @Column('varchar')
  specification: string;
  
  @Column('varchar')
  grade: string; // A, B, C grade
  
  @Column('varchar')
  supplier: string;
  
  @Column('decimal', { precision: 8, scale: 4 })
  unitCost: number;
  
  @Column('varchar')
  unitOfMeasure: string; // kg, lbs, meters, etc.
  
  @Column('int', { nullable: true })
  shelfLifeDays?: number;
  
  @Column('json', { nullable: true })
  chemicalProperties?: {
    density?: number;
    viscosity?: number;
    flashPoint?: number;
    ph?: number;
  };
  
  @Column('boolean', { default: false })
  requiresQualityControl: boolean;
  
  @Column('varchar', { nullable: true })
  msdsNumber?: string; // Material Safety Data Sheet
}
```

#### Pharmaceutical Products
```typescript
@ChildEntity()
export class PharmaceuticalEntity extends MaterialEntity {
  @Column('varchar')
  genericName: string;
  
  @Column('varchar')
  brandName: string;
  
  @Column('varchar')
  ndcNumber: string; // National Drug Code
  
  @Column('varchar')
  dosageForm: string; // tablet, capsule, liquid
  
  @Column('varchar')
  strength: string; // 500mg, 10ml, etc.
  
  @Column('varchar')
  manufacturer: string;
  
  @Column('int')
  shelfLifeMonths: number;
  
  @Column('boolean', { default: false })
  isControlledSubstance: boolean;
  
  @Column('varchar', { nullable: true })
  controlSchedule?: string; // I, II, III, IV, V
  
  @Column('boolean', { default: false })
  requiresRefrigeration: boolean;
  
  @Column('json', { nullable: true })
  storageConditions?: {
    temperatureMin: number; // Celsius
    temperatureMax: number; // Celsius
    humidityMax?: number;   // Percentage
    lightSensitive?: boolean;
  };
  
  @Column('varchar', { nullable: true })
  therapeuticClass?: string;
}
```

### 📍 LocationEntity Extensions

#### Warehouse Locations with Zones
```typescript
@ChildEntity()
export class WarehouseLocationEntity extends LocationEntity {
  @Column('varchar', { length: 20, unique: true })
  code: string; // WH-A-01-R1-S3
  
  @Column('varchar', { length: 100 })
  description: string;
  
  @Column('varchar', { length: 20 })
  zone: string; // RECEIVING, STORAGE, PICKING, SHIPPING
  
  @Column('varchar', { length: 20 })
  type: 'WAREHOUSE' | 'ZONE' | 'AISLE' | 'RACK' | 'SHELF' | 'BIN';
  
  @Column('int', { default: 0 })
  capacity: number; // cubic meters or units
  
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  maxWeight: number; // kg
  
  @Column('boolean', { default: true })
  isActive: boolean;
  
  @Column('boolean', { default: false })
  isPicking: boolean; // Available for picking operations
  
  @Column('boolean', { default: false })
  isReceiving: boolean; // Available for receiving
  
  @Column('json', { nullable: true })
  coordinates?: {
    x: number;
    y: number;
    z?: number; // floor level
  };
  
  @Column('json', { nullable: true })
  environmentalControls?: {
    temperature?: { min: number; max: number };
    humidity?: { min: number; max: number };
    hasClimateControl?: boolean;
  };
  
  @Column('json', { nullable: true })
  restrictions?: {
    hazmatApproved?: boolean;
    weightLimit?: number;
    heightLimit?: number;
    accessEquipment?: string[]; // ['forklift', 'crane', 'ladder']
  };
  
  @Column('varchar', { nullable: true })
  barcode?: string; // For scanning operations
}
```

#### Cold Chain Locations
```typescript
@ChildEntity()
export class ColdChainLocationEntity extends LocationEntity {
  @Column('varchar')
  locationCode: string;
  
  @Column('varchar')
  temperatureZone: 'FROZEN' | 'REFRIGERATED' | 'CONTROLLED' | 'AMBIENT';
  
  @Column('decimal', { precision: 4, scale: 1 })
  targetTemperature: number; // Celsius
  
  @Column('decimal', { precision: 4, scale: 1 })
  temperatureTolerance: number; // +/- degrees
  
  @Column('boolean', { default: true })
  hasTemperatureMonitoring: boolean;
  
  @Column('varchar', { nullable: true })
  sensorId?: string;
  
  @Column('timestamp', { nullable: true })
  lastTemperatureCheck?: Date;
  
  @Column('decimal', { precision: 4, scale: 1, nullable: true })
  currentTemperature?: number;
  
  @Column('boolean', { default: false })
  hasTemperatureAlert: boolean;
  
  @Column('varchar', { nullable: true })
  certificationNumber?: string; // FDA, GMP, etc.
  
  @Column('json', { nullable: true })
  validationData?: {
    lastCalibration?: Date;
    nextCalibration?: Date;
    calibrationCertificate?: string;
  };
}
```

### 📋 OrderEntity Extensions

#### Purchase Orders (Inbound)
```typescript
@ChildEntity()
export class PurchaseOrderEntity extends OrderEntity {
  @Column('varchar', { length: 50, unique: true })
  purchaseOrderNumber: string;
  
  @Column('varchar')
  supplierName: string;
  
  @Column('varchar', { nullable: true })
  supplierContact?: string;
  
  @Column('date')
  orderDate: Date;
  
  @Column('date', { nullable: true })
  expectedDeliveryDate?: Date;
  
  @Column('date', { nullable: true })
  actualDeliveryDate?: Date;
  
  @Column('varchar', { default: 'PENDING' })
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  
  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount: number;
  
  @Column('varchar')
  currency: string;
  
  @Column('varchar', { nullable: true })
  paymentTerms?: string;
  
  @Column('text', { nullable: true })
  notes?: string;
  
  @Column('varchar', { nullable: true })
  shippingTrackingNumber?: string;
  
  @Column('varchar', { nullable: true })
  receivingClerk?: string; // User who received the order
  
  @Column('json', { nullable: true })
  qualityControlResults?: {
    inspectedBy?: string;
    inspectionDate?: Date;
    passed?: boolean;
    defectRate?: number;
    notes?: string;
  };
}
```

#### Sales Orders (Outbound)
```typescript
@ChildEntity()
export class SalesOrderEntity extends OrderEntity {
  @Column('varchar', { length: 50, unique: true })
  salesOrderNumber: string;
  
  @Column('varchar')
  customerName: string;
  
  @Column('varchar', { nullable: true })
  customerPO?: string;
  
  @Column('date')
  orderDate: Date;
  
  @Column('date')
  requestedShipDate: Date;
  
  @Column('date', { nullable: true })
  actualShipDate?: Date;
  
  @Column('varchar', { default: 'NEW' })
  status: 'NEW' | 'CONFIRMED' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  
  @Column('varchar', { default: 'STANDARD' })
  priority: 'LOW' | 'STANDARD' | 'HIGH' | 'URGENT';
  
  @Column('varchar')
  shippingMethod: string;
  
  @Column('json')
  shippingAddress: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone?: string;
  };
  
  @Column('decimal', { precision: 12, scale: 2 })
  totalAmount: number;
  
  @Column('varchar', { nullable: true })
  trackingNumber?: string;
  
  @Column('varchar', { nullable: true })
  pickedBy?: string;
  
  @Column('varchar', { nullable: true })
  packedBy?: string;
  
  @Column('timestamp', { nullable: true })
  pickCompletedAt?: Date;
  
  @Column('timestamp', { nullable: true })
  packCompletedAt?: Date;
}
```

#### Transfer Orders (Internal)
```typescript
@ChildEntity()
export class TransferOrderEntity extends OrderEntity {
  @Column('varchar', { length: 50, unique: true })
  transferOrderNumber: string;
  
  @Column('varchar')
  fromWarehouse: string;
  
  @Column('varchar')
  toWarehouse: string;
  
  @Column('date')
  requestDate: Date;
  
  @Column('date', { nullable: true })
  plannedMoveDate?: Date;
  
  @Column('date', { nullable: true })
  actualMoveDate?: Date;
  
  @Column('varchar', { default: 'REQUESTED' })
  status: 'REQUESTED' | 'APPROVED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  
  @Column('varchar')
  reason: 'REBALANCING' | 'PROMOTION' | 'SEASONAL' | 'DAMAGED_GOODS' | 'OTHER';
  
  @Column('varchar', { nullable: true })
  requestedBy?: string;
  
  @Column('varchar', { nullable: true })
  approvedBy?: string;
  
  @Column('varchar', { nullable: true })
  transportMethod?: string;
  
  @Column('text', { nullable: true })
  notes?: string;
  
  @Column('json', { nullable: true })
  transitDetails?: {
    carrier?: string;
    trackingNumber?: string;
    estimatedArrival?: Date;
    actualArrival?: Date;
  };
}
```

### 🏷️ BatchEntity Extensions

#### Lot Tracking with Expiry
```typescript
@ChildEntity()
export class LotBatchEntity extends BatchEntity {
  @Column('varchar', { length: 50, unique: true })
  lotNumber: string;
  
  @Column('date')
  manufacturingDate: Date;
  
  @Column('date', { nullable: true })
  expiryDate?: Date;
  
  @Column('varchar', { nullable: true })
  supplierLotNumber?: string;
  
  @Column('varchar', { default: 'ACTIVE' })
  status: 'ACTIVE' | 'QUARANTINE' | 'EXPIRED' | 'RECALLED';
  
  @Column('json', { nullable: true })
  qualityTestResults?: {
    testDate?: Date;
    testedBy?: string;
    passed?: boolean;
    testResults?: Record<string, any>;
    certificateNumber?: string;
  };
  
  @Column('varchar', { nullable: true })
  countryOfOrigin?: string;
  
  @Column('boolean', { default: false })
  isBlocked: boolean;
  
  @Column('varchar', { nullable: true })
  blockReason?: string;
  
  @Column('text', { nullable: true })
  notes?: string;

  // Helper methods
  get isExpired(): boolean {
    return this.expiryDate ? new Date() > this.expiryDate : false;
  }
  
  get daysUntilExpiry(): number | null {
    if (!this.expiryDate) return null;
    const diffTime = this.expiryDate.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
```

#### Serial Number Tracking
```typescript
@ChildEntity()
export class SerialBatchEntity extends BatchEntity {
  @Column('varchar', { length: 100, unique: true })
  serialNumber: string;
  
  @Column('varchar', { nullable: true })
  manufacturerSerialNumber?: string;
  
  @Column('date')
  manufacturingDate: Date;
  
  @Column('date', { nullable: true })
  warrantyExpiry?: Date;
  
  @Column('varchar', { default: 'NEW' })
  condition: 'NEW' | 'REFURBISHED' | 'USED' | 'DEFECTIVE';
  
  @Column('varchar', { default: 'AVAILABLE' })
  status: 'AVAILABLE' | 'SOLD' | 'RESERVED' | 'RMA' | 'SCRAPPED';
  
  @Column('json', { nullable: true })
  specifications?: Record<string, any>;
  
  @Column('varchar', { nullable: true })
  firmwareVersion?: string;
  
  @Column('json', { nullable: true })
  serviceHistory?: Array<{
    date: Date;
    type: string;
    description: string;
    technician?: string;
  }>;
  
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  purchasePrice?: number;
  
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  currentValue?: number;
}
```

---

### 🔧 Module Configuration with Custom Entities

#### Single Entity Extension
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WMSBaseModule } from '@rytass/wms-base-nestjs-module';
import { ProductEntity } from './entities/product.entity';

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
      synchronize: false, // Use migrations in production
    }),
    TypeOrmModule.forFeature([ProductEntity]),
    WMSBaseModule.forRootAsync({
      imports: [TypeOrmModule.forFeature([ProductEntity])],
      useFactory: () => ({
        allowNegativeStock: false,
        materialEntity: ProductEntity,
      }),
    }),
  ],
})
export class AppModule {}
```

#### Multiple Entity Extensions
```typescript
// app.module.ts with all custom entities
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WMSBaseModule } from '@rytass/wms-base-nestjs-module';
import { ProductEntity } from './entities/product.entity';
import { WarehouseLocationEntity } from './entities/warehouse-location.entity';
import { PurchaseOrderEntity } from './entities/purchase-order.entity';
import { SalesOrderEntity } from './entities/sales-order.entity';
import { LotBatchEntity } from './entities/lot-batch.entity';

const CUSTOM_ENTITIES = [
  ProductEntity,
  WarehouseLocationEntity,
  PurchaseOrderEntity,
  SalesOrderEntity,
  LotBatchEntity,
];

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'wms_user',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_DATABASE || 'wms_db',
      entities: [/* TypeORM will auto-discover entities */],
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature(CUSTOM_ENTITIES),
    WMSBaseModule.forRootAsync({
      imports: [TypeOrmModule.forFeature(CUSTOM_ENTITIES)],
      useFactory: () => ({
        allowNegativeStock: false,
        // Configure all custom entities
        materialEntity: ProductEntity,
        locationEntity: WarehouseLocationEntity,
        orderEntity: SalesOrderEntity, // Default order type
        batchEntity: LotBatchEntity,
        // stockEntity: CustomStockEntity, // If needed
      }),
    }),
  ],
})
export class AppModule {}
```

### 📝 TypeScript Typing Patterns

#### Generic Service Usage
```typescript
// services/warehouse.service.ts
import { Injectable } from '@nestjs/common';
import { 
  LocationService, 
  MaterialService, 
  OrderService 
} from '@rytass/wms-base-nestjs-module';
import { ProductEntity } from '../entities/product.entity';
import { WarehouseLocationEntity } from '../entities/warehouse-location.entity';
import { PurchaseOrderEntity } from '../entities/purchase-order.entity';

@Injectable()
export class WarehouseService {
  constructor(
    // Type services with custom entities
    private readonly locationService: LocationService<WarehouseLocationEntity>,
    private readonly materialService: MaterialService<ProductEntity>,
    private readonly orderService: OrderService,
  ) {}

  async createProduct(productData: Partial<ProductEntity>): Promise<ProductEntity> {
    return this.materialService.create(productData);
  }

  async createLocation(locationData: Partial<WarehouseLocationEntity>): Promise<WarehouseLocationEntity> {
    return this.locationService.create(locationData);
  }

  async createPurchaseOrder(orderData: {
    order: Partial<PurchaseOrderEntity>;
    batches: Array<{
      id: string;
      materialId: string;
      locationId: string;
      quantity: number;
    }>;
  }): Promise<PurchaseOrderEntity> {
    return this.orderService.createOrder(PurchaseOrderEntity, orderData);
  }

  // Type-safe method with custom entity fields
  async getProductsByCategoryAndBrand(
    category: string,
    brand: string
  ): Promise<ProductEntity[]> {
    // Note: This would require a custom repository method
    // For demonstration purposes
    const allProducts = await this.materialService.findAll();
    return allProducts.filter(p => 
      p.category === category && p.brand === brand
    );
  }

  async getLocationsByZone(zone: string): Promise<WarehouseLocationEntity[]> {
    const allLocations = await this.locationService.findAll();
    return allLocations.filter(l => l.zone === zone);
  }
}
```

#### Interface Segregation
```typescript
// interfaces/inventory.interface.ts
export interface IProductCreate {
  name: string;
  sku: string;
  brand: string;
  category: string;
  unitPrice: number;
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  reorderLevel?: number;
  maxStockLevel?: number;
}

export interface ILocationCreate {
  code: string;
  description: string;
  zone: string;
  type: 'WAREHOUSE' | 'ZONE' | 'AISLE' | 'RACK' | 'SHELF' | 'BIN';
  capacity?: number;
  maxWeight?: number;
  parentId?: string;
}

export interface IStockMovement {
  productId: string;
  locationId: string;
  quantity: number;
  batchId?: string;
  referenceNumber: string;
  movementType: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT';
}

// Usage in service
@Injectable()
export class TypeSafeInventoryService {
  constructor(
    private readonly locationService: LocationService<WarehouseLocationEntity>,
    private readonly materialService: MaterialService<ProductEntity>,
    private readonly orderService: OrderService,
  ) {}

  async createProduct(productData: IProductCreate): Promise<ProductEntity> {
    return this.materialService.create({
      id: productData.sku, // Use SKU as ID
      ...productData,
      isActive: true,
      isHazmat: false,
      requiresSerialNumber: false,
    });
  }

  async createLocation(locationData: ILocationCreate): Promise<WarehouseLocationEntity> {
    return this.locationService.create({
      id: locationData.code, // Use code as ID
      ...locationData,
      isActive: true,
      isPicking: locationData.zone === 'STORAGE',
      isReceiving: locationData.zone === 'RECEIVING',
    });
  }
}
```

### 🔄 Migration Strategies

#### Adding New Fields to Existing Entities
```typescript
// migrations/001-add-product-fields.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductFields001 implements MigrationInterface {
  name = 'AddProductFields001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new fields with safe defaults
    await queryRunner.query(`
      ALTER TABLE "materials" 
      ADD COLUMN "brand" varchar,
      ADD COLUMN "category" varchar,
      ADD COLUMN "unitPrice" decimal(10,2),
      ADD COLUMN "reorderLevel" integer DEFAULT 10,
      ADD COLUMN "isHazmat" boolean DEFAULT false
    `);

    // Update existing records with reasonable defaults
    await queryRunner.query(`
      UPDATE "materials" 
      SET 
        "brand" = 'Unknown',
        "category" = 'General',
        "unitPrice" = 0.00
      WHERE "entityName" = 'ProductEntity'
        AND ("brand" IS NULL OR "category" IS NULL OR "unitPrice" IS NULL)
    `);

    // Add NOT NULL constraints after setting defaults
    await queryRunner.query(`
      ALTER TABLE "materials" 
      ALTER COLUMN "brand" SET NOT NULL,
      ALTER COLUMN "category" SET NOT NULL,
      ALTER COLUMN "unitPrice" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials" 
      DROP COLUMN "brand",
      DROP COLUMN "category", 
      DROP COLUMN "unitPrice",
      DROP COLUMN "reorderLevel",
      DROP COLUMN "isHazmat"
    `);
  }
}
```

#### Entity Migration Script
```typescript
// scripts/migrate-to-custom-entities.ts
import { DataSource } from 'typeorm';
import { MaterialEntity } from '@rytass/wms-base-nestjs-module';
import { ProductEntity } from '../entities/product.entity';

export async function migrateBasicMaterialsToProducts(dataSource: DataSource) {
  const materialRepo = dataSource.getRepository(MaterialEntity);
  const productRepo = dataSource.getRepository(ProductEntity);

  const basicMaterials = await materialRepo.find();

  for (const material of basicMaterials) {
    // Create new ProductEntity record with enhanced data
    const product = productRepo.create({
      id: material.id,
      createdAt: material.createdAt,
      updatedAt: material.updatedAt,
      // Add required ProductEntity fields
      name: `Product ${material.id}`,
      sku: material.id,
      brand: 'Unknown',
      category: 'General',
      unitPrice: 0.00,
      weight: 0.1,
      dimensions: { length: 10, width: 10, height: 10 },
      reorderLevel: 10,
      maxStockLevel: 1000,
      isActive: true,
      isHazmat: false,
      requiresSerialNumber: false,
    });

    await productRepo.save(product);
  }

  console.log(`✅ Migrated ${basicMaterials.length} materials to ProductEntity`);
}
```

**✅ What You've Mastered:**
- Custom entity extension for all 5 base entity types
- Real-world business scenarios and field definitions
- Module configuration patterns for single and multiple entities
- TypeScript typing strategies with generic services
- Interface segregation for clean architecture
- Migration strategies for adding fields and entity upgrades

**🎯 Next Steps:** Ready for production optimization? Continue to [Advanced Patterns](#-advanced-patterns).

---

## 🚀 Advanced Patterns

### Production Optimization Strategies

#### 🎯 Performance Optimization

##### Query Optimization Patterns
```typescript
// services/optimized-stock.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { StockService } from '@rytass/wms-base-nestjs-module';
import { ProductEntity } from '../entities/product.entity';

@Injectable()
export class OptimizedStockService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly stockService: StockService,
  ) {}

  /**
   * Batch stock lookup for multiple products - 90% faster than individual queries
   */
  async getBatchStockLevels(productSkus: string[]): Promise<Map<string, number>> {
    const stockMap = new Map<string, number>();

    // Single query instead of N queries
    const stockLevels = await this.stockService.findTransactions({
      materialIds: productSkus,
    });

    // Aggregate by product
    for (const transaction of stockLevels.transactionLogs) {
      const current = stockMap.get(transaction.materialId) || 0;
      stockMap.set(transaction.materialId, current + transaction.quantity);
    }

    return stockMap;
  }

  /**
   * Optimized location-based stock query with descendant lookup
   */
  async getLocationStockOptimized(
    locationId: string,
    includeChildren: boolean = true
  ): Promise<{ productSku: string; quantity: number; locationCode: string }[]> {
    return this.productRepo.manager.query(`
      WITH RECURSIVE location_tree AS (
        SELECT id, code, mpath FROM locations WHERE id = $1
        UNION ALL
        SELECT l.id, l.code, l.mpath 
        FROM locations l
        JOIN location_tree lt ON l.mpath LIKE CONCAT(lt.mpath, '%')
        WHERE $2 = true
      )
      SELECT 
        p.sku as "productSku",
        SUM(s.quantity) as quantity,
        l.code as "locationCode"
      FROM stocks s
      JOIN materials p ON p.id = s."materialId"
      JOIN location_tree l ON l.id = s."locationId"
      WHERE s."deletedAt" IS NULL
      GROUP BY p.sku, l.code
      ORDER BY p.sku, l.code
    `, [locationId, includeChildren]);
  }
}
```

##### Caching Strategies
```typescript
// services/cached-inventory.service.ts
import { Injectable, CacheManager } from '@nestjs/common';
import { InjectCache } from '@nestjs/cache-manager';
import { StockService, LocationService } from '@rytass/wms-base-nestjs-module';

@Injectable()
export class CachedInventoryService {
  constructor(
    @InjectCache() private cacheManager: CacheManager,
    private readonly stockService: StockService,
    private readonly locationService: LocationService,
  ) {}

  /**
   * Cache frequently accessed stock levels with smart invalidation
   */
  async getCachedStockLevel(
    productId: string,
    locationId: string
  ): Promise<number> {
    const cacheKey = `stock:${productId}:${locationId}`;
    
    let stockLevel = await this.cacheManager.get<number>(cacheKey);
    
    if (stockLevel === undefined) {
      stockLevel = await this.stockService.find({
        materialIds: [productId],
        locationIds: [locationId],
        exactLocationMatch: true,
      });
      
      // Cache for 5 minutes
      await this.cacheManager.set(cacheKey, stockLevel, 300);
    }
    
    return stockLevel;
  }

  /**
   * Invalidate cache on stock movements
   */
  async invalidateStockCache(productId: string, locationId: string): Promise<void> {
    const patterns = [
      `stock:${productId}:${locationId}`,
      `stock:${productId}:*`,
      `location:${locationId}:*`,
    ];

    for (const pattern of patterns) {
      await this.cacheManager.del(pattern);
    }
  }

  /**
   * Warm cache with most accessed products
   */
  async warmCache(popularProducts: string[]): Promise<void> {
    const activeLocations = await this.locationService.findAll();
    
    const promises = popularProducts.flatMap(productId =>
      activeLocations.map(location =>
        this.getCachedStockLevel(productId, location.id)
      )
    );

    await Promise.all(promises);
    console.log(`✅ Warmed cache for ${popularProducts.length} products across ${activeLocations.length} locations`);
  }
}
```

#### 🏗️ Multi-Tenant Architecture

##### Tenant-Isolated WMS
```typescript
// services/multi-tenant-wms.service.ts
import { Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Inject } from '@nestjs/common';
import { Request } from 'express';
import { 
  LocationService, 
  MaterialService, 
  StockService, 
  OrderService 
} from '@rytass/wms-base-nestjs-module';

// Tenant-aware entity extensions
@ChildEntity()
export class TenantProductEntity extends MaterialEntity {
  @Column('varchar')
  tenantId: string; // Tenant isolation

  @Column('varchar')
  name: string;
  
  @Column('varchar')
  sku: string;
  
  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;
}

@ChildEntity()
export class TenantLocationEntity extends LocationEntity {
  @Column('varchar')
  tenantId: string; // Tenant isolation

  @Column('varchar')
  code: string;
  
  @Column('varchar')
  zone: string;
}

interface TenantRequest extends Request {
  tenantId: string;
}

@Injectable({ scope: Scope.REQUEST })
export class MultiTenantWMSService {
  private readonly tenantId: string;

  constructor(
    @Inject(REQUEST) private readonly request: TenantRequest,
    private readonly locationService: LocationService<TenantLocationEntity>,
    private readonly materialService: MaterialService<TenantProductEntity>,
    private readonly stockService: StockService,
    private readonly orderService: OrderService,
  ) {
    this.tenantId = request.tenantId;
  }

  /**
   * Tenant-aware product creation
   */
  async createProduct(productData: Omit<TenantProductEntity, 'tenantId' | 'id'>): Promise<TenantProductEntity> {
    return this.materialService.create({
      ...productData,
      id: `${this.tenantId}-${productData.sku}`,
      tenantId: this.tenantId,
    });
  }

  /**
   * Tenant-aware location creation
   */
  async createLocation(locationData: Omit<TenantLocationEntity, 'tenantId' | 'id'>): Promise<TenantLocationEntity> {
    return this.locationService.create({
      ...locationData,
      id: `${this.tenantId}-${locationData.code}`,
      tenantId: this.tenantId,
    });
  }

  /**
   * Tenant-isolated stock levels
   */
  async getTenantStockLevels(): Promise<Array<{
    productSku: string;
    locationCode: string;
    quantity: number;
  }>> {
    // Get all tenant products and locations
    const products = await this.materialService.findAll();
    const locations = await this.locationService.findAll();

    const stockLevels = [];

    for (const product of products) {
      if (!product.tenantId.startsWith(this.tenantId)) continue;

      for (const location of locations) {
        if (!location.tenantId.startsWith(this.tenantId)) continue;

        const quantity = await this.stockService.find({
          materialIds: [product.id],
          locationIds: [location.id],
          exactLocationMatch: true,
        });

        if (quantity > 0) {
          stockLevels.push({
            productSku: product.sku,
            locationCode: location.code,
            quantity,
          });
        }
      }
    }

    return stockLevels;
  }

  /**
   * Cross-tenant transfer (with authorization)
   */
  async transferBetweenTenants(
    productSku: string,
    fromLocationCode: string,
    toTenantId: string,
    toLocationCode: string,
    quantity: number,
    authorizationCode: string
  ): Promise<void> {
    // Verify authorization for cross-tenant operations
    if (!this.isAuthorizedForCrossTenantTransfer(authorizationCode)) {
      throw new Error('Unauthorized cross-tenant transfer');
    }

    const fromProduct = await this.findTenantProduct(productSku);
    const fromLocation = await this.findTenantLocation(fromLocationCode);
    
    // Create dual orders for cross-tenant transfer
    await Promise.all([
      // Outbound from current tenant
      this.orderService.createOrder(OrderEntity, {
        order: {},
        batches: [{
          id: `XFER-OUT-${Date.now()}`,
          locationId: fromLocation.id,
          materialId: fromProduct.id,
          quantity: -quantity,
        }],
      }),
      // Inbound to target tenant
      this.orderService.createOrder(OrderEntity, {
        order: {},
        batches: [{
          id: `XFER-IN-${Date.now()}`,
          locationId: `${toTenantId}-${toLocationCode}`,
          materialId: `${toTenantId}-${productSku}`,
          quantity: quantity,
        }],
      }),
    ]);
  }

  private async findTenantProduct(sku: string): Promise<TenantProductEntity> {
    const product = await this.materialService.findById(`${this.tenantId}-${sku}`);
    if (!product || product.tenantId !== this.tenantId) {
      throw new Error(`Product ${sku} not found for tenant ${this.tenantId}`);
    }
    return product;
  }

  private async findTenantLocation(code: string): Promise<TenantLocationEntity> {
    const location = await this.locationService.findById(`${this.tenantId}-${code}`);
    if (!location || location.tenantId !== this.tenantId) {
      throw new Error(`Location ${code} not found for tenant ${this.tenantId}`);
    }
    return location;
  }

  private isAuthorizedForCrossTenantTransfer(authCode: string): boolean {
    // Implement authorization logic
    return authCode.startsWith('ADMIN-');
  }
}
```

##### Tenant Configuration Module
```typescript
// modules/tenant-wms.module.ts
import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WMSBaseModule } from '@rytass/wms-base-nestjs-module';
import { TenantProductEntity, TenantLocationEntity } from '../entities/tenant.entities';
import { MultiTenantWMSService } from '../services/multi-tenant-wms.service';

export interface TenantWMSModuleOptions {
  tenantId: string;
  databaseConfig: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
}

@Module({})
export class TenantWMSModule {
  static forTenant(options: TenantWMSModuleOptions): DynamicModule {
    return {
      module: TenantWMSModule,
      imports: [
        TypeOrmModule.forRoot({
          name: `tenant-${options.tenantId}`,
          type: 'postgres',
          ...options.databaseConfig,
          entities: [TenantProductEntity, TenantLocationEntity],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([TenantProductEntity, TenantLocationEntity], `tenant-${options.tenantId}`),
        WMSBaseModule.forRootAsync({
          imports: [TypeOrmModule.forFeature([TenantProductEntity, TenantLocationEntity], `tenant-${options.tenantId}`)],
          useFactory: () => ({
            materialEntity: TenantProductEntity,
            locationEntity: TenantLocationEntity,
          }),
        }),
      ],
      providers: [MultiTenantWMSService],
      exports: [MultiTenantWMSService],
    };
  }
}
```

#### 🔐 Security & Audit Patterns

##### Audit Trail Implementation
```typescript
// entities/audit-trail.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditTrailEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar')
  entityType: string; // 'Product', 'Location', 'Order', etc.

  @Column('varchar')
  entityId: string;

  @Column('varchar')
  action: string; // 'CREATE', 'UPDATE', 'DELETE', 'STOCK_MOVE'

  @Column('json', { nullable: true })
  previousValues?: Record<string, any>;

  @Column('json', { nullable: true })
  newValues?: Record<string, any>;

  @Column('varchar')
  userId: string;

  @Column('varchar', { nullable: true })
  sessionId?: string;

  @Column('varchar', { nullable: true })
  ipAddress?: string;

  @Column('text', { nullable: true })
  reason?: string;

  @CreateDateColumn()
  timestamp: Date;

  @Column('json', { nullable: true })
  metadata?: Record<string, any>;
}

// services/audit.service.ts
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditTrailEntity)
    private readonly auditRepo: Repository<AuditTrailEntity>,
  ) {}

  async logAction(
    entityType: string,
    entityId: string,
    action: string,
    userId: string,
    changes?: {
      previous?: Record<string, any>;
      new?: Record<string, any>;
    },
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.auditRepo.save({
      entityType,
      entityId,
      action,
      userId,
      previousValues: changes?.previous,
      newValues: changes?.new,
      metadata,
    });
  }

  async getAuditTrail(
    entityType?: string,
    entityId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AuditTrailEntity[]> {
    const query = this.auditRepo.createQueryBuilder('audit');

    if (entityType) {
      query.andWhere('audit.entityType = :entityType', { entityType });
    }

    if (entityId) {
      query.andWhere('audit.entityId = :entityId', { entityId });
    }

    if (startDate) {
      query.andWhere('audit.timestamp >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('audit.timestamp <= :endDate', { endDate });
    }

    return query.orderBy('audit.timestamp', 'DESC').getMany();
  }
}
```

##### Audited WMS Service
```typescript
// services/audited-wms.service.ts
@Injectable()
export class AuditedWMSService {
  constructor(
    private readonly materialService: MaterialService<ProductEntity>,
    private readonly locationService: LocationService<WarehouseLocationEntity>,
    private readonly orderService: OrderService,
    private readonly auditService: AuditService,
  ) {}

  async createProductWithAudit(
    productData: Partial<ProductEntity>,
    userId: string,
    reason?: string
  ): Promise<ProductEntity> {
    const product = await this.materialService.create(productData);

    await this.auditService.logAction(
      'Product',
      product.id,
      'CREATE',
      userId,
      { new: productData },
      { reason }
    );

    return product;
  }

  async moveInventoryWithAudit(
    productId: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number,
    userId: string,
    reason: string
  ): Promise<void> {
    // Record before state
    const beforeFromStock = await this.stockService.find({
      materialIds: [productId],
      locationIds: [fromLocationId],
      exactLocationMatch: true,
    });
    
    const beforeToStock = await this.stockService.find({
      materialIds: [productId],
      locationIds: [toLocationId],
      exactLocationMatch: true,
    });

    // Execute transfer
    await this.orderService.createOrder(OrderEntity, {
      order: {},
      batches: [
        {
          id: `XFER-OUT-${Date.now()}`,
          locationId: fromLocationId,
          materialId: productId,
          quantity: -quantity,
        },
        {
          id: `XFER-IN-${Date.now()}`,
          locationId: toLocationId,
          materialId: productId,
          quantity: quantity,
        },
      ],
    });

    // Record after state
    const afterFromStock = await this.stockService.find({
      materialIds: [productId],
      locationIds: [fromLocationId],
      exactLocationMatch: true,
    });
    
    const afterToStock = await this.stockService.find({
      materialIds: [productId],
      locationIds: [toLocationId],
      exactLocationMatch: true,
    });

    // Log audit trail
    await this.auditService.logAction(
      'Inventory',
      productId,
      'TRANSFER',
      userId,
      {
        previous: {
          fromLocation: { id: fromLocationId, stock: beforeFromStock },
          toLocation: { id: toLocationId, stock: beforeToStock },
        },
        new: {
          fromLocation: { id: fromLocationId, stock: afterFromStock },
          toLocation: { id: toLocationId, stock: afterToStock },
        },
      },
      { reason, transferQuantity: quantity }
    );
  }
}
```

#### 📊 Analytics & Reporting

##### Advanced Analytics Service
```typescript
// services/analytics.service.ts
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly stockService: StockService,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  /**
   * ABC Analysis - categorize products by value/movement
   */
  async performABCAnalysis(): Promise<{
    A: ProductEntity[]; // 80% of value
    B: ProductEntity[]; // 15% of value  
    C: ProductEntity[]; // 5% of value
  }> {
    // Get all products with movement data
    const products = await this.productRepo.query(`
      SELECT 
        p.*,
        COALESCE(SUM(ABS(s.quantity)), 0) as total_movement,
        COALESCE(SUM(ABS(s.quantity)) * p."unitPrice", 0) as total_value
      FROM materials p
      LEFT JOIN stocks s ON s."materialId" = p.id
      WHERE p."entityName" = 'ProductEntity'
        AND s."createdAt" >= NOW() - INTERVAL '90 days'
      GROUP BY p.id
      ORDER BY total_value DESC
    `);

    const totalValue = products.reduce((sum, p) => sum + parseFloat(p.total_value), 0);
    let runningValue = 0;
    
    const result = { A: [], B: [], C: [] };

    for (const product of products) {
      const productValue = parseFloat(product.total_value);
      runningValue += productValue;
      const percentOfTotal = runningValue / totalValue;

      if (percentOfTotal <= 0.8) {
        result.A.push(product);
      } else if (percentOfTotal <= 0.95) {
        result.B.push(product);
      } else {
        result.C.push(product);
      }
    }

    return result;
  }

  /**
   * Turnover Analysis
   */
  async calculateTurnoverRates(days: number = 90): Promise<Array<{
    productSku: string;
    averageStock: number;
    totalMovement: number;
    turnoverRate: number;
    daysOfStock: number;
  }>> {
    return this.productRepo.query(`
      WITH stock_summary AS (
        SELECT 
          p.sku as product_sku,
          AVG(daily_stock.stock_level) as average_stock,
          SUM(CASE WHEN s.quantity < 0 THEN ABS(s.quantity) ELSE 0 END) as total_outbound
        FROM materials p
        CROSS JOIN LATERAL (
          SELECT SUM(s2.quantity) as stock_level
          FROM stocks s2 
          WHERE s2."materialId" = p.id 
            AND s2."createdAt" <= s."createdAt"
        ) daily_stock
        JOIN stocks s ON s."materialId" = p.id
        WHERE p."entityName" = 'ProductEntity'
          AND s."createdAt" >= NOW() - INTERVAL '${days} days'
        GROUP BY p.id, p.sku
        HAVING AVG(daily_stock.stock_level) > 0
      )
      SELECT 
        product_sku as "productSku",
        average_stock as "averageStock", 
        total_outbound as "totalMovement",
        CASE 
          WHEN average_stock > 0 
          THEN total_outbound / average_stock * (365.0 / ${days})
          ELSE 0 
        END as "turnoverRate",
        CASE 
          WHEN total_outbound > 0 
          THEN average_stock / (total_outbound / ${days})
          ELSE 999 
        END as "daysOfStock"
      FROM stock_summary
      ORDER BY "turnoverRate" DESC
    `);
  }

  /**
   * Seasonal Analysis
   */
  async analyzeSeasonalTrends(productIds?: string[]): Promise<Array<{
    productSku: string;
    month: number;
    averageDemand: number;
    seasonalIndex: number;
  }>> {
    const productFilter = productIds?.length 
      ? `AND p.id IN (${productIds.map(id => `'${id}'`).join(',')})`
      : '';

    return this.productRepo.query(`
      WITH monthly_demand AS (
        SELECT 
          p.sku as product_sku,
          EXTRACT(MONTH FROM s."createdAt") as month,
          AVG(ABS(s.quantity)) as avg_demand
        FROM materials p
        JOIN stocks s ON s."materialId" = p.id
        WHERE p."entityName" = 'ProductEntity'
          AND s.quantity < 0  -- Only outbound movements
          AND s."createdAt" >= NOW() - INTERVAL '2 years'
          ${productFilter}
        GROUP BY p.id, p.sku, EXTRACT(MONTH FROM s."createdAt")
      ),
      overall_average AS (
        SELECT 
          product_sku,
          AVG(avg_demand) as yearly_avg
        FROM monthly_demand
        GROUP BY product_sku
      )
      SELECT 
        md.product_sku as "productSku",
        md.month::int as "month",
        md.avg_demand as "averageDemand",
        CASE 
          WHEN oa.yearly_avg > 0 
          THEN md.avg_demand / oa.yearly_avg 
          ELSE 1 
        END as "seasonalIndex"
      FROM monthly_demand md
      JOIN overall_average oa ON oa.product_sku = md.product_sku
      ORDER BY md.product_sku, md.month
    `);
  }
}
```

**✅ What You've Achieved:**
- Production-ready performance optimization techniques
- Multi-tenant architecture with data isolation
- Comprehensive audit trail and security patterns
- Advanced analytics including ABC analysis and turnover rates
- Scalable caching strategies and query optimization

**🎯 Next Steps:** Ready for complete enterprise implementations? Continue to [Enterprise Examples](#-enterprise-examples).

---

## 🏭 Enterprise Examples

Real-world implementation patterns for production systems.

### E-commerce Fulfillment Center

Complete implementation for high-volume e-commerce operations with order processing, pick-pack workflows, and shipping integration.

```typescript
// entities/ecommerce-entities.ts
@ChildEntity()
export class EcommerceProductEntity extends MaterialEntity {
  @Column('varchar', { length: 100 })
  name: string;

  @Column('varchar', { length: 50, unique: true })
  sku: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('decimal', { precision: 8, scale: 3 })
  weight: number;

  @Column('json')
  dimensions: { length: number; width: number; height: number; };

  @Column('varchar', { length: 50 })
  category: string;

  @Column('boolean', { default: true })
  isActive: boolean;
}

@ChildEntity()
export class WarehouseZoneEntity extends LocationEntity {
  @Column('varchar', { length: 30 })
  zoneType: 'RECEIVING' | 'STORAGE' | 'PICKING' | 'PACKING' | 'SHIPPING';

  @Column('varchar', { length: 10 })
  temperature: 'AMBIENT' | 'CHILLED' | 'FROZEN';

  @Column('json')
  pickingStrategy: {
    method: 'FIFO' | 'LIFO' | 'FEFO' | 'ZONE_SKIP';
    priority: number;
  };
}

@ChildEntity()
export class EcommerceOrderEntity extends OrderEntity {
  @Column('varchar', { length: 50 })
  orderNumber: string;

  @Column('varchar', { length: 100 })
  customerEmail: string;

  @Column('varchar', { length: 20 })
  status: 'PENDING' | 'PICKING' | 'PACKED' | 'SHIPPED' | 'DELIVERED';

  @Column('varchar', { length: 20 })
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

  @Column('timestamp')
  promisedDate: Date;

  @Column('json')
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

// services/fulfillment.service.ts
@Injectable()
export class FulfillmentService {
  constructor(
    private readonly orderService: OrderService,
    private readonly locationService: LocationService<WarehouseZoneEntity>,
    private readonly materialService: MaterialService<EcommerceProductEntity>,
    private readonly stockService: StockService,
  ) {}

  async processOrder(orderData: OrderCreateDto<EcommerceOrderEntity>): Promise<EcommerceOrderEntity> {
    // Validate inventory availability
    await this.validateInventory(orderData.batches);

    // Optimize picking route
    const optimizedBatches = await this.optimizePickingRoute(orderData.batches);

    // Create order with optimized batch sequence
    const order = await this.orderService.createOrder(EcommerceOrderEntity, {
      ...orderData,
      batches: optimizedBatches,
    });

    // Generate picking list
    await this.generatePickingList(order);

    return order;
  }

  private async validateInventory(batches: BatchCreateDto[]): Promise<void> {
    for (const batch of batches) {
      const currentStock = await this.stockService.find({
        materialIds: [batch.materialId],
        locationIds: [batch.locationId],
        exactLocationMatch: true,
      });

      if (currentStock < Math.abs(batch.quantity)) {
        const product = await this.materialService.findById(batch.materialId);
        throw new Error(`Insufficient inventory for ${product.name} (SKU: ${product.sku})`);
      }
    }
  }

  private async optimizePickingRoute(batches: BatchCreateDto[]): Promise<BatchCreateDto[]> {
    // Get all picking locations
    const locations = await this.locationService.findByIds(
      batches.map(b => b.locationId)
    );

    // Sort by zone hierarchy and picking strategy
    const sortedBatches = batches.sort((a, b) => {
      const locationA = locations.find(l => l.id === a.locationId);
      const locationB = locations.find(l => l.locationId === b.locationId);
      
      return locationA.path.localeCompare(locationB.path);
    });

    return sortedBatches;
  }

  async generatePickingList(order: EcommerceOrderEntity): Promise<PickingList> {
    const pickingTasks = order.stocks.map(stock => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      sku: stock.material.sku,
      productName: stock.material.name,
      quantity: Math.abs(stock.quantity),
      locationPath: stock.location.path,
      priority: order.priority,
    }));

    return {
      id: `PL-${order.orderNumber}`,
      orderId: order.id,
      tasks: pickingTasks,
      estimatedTime: pickingTasks.length * 2.5, // minutes
      createdAt: new Date(),
    };
  }
}

// Module configuration for e-commerce
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EcommerceProductEntity,
      WarehouseZoneEntity, 
      EcommerceOrderEntity
    ]),
    WMSBaseModule.forRootAsync({
      imports: [TypeOrmModule.forFeature([EcommerceProductEntity])],
      useFactory: () => ({
        materialEntity: EcommerceProductEntity,
        allowNegativeStock: false, // Strict inventory control
      }),
    }),
  ],
  providers: [FulfillmentService],
  exports: [FulfillmentService],
})
export class EcommerceFulfillmentModule {}
```

### Manufacturing Supply Chain WMS

Production-focused WMS with work orders, quality control, and supply chain integration.

```typescript
// entities/manufacturing-entities.ts
@ChildEntity()
export class ComponentEntity extends MaterialEntity {
  @Column('varchar', { length: 100 })
  partNumber: string;

  @Column('varchar', { length: 200 })
  description: string;

  @Column('varchar', { length: 50 })
  supplier: string;

  @Column('decimal', { precision: 10, scale: 4 })
  standardCost: number;

  @Column('int')
  leadTimeDays: number;

  @Column('json')
  qualitySpecs: {
    tolerances: Record<string, number>;
    testingRequired: boolean;
    certificationLevel: string;
  };
}

@ChildEntity()
export class ProductionLineEntity extends LocationEntity {
  @Column('varchar', { length: 50 })
  lineType: string;

  @Column('int')
  capacity: number; // units per hour

  @Column('json')
  capabilities: string[];

  @Column('varchar', { length: 20 })
  status: 'ACTIVE' | 'MAINTENANCE' | 'DOWN';
}

@ChildEntity()
export class WorkOrderEntity extends OrderEntity {
  @Column('varchar', { length: 50 })
  workOrderNumber: string;

  @Column('varchar', { length: 50 })
  productId: string;

  @Column('int')
  plannedQuantity: number;

  @Column('int', { default: 0 })
  completedQuantity: number;

  @Column('varchar', { length: 20 })
  status: 'PLANNED' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';

  @Column('timestamp')
  scheduledStart: Date;

  @Column('timestamp')
  scheduledEnd: Date;

  @Column('json')
  bomItems: {
    componentId: string;
    quantityRequired: number;
    quantityIssued: number;
  }[];
}

// services/production.service.ts
@Injectable()
export class ProductionService {
  constructor(
    private readonly orderService: OrderService,
    private readonly materialService: MaterialService<ComponentEntity>,
    private readonly locationService: LocationService<ProductionLineEntity>,
    private readonly stockService: StockService,
  ) {}

  async createWorkOrder(workOrderData: {
    productId: string;
    quantity: number;
    scheduledStart: Date;
    bomItems: { componentId: string; quantity: number; }[];
  }): Promise<WorkOrderEntity> {
    // Validate BOM availability
    await this.validateBOMAvailability(workOrderData.bomItems);

    // Reserve components
    const reservationBatches = await this.reserveComponents(workOrderData.bomItems);

    const order = await this.orderService.createOrder(WorkOrderEntity, {
      order: {
        workOrderNumber: `WO-${Date.now()}`,
        productId: workOrderData.productId,
        plannedQuantity: workOrderData.quantity,
        status: 'PLANNED',
        scheduledStart: workOrderData.scheduledStart,
        scheduledEnd: new Date(workOrderData.scheduledStart.getTime() + 8 * 60 * 60 * 1000), // 8 hours
        bomItems: workOrderData.bomItems.map(item => ({
          componentId: item.componentId,
          quantityRequired: item.quantity,
          quantityIssued: 0,
        })),
      },
      batches: reservationBatches,
    });

    return order;
  }

  private async validateBOMAvailability(bomItems: { componentId: string; quantity: number; }[]): Promise<void> {
    for (const item of bomItems) {
      const availableStock = await this.stockService.find({
        materialIds: [item.componentId],
        exactLocationMatch: false,
      });

      if (availableStock < item.quantity) {
        const component = await this.materialService.findById(item.componentId);
        throw new Error(`Insufficient stock for component ${component.partNumber}. Required: ${item.quantity}, Available: ${availableStock}`);
      }
    }
  }

  private async reserveComponents(bomItems: { componentId: string; quantity: number; }[]): Promise<BatchCreateDto[]> {
    const reservations: BatchCreateDto[] = [];

    for (const item of bomItems) {
      // Find locations with available stock
      const stockLocations = await this.stockService.findStockByMaterial(item.componentId);
      
      let remainingQuantity = item.quantity;
      
      for (const location of stockLocations) {
        if (remainingQuantity <= 0) break;
        
        const reserveQuantity = Math.min(location.quantity, remainingQuantity);
        
        reservations.push({
          id: `RES-${item.componentId}-${location.locationId}`,
          materialId: item.componentId,
          locationId: location.locationId,
          quantity: -reserveQuantity, // Negative for reservation
        });
        
        remainingQuantity -= reserveQuantity;
      }
    }

    return reservations;
  }

  async issueComponents(workOrderId: string, componentIssues: { componentId: string; quantity: number; }[]): Promise<void> {
    const workOrder = await this.orderService.findById(workOrderId) as WorkOrderEntity;
    
    for (const issue of componentIssues) {
      // Update BOM issued quantities
      const bomItem = workOrder.bomItems.find(item => item.componentId === issue.componentId);
      if (bomItem) {
        bomItem.quantityIssued += issue.quantity;
      }

      // Create issue transaction
      await this.orderService.createOrder(WorkOrderEntity, {
        order: {
          workOrderNumber: `${workOrder.workOrderNumber}-ISSUE`,
          productId: workOrder.productId,
          status: 'IN_PROGRESS',
        },
        batches: [{
          id: `ISSUE-${issue.componentId}-${Date.now()}`,
          materialId: issue.componentId,
          locationId: 'PRODUCTION-FLOOR',
          quantity: -issue.quantity,
        }],
      });
    }

    // Update work order status
    await this.orderService.update(workOrderId, {
      status: 'IN_PROGRESS',
      bomItems: workOrder.bomItems,
    });
  }
}
```

### 3PL Multi-Client Operations

Multi-tenant 3PL system with client isolation, billing integration, and SLA monitoring.

```typescript
// entities/3pl-entities.ts
@ChildEntity()
export class Client3PLEntity extends MaterialEntity {
  @Column('varchar', { length: 100 })
  clientId: string;

  @Column('varchar', { length: 200 })
  clientName: string;

  @Column('varchar', { length: 50 })
  productSKU: string;

  @Column('varchar', { length: 200 })
  productDescription: string;

  @Column('json')
  storageRequirements: {
    temperature: string;
    hazmat: boolean;
    specialHandling: string[];
  };

  @Column('decimal', { precision: 8, scale: 4 })
  handlingFee: number;

  @Column('decimal', { precision: 8, scale: 4 })
  storageFee: number; // per unit per day
}

@ChildEntity()
export class ClientZoneEntity extends LocationEntity {
  @Column('varchar', { length: 100 })
  clientId: string;

  @Column('varchar', { length: 50 })
  zoneCode: string;

  @Column('decimal', { precision: 10, scale: 2 })
  totalCapacity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  usedCapacity: number;

  @Column('json')
  slaTargets: {
    inboundProcessingHours: number;
    outboundProcessingHours: number;
    accuracyTarget: number; // percentage
  };
}

@ChildEntity()
export class ThreePLOrderEntity extends OrderEntity {
  @Column('varchar', { length: 100 })
  clientId: string;

  @Column('varchar', { length: 50 })
  clientOrderNumber: string;

  @Column('varchar', { length: 20 })
  orderType: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT';

  @Column('varchar', { length: 20 })
  priority: 'STANDARD' | 'EXPRESS' | 'NEXT_DAY';

  @Column('timestamp')
  slaDeadline: Date;

  @Column('json')
  billingItems: {
    service: string;
    quantity: number;
    rate: number;
    amount: number;
  }[];

  @Column('decimal', { precision: 10, scale: 2 })
  totalBilling: number;
}

// services/3pl-operations.service.ts
@Injectable()
export class ThreePLOperationsService {
  constructor(
    private readonly orderService: OrderService,
    private readonly materialService: MaterialService<Client3PLEntity>,
    private readonly locationService: LocationService<ClientZoneEntity>,
    private readonly stockService: StockService,
  ) {}

  async processInboundShipment(clientId: string, shipmentData: {
    clientOrderNumber: string;
    items: { sku: string; quantity: number; }[];
    expectedDate: Date;
  }): Promise<ThreePLOrderEntity> {
    // Validate client access
    await this.validateClientAccess(clientId, shipmentData.items);

    // Allocate storage locations
    const allocationBatches = await this.allocateStorage(clientId, shipmentData.items);

    // Calculate billing
    const billingItems = await this.calculateInboundBilling(clientId, shipmentData.items);

    const order = await this.orderService.createOrder(ThreePLOrderEntity, {
      order: {
        clientId,
        clientOrderNumber: shipmentData.clientOrderNumber,
        orderType: 'INBOUND',
        priority: 'STANDARD',
        slaDeadline: new Date(shipmentData.expectedDate.getTime() + 24 * 60 * 60 * 1000), // 24 hours SLA
        billingItems,
        totalBilling: billingItems.reduce((sum, item) => sum + item.amount, 0),
      },
      batches: allocationBatches,
    });

    // Update capacity tracking
    await this.updateCapacityTracking(clientId, allocationBatches);

    return order;
  }

  private async validateClientAccess(clientId: string, items: { sku: string; quantity: number; }[]): Promise<void> {
    for (const item of items) {
      const product = await this.materialService.findOne({
        where: { clientId, productSKU: item.sku }
      });

      if (!product) {
        throw new Error(`Product ${item.sku} not authorized for client ${clientId}`);
      }
    }
  }

  private async allocateStorage(clientId: string, items: { sku: string; quantity: number; }[]): Promise<BatchCreateDto[]> {
    const allocations: BatchCreateDto[] = [];
    
    // Get client's dedicated zones
    const clientZones = await this.locationService.find({
      where: { clientId }
    });

    for (const item of items) {
      const product = await this.materialService.findOne({
        where: { clientId, productSKU: item.sku }
      });

      // Find suitable zone based on storage requirements
      const suitableZone = clientZones.find(zone => 
        this.isZoneSuitable(zone, product.storageRequirements) &&
        zone.usedCapacity + item.quantity <= zone.totalCapacity
      );

      if (!suitableZone) {
        throw new Error(`No available storage space for ${item.sku}`);
      }

      allocations.push({
        id: `RCPT-${item.sku}-${Date.now()}`,
        materialId: product.id,
        locationId: suitableZone.id,
        quantity: item.quantity,
      });
    }

    return allocations;
  }

  private isZoneSuitable(zone: ClientZoneEntity, requirements: any): boolean {
    // Implement zone suitability logic based on storage requirements
    return true; // Simplified for example
  }

  private async calculateInboundBilling(clientId: string, items: { sku: string; quantity: number; }[]): Promise<any[]> {
    const billingItems = [];

    for (const item of items) {
      const product = await this.materialService.findOne({
        where: { clientId, productSKU: item.sku }
      });

      billingItems.push({
        service: 'RECEIVING',
        quantity: item.quantity,
        rate: product.handlingFee,
        amount: item.quantity * product.handlingFee,
      });

      billingItems.push({
        service: 'PUTAWAY',
        quantity: item.quantity,
        rate: 0.50, // Fixed putaway fee
        amount: item.quantity * 0.50,
      });
    }

    return billingItems;
  }

  async generateMonthlyBilling(clientId: string, month: Date): Promise<ClientBillingReport> {
    // Get all orders for the month
    const orders = await this.orderService.findByClientAndDateRange(
      clientId,
      new Date(month.getFullYear(), month.getMonth(), 1),
      new Date(month.getFullYear(), month.getMonth() + 1, 0)
    );

    // Calculate storage fees
    const storageFees = await this.calculateStorageFees(clientId, month);

    // Aggregate all charges
    const totalHandling = orders.reduce((sum, order) => sum + order.totalBilling, 0);
    const totalStorage = storageFees.reduce((sum, fee) => sum + fee.amount, 0);

    return {
      clientId,
      month,
      handlingCharges: totalHandling,
      storageCharges: totalStorage,
      totalCharges: totalHandling + totalStorage,
      orders: orders.length,
      itemsProcessed: orders.reduce((sum, order) => sum + order.stocks.length, 0),
    };
  }
}
```

## 🔧 Technical Documentation

### Production Deployment Guide

#### Infrastructure Requirements

**Database Configuration**
```typescript
// For high-availability PostgreSQL setup
const databaseConfig = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [MaterialEntity, LocationEntity, OrderEntity, BatchEntity, StockEntity],
  synchronize: false, // NEVER use in production
  migrations: ['dist/migrations/*.js'],
  migrationsRun: true,
  logging: ['error', 'warn'],
  extra: {
    connectionLimit: 100,
    acquireConnectionTimeout: 60000,
    timeout: 60000,
    reconnect: true,
  },
};
```

**Connection Pooling & Performance**
```typescript
// connection-pool.config.ts
export const productionPoolConfig = {
  pool: {
    min: 10,
    max: 100,
    idle: 10000,
    acquire: 30000,
    evict: 1000,
  },
  dialectOptions: {
    statement_timeout: 30000,
    idle_in_transaction_session_timeout: 30000,
  },
};
```

#### Migration Strategy

**Database Schema Evolution**
```bash
# Generate migration
npm run typeorm migration:generate -- -n AddTenantSupport

# Review migration files before running
# migrations/1642345678901-AddTenantSupport.ts

# Run migrations in production
npm run typeorm migration:run

# Rollback if needed (test thoroughly first)
npm run typeorm migration:revert
```

**Zero-Downtime Deployment**
```typescript
// deployment/migration-runner.ts
export class SafeMigrationRunner {
  async runMigrations(): Promise<void> {
    const connection = await createConnection(productionConfig);
    
    // Check current schema version
    const currentVersion = await this.getCurrentVersion(connection);
    
    // Run migrations with rollback capability
    try {
      await connection.runMigrations({ transaction: 'each' });
      await this.validateMigration(connection);
    } catch (error) {
      console.error('Migration failed, initiating rollback:', error);
      await this.rollbackToVersion(connection, currentVersion);
      throw error;
    }
  }

  private async validateMigration(connection: Connection): Promise<void> {
    // Run post-migration validation checks
    const validationQueries = [
      'SELECT COUNT(*) FROM material_entity',
      'SELECT COUNT(*) FROM location_entity WHERE path IS NOT NULL',
      'SELECT COUNT(*) FROM stock_entity WHERE quantity IS NOT NULL',
    ];

    for (const query of validationQueries) {
      const result = await connection.query(query);
      if (!result || result[0].count === '0') {
        throw new Error(`Validation failed for query: ${query}`);
      }
    }
  }
}
```

#### Monitoring & Observability

**Performance Metrics**
```typescript
// monitoring/metrics.service.ts
@Injectable()
export class WMSMetricsService {
  constructor(
    @Inject('PROMETHEUS_REGISTRY') private readonly registry: Registry,
  ) {
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // Database query performance
    this.dbQueryDuration = new Histogram({
      name: 'wms_db_query_duration_seconds',
      help: 'Database query execution time',
      labelNames: ['operation', 'entity', 'status'],
      registers: [this.registry],
    });

    // Stock operation metrics
    this.stockOperations = new Counter({
      name: 'wms_stock_operations_total',
      help: 'Total stock operations performed',
      labelNames: ['operation_type', 'entity_type', 'tenant_id'],
      registers: [this.registry],
    });

    // Error tracking
    this.errorCount = new Counter({
      name: 'wms_errors_total',
      help: 'Total errors encountered',
      labelNames: ['error_type', 'service', 'severity'],
      registers: [this.registry],
    });
  }

  recordStockOperation(type: string, entityType: string, tenantId?: string): void {
    this.stockOperations.inc({ 
      operation_type: type, 
      entity_type: entityType, 
      tenant_id: tenantId || 'default' 
    });
  }

  recordError(error: Error, service: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    this.errorCount.inc({
      error_type: error.constructor.name,
      service,
      severity,
    });
  }
}
```

**Health Checks**
```typescript
// health/wms-health.service.ts
@Injectable()
export class WMSHealthService {
  constructor(
    private readonly stockService: StockService,
    private readonly materialService: MaterialService,
    private readonly connection: Connection,
  ) {}

  @HealthCheck()
  async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.connection.query('SELECT 1');
      return { database: { status: 'up' } };
    } catch (error) {
      return { database: { status: 'down', error: error.message } };
    }
  }

  @HealthCheck()
  async checkStockIntegrity(): Promise<HealthIndicatorResult> {
    try {
      // Verify stock calculations are consistent
      const stockValidation = await this.stockService.validateStockIntegrity();
      
      if (stockValidation.isValid) {
        return { stock_integrity: { status: 'up', validated_records: stockValidation.recordCount } };
      } else {
        return { 
          stock_integrity: { 
            status: 'degraded', 
            issues: stockValidation.issues.length,
            sample_issues: stockValidation.issues.slice(0, 3)
          } 
        };
      }
    } catch (error) {
      return { stock_integrity: { status: 'down', error: error.message } };
    }
  }

  @HealthCheck()
  async checkPerformance(): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    
    try {
      // Test query performance
      await this.stockService.find({ exactLocationMatch: false });
      const queryTime = Date.now() - startTime;
      
      const status = queryTime < 1000 ? 'up' : queryTime < 5000 ? 'degraded' : 'down';
      
      return { 
        performance: { 
          status, 
          query_time_ms: queryTime,
          threshold_ms: 1000
        } 
      };
    } catch (error) {
      return { performance: { status: 'down', error: error.message } };
    }
  }
}
```

#### Security Configuration

**Access Control & Authorization**
```typescript
// security/wms-auth.guard.ts
@Injectable()
export class WMSAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No authentication token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Add user context for multi-tenant operations
      request.user = {
        id: payload.sub,
        username: payload.username,
        tenantId: payload.tenantId,
        roles: payload.roles || [],
        permissions: payload.permissions || [],
      };

      // Validate tenant access for WMS operations
      if (!this.hasWMSAccess(request.user)) {
        throw new ForbiddenException('Insufficient WMS permissions');
      }

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  private hasWMSAccess(user: any): boolean {
    const requiredPermissions = ['wms:read', 'wms:write'];
    return requiredPermissions.some(permission => 
      user.permissions.includes(permission) || 
      user.roles.includes('wms-operator') ||
      user.roles.includes('admin')
    );
  }
}
```

**Data Encryption & Audit Trails**
```typescript
// security/audit.service.ts
@Injectable()
export class AuditService {
  constructor(
    private readonly auditRepository: Repository<AuditLogEntity>,
  ) {}

  async logStockOperation(
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    entityType: string,
    entityId: string,
    changes: any,
    userId: string,
    tenantId?: string,
  ): Promise<void> {
    const auditLog = {
      operation,
      entityType,
      entityId,
      changes: this.encryptSensitiveData(changes),
      userId,
      tenantId,
      timestamp: new Date(),
      ipAddress: this.getCurrentIPAddress(),
      userAgent: this.getCurrentUserAgent(),
    };

    await this.auditRepository.save(auditLog);
  }

  private encryptSensitiveData(data: any): any {
    // Encrypt sensitive fields before logging
    const sensitiveFields = ['price', 'cost', 'customerInfo'];
    const encrypted = { ...data };

    sensitiveFields.forEach(field => {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    });

    return encrypted;
  }
}
```

#### Performance Optimization

**Database Query Optimization**
```typescript
// optimization/query-optimizer.service.ts
@Injectable()
export class QueryOptimizerService {
  constructor(
    @InjectRepository(StockEntity)
    private readonly stockRepository: Repository<StockEntity>,
    private readonly cacheService: CacheService,
  ) {}

  async findOptimizedStock(criteria: StockSearchCriteria): Promise<number> {
    // Check cache first
    const cacheKey = this.generateCacheKey(criteria);
    const cachedResult = await this.cacheService.get(cacheKey);
    
    if (cachedResult !== null) {
      return cachedResult;
    }

    // Build optimized query with indexes
    const query = this.stockRepository
      .createQueryBuilder('stock')
      .select('SUM(stock.quantity)', 'total')
      .leftJoin('stock.material', 'material')
      .leftJoin('stock.location', 'location');

    // Add optimized WHERE clauses
    if (criteria.materialIds?.length) {
      query.andWhere('material.id IN (:...materialIds)', { materialIds: criteria.materialIds });
    }

    if (criteria.locationIds?.length) {
      if (criteria.exactLocationMatch) {
        query.andWhere('location.id IN (:...locationIds)', { locationIds: criteria.locationIds });
      } else {
        // Use materialized path for hierarchical search
        const pathConditions = criteria.locationIds.map((id, index) => 
          `location.path LIKE :path${index}`
        );
        query.andWhere(`(${pathConditions.join(' OR ')})`, 
          criteria.locationIds.reduce((params, id, index) => {
            params[`path${index}`] = `${id}%`;
            return params;
          }, {})
        );
      }
    }

    // Execute optimized query
    const result = await query.getRawOne();
    const total = parseFloat(result?.total || '0');

    // Cache result for future queries
    await this.cacheService.set(cacheKey, total, 300); // 5 minutes cache

    return total;
  }

  private generateCacheKey(criteria: StockSearchCriteria): string {
    return `stock:${JSON.stringify(criteria)}`;
  }
}
```

**Caching Strategy**
```typescript
// caching/wms-cache.service.ts
@Injectable()
export class WMSCacheService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis,
  ) {}

  // Hierarchical cache invalidation
  async invalidateLocationCache(locationId: string): Promise<void> {
    const location = await this.getLocation(locationId);
    
    // Clear cache for this location and all parent locations
    const pathSegments = location.path.split('/');
    const invalidationPromises = pathSegments.map((_, index) => {
      const parentPath = pathSegments.slice(0, index + 1).join('/');
      return this.redisClient.del(`location:${parentPath}:*`);
    });

    await Promise.all(invalidationPromises);
  }

  // Bulk cache operations for performance
  async bulkSetStockCache(stockData: { key: string; value: number; }[]): Promise<void> {
    const pipeline = this.redisClient.pipeline();
    
    stockData.forEach(({ key, value }) => {
      pipeline.setex(`stock:${key}`, 300, value.toString());
    });

    await pipeline.exec();
  }

  // Cache warming for frequently accessed data
  async warmCache(): Promise<void> {
    // Pre-load frequently accessed stock levels
    const topMaterials = await this.getTopAccessedMaterials();
    const topLocations = await this.getTopAccessedLocations();

    const warmingPromises = [];

    for (const material of topMaterials) {
      for (const location of topLocations) {
        warmingPromises.push(
          this.preloadStockData(material.id, location.id)
        );
      }
    }

    await Promise.all(warmingPromises);
  }
}
```

## 🔍 Reference

### Base Entities

The module provides these base entities that you can extend:

- **`MaterialEntity`** - Base for products/materials with ID and basic metadata
- **`LocationEntity`** - Base for warehouse locations with hierarchical path support  
- **`OrderEntity`** - Base for orders/transactions with stock relationships
- **`BatchEntity`** - Tracks material batches with location and quantity
- **`StockEntity`** - Current inventory levels with material/location/batch references

### Services

Core services for warehouse operations:

- **`MaterialService<T>`** - Material management with CRUD operations and custom entity support
- **`LocationService<T>`** - Location hierarchy management with materialized path queries
- **`OrderService`** - Order processing with batch creation and stock updates
- **`StockService`** - Inventory tracking with hierarchical location queries and aggregation
- **`BatchService`** - Batch operations and lifecycle management

### Configuration Options

```typescript
interface WMSConfig {
  materialEntity?: Type<MaterialEntity>;  // Custom material entity class
  allowNegativeStock?: boolean;           // Allow negative inventory (default: false)
}
```

### Performance Benchmarks

Expected performance characteristics for production deployments:

| Operation | Target Response Time | Throughput | Notes |
|-----------|---------------------|------------|-------|
| Stock Query (single location) | < 50ms | 2000+ req/sec | With proper indexing |
| Stock Query (hierarchical) | < 100ms | 1000+ req/sec | Uses materialized paths |
| Order Creation | < 500ms | 200+ req/sec | Includes validation & batch creation |
| Bulk Import | < 5s per 1000 records | 10K+ records/min | Batch processing recommended |
| Report Generation | < 2s | 50+ req/sec | With caching enabled |

### Troubleshooting Guide

**Common Issues & Solutions**

1. **Slow Query Performance**
   - ❌ **Issue**: Queries taking >1s with large datasets
   - ✅ **Solution**: 
     ```typescript
     // Enable query logging to identify bottlenecks
     TypeOrmModule.forRoot({
       logging: ['query', 'slow'],
       maxQueryExecutionTime: 1000,
     });
     
     // Use exact location matching when possible
     await stockService.find({
       locationIds: [specificLocationId],
       exactLocationMatch: true, // Much faster than hierarchical
     });
     ```

2. **Memory Usage Issues**
   - ❌ **Issue**: High memory consumption during bulk operations
   - ✅ **Solution**: 
     ```typescript
     // Implement pagination for large datasets
     const pageSize = 1000;
     for (let page = 0; page < totalPages; page++) {
       const orders = await orderService.findWithPagination(page, pageSize);
       await processOrders(orders);
     }
     
     // Use streaming for bulk imports
     const stream = fs.createReadStream('large-inventory.csv');
     await stockService.importFromStream(stream);
     ```

3. **Transaction Deadlocks**
   - ❌ **Issue**: `deadlock detected` errors during concurrent operations
   - ✅ **Solution**: 
     ```typescript
     // Order batch operations consistently (by ID)
     const sortedBatches = batches.sort((a, b) => a.materialId.localeCompare(b.materialId));
     
     // Use shorter transaction scopes
     await dataSource.transaction(async (manager) => {
       // Keep transactions focused and short
       await manager.save(stockEntities);
     });
     
     // Implement retry logic with exponential backoff
     const retryTransaction = async (operation: () => Promise<any>, maxRetries = 3) => {
       for (let i = 0; i < maxRetries; i++) {
         try {
           return await operation();
         } catch (error) {
           if (error.code === '40P01' && i < maxRetries - 1) { // Deadlock
             await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
             continue;
           }
           throw error;
         }
       }
     };
     ```

4. **Cache Inconsistencies**
   - ❌ **Issue**: Cached stock levels don't match database
   - ✅ **Solution**: 
     ```typescript
     // Implement proper cache invalidation
     class StockCacheService {
       async invalidateStockCache(materialId: string, locationId: string): Promise<void> {
         const keys = [
           `stock:${materialId}:${locationId}`,
           `stock:${materialId}:*`,
           `location:${locationId}:*`,
         ];
         await Promise.all(keys.map(key => this.redis.del(key)));
       }
     }
     
     // Use cache versioning for consistency
     const cacheKey = `stock:${materialId}:${locationId}:v${CACHE_VERSION}`;
     ```

5. **Entity Relationship Issues**
   - ❌ **Issue**: `Cannot create a relation because entity does not exist`
   - ✅ **Solution**: 
     ```typescript
     // Always validate entity existence before creating relationships
     async validateOrderData(orderData: OrderCreateDto): Promise<void> {
       for (const batch of orderData.batches) {
         const [material, location] = await Promise.all([
           this.materialService.findById(batch.materialId),
           this.locationService.findById(batch.locationId),
         ]);
         
         if (!material) throw new Error(`Material ${batch.materialId} not found`);
         if (!location) throw new Error(`Location ${batch.locationId} not found`);
       }
     }
     ```

**Performance Monitoring**

Set up these key metrics for production monitoring:

```typescript
// Key performance indicators
const kpis = {
  'wms.query.response_time': { threshold: 100, unit: 'ms' },
  'wms.order.processing_time': { threshold: 500, unit: 'ms' },
  'wms.stock.accuracy': { threshold: 99.9, unit: '%' },
  'wms.cache.hit_rate': { threshold: 80, unit: '%' },
  'wms.db.connection_pool': { threshold: 80, unit: '%' },
};

// Alert conditions
const alerts = {
  critical: 'response_time > 5s OR accuracy < 95%',
  warning: 'response_time > 1s OR hit_rate < 70%',
  info: 'connection_pool > 70%',
};
```

### Version Compatibility

| WMS Module Version | NestJS | TypeORM | Node.js | Database |
|-------------------|--------|---------|---------|----------|
| 2.x | ^10.0.0 | ^0.3.0 | ≥18 | PostgreSQL 13+ |
| 1.x | ^9.0.0 | ^0.2.x | ≥16 | PostgreSQL 11+ |

### Migration from v1.x to v2.x

```typescript
// v1.x (deprecated)
import { WMSModule } from '@rytass/wms-base-nestjs-module';

@Module({
  imports: [
    WMSModule.forRoot({
      entities: [CustomMaterialEntity],
    }),
  ],
})
export class AppModule {}

// v2.x (current)
import { WMSBaseModule } from '@rytass/wms-base-nestjs-module';

@Module({
  imports: [
    WMSBaseModule.forRootAsync({
      imports: [TypeOrmModule.forFeature([CustomMaterialEntity])],
      useFactory: () => ({
        materialEntity: CustomMaterialEntity,
        allowNegativeStock: false,
      }),
    }),
  ],
})
export class AppModule {}
```

### Contributing

We welcome contributions! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting PRs.

**Development Setup:**
```bash
# Clone the monorepo
git clone https://github.com/Rytass/RytassUtils.git
cd RytassUtils/packages/wms-base-nestjs-module

# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build the package
npm run build
```

**Testing Your Changes:**
```bash
# Run integration tests
npm run test:e2e

# Run specific test suite
npm run test -- --testPathPattern=order.spec

# Test with different databases
npm run test:postgres
npm run test:mysql
```

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/) framework
- Database abstraction via [TypeORM](https://typeorm.io/)
- Inspired by modern warehouse management practices
- Community feedback and contributions

## 🎯 What's Next?

**Upcoming Features:**
- **v2.1**: GraphQL API support
- **v2.2**: Real-time stock notifications via WebSockets  
- **v2.3**: Advanced analytics and reporting dashboard
- **v2.4**: Multi-warehouse support with transfer workflows

**Community Requests:**
- MongoDB adapter support
- Barcode scanning integration
- Integration with popular ERP systems
- Mobile-optimized management interface

---

**Ready to build your warehouse management system?** 

Start with [Quick Start](#-quick-start) and work your way through the progressive learning path. Join our [Discord community](https://discord.gg/rytass) for support and discussions.

**Questions or need help?** Check our [GitHub Discussions](https://github.com/Rytass/RytassUtils/discussions) or [create an issue](https://github.com/Rytass/RytassUtils/issues/new).

---

*Last updated: January 2025 | Version 2.0.0*