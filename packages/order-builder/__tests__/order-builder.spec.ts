import {
  OrderBuilder,
  Discount,
  PercentageDiscount,
  ValueDiscount,
  CouponValidator,
  ItemRequired,
  PriceThreshold,
} from '../src';
import { Order } from '../src/core/order';

/** OrderBuilder */
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
        'Policy is immutable if builder.build was called.'
      );
    }

    try {
      builder.removePolicy('TESTING');
    } catch (ex: any) {
      expect(ex).toBeInstanceOf(Error);
      expect(ex?.message).toEqual(
        'Policy is immutable if builder.build was called.'
      );
    }

    const memberDiscount = new PercentageDiscount(0.8, { id: 'MEMBER_DISCOUNT' });

    const builder3 = new OrderBuilder({
      policies: [
        new ValueDiscount(100),
        new ValueDiscount(80, [new PriceThreshold(200)], {
          id: 'SEASONAL_DISCOUNT',
        }),
      ],
    });

    const testDiscount = new ValueDiscount(10, [new PriceThreshold(500)], { id: 'TESTING' });

    builder3.addPolicy([
      testDiscount,
      memberDiscount,
    ]);

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

    expect(order5.price).toEqual(570); // 1500 * 0.5 - 100 - 80 = 570
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
        'Policy is immutable if builder.build was called.'
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

    // check discount records
    const discountRecords = order2.discounts;

    expect(JSON.stringify(discountRecords)).toEqual(JSON.stringify([
      { id: 'MEMBER_DISCOUNT', value: 0.8, type: 'PERCENTAGE', discount: 214, conditions: [] },
      { id: 'SEASONAL_DISCOUNT', value: 100, type: 'VALUE', discount: 100, conditions: [{ type: 'THRESHOLD', value: 500 }] },
      { id: discountRecords[2].id, value: 500, type: 'VALUE', discount: 500, conditions: [{ type: 'THRESHOLD', value: 300 }, { type: 'ITEM_REQUIRED', items: [{ id: 'ItemA', quantity: 2 }, { id: 'ItemB', quantity: 1 }] }] },
    ]));

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

  expect(order.price).toEqual(989); // 1210 * 0.9 - 100 = 989

  // add coupon
  order.addCoupon('COUPON1');
  expect(JSON.stringify(order.coupons)).toEqual(JSON.stringify(['COUPON1']));
  expect(order.price).toEqual(889); // 1210 * 0.9 - 100 - 100 = 889
  order.addCoupon(['COUPON2', 'COUPON3']);
  expect(JSON.stringify(order.coupons)).toEqual(JSON.stringify(coupons));
  expect(order.price).toEqual(759); // 1210 * 0.9 - 100 - 100 - 50 - 80 = 759;

  // remove coupon
  order.removeCoupon(['COUPON1', 'COUPON3']);
  expect(JSON.stringify(order.coupons)).toEqual(JSON.stringify(['COUPON2']));
  expect(order.price).toEqual(939); // 1210 * 0.9 - 100 - 50 = 939;

  order.removeCoupon('COUPON2');
  expect(JSON.stringify(order.coupons)).toEqual(JSON.stringify([]));
  expect(order.price).toEqual(989); // 1210 * 0.9 - 100 = 989;

  order.addCoupon('COUPON2');
  expect(JSON.stringify(order.coupons)).toEqual(JSON.stringify(['COUPON2']));
  expect(order.price).toEqual(939); // 1210 * 0.9 - 100 - 50 = 939;

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

  expect(order.price).toEqual(2739); // 3210 * 0.9 - 100 - 50 = 2739

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

  expect(order.price).toEqual(2882.82); // 3369.8 * 0.9 - 100 - 50 = 2882.82

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

  expect(order.itemValue).toEqual(2639.9) // itemValue 500 + 70 + 140 + 1900 + 29.9 = 2639.9
  expect(order.price).toEqual(2225.91) // 2639.9 * 0.9 - 100 - 50 = 2225.91
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
    expect(JSON.stringify(valueDiscount.description())).toEqual(JSON.stringify({
      id: hijackedPolicyId,
      value: 100,
      type: Discount.VALUE,
      discount: 100,
      conditions: [],
    }));

    const valueDiscount2 = new ValueDiscount(20, { id: 'VALUE_DISCOUNT_2' });

    expect(valueDiscount2).toBeDefined();
    expect(valueDiscount2).toBeInstanceOf(ValueDiscount);
    expect(valueDiscount2.discount()).toEqual(20);
    expect(JSON.stringify(valueDiscount2.description())).toEqual(JSON.stringify({
      id: 'VALUE_DISCOUNT_2',
      value: 20,
      type: Discount.VALUE,
      discount: 20,
      conditions: [],
    }));
  })

  it('PercentageDiscount', () => {
    try {
      new PercentageDiscount(100);
    } catch (ex: any) {
      expect(ex).toBeInstanceOf(Error);
      expect(ex.message).toEqual('Invalid percentage-discount value.');
    }

    const percentageDiscount = new PercentageDiscount(0.1, { id: 'PERCENTAGE_DISCOUNT' });
    const itemValue = 100;

    expect(percentageDiscount).toBeDefined();
    expect(percentageDiscount).toBeInstanceOf(PercentageDiscount);
    expect(percentageDiscount.discount(itemValue)).toEqual(90);
    expect(JSON.stringify(percentageDiscount.description(itemValue))).toEqual(JSON.stringify({
      id: 'PERCENTAGE_DISCOUNT',
      value: 0.1,
      type: Discount.PERCENTAGE,
      discount: 90,
      conditions: [],
    }));

    const percentageDiscount2 = new PercentageDiscount(0.8);

    expect(percentageDiscount2).toBeDefined();
    expect(percentageDiscount2).toBeInstanceOf(PercentageDiscount);
    expect(percentageDiscount2.discount(itemValue)).toEqual(20); // 100 * (1 - 0.8) = 20
    expect(JSON.stringify(percentageDiscount2.description(itemValue))).toEqual(JSON.stringify({
      id: hijackedPolicyId,
      value: 0.8,
      type: Discount.PERCENTAGE,
      discount: 20,
      conditions: [],
    }));
  })
})
