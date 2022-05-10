# `OrderBuilder`

## An `Order` builder API makes business-logic development more easier.

## Features

  - Arbitrary-precision order-calculating based on [decimal.js](https://github.com/MikeMcl/decimal.js/).
  - Common `Pipe-line` pattern API.

Core Concepts

1. Policy
    - Configuration for OrderBuilder instance.
    - Is mutable `before` OrderBuilder create an `Order` instance.
    - discount
      1. `ValueDiscount`
      2. `PercentageDiscount`

2. Condition
    - A function that resolve to `Boolean` to validate whether its policy will be activated.
    - threshold
      - `PriceThreshold`
    - requirement
      - `ItemRequired`
    - validator
      - `CouponValidator`

3. Coupon
    - Can binding with Policy.

## Load

```typescript
import { OrderBuilder } from '@rytass/order-builder';
```

## Usage

```typescript
import { OrderBuilder, ValueDiscount, PercentageDiscount } from '@rytass/order-builder';

const builder = new OrderBuilder({
  policies: [
    new PercentageDiscount(0.8, { id: 'MEMBER_DISCOUNT' }),
    new ValueDiscount(
      100, 
      [
        new PriceThreshold(500),
      ],
      {
        id: 'SEASONAL_DISCOUNT',
      },
    ),
    new ValueDiscount(
      500, 
      [
        new PriceThreshold(300),
        new ItemsRequired([{
          id: 'ItemA',
          quantity: 2,
        }, 'ItemB']),
      ],
    ),
  ],
});

builder.addPolicy(new ValueDiscount(50, [new CouponValidator('DISCOUNT_50')]));

const order1 = builder.build({
  items: [{
    id: 'ItemB',
    name: 'Hello',
    unitPrice: 100,
    quantity: 10,
  }],
});

builder.addPolicy(new ValueDiscount(10, [new CouponValidator('DISCOUNT_10')])); // throw error "Policy is immutable if builder.build was called."

order1.price; // 1000 * 0.8 - 100 = 700

order1.addCoupon('DISCOUNT_50');

order1.price; // 1000 * 0.8 - 100 - 50 = 650

const order2 = builder.build({
  items: [{
    id: 'ItemA',
    name: 'Hello',
    unitPrice: 100,
    quantity: 10,
  }, {
    id: 'ItemB',
    name: 'Foo',
    unitPrice: 70,
    quantity: 1,
  }],
  coupons: [],
});

order2.price; // 1070 * 0.8 - 100 - 500 = 256

order2.discountValue; // 1070 * 0.2 + 100 + 500 = 814

orders.discounts; // [{ type: 'PERCENTAGE', conditions: [], value: 0.8, discount: 214, id: 'MEMBER_DISCOUNT' }, { type: 'VALUE', conditions: [{ type: 'THRESHOLD', value: 500 }] value: 100, discount: 100, id: 'SEASONAL_DISCOUNT' }, { type: 'VALUE', conditions: [{ type: 'THRESHOLD', value: 300 }, { type: 'ITEM_REQUIRED', items: [{ id: 'ItemA', quantity: 2 }, { id: 'ItemB', quantity: 1 }] }] value: 500, discount: 500 }]

// On Refund
order2.removeItem('ItemB', 1);

order2.price; // 1000 * 0.8 - 100 = 700

const builder2 = new OrderBuilder(builder);

builder2.addPolicy(new ValueDiscount(10, [new CouponValidator('DISCOUNT_10')]));
builder2.removePolicy('MEMBER_DISCOUNT');

const order3 = builder2.build({
  items: [{
    id: 'ItemB',
    name: 'Hello',
    unitPrice: 100,
    quantity: 10,
  }],
  coupons: ['DISCOUNT_10'],
});

order3.price; // 1000 - 100 - 10 = 890
```
