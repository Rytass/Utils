# `OrderBuilder`

## An `Order` builder API makes business-logic development more easier.

---

## Features

  - Arbitrary-precision order-calculating based on [decimal.js](https://github.com/MikeMcl/decimal.js/).
  - Common `Pipe` pattern API.

Core API

1. OrderBuilder
    - config
      - PolicyPickStrategy
        - `ItemBasedPolicyPickStrategy`
        - `OrderBasedPolicyPickStrategy`
      - DiscountMethod
        - `PriceWeightedAverageDiscountMethod`
        - `QuantityWeightedAverageDiscountMethod`
      - RoundStrategy
        - `EveryCalculationRoundStrategy`
        - `FinalPriceRoundStrategy`
        - `NoRoundRoundStrategy`

2. Policy
    - discount
      - `ValueDiscount`
      - `PercentageDiscount`
      - `StepValueDiscount`
      - `StepPercentageDiscount`
      - `ItemGiveawayDiscount`

3. Condition
    - threshold
      - `PriceThreshold`
      - `QuantityThreshold`
    - requirement
      - `ItemIncluded`
      - `ItemRequired`
      - `QuantityRequired`
      - `ItemExcluded`
    - validator
      - `CouponValidator`

---

## Documents

### OrderBuilder

| **Arguments**        |  index  | Type                            | Required |
| -------------------- | ------- | ------------------------------- | -------- |
| **overload1**        |         |                                 |          |
| `builder`            | 0       | OrderBuilder                    | `false`  |
| **overload2**        |         |                                 |          |
| `options`            | 0       | OrderBuilderConstructor         | `false`  |

#### OrderBuilderConstructor

| **Properties**       | Type                     | Required |
| -------------------- | ------------------------ | -------- |
| `policies`           | Policy[]                 | `true`   |
| `discountMethod`     | "price-weighted-average" \| "quantity-weighted-average" | `false` |
| `roundStrategy`      | "every-calculation" \| "final-price-only" \| "no-round" | `false` |
| `logistics`          | OrderLogistics           | `false` |


<!-- Disable table formatting because Prettier messing it up. -->
<!-- prettier-ignore -->
| `OrderBuilder`                           | Return            | Description |
| ---------------------------------------- | ----------------- | ----------- |
| **Properties**                           |                   |             |
| `config`                                 | OrderConfig       | Get the configuration of current builder. |
| `policies`                               | Policies[]        | Get all the policies of the builder. **(activated + none-activated)** |
| `hasBuiltOrders`                         | boolean           | Checks whether this builder has already built any instance of order. |
| **Methods**                              |                   |             |
| `build`                                  | Order             | Create an order instance, and lock the access of mutations on policy. |
| `clone`                                  | OrderBuilder      | Create a new OrderBuilder instance based on current instance. |
| `addPolicy(policy: Policies)`            | this              | Push policy instance(s) into **builder.policies** (can active as `builder.hasBuiltOrders` is `false`). |
| `addPolicy(policies: Policies[])`        |                   | |
| `removePolicy(policy: Policy)`           | this              | Remove policy instance(s) from **builder.policies** based on instance reference or **policy.id** (can active as `builder.hasBuiltOrders` is `false`) |
| `removePolicy(policy: string)`           | | |
| `removePolicy(policies: Policy[])`       | | |
| `removePolicy(policies: string[])`       | | |
| `getPolicy(policyId: string)`            | Policy \| undefined | Get the specified policy instance by **policy.id** |
| `setLogistics(logistics: OrderLogistics)`| this              | Set the logistics of the order. |

---

### Order

#### OrderConstructor

| **Properties**       | Type          | Required |
| -------------------- | ------------- | -------- |
| `items`              | OrderItem[]   | `true`   |
| `coupons`            | string[]      | `false`  |

<!-- Disable table formatting because Prettier messing it up. -->
<!-- prettier-ignore -->
| `Order`                                  | Return            | Description |
| ---------------------------------------- | ----------------- | ----------- |
| **Properties**                           |                   |             |
| `builder`                                | OrderBuilder      | Get the the owner of current order. |
| `config`                                 | OrderConfig       | Get the configuration from its builder. |
| `policies`                               | Policies[]        | Get all the policies from its builder. |
| `coupons`                                | string[]          | Get all the coupons from current order. |
| `items`                                  | OrderItem[]       | Get all the items from current order. |
| `itemManager`                            | OrderItemManager  | Get the item manager. |
| `itemRecords`                            | OrderItemRecord[] | Get all the detail-records of item based on policies. |
| `discounts`                              | PolicyDiscountDescription[] | Get the descriptions of discount based on applied-policies. |
| `discountValue`                          | number            | Get total discount in this order. |
| `itemValue`                              | number            | Get total value of items in this order. |
| `itemQuantity`                           | number            | Get total quantity of items in this order. |
| `price`                                  | number            | Get final price of order. |
| `logistics`                              | OrderLogistics    | Get logistics config of current order. |
| `logisticsRecord`                        | OrderItemRecord   | Get logistics in the type of order-item-record. |
| **Methods**                              |                   | |
| `subOrder(subCondition: SubOrderCondition)`| Order             | Create a new instance of **Order** based on the sub-condition on `items` and `coupons`. |
| `addCoupon(coupon: string)`              | this              | Push coupon(s) into `order.coupons`.  |
| `addCoupon(coupons: string[])`           |                   | |
| `removeCoupon(coupon: string)`           | this              | Remove coupons(s) from `order.coupons` |
| `removeCoupon(coupons: string[])`        |                   | |
| `addItem(item: OrderItem)`               | this              | Push item(s) into `order.items`. |
| `addItem(items: OrderItem[])`            |                   | |
| `removeItem(id: string, quantity: number)`  | this           | Remove item(s) from `order.items`. |
| `removeItem(item: OrderItem)`            |                   | |
| `removeItem(item: string)`               |                   | |
| `removeItem(items: OrderItem[])`         |                   | |
| `removeItem(items: string[])`            |                   | |

---

### Discount
<!-- Disable table formatting because Prettier messing it up. -->
<!-- prettier-ignore -->
| **Arguments**        | index   | Type            | Required |
| -------------------- | ------- | --------------- | -------- |
| **overload1**        |         |                 |          |
| `value`              | 0       | number          | `true`   |
| `condition`          | 1       | Condition       | `false`  |
| `options`            | 2       | DiscountOptions | `false`  |
| **overload2**        |         |                 |          |
| `value`              | 0       | number          | `true`   |
| `conditions`         | 1       | Condition[]     | `false`  |
| `options`            | 2       | DiscountOptions | `false`  |
| **overload3**        |         |                 |          |
| `value`              | 0       | number          | `true`   |
| `options`            | 1       | DiscountOptions | `false`  |

### Interfaces Remark

| Interface      | Type                   |
| -------------- | ---------------------- |
| `Policies`     | `Policy` \| `Policy[]` |
| `RemovePolicy` | `Policy` \| `string`   |

---

## Basic Usage

```typescript
import { OrderBuilder, ValueDiscount, PercentageDiscount } from '@rytass/order-builder';

const policy1 = new ValueDiscount(100, { id: 'DISCOUNT_1' });
const policy2 = new PercentageDiscount(0.8, { id: 'DISCOUNT_2' });

// Initialize an order-builder.
const builder = new OrderBuilder({
  policyPickStrategy: 'item-based',
  discountMethod: 'price-weighted-average',
  roundStrategy: 'every-calculation',
  policies: [policy1],
});

// Allowing conditional business-logic to determinate whether to mutate policies.
const order = builder
  .addPolicy(policy2) // 20% off
  .removePolicy('DISCOUNT_1') // or .removePolicy(policy1)
  .build({
    items: [
      {
        id: 'ItemA',
        name: 'Foo',
        unitPrice: 100,
        quantity: 2,
      },
      {
        id: 'ItemB',
        name: 'Bar',
        unitPrice: 50,
        quantity: 1,
      },
    ],
  });

builder.getPolicy('DISCOUNT_1'); // undefined
builder.getPolicy('DISCOUNT_2'); // reference to `policy2`
order.price // 250 * 0.8 = 200
order.itemRecords
// [
//   {
//     itemId: 'ItemA-1',
//     originItem: { id: 'ItemA', name: 'Foo', unitPrice: 100 },
//     initialValue: 100,
//     discountValue: 20,
//     finalPrice: 80,
//     discountRecords: [{ policyId: 'DISCOUNT_2', discountValue: 20 }],
//     appliedPolicies: [policy2]
//   },
//   {
//     itemId: 'ItemA-2',
//     originItem: { id: 'ItemA', name: 'Foo', unitPrice: 100 },
//     initialValue: 100,
//     discountValue: 20,
//     finalPrice: 80,
//     discountRecords: [{ policyId: 'DISCOUNT_2', discountValue: 20 }],
//     appliedPolicies: [policy2]
//   },
//   {
//     itemId: 'ItemB-1',
//     originItem: { id: 'ItemB', name: 'Bar', unitPrice: 50 },
//     initialValue: 50,
//     discountValue: 10,
//     finalPrice: 40,
//     discountRecords: [{ policyId: 'DISCOUNT_2', discountValue: 10 }],
//     appliedPolicies: [policy2]
//   }
// ]

```

## Examples

### Custom OrderItem Dto

```typescript
import {
  /** Core */
  OrderItem,
  OrderBuilder,
  /** Conditions */
  ItemIncluded,
  PriceThreshold,
  QuantityThreshold,
  /** Discount policies */
  ValueDiscount,
  StepValueDiscount,
  PercentageDiscount,
  ItemGiveawayDiscount,
  StepPercentageDiscount,
} from '@rytass/order-builder';

// Allow custom order-item dto.
type TestOrderItem = OrderItem<{
  category: string,
  brand: string,
}>;

const items: TestOrderItem[] = [
  {
    id: 'A',
    name: '外套A',
    unitPrice: 1000,
    quantity: 1,
    category: 'jacket',
    brand: 'AJE',
  },
  {
    id: 'B',
    name: '外套B',
    unitPrice: 1500,
    quantity: 1,
    category: 'jacket',
    brand: 'N21',
  },
  {
    id: 'C',
    name: '鞋子C',
    unitPrice: 2000,
    quantity: 1,
    category: 'shoes',
    brand: 'N21',
  },
  {
    id: 'D',
    name: '鞋子D',
    unitPrice: 2500,
    quantity: 1,
    category: 'shoes',
    brand: 'Preen',
  },
  {
    id: 'E',
    name: '鞋子E',
    unitPrice: 3000,
    quantity: 1,
    category: 'shoes',
    brand: 'Preen',
  },
  {
    id: 'F',
    name: '飾品F',
    unitPrice: 4000,
    quantity: 1,
    category: 'accessory',
    brand: 'Swell',
  },
  {
    id: 'G',
    name: '飾品G',
    unitPrice: 5000,
    quantity: 1,
    category: 'accessory',
    brand: 'Swell',
  },
  {
    id: 'H',
    name: '飾品H',
    unitPrice: 6000,
    quantity: 1,
    category: 'accessory',
    brand: 'Swell',
  },
  {
    id: 'I',
    name: '飾品I',
    unitPrice: 6500,
    quantity: 1,
    category: 'accessory',
    brand: 'Boyy',
  },
];
```

### Scenario 1 - 1

```typescript
/**
 * 情境編號：甲
 * 
 * 決策法：擇優取一 (order-based)
 *
 * 情境敘述：
 * 1. 指定商品（Ａ～Ｆ）滿3件 打9折
 * 2. 指定商品（Ｃ～Ｉ）每5000元 折600元
 * 3. 指定分類（鞋子）滿4000元 送最低價商品
 * 4. 指定分類（Swell）每1件 打9折
 *
 * 輸入：(1|2) & (3|4)
 * 預期結果：2 + 4
 * 購物車顯示金額 24856
 */

// 1. 指定商品（Ａ～Ｆ）滿3件 打9折
const policy1 = new PercentageDiscount(
  0.9,
  new ItemIncluded({
    items: ['A', 'B', 'C', 'D', 'E', 'F'],
    threshold: 3,
  }),
  { onlyMatched: true },
);

// 2. 指定商品（Ｃ～Ｉ）每5000元 折600元
const policy2 = new StepValueDiscount(
  5000,
  600,
  new ItemIncluded<TestOrderItem>({
    items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
  }),
  { stepUnit: 'price', onlyMatched: true },
);

// 3. 指定分類（鞋子）滿4000元 送最低價商品
const policy3 = new ItemGiveawayDiscount(
  1,
  new ItemIncluded<TestOrderItem>({
    scope: 'category',
    items: ['shoes'],
    conditions: [new PriceThreshold(4000)],
  }),
  { onlyMatched: true },
);

// 4. 指定分類（Swell）每1件 打9折
const policy4 = new StepPercentageDiscount(
  1,
  0.9,
  new ItemIncluded<TestOrderItem>({
    scope: 'brand',
    items: ['Swell'],
  }),
  {
    stepUnit: 'quantity',
    onlyMatched: true,
  }
);

// 擇優 (1|2) & (3|4)
const builder = new OrderBuilder({
  policyPickStrategy: 'order-based',
  policies: [
    [policy1, policy2],
    [policy3, policy4],
  ],
});

const order = builder.build({ items });

order.price // 24856
```

### Scenario 2

```typescript
/**
 * 情境編號：乙
 * 
 * 決策法：擇優取一 (order-based)
 *
 * 情境敘述：
 * 1. 指定商品（Ｂ～Ｅ）無條件 送最低價商品
 * 2. 指定商品（Ｃ～Ｉ）每3000元 折200元
 * 3. 指定分類（N21）滿2件 折100元
 * 4. 指定分類（飾品）每2件 打9折
 * 5. 指定分類（Boyy）滿5000元 打9折
 * 6. 全館 滿6件 送最低價商品
 *
 * 輸入：(1|2) & (3|4|5) & 6
 * 輸出：2 + 4 + 6
 * 購物車顯示金額 24868
 */

// 1. 指定商品（Ｂ～Ｅ）無條件 送最低價商品
const policy1 = new ItemGiveawayDiscount(
  1,
  new ItemIncluded<TestOrderItem>({
    items: ['B', 'C', 'D', 'E'],
  }),
  { onlyMatched: true }
);

// 2. 指定商品（Ｃ～Ｉ）每3000元 折200元
const policy2 = new StepValueDiscount(
  3000,
  200,
  new ItemIncluded<TestOrderItem>({
    items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
    scope: 'id',
  }),
  { stepUnit: 'price', onlyMatched: true }
);

// 3. 指定分類（N21）滿2件 折100元
const policy3 = new ValueDiscount(
  100,
  new ItemIncluded<TestOrderItem>({
    items: ['N21'],
    scope: 'brand',
    threshold: 2,
  }),
  { onlyMatched: true }
);

// 4. 指定分類（飾品）每2件 打9折
const policy4 = new StepPercentageDiscount(
  2,
  0.9,
  new ItemIncluded<TestOrderItem>({
    items: ['accessory'],
    scope: 'category',
  }),
  { stepUnit: 'quantity', onlyMatched: true }
);

// 5. 指定分類（Boyy）滿5000元 打9折
const policy5 = new PercentageDiscount(
  0.9,
  new ItemIncluded<TestOrderItem>({
    items: ['Boyy'],
    scope: 'brand',
    conditions: [new PriceThreshold(5000)],
  }),
  { id: 'P5', onlyMatched: true }
);

// 6. 全館 滿6件 送最低價商品
const policy6 = new ItemGiveawayDiscount(1, new QuantityThreshold(6));

// 擇優 (1|2) & (3|4|5) & 6
const builder = new OrderBuilder({
  policyPickStrategy: 'order-based',
  policies: [
    [policy1, policy2],
    [policy3, policy4, policy5],
    policy6,
  ],
});

const order = builder.build({ items });

order.price // 24868
```

### Scenario 3

```typescript
/**
 * 情境編號：丙 - 1
 * 
 * 決策法：擇優取一 (order-based)
 *
 * 情境敘述：
 * 1. 全館 滿6件 送最低價商品
 * 2. 指定分類（Boyy）滿5000元 打9折
 * 3. 指定商品（Ｂ～Ｅ）無條件 送最低價商品
 * 4. 指定商品（Ｃ～Ｉ）每3000元 折200元
 * 5. 指定分類（鞋子）滿4000元 送最低價商品
 *
 * 輸入：1 & 2 & 3 & 4 & 5
 * 輸出：1 + 2 + 3 + 4 + 5
 * 購物車顯示金額 24677
 */

// 1. 全館 滿6件 送最低價商品
const policy1 = new ItemGiveawayDiscount(
  1,
  new QuantityThreshold(6),
);

// 2. 指定分類（Boyy）滿5000元 打9折
const policy2 = new PercentageDiscount(
  0.9,
  new ItemIncluded<TestOrderItem>({
    items: ['Boyy'],
    scope: 'brand',
    conditions: [new PriceThreshold(5000)],
  }),
  { onlyMatched: true }
);

// 3. 指定商品（Ｂ～Ｅ）無條件 送最低價商品
const policy3 = new ItemGiveawayDiscount(
  1,
  new ItemIncluded<TestOrderItem>({
    items: ['B', 'C', 'D', 'E'],
  }),
  { onlyMatched: true }
);

// 4. 指定商品（Ｃ～Ｉ）每3000元 折200元
const policy4 = new StepValueDiscount(
  3000,
  200,
  new ItemIncluded<TestOrderItem>({
    items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
  }),
  { stepUnit: 'price', onlyMatched: true }
);

// 5. 指定分類（鞋子）滿4000元 送最低價商品
const policy5 = new ItemGiveawayDiscount(
  1,
  new ItemIncluded<TestOrderItem>({
    items: ['shoes'],
    scope: 'category',
    conditions: [new PriceThreshold(4000)],
  }),
  { onlyMatched: true }
);

const builder = new OrderBuilder({
  policyPickStrategy: 'order-based',
  policies: [
    policy1,
    policy2,
    policy3,
    policy4,
    policy5,
  ],
});

const order = builder.build({ items });

order.price // 24677
```

### Scenario 3 - 2

```typescript
/**
 * 情境編號：丙 - 2
 * 
 * 決策法：擇優取一 (order-based)
 *
 * 情境敘述：
 * 1. 全館 滿14000元 贈最低價品
 * 2. 指定商品（Ｃ～Ｅ）無條件 送最低價商品
 * 3. 指定分類（鞋子）滿6000元 送最低價商品
 * 4. 指定分類（Boyy）滿5000元 打9折
 * 5. 全館 滿9件 送最低價商品
 * 6. 指定商品（Ｃ～Ｉ）每3000元 折200元
 *
 * 輸入：1 & 2 & 3 & 4 & 5 & 6
 * 輸出：1 + 2 + 3 + 4 + 5 + 6
 * 購物車顯示金額 26250
 */

// 1. 全館 滿14000元 送最低價商品
const policy1 = new ItemGiveawayDiscount(
  1,
  new PriceThreshold(14000),
);

// 2. 指定商品（Ｃ～Ｅ）無條件 送最低價商品
const policy2 = new ItemGiveawayDiscount(
  1,
  new ItemIncluded<TestOrderItem>({
    items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
  }),
  { onlyMatched: true }
);

// 3. 指定分類（鞋子）滿6000元 送最低價商品
const policy3 = new ItemGiveawayDiscount(
  1,
  new ItemIncluded<TestOrderItem>({
    items: ['shoes'],
    scope: 'category',
    conditions: [new PriceThreshold(6000)],
  }),
  { onlyMatched: true }
);

// 4. 指定分類（Boyy）滿5000元 打9折
const policy4 = new PercentageDiscount(
  0.9,
  new ItemIncluded<TestOrderItem>({
    scope: 'brand',
    items: ['Boyy'],
    conditions: [new PriceThreshold(5000)],
  }),
  { onlyMatched: true }
);

// 5. 全館 滿9件 送最低價商品
const policy5 = new ItemGiveawayDiscount(
  1,
  new QuantityThreshold(9),
);

// 6. 指定商品（Ｃ～Ｉ）每3000元 折200元
const policy6 = new StepValueDiscount(
  3000,
  200,
  new ItemIncluded({
    items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
  }),
  { stepUnit: 'price', onlyMatched: true }
);

const builder = new OrderBuilder({
  policyPickStrategy: 'order-based',
  discountMethod: 'price-weighted-average',
  policies: [
    policy1,
    policy2,
    policy3,
    policy4,
    policy5,
    policy6,
  ],
});

const order = builder.build({ items });

order.price // 26250
```

### Scenario 4

```typescript
/**
  * 情境編號：丁
  * 
  * 決策法：擇優取一 (order-based)
  *
  * 情境敘述：
  * 1. 指定分類（飾品）無條件 折1,000 元
  * 2. 指定分類（Swell）滿10,000元 打9折
  * 3. 全館 滿15,000元 送最低價品
  * 4. 指定商品（Ｆ～Ｉ）無條件 打9折
  * 5. 指定分類（Boyy）滿5000 打9折
  *
  * 預期結果：(1&2&3) | (4&5)
  * 購物車顯示金額 28070
  */

// 1. 指定分類（飾品）無條件 折1,000 元
const policy1 = new ValueDiscount(
  1000,
  new ItemIncluded<TestOrderItem>({
    scope: 'category',
    items: ['accessory'],
  }),
  { onlyMatched: true }
);

// 2. 指定分類（Swell）滿10,000元 打9折
const policy2 = new PercentageDiscount(
  0.9,
  new ItemIncluded<TestOrderItem>({
    scope: 'brand',
    items: ['Swell'],
    conditions: [new PriceThreshold(10000)],
  }),
  { onlyMatched: true }
);

// 3. 全館 滿15,000元 送最低價品
const policy3 = new ItemGiveawayDiscount(
  1,
  new PriceThreshold(15000),
);

// 4. 指定商品（Ｆ～Ｉ）無條件 打9折
const policy4 = new PercentageDiscount(
  0.9,
  new ItemIncluded<TestOrderItem>({
    items: ['F', 'G', 'H', 'I'],
  }),
  { onlyMatched: true }
);

// 5. 指定分類（Boyy）滿5000 打9折
const policy5 = new PercentageDiscount(
  0.9,
  new ItemIncluded<TestOrderItem>({
    scope: 'brand',
    items: ['Boyy'],
    conditions: [new PriceThreshold(5000)],
  }),
  { onlyMatched: true }
);

const builder1 = new OrderBuilder({
  policyPickStrategy: 'order-based',
  policies: [
    policy1,
    policy2,
    policy3,
  ],
});

const builder2 = new OrderBuilder({
  policyPickStrategy: 'order-based',
  policies: [
    policy4,
    policy5,
  ],
});

const order1 = builder1.build({ items });
const order2 = builder2.build({ items });

order1.price // 28070
order2.price // 28765
```

### Scenario 5

```typescript
/**
 * 情境編號：戊
 *
 * 決策法：擇優取一 (order-based)
 *
 * 情境敘述：
 * 1. 指定商品（Ｂ～Ｅ）無條件 送最低價商品
 * 2. 全館 滿6件 送最低價商品
 * 3. 指定分類（飾品）每2件 打9折
 * 4. 指定分類（鞋子）滿4000元 送最低價商品
 * 5. 指定分類（Boyy）滿5000元 打9折
 * 6. 全館 滿15,000元 送最低價品
 *
 * 預期結果：(1&2&3) | (4&5&6)
 * 購物車顯示金額 24915
 */

// 1. 指定商品（Ｂ～Ｅ）無條件 送最低價商品
const policy1 = new ItemGiveawayDiscount(
  1,
  new ItemIncluded<TestOrderItem>({
    items: ['B', 'C', 'D', 'E'],
  }),
  { onlyMatched: true }
);

// 2.全館 滿6件 送最低價商品
const policy2 = new ItemGiveawayDiscount(
  1,
  new QuantityThreshold(6),
);

// 3. 指定分類（飾品）每2件 打9折
const policy3 = new StepPercentageDiscount(
  2,
  0.9,
  new ItemIncluded<TestOrderItem>({
    scope: 'category',
    items: ['accessory'],
  }),
  { stepUnit: 'quantity', onlyMatched: true }
);

// 4. 指定分類（鞋子）滿4000元 送最低價商品
const policy4 = new ItemGiveawayDiscount(
  1,
  new ItemIncluded<TestOrderItem>({
    scope: 'category',
    items: ['shoes'],
    conditions: [new PriceThreshold(4000)],
  }),
  { onlyMatched: true }
);

// 5. 指定分類（Boyy）滿5000元 打9折
const policy5 = new PercentageDiscount(
  0.9,
  new ItemIncluded<TestOrderItem>({
    scope: 'brand',
    items: ['Boyy'],
    conditions: [new PriceThreshold(5000)],
  }),
  { onlyMatched: true }
);

// 6. 全館 滿15,000元 送最低價品
const policy6 = new ItemGiveawayDiscount(
  1,
  new PriceThreshold(15000),
);

const builder1 = new OrderBuilder({
  policyPickStrategy: 'order-based',
  policies: [
    policy1,
    policy2,
    policy3,
  ],
});

const builder2 = new OrderBuilder({
  policyPickStrategy: 'order-based',
  policies: [
    policy4,
    policy5,
    policy6,
  ],
});

const order1 = builder1.build({ items });
const order2 = builder2.build({ items });

order1.price // 24915
order2.price // 27850
```

### Scenario 1 - 2

```typescript
/**
 * 情境編號：甲 - 2
 *
 * 決策法：最適組合 (item-based)
 *
 * 情境敘述：
 * 1. 指定商品（Ａ～Ｆ）滿3件 打9折
 * 2. 指定商品（Ｃ～Ｉ）每5000元 折600元
 * 3. 指定分類（鞋子）滿4000元 送最低價商品
 * 4. 指定分類（Swell）每1件 打9折
 * 5. 全館 滿6件 贈紅利點數1000點
 * 6. 全館 滿6000元 免運
 *
 * 預期結果：
 * 取最優排列組合：2+4
 * 購物車顯示金額 24856
 */

// 指定商品（Ａ～Ｆ）滿3件 打9折
const policy1 = new PercentageDiscount(
  0.9,
  new ItemIncluded({
    items: ['A', 'B', 'C', 'D', 'E', 'F'],
    threshold: 3,
  }),
  { id: 'SPECIFIED_A_F', onlyMatched: true }
);

// 2. 指定商品（Ｃ～Ｉ）每5000元 折600元
const policy2 = new StepValueDiscount(
  5000,
  600,
  new ItemIncluded<TestOrderItem>({
    items: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
  }),
  { id: 'SPECIFIED_C_I', stepUnit: 'price', onlyMatched: true }
);

// 3. 指定分類（鞋子）滿4000元 送最低價商品
const policy3 = new ItemGiveawayDiscount(
  1,
  new ItemIncluded<TestOrderItem>({
    scope: 'category',
    items: ['shoes'],
    conditions: [new PriceThreshold(4000)],
  }),
  { id: 'GIVEAWAY_BY_SHOES_1', onlyMatched: true }
);

// * 4. 指定分類（Swell）每1件 打9折
const policy4 = new StepPercentageDiscount(
  1,
  0.9,
  new ItemIncluded<TestOrderItem>({
    scope: 'brand',
    items: ['Swell'],
  }),
  {
    id: 'SPECIFIED_BRAND_BY_Swell_1',
    stepUnit: 'quantity',
    onlyMatched: true,
  }
);

// (1|2)&(3|4)
const builder1 = new OrderBuilder<TestOrderItem>({
  policyPickStrategy: 'item-based',
  policies: [
    [policy1, policy2],
    [policy3, policy4],
  ],
});

const order1 = builder1.build({ items });

const builder2 = new OrderBuilder<TestOrderItem>({
  policyPickStrategy: 'item-based',
  policies: [
    [policy1, policy2],
    policy3,
    policy4,
  ],
});

const order2 = builder2.build({ items });

order1.price === order2.price // true
order1.price // 22491
order2.price // 22491

order1.itemRecords
// [ 
//   {
//     itemId: 'A-1',
//     originItem: {
//       id: 'A',
//       name: '外套A',
//       unitPrice: 1000,
//       category: 'jacket',
//       brand: 'AJE',
//     },
//     initialValue: 1000,
//     discountValue: 100,
//     finalPrice: 900,
//     discountRecords: [
//       {
//         policyId: 'SPECIFIED_A_F',
//         discountValue: 100,
//       },
//     ],
//     appliedPolicies: [
//       {
//         prefix: 'DISCOUNT',
//         type: 'PERCENTAGE',
//         id: 'SPECIFIED_A_F',
//         value: 0.9,
//         conditions: [
//           {
//             type: 'QUANTITY',
//             items: ['A', 'B', 'C', 'D', 'E', 'F'],
//             threshold: 3,
//             conditions: [],
//             scope: 'id',
//           },
//         ],
//         options: {
//           id: 'SPECIFIED_A_F',
//           onlyMatched: true,
//         },
//       },
//     ],
//   },
//   ...
```

### Logistics Fee

```typescript
/**
 * 情境編號：總額滿 2000元 免運
 *
 * 情境敘述：
 * 1. 指定商品（B～E）滿2件 送最低價品
 * 2. 整筆訂單 滿 2000 元免運
 *
 * 預期結果： 4500 + 200 - 1500 - 200 = 3000
 * 購物車顯示金額 3000
 */
const originItems: TestOrderItem[] = [
  {
    id: 'A',
    name: '外套A',
    unitPrice: 1000,
    quantity: 1,
    category: 'jacket',
    brand: 'AJE',
  },
  {
    id: 'B',
    name: '外套B',
    unitPrice: 1500,
    quantity: 1,
    category: 'jacket',
    brand: 'N21',
  },
  {
    id: 'C',
    name: '鞋子C',
    unitPrice: 2000,
    quantity: 1,
    category: 'shoes',
    brand: 'N21',
  },
];

const order = new OrderBuilder()
  // 滿 2000 免運
  .setLogistics({
    price: 200,
    threshold: 2000,
    name: '運費',
  })
  // 指定商品 B, C, D, E 滿兩件送最低價品
  .addPolicy(
    new ItemGiveawayDiscount(
      1,
      new ItemIncluded<TestOrderItem>({
        items: ['B', 'C', 'D', 'E'],
        threshold: 2,
      }),
      { onlyMatched: true }
    )
  )
  .build({ items: originItems });

order.price // 4500 + 200 - 1500 - 200 = 3000
```

### Matched Times & Excluded Calculating Policy

```typescript
/**
 * 情境敘述：
 * 滿足條件贈送紅利點數、滿足條件可加購商品
 * 需要能單純判斷是否滿足特定條件、滿足幾次，不影響訂單計算的 policy 功能
 */
const items: TestOrderItem[] = [
  {
    id: 'A',
    name: '外套A',
    unitPrice: 1000,
    quantity: 1,
    category: 'jacket',
    brand: 'AJE',
  },
  {
    id: 'B',
    name: '外套B',
    unitPrice: 1500,
    quantity: 1,
    category: 'jacket',
    brand: 'N21',
  },
  {
    id: 'C',
    name: '鞋子C',
    unitPrice: 2000,
    quantity: 1,
    category: 'shoes',
    brand: 'N21',
  },
];

// Policy1: 每 2000 元折 200 元
const policy1 = new StepValueDiscount(
  2000,
  200,
  { stepUnit: 'price' },
);

// Policy1 滿足次數
new OrderBuilder()
  .addPolicy(policy1)
  .build({ items })
  .discounts
  .find(discount => discount.id === policy1.id)
  ?.matchedTimes; // step(4500, 2000) = 2

// Policy2: 每 1499 元打 8折 (Matched only Policy, will not participant in discounting)
const policy2 = new StepPercentageDiscount(
  1499,
  0.8,
  { stepUnit: 'price', excludedInCalculation: true }
);

const order = new OrderBuilder()
  .addPolicy(policy2)
  .build({ items });

// Policy2: 滿足次數
order
.discounts
.find(discount => discount.id === policy2.id)
?.matchedTimes; // step(4500, 1499) = 3

// Policy2: Excluded in calculation.
order.discountValue // 0
```
