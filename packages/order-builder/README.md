# `OrderBuilder`

## An `Order` builder API makes business-logic development more easier.

## Features

  - Arbitrary-precision order-calculating based on [decimal.js](https://github.com/MikeMcl/decimal.js/).
  - Common `Pipe` pattern API.

Core API

1. OrderBuilder
    - config
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
    - validator
      - `CouponValidator`

## Load & Interface

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

## Usage

### Scenario 1

```typescript
/**
 * 情境編號：甲
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
    items: ['B''C', 'D', 'E'],
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
    items: ['C', 'D', 'E', 'F''G', 'H', 'I'],
  }),
  { stepUnit: 'price', onlyMatched: true }
);

const builder = new OrderBuilder({
  discountMethod: 'PRICE_WEIGHTED_AVERAGE',
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
  policies: [
    policy1,
    policy2,
    policy3,
  ],
});

const builder2 = new OrderBuilder({
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
  policies: [
    policy1,
    policy2,
    policy3,
  ],
});

const builder2 = new OrderBuilder({
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
