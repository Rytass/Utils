import { StepPercentageDiscount } from './../src/policies/discount/step-percentage-discount';
import { ItemGiveawayDiscount } from './../src/policies/discount/item-giveaway-discount';
import {
  OrderBuilder,
  PercentageDiscount,
  ValueDiscount,
  CouponValidator,
  ItemRequired,
  PriceThreshold,
  QuantityRequired,
  StepValueDiscount,
  ItemIncluded,
  QuantityThreshold,
  ORDER_LOGISTICS_ID,
  ItemExcluded,
} from '../src';
import { Order } from '../src/core/order';
import { OrderConfig } from '../src/core/configs/order-config';
import { getOnlyMatchedItems } from '../src/policies/discount/utils';

/** OrderBuilder */
describe('OrderBuilder', () => {
  it('should be defined', () => {
    const builder = new OrderBuilder({
      policies: [],
    });

    expect(builder).toBeDefined();
    expect(builder).toBeInstanceOf(OrderBuilder);
  })
})

describe('OrderBuilder', () => {
  it('should create an OrderBuilder instance', () => {
    const builder = new OrderBuilder({
      policies: [],
    });

    expect(builder).toBeDefined();
    expect(builder).toBeInstanceOf(OrderBuilder);

    const builder2 = new OrderBuilder(builder);

    expect(builder2).toBeDefined();
    expect(builder2).toBeInstanceOf(OrderBuilder);
  });

  it('should be allowed to pass policy-based implementation in args', () => {
    const builder = new OrderBuilder({
      policies: [
        new PercentageDiscount(0.8, { id: 'MEMBER_DISCOUNT' }),
        new ValueDiscount(100),
      ],
    });

    expect(builder).toBeDefined();
    expect(builder).toBeInstanceOf(OrderBuilder);
  });

  describe('Simulate E2E user flow', () => {
    const builder = new OrderBuilder({
      policies: [
        new PercentageDiscount(0.8, { id: 'MEMBER_DISCOUNT' }),
        new ValueDiscount(100),
        new ValueDiscount(80, [new PriceThreshold(200)], {
          id: 'SEASONAL_DISCOUNT',
        }),
      ],
    });

    const order1 = builder.build({
      items: [
        {
          id: 'ItemB',
          name: 'Hello',
          unitPrice: 100,
          quantity: 10,
        },
      ],
      coupons: ['DISCOUNT_50'],
    });

    expect(order1).toBeDefined();
    expect(order1).toBeInstanceOf(Order);

    const discountPolicy = new ValueDiscount(10, [new PriceThreshold(500)], { id: 'TESTING' });

    try {
      builder.addPolicy(discountPolicy);
    } catch (ex: any) {
      expect(ex).toBeInstanceOf(Error);
      expect(ex?.message).toEqual(
        'Policy is immutable if builder.build was called. You should call builder.clone first.'
      );
    }

    try {
      builder.removePolicy('TESTING');
    } catch (ex: any) {
      expect(ex).toBeInstanceOf(Error);
      expect(ex?.message).toEqual(
        'Policy is immutable if builder.build was called. You should call builder.clone first.'
      );
    }

    const memberDiscount = new PercentageDiscount(0.8, { id: 'MEMBER_DISCOUNT' });
    const testDiscount = new ValueDiscount(10, [new PriceThreshold(500)], { id: 'TESTING' });

    const builder3 = new OrderBuilder({
      policies: [
        memberDiscount,
        new ValueDiscount(100),
        new ValueDiscount(80, [new PriceThreshold(200)], {
          id: 'SEASONAL_DISCOUNT',
        }),
        testDiscount,
      ],
    });

    const order3 = builder3.build({
      items: [{
        id: 'ItemA',
        name: 'Hello',
        unitPrice: 100,
        quantity: 10,
      }, {
        id: 'ItemB',
        name: 'Foo',
        unitPrice: 70,
        quantity: 2,
      }],
    });

    expect(order3.price).toEqual(722); // 1140 * 0.8 - 100 - 80 - 10 = 722

    const builder4 = new OrderBuilder(builder3);

    const order4 = builder4
      .removePolicy([testDiscount, memberDiscount])
      .build({ items: order3.items });

    expect(JSON.stringify(order3.items)).toEqual(JSON.stringify([{
      id: 'ItemA',
      name: 'Hello',
      unitPrice: 100,
      quantity: 10,
    }, {
      id: 'ItemB',
      name: 'Foo',
      unitPrice: 70,
      quantity: 2,
    }]));

    expect(JSON.stringify(order4.items)).toEqual(JSON.stringify(order4.items));
    expect(order4.price).toEqual(960); // 1140 - 100 - 80 = 960

    order4.removeItem('ItemB', 1);

    expect(order4.price).toEqual(890) // 1070 - 100 - 80 = 890

    const builder5 = new OrderBuilder(builder4);

    builder5
      .addPolicy(
        new PercentageDiscount(0.5, [
          new PriceThreshold(1000),
          new ItemRequired({ id: 'ItemB', quantity: 1 }),
        ])
      )
      .addPolicy(
        new PercentageDiscount(0.5, [
          new PriceThreshold(2000),
          new ItemRequired({ id: 'ItemC', quantity: 1 }),
        ])
      )

    const order5 = builder5.build({
      items: [{
        id: 'ItemB',
        name: 'Foo',
        unitPrice: 100,
        quantity: 15,
      }],
    });

    // expect(order5.price).toEqual(570); // 1500 * 0.5 - 100 - 80 = 570
  });

  describe([
    '1. [會員優惠:MEMBER_DISCOUNT]: 八折',
    '2. [季度優惠:SEASONAL_DISCOUNT]: 滿500元折抵100元',
    '3. (滿額 300元) 及 (購買 ItemA(*2) 和 ItemB(*1)) 可以折抵500元',
    '4. [折價卷]: 該會員使用折價卷 50 元',
  ].join('\n'), () => {
    const builder = new OrderBuilder({
      policies: [
        new PercentageDiscount(0.8, { id: 'MEMBER_DISCOUNT' }),
        new ValueDiscount(100, [new PriceThreshold(500)], { id: 'SEASONAL_DISCOUNT' }),
        new ValueDiscount(500, [
          new PriceThreshold(300),
          new ItemRequired([{
            id: 'ItemA',
            quantity: 2,
          }, 'ItemB']),
        ]),
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

    // throw error "Policy is immutable if builder.build was called."
    try {
      builder.addPolicy(new ValueDiscount(10, [new CouponValidator('DISCOUNT_10')]));
    } catch (ex: any) {
      expect(ex).toBeInstanceOf(Error);
      expect(ex?.message).toEqual(
        'Policy is immutable if builder.build was called. You should call builder.clone first.'
      );
    }

    expect(order1.price).toEqual(700); // 1000 * 0.8 - 100 = 700

    order1.addCoupon('DISCOUNT_50');

    expect(order1.price).toEqual(650); // 1000 * 0.8 - 100 - 50 = 650

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
    });

    expect(order1 === order2).toEqual(false);
    expect(order2.price).toEqual(256); // 1070 * 0.8 - 100 - 500 = 256
    expect(order2.discountValue).toEqual(814) // 1070 * 0.2 + 100 + 500 = 814

    // On Refund
    order2.removeItem('ItemB', 1);
    order2.removeItem('ItemB', '' as unknown as number); // test if developer given wrong input in a forced way.

    expect(order2.price).toEqual(700); // 1000 * 0.8 - 100 = 700

    const builder2 = new OrderBuilder(builder);

    expect(builder2).toBeDefined();
    expect(builder2).toBeInstanceOf(OrderBuilder);
    expect(builder2 === builder).toEqual(false);

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

    expect(order3.price).toEqual(890); // 1000 - 100 - 10 = 890
  })
});

describe('Order', () => {
  const builder = new OrderBuilder();

  // itemValue = 100 * 10 + 70 + 70 * 2 = 1210
  const items = [{
    id: 'ItemA',
    name: 'Hello',
    unitPrice: 100,
    quantity: 10,
  }, {
    id: 'ItemB',
    name: 'Foo',
    unitPrice: 70,
    quantity: 1,
  }, {
    id: 'ItemC',
    name: 'Foo',
    unitPrice: 70,
    quantity: 2,
  }];

  builder
    .addPolicy(new ValueDiscount(100))
    .addPolicy(new PercentageDiscount(0.9, new ItemRequired('ItemA')));

  const coupons = ['COUPON1', 'COUPON2', 'COUPON3'];

  builder.addPolicy([
    new ValueDiscount(100, new CouponValidator('COUPON1')),
    new ValueDiscount(50, new CouponValidator('COUPON2')),
    new ValueDiscount(80, new CouponValidator('COUPON3')),
  ]);

  const order = builder.build({ items });

  expect(JSON.stringify(order.coupons)).toEqual(JSON.stringify([]));

  // add coupon
  order.addCoupon('COUPON1');
  expect(JSON.stringify(order.coupons)).toEqual(JSON.stringify(['COUPON1']));
  order.addCoupon(['COUPON2', 'COUPON3']);
  expect(JSON.stringify(order.coupons)).toEqual(JSON.stringify(coupons));

  // remove coupon
  order.removeCoupon(['COUPON1', 'COUPON3']);
  expect(JSON.stringify(order.coupons)).toEqual(JSON.stringify(['COUPON2']));

  order.removeCoupon('COUPON2');
  expect(JSON.stringify(order.coupons)).toEqual(JSON.stringify([]));

  order.addCoupon('COUPON2');
  expect(JSON.stringify(order.coupons)).toEqual(JSON.stringify(['COUPON2']));

  // add item
  order.addItem({
    id: 'ItemD',
    name: '213',
    quantity: 20,
    unitPrice: 100,
  });

  expect(JSON.stringify(order.items)).toEqual(JSON.stringify([
    ...items,
    {
      id: 'ItemD',
      name: '213',
      quantity: 20,
      unitPrice: 100,
    },
  ]));

  order.addItem([
    {
      id: 'ItemE',
      name: 'E',
      quantity: 20,
      unitPrice: 2.99,
    },
    {
      id: 'ItemF',
      name: 'F',
      quantity: 1,
      unitPrice: 100,
    },
  ]);

  expect(JSON.stringify(order.items)).toEqual(JSON.stringify([
    ...items,
    {
      id: 'ItemD',
      name: '213',
      quantity: 20,
      unitPrice: 100,
    },
    {
      id: 'ItemE',
      name: 'E',
      quantity: 20,
      unitPrice: 2.99,
    },
    {
      id: 'ItemF',
      name: 'F',
      quantity: 1,
      unitPrice: 100,
    },
  ]));

  order
    .removeItem('ItemD', 1)
    .removeItem({ id: 'ItemE', quantity: 10 })
    .removeItem([
      { id: 'ItemA', quantity: 5 },
      { id: 'ItemF', quantity: 2 },
    ]);

  expect(JSON.stringify(order.items)).toEqual(JSON.stringify([
    {
      id: 'ItemA',
      name: 'Hello',
      unitPrice: 100,
      quantity: 5,
    }, {
      id: 'ItemB',
      name: 'Foo',
      unitPrice: 70,
      quantity: 1,
    }, {
      id: 'ItemC',
      name: 'Foo',
      unitPrice: 70,
      quantity: 2,
    }, {
      id: 'ItemD',
      name: '213',
      quantity: 19,
      unitPrice: 100,
    }, {
      id: 'ItemE',
      name: 'E',
      quantity: 10,
      unitPrice: 2.99,
    },
  ]));

  const subOrder = order
    .addCoupon(['COUPON1', 'COUPON2', 'COUPON3']).subOrder({
      subCoupons: ['COUPON2', 'COUPON1'],
      subItems: [],
    });

  expect(JSON.stringify(subOrder.coupons)).toEqual(JSON.stringify(['COUPON2', 'COUPON1']))

  const subOrder2 = order.subOrder({});

  expect(subOrder2.items.length).toEqual(0);

  const subOrder3 = order.subOrder({ subItems: ['ItemB', 'ItemA'] });

  expect(JSON.stringify(subOrder3.items)).toEqual(JSON.stringify([
    {
      id: 'ItemA',
      name: 'Hello',
      unitPrice: 100,
      quantity: 5,
    }, {
      id: 'ItemB',
      name: 'Foo',
      unitPrice: 70,
      quantity: 1,
    },
  ]))

  const matchedItems = getOnlyMatchedItems(subOrder, [new PriceThreshold(10)]);

  expect(JSON.stringify(matchedItems)).toEqual(JSON.stringify(subOrder.items));

  const builder2 = new OrderBuilder({
    policies: [
      new ItemGiveawayDiscount(1, new ItemIncluded({
        items: [],
        conditions: [],
      }), { onlyMatched: true }),
    ],
  });

  const order2 = builder2.build({ items });

  expect(order2.price).toEqual(1210);

  const builder3 = new OrderBuilder({
    policies: [
      new ItemGiveawayDiscount(
        1,
        new ItemIncluded({
          items: ['ItemC', 'ItemD'],
          conditions: [],
        }),
        { onlyMatched: true, strategy: 'HIGH_PRICE_FIRST' }
      ),
    ],
  });

  const items2 = [{
    id: 'ItemA',
    name: 'Hello',
    unitPrice: 100,
    quantity: 10,
  }, {
    id: 'ItemB',
    name: 'Foo',
    unitPrice: 70,
    quantity: 1,
  }, {
    id: 'ItemC',
    name: 'Foo',
    unitPrice: 70,
    quantity: 2,
  }, {
    id: 'ItemD',
    name: 'Foo',
    unitPrice: 50,
    quantity: 2,
  }];

  const order3 = builder3.build({ items: items2 });

  // 1310 - 70 = 1240
  expect(order3.price).toEqual(1240);

  const builder4 = new OrderBuilder({
    policies: [new ItemGiveawayDiscount(1)],
  });

  const order4 = builder4.build({ items: items2 });

  // 1310 - 50 = 1260
  expect(order4.price).toEqual(1260);

  try {
    new OrderBuilder({
      policies: [new StepPercentageDiscount(2, 1.1)],
    });
  } catch (ex: any) {
    expect(ex).toBeInstanceOf(Error);
    expect(ex.message).toEqual('Invalid percentage value.');
  }

  const builder5 = new OrderBuilder({
    policies: [new StepPercentageDiscount(500, 0.9)],
  });

  const order5 = builder5.build({ items: items2 });

  // 1310 * 0.81 = 1061.1
  expect(Math.round(order5.price)).toEqual(1061);

  const builder6 = new OrderBuilder({
    policies: [
      new StepPercentageDiscount(500, 0.9, [new PriceThreshold(20000)]),
    ],
  });

  const order6 = builder6.build(order5);

  expect(Math.round(order6.price)).toEqual(1310);

  const builder7 = new OrderBuilder({
    policies: [new StepValueDiscount(2, 20, { stepUnit: 'quantity' })],
  });

  const order7 = builder7.build({ items: items2 });

  // 1310 - 20 * floor(15 / 2) = 1310 - 140 = 1170
  expect(order7.price).toEqual(1170);

  const builder8 = new OrderBuilder({
    policies: [new StepValueDiscount(
      2,
      20,
      new QuantityThreshold(16),
      { stepUnit: 'quantity' },
    )],
  });

  const order8 = builder8.build({ items: items2 });

  // 1310
  expect(order8.price).toEqual(1310);

  it('should allow to give config property', () => {
    const builder9 = new OrderBuilder({
      policies: [],
      discountMethod: 'quantity-weighted-average',
      roundStrategy: ['every-calculation', 2],
    });

    expect(builder9.config).toBeDefined();
    expect(builder9.config).toBeInstanceOf(OrderConfig);
    expect(builder9.config.discountMethod).toBeDefined();

    const builder10 = new OrderBuilder(builder9);

    expect(builder10.config).toBeDefined();
    expect(builder10.config).toBeInstanceOf(OrderConfig);
    expect(builder10.config.discountMethod).toBeDefined();
    expect(builder10.config).toEqual(builder9.config);
  });

  const valueDiscountPolicy = new ValueDiscount(20, { id: 'VALUE_DISCOUNT' });
  const builder11 = new OrderBuilder({
    policies: [valueDiscountPolicy],
    discountMethod: 'price-weighted-average',
    roundStrategy: 'final-price-only',
  });

  expect(builder11.getPolicy('VALUE_DISCOUNT')).toEqual(valueDiscountPolicy);

  it('should get a policyMap', () => {
    const policy1 = new ValueDiscount(200);
    const policy2 = new ValueDiscount(10);
    const policy3 = new ValueDiscount(20);

    const builder = new OrderBuilder({
      policies: [
        policy1,
        [policy2, policy3],
      ],
    });

    const order = builder.build({ items: [] });

    expect(order.itemRecords.length).toEqual(order.itemQuantity);
  });

  it('should create a no-round quantity-weighted-discountMethod order-builder', () => {
    const builder = new OrderBuilder({
      policies: [new PercentageDiscount(0.87)],
      discountMethod: 'quantity-weighted-average',
      roundStrategy: 'no-round',
    });

    const order = builder.build({
      items: [
        {
          id: 'ItemA',
          name: 'Hello',
          unitPrice: 100,
          quantity: 5,
        }, {
          id: 'ItemB',
          name: 'Foo',
          unitPrice: 70,
          quantity: 1,
        }, {
          id: 'ItemC',
          name: 'Foo2',
          unitPrice: 10,
          quantity: 1,
        },
      ],
    });

    // 580 * 0.87 = 504.6
    expect(order.price).toEqual(504.6);
    expect(order.discountValue).toEqual(75.4);
    // (75.4 / 7) = 10.7714286 (Prediction-discount in every items)
    // but 'ItemC' has only $10 to split out
    // so other items have to digest more shared-discount.
    // (75.4 - 10) / (7 - 1) === 10.9 (Items except for 'ItemC')
    expect(order.itemRecords.every(record => (
      record.originItem.id === 'ItemC'
        ? record.discountValue === 10
        : record.discountValue === 10.9
    ))).toEqual(true);

    const builder2 = new OrderBuilder({
      policies: [
        [new PercentageDiscount(0.85), new ValueDiscount(50)],
      ],
      discountMethod: 'quantity-weighted-average',
      roundStrategy: 'no-round',
    });

    const order2 = builder2.build({
      items: [
        {
          id: 'ItemA',
          name: 'Hello',
          unitPrice: 100,
          quantity: 5,
        }, {
          id: 'ItemB',
          name: 'Foo',
          unitPrice: 70,
          quantity: 1,
        },
      ],
    });

    // 570 * 0.85 = 484.5
    expect(order2.price).toEqual(484.5);
    // 85.5 / 6 = 14.25
    expect(order2.itemRecords.every(record => record.discountValue === 14.25)).toEqual(true);

    const builder3 = new OrderBuilder({
      policies: [
        [],
      ],
      discountMethod: 'quantity-weighted-average',
      roundStrategy: 'no-round',
    });

    const order3 = builder3.build({
      items: [
        {
          id: 'ItemA',
          name: 'Hello',
          unitPrice: 100,
          quantity: 5,
        }, {
          id: 'ItemB',
          name: 'Foo',
          unitPrice: 70,
          quantity: 1,
        },
      ],
    });

    expect(order3.price).toEqual(570);
    expect(order3.itemRecords.every(record => record.discountValue === 0)).toEqual(true);
    expect(order3.discounts.length).toEqual(0);
  })

  it('README USAGE', () => {
    const policy1 = new ValueDiscount(100, { id: 'DISCOUNT_1' });
    const policy2 = new PercentageDiscount(0.8, { id: 'DISCOUNT_2' });

    // Initialize a order-builder.
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

    expect(builder.getPolicy('DISCOUNT_1')).toEqual(undefined);
    expect(builder.getPolicy('DISCOUNT_2')).toEqual(policy2);
    expect(order.price).toEqual(200);
    expect(JSON.stringify(order.itemRecords)).toEqual(JSON.stringify([
      {
        itemId: 'ItemA-1',
        originItem: { id: 'ItemA', name: 'Foo', unitPrice: 100 },
        initialValue: 100,
        discountValue: 20,
        finalPrice: 80,
        discountRecords: [{ policyId: 'DISCOUNT_2', itemId: 'ItemA-1', discountValue: 20 }],
        appliedPolicies: [policy2],
      },
      {
        itemId: 'ItemA-2',
        originItem: { id: 'ItemA', name: 'Foo', unitPrice: 100 },
        initialValue: 100,
        discountValue: 20,
        finalPrice: 80,
        discountRecords: [{ policyId: 'DISCOUNT_2', itemId: 'ItemA-2', discountValue: 20 }],
        appliedPolicies: [policy2],
      },
      {
        itemId: 'ItemB-1',
        originItem: { id: 'ItemB', name: 'Bar', unitPrice: 50 },
        initialValue: 50,
        discountValue: 10,
        finalPrice: 40,
        discountRecords: [{ policyId: 'DISCOUNT_2', itemId: 'ItemB-1', discountValue: 10 }],
        appliedPolicies: [policy2],
      },
    ]));
  })
});

/** Discount */
describe('Discount', () => {
  const tz = Date.now();
  const now = jest.spyOn(Date, 'now');
  const hijackedPolicyId = `POLICY_${tz}`;

  now.mockImplementation(() => tz);

  it('ValueDiscount', () => {
    const valueDiscount = new ValueDiscount(100);

    expect(valueDiscount).toBeDefined();
    expect(valueDiscount).toBeInstanceOf(ValueDiscount);
    expect(valueDiscount.discount()).toEqual(100);

    const valueDiscount2 = new ValueDiscount(20, { id: 'VALUE_DISCOUNT_2' });

    expect(valueDiscount2).toBeDefined();
    expect(valueDiscount2).toBeInstanceOf(ValueDiscount);
    expect(valueDiscount2.discount()).toEqual(20);
  })

  it('PercentageDiscount', () => {
    try {
      new PercentageDiscount(100);
    } catch (ex: any) {
      expect(ex).toBeInstanceOf(Error);
      expect(ex.message).toEqual('Invalid percentage value.');
    }

    const percentageDiscount = new PercentageDiscount(0.1, { id: 'PERCENTAGE_DISCOUNT' });
    const itemValue = 100;

    expect(percentageDiscount).toBeDefined();
    expect(percentageDiscount).toBeInstanceOf(PercentageDiscount);
    expect(percentageDiscount.discount(itemValue)).toEqual(90);

    const percentageDiscount2 = new PercentageDiscount(0.8);

    expect(percentageDiscount2).toBeDefined();
    expect(percentageDiscount2).toBeInstanceOf(PercentageDiscount);
    expect(percentageDiscount2.discount(itemValue)).toEqual(20); // 100 * (1 - 0.8) = 20
  })

  it('StepDiscount', () => {
    const discount = new StepValueDiscount(500, 50);

    expect(discount).toBeDefined();
    expect(discount).toBeInstanceOf(StepValueDiscount);

    expect(discount.discount(1000)).toEqual(100);
    expect(discount.discount(1001)).toEqual(100);
    expect(discount.discount(999)).toEqual(50);
  })
})

describe('Condition', () => {
  const items = [
    {
      id: 'A',
      name: '外套A',
      unitPrice: 1000,
      quantity: 1,
    },
    {
      id: 'B',
      name: '外套B',
      unitPrice: 1500,
      quantity: 1,
    },
    {
      id: 'C',
      name: '鞋子C',
      unitPrice: 2000,
      quantity: 1,
    },
    {
      id: 'D',
      name: '鞋子D',
      unitPrice: 2500,
      quantity: 1,
    },
    {
      id: 'E',
      name: '鞋子E',
      unitPrice: 3000,
      quantity: 1,
    },
    {
      id: 'F',
      name: '飾品F',
      unitPrice: 4000,
      quantity: 1,
    },
    {
      id: 'G',
      name: '飾品G',
      unitPrice: 5000,
      quantity: 1,
    },
    {
      id: 'H',
      name: '飾品H',
      unitPrice: 6000,
      quantity: 1,
    },
    {
      id: 'I',
      name: '飾品I',
      unitPrice: 6500,
      quantity: 1,
    },
  ];

  const builder = new OrderBuilder({
    policies: [
      new PercentageDiscount(
        0.9,
        new QuantityRequired(5),
      ),
    ],
  });

  const order = builder.build({ items });

  expect(order.price).toEqual(28350); // 31500 * 0.9 = 28350

  const builder2 = new OrderBuilder({
    policies: [
      new PercentageDiscount(0.9, [
        new ItemRequired({ id: 'A', quantity: 2 }),
        new QuantityRequired(3, [
          'A',
          'B',
          'C',
          'D',
          'E',
          'F',
        ]),
      ]),
    ],
  });

  const order2 = builder2.build({ items });

  expect(order2.price).toEqual(31500);

  const builder3 = new OrderBuilder({
    policies: [
      new PercentageDiscount(0.9, [
        // 滿件符合 2A + (B|C)
        new QuantityRequired(3, [
          { id: 'A', leastQuantity: 2 },
          { id: 'B' },
          'C',
        ]),
      ]),
    ],
  });

  const order3 = builder3.build({ items });

  expect(order3.price).toEqual(31500);

  const builder4 = new OrderBuilder({
    policies: [
      new PercentageDiscount(0.9, [
        new QuantityRequired(11),
      ]),
    ],
  });

  const order4 = builder4.build({ items });

  expect(order4.price).toEqual(31500);

  const builder5 = new OrderBuilder({
    policies: [
      new ValueDiscount(100, { id: '1' }),
      new ValueDiscount(100, { id: '2' }),
      new ValueDiscount(100, { id: '3' }),
      [new ValueDiscount(100, { id: '4' }), new ValueDiscount(100, { id: '5' })],
      new ValueDiscount(
        10,
        new ItemIncluded({
          items: [],
          conditions: [new PriceThreshold(1000000)],
        }),
      ),
    ],
  });

  const order5 = builder5
    .removePolicy(['1', '2', '3', '4', '5'])
    .build({ items });

  expect(order5.price).toEqual(31500);

  const builder6 = new OrderBuilder({
    policies: [
      new ValueDiscount(100, new ItemExcluded({
        items: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
      })),
    ],
  });

  const order6 = builder6.build({ items });

  expect(order6.price).toEqual(31500);

  const builder7 = new OrderBuilder({
    policies: [
      new ValueDiscount(100, new ItemExcluded({
        items: 'A',
      })),
    ],
  });

  const order7 = builder7.build({ items: [] });

  expect(order7.price).toEqual(0);

  const builder8 = new OrderBuilder({
    policies: [
      new ValueDiscount(100, new ItemExcluded({
        items: 'A',
      })),
      new ValueDiscount(100, new ItemExcluded({
        items: [],
      })),
      new ValueDiscount(100, new ItemExcluded({
        items: 'A',
        conditions: [new PriceThreshold(100000)],
      })),
    ],
  });

  const order8 = builder8.build({ items });

  expect(order8.price).toEqual(31400);
})

describe('Logistics', () => {
  it('logistics', () => {
    const items = [
      {
        id: 'A',
        name: '外套A',
        unitPrice: 1000,
        quantity: 1,
        category: 'jacket',
        brand: 'AJE',
      },
    ];

    const order = new OrderBuilder({
      logistics: {
        price: 200,
        threshold: 2000,
        name: 'custom logistics name',
      },
    }).build({
      items,
    });

    // The condition of free-logistics is not satisfied.
    expect(order.price).toEqual(1000 + 200);
    expect(JSON.stringify(order.logisticsRecord)).toEqual(
      JSON.stringify({
        itemId: '__LOGISTICS__-1',
        originItem: {
          id: '__LOGISTICS__',
          name: 'custom logistics name',
          unitPrice: 200,
        },
        initialValue: 200,
        discountValue: 0,
        finalPrice: 200,
        discountRecords: [],
        appliedPolicies: [],
      })
    );

    const order2 = new OrderBuilder()
      .setLogistics({
        price: 200,
        name: 'ECat',
        freeConditions: new ItemIncluded({
          items: 'A',
        }),
      })
      .build({ items: [] });

    expect(order2.price).toEqual(200);

    const order3 = new OrderBuilder()
      .setLogistics({
        price: 300,
        name: 'ECat',
        freeConditions: [
          new PriceThreshold(2000),
          new ItemIncluded({ items: 'A' }),
        ],
      }).build({
        items: [
          {
            id: 'A',
            name: 'a',
            quantity: 1,
            unitPrice: 2001,
          },
        ],
      });

    expect(order3.price).toEqual(2001);
  });

  it('should return null', () => {
    expect(new OrderBuilder().build({
      items: [
        {
          id: '1',
          name: '1',
          quantity: 1,
          unitPrice: 200,
        },
      ],
    }).logisticsRecord).toEqual(null);
  });
});

describe('Clone OrderBuilder', () => {
  it('should create a new instance of OrderBuilder', () => {
    const items = [
      {
        id: 'A',
        name: '外套A',
        unitPrice: 1000,
        quantity: 1,
        category: 'jacket',
        brand: 'AJE',
      },
    ];

    const order = new OrderBuilder({
      logistics: {
        price: 200,
        threshold: 2000,
        name: 'custom logistics name',
      },
    }).build({ items });

    const builder2 = order.builder.clone();

    expect(builder2 === order.builder).toBeFalsy();

    try {
      new OrderBuilder()
      .addPolicy(new ValueDiscount(200))
      .build({ items })
      .builder
      .addPolicy(new ValueDiscount(50))
    } catch (ex: any) {
      expect(ex.message).toBe('Policy is immutable if builder.build was called. You should call builder.clone first.');
    }

    expect(
      new OrderBuilder()
      .addPolicy(new ValueDiscount(200))
      .build({ items })
      .builder
      .clone() // !! difference
      .addPolicy(new ValueDiscount(50))
      .build({ items })
      .price
    ).toBe(1000 - 200 - 50);
  });
})