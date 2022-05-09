import { Order, OrderBuilder } from '../src/order-builder';
import { PercentageDiscount, ValueDiscount } from '../src/policies';
import { CouponValidator, ItemRequired, PriceThreshold } from '../src/conditions';

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

    expect(order3.getPrice()).toEqual(722); // 1140 * 0.8 - 100 - 80 - 10 = 722

    const builder4 = new OrderBuilder(builder3);

    const order4 = builder4
      .removePolicy([testDiscount, memberDiscount])
      .build({ items: order3.items });

    expect(order4.getPrice()).toEqual(960); // 1140 - 100 - 80 = 960

    order4.removeItem('ItemB', 1);

    expect(order4.getPrice()).toEqual(890) // 1070 - 100 - 80 = 890
  });

  describe([
    '1. [會員優惠:MEMBER_DISCOUNT]: 八折',
    '2. [季度優惠:SEASONAL_DISCOUNT]: 滿500元折抵100元',
    '3. (滿額 300元) 或是 (購買 ItemA(*2) 和 ItemB(*1)) 可以折抵500元',
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

    expect(order1.getPrice()).toEqual(700); // 1000 * 0.8 - 100 = 700

    order1.addCoupon('DISCOUNT_50');

    expect(order1.getPrice()).toEqual(650); // 1000 * 0.8 - 100 - 50 = 650

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
    expect(order2.getPrice()).toEqual(256); // 1070 * 0.8 - 100 - 500 = 256
    expect(order2.getDiscountValue()).toEqual(814) // 1070 * 0.2 + 100 + 500 = 814

    // check discount records
    expect(JSON.stringify(order2.getDiscounts())).toEqual(JSON.stringify([
      { id: 'MEMBER_DISCOUNT', value: 0.8, type: 'PERCENTAGE', discount: 214, conditions: [] },
      { id: 'SEASONAL_DISCOUNT', value: 100, type: 'VALUE', discount: 100, conditions: [{ value: 500, type: 'THRESHOLD' }] },
      { id: '', value: 500, type: 'VALUE', discount: 500, conditions: [{ value: 300, type: 'THRESHOLD' }, { type: 'ITEM_REQUIRED', items: [{ id: 'ItemA', quantity: 2 }, { id: 'ItemB', quantity: 1 }] }] },
    ]));

    // On Refund
    order2.removeItem('ItemB', 1);

    expect(order2.getPrice()).toEqual(700); // 1000 * 0.8 - 100 = 700

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

    expect(order3.getPrice()).toEqual(890); // 1000 - 100 - 10 = 890
  })
});
